import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { email } = await req.json();

  // Find user by email
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), { status: 400 });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  // Delete from auth
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 400 });
  }

  // Clean up related tables
  await supabaseAdmin.from("email_confirmation_tokens").delete().eq("user_id", user.id);
  await supabaseAdmin.from("device_signups").delete().eq("user_id", user.id);
  await supabaseAdmin.from("profiles").delete().eq("id", user.id);

  return new Response(JSON.stringify({ success: true, deleted: email }), { status: 200 });
});
