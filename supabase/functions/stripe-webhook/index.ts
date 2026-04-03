import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@18.5.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ── SendPulse token cache ──
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getSendPulseToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }
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

// ── Welcome email HTML ──
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

// ── Main handler ──
serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!stripeWebhookSecret || !stripeSecretKey) {
    console.error("[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return json({ error: "server_config_error" }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return json({ error: "missing_signature" }, 400);
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return json({ error: "invalid_signature" }, 400);
  }

  console.log(`[stripe-webhook] Event received: ${event.type} (${event.id})`);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Log webhook
  await supabaseAdmin.from("webhook_logs").insert({
    source: "stripe",
    event_type: event.type,
    payload: event as any,
    status: "received",
    processed: false,
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();

    if (!customerEmail) {
      console.error("[stripe-webhook] No customer email in session");
      return json({ received: true, warning: "no_email" });
    }

    // ── Verify this is an Upscaler Arcano V3 purchase ──
    const UPSCALER_V3_PRODUCT_ID = "prod_UG4a2X2zxwTUZX";

    // Expand line_items to check product IDs
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price.product"],
    });

    const lineItems = fullSession.line_items?.data || [];
    const isUpscalerV3Purchase = lineItems.some((item: any) => {
      const product = item.price?.product;
      const productId = typeof product === "string" ? product : product?.id;
      return productId === UPSCALER_V3_PRODUCT_ID;
    });

    if (!isUpscalerV3Purchase) {
      console.log(`[stripe-webhook] Not an Upscaler V3 purchase, skipping. Products: ${lineItems.map((i: any) => typeof i.price?.product === "string" ? i.price.product : i.price?.product?.id).join(", ")}`);
      await supabaseAdmin.from("webhook_logs")
        .update({ status: "skipped_not_v3", processed: true })
        .eq("source", "stripe")
        .order("created_at", { ascending: false })
        .limit(1);
      return json({ received: true, action: "skipped_not_upscaler_v3" });
    }

    console.log(`[stripe-webhook] ✅ Upscaler V3 purchase confirmed for: ${customerEmail}`);

    try {
      // 1. Check if user already exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .maybeSingle();

      let userId: string;

      if (existingProfile) {
        userId = existingProfile.id;
        console.log(`[stripe-webhook] Existing user found: ${userId}`);
      } else {
        // 2. Create new user (auto-confirmed, temp password = email for auto-login in set-password flow)
        const tempPassword = customerEmail;
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: customerEmail,
          password: tempPassword,
          email_confirm: true, // Already confirmed — they paid
          user_metadata: { source: "stripe_purchase" },
        });

        if (createError) {
          // User might exist in auth but not in profiles
          if (createError.message?.includes("already") || createError.message?.includes("exists")) {
            const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
            const found = authUsers?.users?.find(
              (u) => u.email?.toLowerCase() === customerEmail
            );
            if (found) {
              userId = found.id;
              console.log(`[stripe-webhook] Found in auth: ${userId}`);
            } else {
              throw createError;
            }
          } else {
            throw createError;
          }
        } else {
          userId = newUser.user.id;
          console.log(`[stripe-webhook] New user created: ${userId}`);
        }

        // 3. Upsert profile
        await supabaseAdmin.from("profiles").upsert(
          {
            id: userId,
            email: customerEmail,
            email_verified: true,
            password_changed: false, // They need to set their own password
            has_logged_in: false,
          },
          { onConflict: "id" }
        );
      }

      // 4. Grant access to Upscaler Arcano V3
      const { data: existingPurchase } = await supabaseAdmin
        .from("user_pack_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("pack_slug", "upscaller-arcano-v3")
        .eq("payment_status", "active")
        .limit(1);

      if (!existingPurchase || existingPurchase.length === 0) {
        await supabaseAdmin.from("user_pack_purchases").insert({
          user_id: userId,
          pack_slug: "upscaller-arcano-v3",
          payment_status: "active",
          gateway: "stripe",
          plan_type: "v3",
          external_id: session.id,
          amount: session.amount_total ? session.amount_total / 100 : null,
        });
        console.log(`[stripe-webhook] Access granted: upscaller-arcano-v3 for ${userId}`);
      } else {
        console.log(`[stripe-webhook] User already has v3 access: ${userId}`);
      }

      // 5. Send welcome email
      try {
        const APP_URL = "https://arcanoapp-es.voxvisual.com.br";
        const htmlContent = buildWelcomeEmailHtml(APP_URL);
        const sendPulseToken = await getSendPulseToken();
        const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

        await fetch("https://api.sendpulse.com/smtp/emails", {
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
        console.log(`[stripe-webhook] Welcome email sent to: ${customerEmail}`);
      } catch (emailErr: any) {
        console.error(`[stripe-webhook] Welcome email failed:`, emailErr.message);
        // Don't fail the webhook just because email failed
      }

      // 6. Mark webhook as processed
      await supabaseAdmin.from("webhook_logs")
        .update({ status: "processed", processed: true })
        .eq("source", "stripe")
        .eq("event_type", event.type)
        .order("created_at", { ascending: false })
        .limit(1);

      return json({ received: true, user_id: userId, access_granted: true });

    } catch (err: any) {
      console.error("[stripe-webhook] Processing error:", err);
      await supabaseAdmin.from("webhook_logs")
        .update({ status: "error", error_message: err.message, processed: true })
        .eq("source", "stripe")
        .eq("event_type", event.type)
        .order("created_at", { ascending: false })
        .limit(1);
      return json({ received: true, error: err.message }, 500);
    }
  }

  // Other events — just acknowledge
  return json({ received: true });
});
