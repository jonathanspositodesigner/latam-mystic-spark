import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "no_auth" }, 401);

    // Validate caller is admin
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "invalid_token" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") return json({ error: "missing_user_id" }, 400);

    // Delete dependent rows (best-effort)
    const tables = [
      "user_pack_purchases",
      "upscaler_credit_transactions",
      "upscaler_jobs",
      "user_roles",
      "premium_artes_users",
      "push_subscriptions",
      "device_signups",
    ];
    for (const t of tables) {
      const { error } = await admin.from(t).delete().eq("user_id", user_id);
      if (error) console.warn(`[delete-user-account] ${t}: ${error.message}`);
    }

    // partners cascade
    const { data: partners } = await admin.from("partners").select("id").eq("user_id", user_id);
    const partnerIds = (partners || []).map((p: any) => p.id);
    if (partnerIds.length > 0) {
      await admin.from("partner_platforms").delete().in("partner_id", partnerIds);
      await admin.from("partner_artes").delete().in("partner_id", partnerIds);
      await admin.from("partners").delete().in("id", partnerIds);
    }

    // tokens by email
    const { data: prof } = await admin.from("profiles").select("email").eq("id", user_id).maybeSingle();
    if (prof?.email) {
      await admin.from("email_confirmation_tokens").delete().eq("email", prof.email);
    }

    await admin.from("profiles").delete().eq("id", user_id);

    // Finally delete auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) {
      console.error("[delete-user-account] auth.deleteUser failed:", delErr.message);
      return json({ error: "auth_delete_failed", message: delErr.message }, 500);
    }

    return json({ success: true, deleted_user_id: user_id });
  } catch (e: any) {
    console.error("[delete-user-account] error:", e);
    return json({ error: e?.message || "unknown_error" }, 500);
  }
});
