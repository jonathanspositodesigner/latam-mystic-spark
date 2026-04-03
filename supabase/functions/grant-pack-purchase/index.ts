import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.replace("Bearer ", "").trim();

    if (!token) {
      return json({ success: false, error: "missing_auth" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: requesterData, error: requesterError } = await supabaseAdmin.auth.getUser(token);

    if (requesterError || !requesterData.user) {
      return json({ success: false, error: "invalid_auth" }, 401);
    }

    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      throw roleError;
    }

    if (!adminRole) {
      return json({ success: false, error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const packSlug = String(body?.packSlug || "").trim();

    if (!email || packSlug !== "upscaller-arcano-v3") {
      return json({ success: false, error: "invalid_payload" }, 400);
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (targetError) {
      throw targetError;
    }

    if (!targetProfile) {
      return json({ success: false, error: "user_not_found" }, 404);
    }

    const { data: existingPurchase, error: existingError } = await supabaseAdmin
      .from("user_pack_purchases")
      .select("id")
      .eq("user_id", targetProfile.id)
      .eq("pack_slug", "upscaller-arcano-v3")
      .eq("payment_status", "active")
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    if (!existingPurchase || existingPurchase.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from("user_pack_purchases")
        .insert({
          user_id: targetProfile.id,
          pack_slug: "upscaller-arcano-v3",
          payment_status: "active",
          gateway: "manual",
          plan_type: "v3",
          external_id: crypto.randomUUID(),
        });

      if (insertError) {
        throw insertError;
      }
    }

    const { data: purchases, error: purchasesError } = await supabaseAdmin
      .from("user_pack_purchases")
      .select("pack_slug, payment_status, plan_type, gateway")
      .eq("user_id", targetProfile.id)
      .in("pack_slug", ["upscaller-arcano", "upscaller-arcano-v3", "upscaller-arcano-vitalicio"]);

    if (purchasesError) {
      throw purchasesError;
    }

    return json({
      success: true,
      email,
      implied_access: ["upscaller-arcano-v3", "upscaller-arcano"],
      purchases,
    });
  } catch (error: any) {
    console.error("[grant-pack-purchase] Error:", error);
    return json({ success: false, error: error?.message || "unknown_error" }, 500);
  }
});