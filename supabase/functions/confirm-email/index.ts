import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// TODO: Update this URL after publishing or setting a custom domain
const APP_URL = "https://id-preview--ac4446a0-f9d0-4d56-89ef-84dbe9ac5211.lovable.app";

function buildSuccessHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Correo confirmado!</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0221;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0221;padding:40px 20px;min-height:100vh;">
    <tr><td align="center" valign="middle">
      <table width="100%" style="max-width:500px;background-color:#1A0A2E;border-radius:12px;border:1px solid rgba(139,92,246,0.2);padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="font-size:64px;margin-bottom:16px;">✅</div>
          <h1 style="color:#ffffff;font-size:24px;margin:0;">¡Correo confirmado!</h1>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            Tu cuenta ha sido activada exitosamente. Ahora puedes iniciar sesión en la plataforma.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${APP_URL}/" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
            Ir al Login
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildErrorHtml(message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error en la confirmación</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0221;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0221;padding:40px 20px;min-height:100vh;">
    <tr><td align="center" valign="middle">
      <table width="100%" style="max-width:500px;background-color:#1A0A2E;border-radius:12px;border:1px solid rgba(139,92,246,0.2);padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="font-size:64px;margin-bottom:16px;">❌</div>
          <h1 style="color:#ffffff;font-size:24px;margin:0;">Error en la confirmación</h1>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            ${message}
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${APP_URL}/" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;">
            Ir a la plataforma
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(buildErrorHtml("Token no proporcionado."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    console.log(`[confirm-email] Validating token: ${token.substring(0, 8)}...`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error("[confirm-email] Token not found:", tokenError);
      return new Response(buildErrorHtml("Enlace inválido o ya utilizado. Intenta crear una nueva cuenta."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Check if already used
    if (tokenData.used_at) {
      console.log("[confirm-email] Token already used, showing success page");
      return new Response(buildSuccessHtml(), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("[confirm-email] Token expired");
      return new Response(buildErrorHtml("Este enlace ha expirado. Intenta crear una nueva cuenta para recibir un nuevo enlace."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Mark token as used
    await supabaseAdmin
      .from("email_confirmation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Confirm user in Supabase Auth (so signInWithPassword works)
    const { error: authConfirmError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { email_confirm: true }
    );

    if (authConfirmError) {
      console.error("[confirm-email] Auth confirm error:", authConfirmError);
    } else {
      console.log(`[confirm-email] Auth email confirmed for user: ${tokenData.user_id}`);
    }

    // Update profile: email_verified + password_changed
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        email_verified: true,
        password_changed: true,
      })
      .eq("id", tokenData.user_id);

    if (updateError) {
      console.error("[confirm-email] Profile update error:", updateError);
      return new Response(buildErrorHtml("Error al confirmar el correo. Inténtalo de nuevo."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    console.log(`[confirm-email] Email confirmed for user: ${tokenData.user_id}`);

    // Show success page instead of redirect
    return new Response(buildSuccessHtml(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("[confirm-email] Error:", error);
    return new Response(buildErrorHtml("Error interno. Inténtalo más tarde."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
