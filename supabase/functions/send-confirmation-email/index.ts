import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: Deno.env.get("SENDPULSE_CLIENT_ID"),
      client_secret: Deno.env.get("SENDPULSE_CLIENT_SECRET"),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SendPulse token error:", errorText);
    throw new Error(`Failed to get SendPulse token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + 3300000,
  };

  return data.access_token;
}

const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com','temp-mail.org','guerrillamail.com','guerrillamail.net',
  'yopmail.com','yopmail.fr','mailinator.com','throwaway.email',
  '10minutemail.com','dispostable.com','maildrop.cc','mailsac.com',
  'burnermail.io','trashmail.com','trashmail.org','fakeinbox.com',
  'fakemail.net','getairmail.com','getnada.com','tempmailo.com',
  'disposable.email','discardmail.com','dropmail.me','meltmail.com',
  'nada.email','spambox.us','teleworm.us','rhyta.com','armyspy.com',
  'guerrillamailblock.com','sharklasers.com','grr.la',
]);

const DISPOSABLE_PATTERNS = [
  /tempmail/i, /throwaway/i, /disposable/i, /10minute/i,
  /fakemail/i, /trashmail/i, /guerrillamail/i, /mailinator/i,
  /yopmail/i, /wegwerf/i, /burnermail/i, /spammail/i,
];

function isDisposableEmailServer(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  for (const pattern of DISPOSABLE_PATTERNS) {
    if (pattern.test(domain)) return true;
  }
  return false;
}

function buildConfirmationEmailHtml(confirmLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0221;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0221;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;background-color:#1A0A2E;border-radius:12px;border:1px solid rgba(139,92,246,0.2);padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="color:#ffffff;font-size:24px;margin:0;">✉️ Confirma tu correo</h1>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            Haz clic en el botón de abajo para confirmar tu correo y activar tu cuenta.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${confirmLink}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
            Confirmar mi correo
          </a>
        </td></tr>
        <tr><td>
          <p style="color:#7c3aed;font-size:13px;text-align:center;margin:0;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </p>
          <p style="color:#a78bfa;font-size:12px;text-align:center;word-break:break-all;margin:8px 0 0 0;">
            ${confirmLink}
          </p>
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid rgba(139,92,246,0.2);margin-top:32px;">
          <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
            Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este correo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { email, user_id } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[send-confirmation-email] Sending to: ${normalizedEmail}, user: ${user_id}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If user_id is "resend" or missing, look it up from profiles
    if (!user_id || user_id === 'resend') {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      
      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user_id = profile.id;
    }

    if (isDisposableEmailServer(normalizedEmail)) {
      console.log(`[send-confirmation-email] Disposable email blocked: ${normalizedEmail}`);
      return new Response(
        JSON.stringify({ success: false, error: "Los correos temporales no están permitidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check blacklist
    const { data: blacklisted } = await supabaseAdmin
      .from("blacklisted_emails")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (blacklisted) {
      console.log(`[send-confirmation-email] Email ${normalizedEmail} is blacklisted`);
      return new Response(
        JSON.stringify({ success: false, error: "Correo bloqueado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate existing tokens for this user
    await supabaseAdmin
      .from("email_confirmation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .is("used_at", null);

    // Generate new token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .insert({ user_id, email: normalizedEmail, token, expires_at: expiresAt });

    if (insertError) {
      console.error("[send-confirmation-email] Token insert error:", insertError);
      throw new Error("Failed to create confirmation token");
    }

    // Build confirmation link
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const confirmLink = `${supabaseUrl}/functions/v1/confirm-email?token=${token}`;

    const htmlContent = buildConfirmationEmailHtml(confirmLink);

    // Send via SendPulse
    const sendPulseToken = await getSendPulseToken();
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

    const emailPayload = {
      email: {
        html: htmlBase64,
        text: "",
        subject: "✉️ Confirma tu correo - ArcanoApp",
        from: { name: "Arcano App", email: "contato@voxvisual.com.br" },
        to: [{ name: normalizedEmail, email: normalizedEmail }],
      },
    };

    const sendResponse = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sendPulseToken}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const sendResult = await sendResponse.text();
    console.log(`[send-confirmation-email] SendPulse response: ${sendResponse.status} - ${sendResult}`);

    if (!sendResponse.ok) {
      throw new Error(`SendPulse error: ${sendResult}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-confirmation-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
