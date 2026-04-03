import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_EMAILS = [
  "jonathandesigner1993@gmail.com",
  "jonathan.lifecazy@gmail.com",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedEmail = String(body?.email || TARGET_EMAIL).trim().toLowerCase();

    if (requestedEmail !== TARGET_EMAIL) {
      return new Response(
        JSON.stringify({ success: false, error: "email_not_allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userIds = new Set<string>();

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", requestedEmail);

    if (profilesError) {
      throw profilesError;
    }

    profiles?.forEach((profile) => userIds.add(profile.id));

    for (let page = 1; page <= 5; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });

      if (error) {
        throw error;
      }

      data.users
        .filter((user) => (user.email || "").trim().toLowerCase() === requestedEmail)
        .forEach((user) => userIds.add(user.id));

      if (data.users.length < 1000) {
        break;
      }
    }

    const ids = Array.from(userIds);

    const deleteByEmail = async (table: string) => {
      const { error } = await supabaseAdmin.from(table).delete().eq("email", requestedEmail);
      if (error) throw error;
    };

    await deleteByEmail("email_confirmation_tokens");
    await deleteByEmail("profiles");

    if (ids.length > 0) {
      const deleteByUserIds = async (table: string) => {
        const { error } = await supabaseAdmin.from(table).delete().in("user_id", ids);
        if (error) throw error;
      };

      await deleteByUserIds("device_signups");
      await deleteByUserIds("user_roles");
      await deleteByUserIds("premium_artes_users");
      await deleteByUserIds("user_pack_purchases");
      await deleteByUserIds("push_subscriptions");

      const { data: partners, error: partnersError } = await supabaseAdmin
        .from("partners")
        .select("id")
        .in("user_id", ids);

      if (partnersError) {
        throw partnersError;
      }

      const partnerIds = (partners || []).map((partner) => partner.id);

      if (partnerIds.length > 0) {
        const { error: partnerPlatformsError } = await supabaseAdmin
          .from("partner_platforms")
          .delete()
          .in("partner_id", partnerIds);

        if (partnerPlatformsError) {
          throw partnerPlatformsError;
        }

        const { error: partnerArtesError } = await supabaseAdmin
          .from("partner_artes")
          .delete()
          .in("partner_id", partnerIds);

        if (partnerArtesError) {
          throw partnerArtesError;
        }

        const { error: partnersDeleteError } = await supabaseAdmin
          .from("partners")
          .delete()
          .in("id", partnerIds);

        if (partnersDeleteError) {
          throw partnersDeleteError;
        }
      }

      for (const userId of ids) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
      }
    }

    return new Response(
      JSON.stringify({ success: true, email: requestedEmail, deletedUsers: ids.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[delete-test-user] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});