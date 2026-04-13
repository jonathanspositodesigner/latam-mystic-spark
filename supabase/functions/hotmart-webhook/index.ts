import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Product mapping (Hotmart product IDs) ──
const HOTMART_PRODUCTS: Record<string, { slug: string; credits: number; label: string; type: "vitalicio" | "creditos" }> = {
  "7521432": { slug: "upscaller-arcano-v3", credits: 0, label: "Vitalício", type: "vitalicio" },
  "7521921": { slug: "upscaler-creditos-starter", credits: 1500, label: "Starter", type: "creditos" },
  "7545929": { slug: "upscaler-creditos-pro", credits: 4200, label: "Pro", type: "creditos" },
  "7545977": { slug: "upscaler-creditos-ultimate", credits: 14000, label: "Ultimate", type: "creditos" },
};

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
function buildWelcomeEmailHtml(appUrl: string, productType: "vitalicio" | "creditos", creditLabel?: string): string {
  const isCreditos = productType === "creditos";
  const productName = isCreditos ? `Upscaler Arcano ${creditLabel}` : "Upscaler Arcano V3";
  const description = isCreditos
    ? `Tu compra del pack <strong style="color:#ffffff;">${productName}</strong> fue confirmada. Tus créditos ya están disponibles.`
    : `Tu compra del <strong style="color:#ffffff;">Upscaler Arcano V3</strong> fue confirmada exitosamente.`;

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
            ${description}
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
            <strong style="color:#ffffff;">Paso 4:</strong> ¡Listo! Disfruta del ${productName}
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

// ── Ensure user exists ──
async function ensureUser(supabaseAdmin: any, customerEmail: string, customerName?: string): Promise<string> {
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", customerEmail)
    .maybeSingle();

  if (existingProfile) {
    // Update name if provided and not set
    if (customerName) {
      await supabaseAdmin.from("profiles")
        .update({ name: customerName })
        .eq("id", existingProfile.id)
        .is("name", null);
    }
    console.log(`[hotmart-webhook] Existing user: ${existingProfile.id}`);
    return existingProfile.id;
  }

  const tempPassword = customerEmail;
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: customerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { source: "hotmart_purchase", name: customerName },
  });

  let userId: string;

  if (createError) {
    if (createError.message?.includes("already") || createError.message?.includes("exists")) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const found = authUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === customerEmail
      );
      if (found) {
        userId = found.id;
      } else {
        throw createError;
      }
    } else {
      throw createError;
    }
  } else {
    userId = newUser.user.id;
    console.log(`[hotmart-webhook] New user created: ${userId}`);
  }

  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: customerEmail,
      name: customerName || null,
      email_verified: true,
      password_changed: false,
      has_logged_in: false,
    },
    { onConflict: "id" }
  );

  return userId;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ── Validate Hotmart hottok secret ──
  const HOTTOK = Deno.env.get("HOTMART_HOTTOK");
  if (HOTTOK) {
    const headerHottok = req.headers.get("x-hotmart-hottok");
    if (headerHottok !== HOTTOK) {
      console.warn("[hotmart-webhook] Invalid or missing hottok header");
      return json({ error: "unauthorized" }, 401);
    }
  } else {
    console.warn("[hotmart-webhook] HOTMART_HOTTOK not configured — skipping validation");
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  console.log(`[hotmart-webhook] Payload received:`, JSON.stringify(payload).substring(0, 500));

  // Hotmart webhook format: { event, data: { ... } }
  const event = payload.event || payload.status || "unknown";
  const purchaseData = payload.data?.purchase || payload.data || {};
  const buyerData = payload.data?.buyer || {};
  const productData = payload.data?.product || {};
  const subscriptionData = payload.data?.subscription || {};

  // Log webhook
  await supabaseAdmin.from("webhook_logs").insert({
    source: "hotmart",
    event_type: event,
    payload: payload,
    status: "received",
    processed: false,
  });

  // ── Handle cancellation / chargeback events ──
  const cancellationEvents = [
    "PURCHASE_CANCELED",
    "PURCHASE_REFUNDED",
    "PURCHASE_CHARGEBACK",
    "PURCHASE_EXPIRED",
  ];

  if (cancellationEvents.includes(event)) {
    console.log(`[hotmart-webhook] Cancellation event: ${event}`);
    const cancelEmail = (
      buyerData.email || purchaseData.buyer?.email || payload.data?.email || ""
    ).trim().toLowerCase();

    if (cancelEmail) {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("id").eq("email", cancelEmail).maybeSingle();

      if (profile) {
        // Deactivate premium_artes_users
        await supabaseAdmin.from("premium_artes_users")
          .update({ is_active: false })
          .eq("user_id", profile.id)
          .eq("payment_gateway", "hotmart");

        // Deactivate user_pack_purchases
        await supabaseAdmin.from("user_pack_purchases")
          .update({ payment_status: "cancelled" })
          .eq("user_id", profile.id)
          .eq("gateway", "hotmart");

        console.log(`[hotmart-webhook] Access revoked for user ${profile.id} due to ${event}`);
      }
    }

    await supabaseAdmin.from("webhook_logs")
      .update({ status: `processed_${event.toLowerCase()}`, processed: true })
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(1);

    return json({ received: true, action: `access_revoked_${event.toLowerCase()}` });
  }

  // Only process approved purchases
  const approvedEvents = [
    "PURCHASE_APPROVED",
    "PURCHASE_COMPLETE",
  ];

  const purchaseStatus = purchaseData.status || purchaseData.transaction?.status || "";

  if (!approvedEvents.includes(event) && purchaseStatus !== "APPROVED" && purchaseStatus !== "COMPLETE") {
    console.log(`[hotmart-webhook] Event not actionable: ${event} / status: ${purchaseStatus}`);
    await supabaseAdmin.from("webhook_logs")
      .update({ status: `skipped_event_${event}`, processed: true })
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(1);
    return json({ received: true, action: "skipped" });
  }

  // Extract customer email
  const customerEmail = (
    buyerData.email ||
    purchaseData.buyer?.email ||
    payload.data?.email ||
    ""
  ).trim().toLowerCase();

  if (!customerEmail) {
    console.error("[hotmart-webhook] No customer email found");
    return json({ received: true, warning: "no_email" });
  }

  const customerName = (
    buyerData.name ||
    purchaseData.buyer?.name ||
    ""
  ).trim() || null;

  // Extract product ID
  const productId = String(
    productData.id ||
    purchaseData.product?.id ||
    payload.data?.product_id ||
    ""
  );

  const hotmartProduct = HOTMART_PRODUCTS[productId];

  if (!hotmartProduct) {
    console.log(`[hotmart-webhook] Unknown product ID: ${productId}`);
    await supabaseAdmin.from("webhook_logs")
      .update({ status: "skipped_unknown_product", processed: true })
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(1);
    return json({ received: true, action: "skipped_unknown_product" });
  }

  const transactionId = purchaseData.transaction || purchaseData.transaction_id || 
    subscriptionData.subscriber?.code || `hotmart_${Date.now()}`;

  try {
    const userId = await ensureUser(supabaseAdmin, customerEmail, customerName);
    const actions: string[] = [];

    if (hotmartProduct.type === "vitalicio") {
      // Check if already has active v3
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
          gateway: "hotmart",
          plan_type: "v3",
          external_id: String(transactionId),
          amount: purchaseData.price?.value || purchaseData.original_offer_price?.value || null,
        });
        actions.push("v3_access_granted");
      } else {
        actions.push("v3_already_active");
      }
    } else {
      // Credits product
      await supabaseAdmin.from("upscaler_credit_transactions").insert({
        user_id: userId,
        amount: hotmartProduct.credits,
        transaction_type: "purchase",
        description: `Compra Hotmart pack ${hotmartProduct.label} (${hotmartProduct.credits} créditos)`,
      });

      await supabaseAdmin.from("user_pack_purchases").insert({
        user_id: userId,
        pack_slug: hotmartProduct.slug,
        payment_status: "active",
        gateway: "hotmart",
        plan_type: hotmartProduct.slug,
        external_id: String(transactionId),
        amount: purchaseData.price?.value || purchaseData.original_offer_price?.value || null,
      });
      actions.push(`credits_granted_${hotmartProduct.label.toLowerCase()}`);
    }

    // ── Send welcome email ──
    let emailSent = false;
    try {
      const APP_URL = "https://arcanoapp-es.voxvisual.com.br";
      const htmlContent = buildWelcomeEmailHtml(APP_URL, hotmartProduct.type, hotmartProduct.label);
      const sendPulseToken = await getSendPulseToken();
      const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

      const emailPayload = {
        email: {
          html: htmlBase64,
          text: "",
          subject: `🎉 ¡Bienvenido a Arcano App! Tu ${hotmartProduct.type === "creditos" ? `pack ${hotmartProduct.label}` : "Upscaler Arcano V3"} está listo`,
          from: { name: "Arcano App", email: "contato@voxvisual.com.br" },
          to: [{ name: customerName || customerEmail, email: customerEmail }],
        },
      };

      const emailRes = await fetch("https://api.sendpulse.com/smtp/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendPulseToken}`,
        },
        body: JSON.stringify(emailPayload),
      });

      emailSent = emailRes.ok;
      const emailResBody = await emailRes.text();
      console.log(`[hotmart-webhook] SendPulse: status=${emailRes.status} ok=${emailSent} body=${emailResBody}`);
    } catch (emailErr: any) {
      console.error(`[hotmart-webhook] Email error:`, emailErr.message);
    }

    if (emailSent) {
      await supabaseAdmin.from("user_pack_purchases")
        .update({ welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("external_id", String(transactionId));
    }

    // Mark processed
    await supabaseAdmin.from("webhook_logs")
      .update({ status: "processed", processed: true })
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(1);

    console.log(`[hotmart-webhook] Done: ${userId} / ${actions.join(", ")}`);
    return json({ received: true, user_id: userId, actions });

  } catch (err: any) {
    console.error("[hotmart-webhook] Error:", err);
    await supabaseAdmin.from("webhook_logs")
      .update({ status: "error", error_message: err.message, processed: true })
      .eq("source", "hotmart")
      .order("created_at", { ascending: false })
      .limit(1);
    return json({ received: true, error: err.message }, 500);
  }
});
