import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, name, phone } = await req.json();
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedName = name?.trim() || null;
    const normalizedPhone = phone?.trim() || null;

    if (!normalizedEmail || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create user via admin API — this does NOT send any confirmation email
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false, // Don't auto-confirm — our custom flow handles this
      user_metadata: {
        name: normalizedName,
        phone: normalizedPhone,
      },
    });

    if (createError) {
      console.error("[signup-user] Create error:", createError);
      const msg = createError.message || "";
      if (msg.includes("already been registered") || msg.includes("already exists")) {
        return new Response(
          JSON.stringify({ success: false, error: "already_registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email: normalizedEmail,
        name: normalizedName,
        phone: normalizedPhone,
        password_changed: true,
        email_verified: false,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("[signup-user] Profile upsert error:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return new Response(
        JSON.stringify({ success: false, error: "profile_setup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[signup-user] User created: ${userId} (${normalizedEmail})`);

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[signup-user] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
