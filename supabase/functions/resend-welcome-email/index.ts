import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── SendPulse token cache ──
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) return cachedToken.token;
  const res = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: Deno.env.get("SENDPULSE_CLIENT_ID"),
      client_secret: Deno.env.get("SENDPULSE_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) throw new Error(`SendPulse token error: ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3_300_000 };
  return data.access_token;
}

function buildWelcomeEmailHtml(appUrl: string, productType: "vitalicio" | "creditos", creditLabel?: string): string {
  const isCreditos = productType === "creditos";
  const productName = isCreditos ? `Upscaler Arcano ${creditLabel}` : "Upscaler Arcano V3";
  const description = isCreditos
    ? `Tu compra del pack <strong style="color:#ffffff;">${productName}</strong> fue confirmada. Tus créditos ya están disponibles.`
    : `Tu compra del <strong style="color:#ffffff;">Upscaler Arcano V3</strong> fue confirmada exitosamente.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0221;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0221;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;background-color:#1A0A2E;border-radius:12px;border:1px solid rgba(139,92,246,0.2);padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="color:#ffffff;font-size:24px;margin:0;">🎉 ¡Bienvenido a Arcano App!</h1>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">${description}</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            Tu cuenta ya está creada con el correo de compra. Solo necesitas establecer tu contraseña para acceder a la plataforma.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <p style="color:#c4b5fd;font-size:14px;line-height:1.6;margin:0;text-align:center;">
            <strong style="color:#ffffff;">Paso 1:</strong> Haz clic en el botón de abajo<br/>
            <strong style="color:#ffffff;">Paso 2:</strong> Ingresa tu correo de compra<br/>
            <strong style="color:#ffffff;">Paso 3:</strong> Crea tu contraseña personal<br/>
            <strong style="color:#ffffff;">Paso 4:</strong> ¡Listo! Disfruta del ${productName}
          </p>
        </td></tr>
        <tr><td align="center" style="padding:24px 0;">
          <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
            Acceder a Arcano App
          </a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid rgba(139,92,246,0.2);">
          <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
            Si tienes alguna duda, responde a este correo. ¡Estamos para ayudarte!
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Verify admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: roleData } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleData) return json({ error: "forbidden" }, 403);

  const { purchase_id, customer_email, pack_slug } = await req.json();
  if (!purchase_id || !customer_email) return json({ error: "missing_fields" }, 400);

  try {
    const APP_URL = "https://arcanoapp-es.voxvisual.com.br";
    const isCreditos = pack_slug?.startsWith("upscaler-creditos");
    const creditLabels: Record<string, string> = {
      "upscaler-creditos-starter": "Starter",
      "upscaler-creditos-pro": "Pro",
      "upscaler-creditos-ultimate": "Ultimate",
    };
    const emailType = isCreditos ? "creditos" : "vitalicio";
    const creditLabel = isCreditos ? creditLabels[pack_slug] || "" : undefined;
    const htmlContent = buildWelcomeEmailHtml(APP_URL, emailType as any, creditLabel);

    const sendPulseToken = await getSendPulseToken();
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

    const emailRes = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sendPulseToken}`,
      },
      body: JSON.stringify({
        email: {
          html: htmlBase64,
          text: "",
          subject: `🎉 ¡Bienvenido a Arcano App! Tu ${isCreditos ? `pack ${creditLabel}` : "Upscaler Arcano V3"} está listo`,
          from: { name: "Arcano App", email: "contato@voxvisual.com.br" },
          to: [{ name: customer_email, email: customer_email }],
        },
      }),
    });

    if (emailRes.ok) {
      await supabaseAdmin.from("user_pack_purchases")
        .update({ welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() })
        .eq("id", purchase_id);
      return json({ success: true });
    } else {
      const errBody = await emailRes.text();
      console.error("[resend-welcome] SendPulse error:", errBody);
      return json({ error: "email_send_failed", detail: errBody }, 500);
    }
  } catch (err: any) {
    console.error("[resend-welcome] Error:", err.message);
    return json({ error: err.message }, 500);
  }
});
