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

    if (!email || !password) {
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
      email: email.trim().toLowerCase(),
      password,
      email_confirm: false, // Don't auto-confirm — our custom flow handles this
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

    // Update profile with name/phone and mark password as set
    await supabaseAdmin.from("profiles").update({
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      password_changed: true,
      email_verified: false,
    }).eq("id", userId);

    console.log(`[signup-user] User created: ${userId} (${email})`);

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
