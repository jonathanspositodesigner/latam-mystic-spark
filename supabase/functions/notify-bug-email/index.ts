import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SENDPULSE_CLIENT_ID = Deno.env.get('SENDPULSE_CLIENT_ID')!;
const SENDPULSE_CLIENT_SECRET = Deno.env.get('SENDPULSE_CLIENT_SECRET')!;

const NOTIFY_EMAIL = 'jonathandesigner1993@gmail.com';
const FROM_EMAIL = 'contato@voxvisual.com.br';
const FROM_NAME = 'Arcano App - Alertas';
const RATE_LIMIT_MINUTES = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getSendPulseToken(): Promise<string> {
  const res = await fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: SENDPULSE_CLIENT_ID,
      client_secret: SENDPULSE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`SendPulse auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function buildHtml(params: {
  errorType: string;
  errorMessage: string;
  context: Record<string, any>;
  occurrencesInWindow: number;
}): string {
  const { errorType, errorMessage, context, occurrencesInWindow } = params;
  const ctxRows = Object.entries(context)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #eee;font-weight:600;background:#fafafa">${k}</td><td style="padding:6px 12px;border:1px solid #eee"><code>${typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</code></td></tr>`)
    .join('');
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;color:#222">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
      <div style="background:#dc2626;color:#fff;padding:16px 24px"><h2 style="margin:0;font-size:18px">🚨 Bug detectado en la plataforma</h2></div>
      <div style="padding:24px">
        <p style="margin:0 0 8px"><strong>Tipo:</strong> <code>${errorType}</code></p>
        <p style="margin:0 0 16px"><strong>Mensaje:</strong> ${errorMessage}</p>
        <p style="margin:0 0 16px;color:#666;font-size:13px">Ocurrencias en los últimos ${RATE_LIMIT_MINUTES} min: <strong>${occurrencesInWindow}</strong></p>
        <h3 style="font-size:14px;margin:20px 0 8px">Contexto</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">${ctxRows}</table>
        <p style="margin:24px 0 0;font-size:12px;color:#999">Hora: ${new Date().toISOString()}</p>
      </div>
    </div></body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { errorType, errorMessage, context = {}, errorKey } = await req.json();
    if (!errorType || !errorMessage) {
      return new Response(JSON.stringify({ error: 'errorType and errorMessage required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = errorKey || errorType;
    const windowStart = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();

    // Check rate limit + count occurrences
    const { data: recent } = await supabase
      .from('bug_notification_log')
      .select('id, sent_at')
      .eq('error_key', key)
      .gte('sent_at', windowStart)
      .order('sent_at', { ascending: false });

    const occurrencesInWindow = (recent?.length || 0) + 1;

    if (recent && recent.length > 0) {
      // Already sent in window, just log occurrence and skip email
      await supabase.from('bug_notification_log').insert({
        error_key: key, error_type: errorType, error_message: errorMessage.slice(0, 500), context,
      });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'rate_limited', occurrencesInWindow }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via SendPulse
    const token = await getSendPulseToken();
    const html = buildHtml({ errorType, errorMessage, context, occurrencesInWindow });
    const subject = `🚨 [Arcano] ${errorType}`;

    const emailPayload = {
      email: {
        html: btoa(unescape(encodeURIComponent(html))),
        text: `${errorType}\n\n${errorMessage}\n\nContext: ${JSON.stringify(context, null, 2)}`,
        subject,
        from: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: NOTIFY_EMAIL }],
      },
    };

    const sendRes = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(emailPayload),
    });

    const sendBody = await sendRes.text();
    if (!sendRes.ok) {
      console.error('[notify-bug-email] SendPulse failed:', sendRes.status, sendBody);
      return new Response(JSON.stringify({ error: 'send_failed', detail: sendBody.slice(0, 200) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('bug_notification_log').insert({
      error_key: key, error_type: errorType, error_message: errorMessage.slice(0, 500), context,
    });

    return new Response(JSON.stringify({ success: true, sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[notify-bug-email] Error:', e);
    return new Response(JSON.stringify({ error: e.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
