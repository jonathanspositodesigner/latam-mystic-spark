import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Welcome email HTML (same as stripe-webhook) ──
function buildWelcomeEmailHtml(appUrl: string): string {
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
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            Tu compra del <strong style="color:#ffffff;">Upscaler Arcano V3</strong> fue confirmada exitosamente.
          </p>
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
            <strong style="color:#ffffff;">Paso 4:</strong> ¡Listo! Disfruta del Upscaler Arcano V3
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

// ── SendPulse ──
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    const customerEmail = (email || "").trim().toLowerCase();
    if (!customerEmail) throw new Error("email required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Create user
    const tempPassword = customerEmail;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { source: "stripe_purchase" },
    });

    if (createError) throw createError;
    const userId = newUser.user.id;

    // 2. Upsert profile
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: customerEmail,
      email_verified: true,
      password_changed: false,
      has_logged_in: false,
    }, { onConflict: "id" });

    // 3. Grant access
    await supabaseAdmin.from("user_pack_purchases").insert({
      user_id: userId,
      pack_slug: "upscaller-arcano-v3",
      payment_status: "active",
      gateway: "stripe",
      plan_type: "v3",
      external_id: "test_simulation",
      amount: null,
    });

    // 4. Send welcome email
    const APP_URL = "https://arcanoapp-es.voxvisual.com.br";
    const htmlContent = buildWelcomeEmailHtml(APP_URL);
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
          subject: "🎉 ¡Bienvenido a Arcano App! Tu Upscaler Arcano V3 está listo",
          from: { name: "Arcano App", email: "contato@voxvisual.com.br" },
          to: [{ name: customerEmail, email: customerEmail }],
        },
      }),
    });

    const emailResult = await emailRes.json();

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      email: customerEmail,
      access_granted: true,
      email_sent: emailRes.ok,
      email_result: emailResult,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
