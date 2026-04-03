import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const APP_URL = "https://arcanoapp-es.voxvisual.com.br";

type ConfirmationToken = {
  id: string;
  user_id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
};

function buildAppRedirect(
  status: "success" | "error",
  options: { reason?: string; email?: string } = {},
): string {
  const redirectUrl = new URL(APP_URL);
  redirectUrl.searchParams.set("confirmation", status);

  if (options.reason) {
    redirectUrl.searchParams.set("reason", options.reason);
  }

  if (options.email) {
    redirectUrl.searchParams.set("email", options.email);
  }

  return redirectUrl.toString();
}

function redirectToApp(
  status: "success" | "error",
  options?: { reason?: string; email?: string },
) {
  return Response.redirect(buildAppRedirect(status, options), 303);
}

async function finalizeConfirmation(supabaseAdmin: ReturnType<typeof createClient>, tokenData: ConfirmationToken) {
  if (!tokenData.used_at) {
    const { error: tokenUpdateError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    if (tokenUpdateError) {
      console.error("[confirm-email] Token update error:", tokenUpdateError);
      throw tokenUpdateError;
    }
  }

  const { error: authConfirmError } = await supabaseAdmin.auth.admin.updateUserById(
    tokenData.user_id,
    { email_confirm: true },
  );

  if (authConfirmError) {
    console.error("[confirm-email] Auth confirm error:", authConfirmError);
    throw authConfirmError;
  }

  const { error: profileUpsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: tokenData.user_id,
        email: tokenData.email,
        email_verified: true,
        password_changed: true,
      },
      { onConflict: "id" },
    );

  if (profileUpsertError) {
    console.error("[confirm-email] Profile upsert error:", profileUpsertError);
    throw profileUpsertError;
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return redirectToApp("error", { reason: "missing_token" });
    }

    console.log(`[confirm-email] Validating token: ${token.substring(0, 8)}...`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error: tokenError } = await supabaseAdmin
      .from("email_confirmation_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    const tokenData = data as ConfirmationToken | null;

    if (tokenError || !tokenData) {
      console.error("[confirm-email] Token not found:", tokenError);
      return redirectToApp("error", { reason: "invalid_token" });
    }

    if (!tokenData.used_at && new Date(tokenData.expires_at) < new Date()) {
      console.log("[confirm-email] Token expired");
      return redirectToApp("error", { reason: "expired_token", email: tokenData.email });
    }

    await finalizeConfirmation(supabaseAdmin, tokenData);

    console.log(`[confirm-email] Email confirmed for user: ${tokenData.user_id}`);

    return redirectToApp("success", { email: tokenData.email });
  } catch (error) {
    console.error("[confirm-email] Error:", error);
    return redirectToApp("error", { reason: "internal_error" });
  }
});
