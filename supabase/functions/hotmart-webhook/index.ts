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
type ProductFamily = "upscaler" | "flyer";

interface HotmartProduct {
  slug: string;
  credits: number;
  label: string;
  type: "vitalicio" | "creditos" | "monthly_credits" | "unlimited";
  family: ProductFamily;
  productName: string;
}

const HOTMART_PRODUCTS: Record<string, HotmartProduct> = {
  // Upscaler (vitalício + créditos lifetime)
  "7521432": { slug: "upscaller-arcano-v3", credits: 0, label: "Vitalício", type: "vitalicio", family: "upscaler", productName: "Upscaler Arcano V3" },
  "7521921": { slug: "upscaler-creditos-starter", credits: 1500, label: "Starter", type: "creditos", family: "upscaler", productName: "Upscaler Arcano Starter" },
  "7545929": { slug: "upscaler-creditos-pro", credits: 4200, label: "Pro", type: "creditos", family: "upscaler", productName: "Upscaler Arcano Pro" },
  "7545977": { slug: "upscaler-creditos-ultimate", credits: 14000, label: "Ultimate", type: "creditos", family: "upscaler", productName: "Upscaler Arcano Ultimate" },

  // Flyer Maker — créditos mensais (1 mês de validade)
  "7689776": { slug: "flyer-maker-pro-7k", credits: 7000, label: "Pro", type: "monthly_credits", family: "flyer", productName: "Flyer Maker Pro" },
  "7689837": { slug: "flyer-maker-ultimate-14k", credits: 14000, label: "Ultimate", type: "monthly_credits", family: "flyer", productName: "Flyer Maker Ultimate" },

  // Flyer Maker Unlimited — flyers estáticos + refine ilimitados, motion cobra normal
  "7689893": { slug: "flyer-maker-unlimited", credits: 14000, label: "Unlimited", type: "unlimited", family: "flyer", productName: "Flyer Maker Unlimited" },
};

const FLYER_PACK_SLUGS = ["flyer-maker-pro-7k", "flyer-maker-ultimate-14k", "flyer-maker-unlimited"];
const MONTHLY_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

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

// ── Welcome email HTML (Spanish) ──
function buildWelcomeEmailHtml(appUrl: string, product: HotmartProduct): string {
  let intro = "";
  let benefitsList = "";

  if (product.family === "upscaler") {
    if (product.type === "vitalicio") {
      intro = `Tu compra del <strong style="color:#ffffff;">${product.productName}</strong> fue confirmada exitosamente.`;
      benefitsList = `
        <li>✨ Acceso vitalicio al Upscaler Arcano V3</li>
        <li>🎨 Mejora la calidad de tus imágenes y artes</li>
      `;
    } else {
      intro = `Tu compra del pack <strong style="color:#ffffff;">${product.productName}</strong> fue confirmada. Tus créditos ya están disponibles.`;
      benefitsList = `
        <li>💎 ${product.credits.toLocaleString("es-MX")} créditos para el Upscaler</li>
        <li>♾️ Créditos sin vencimiento</li>
      `;
    }
  } else {
    if (product.type === "unlimited") {
      intro = `Tu compra del plan <strong style="color:#ffffff;">${product.productName}</strong> fue confirmada. ¡Ya tienes acceso completo!`;
      benefitsList = `
        <li>♾️ Flyers estáticos <strong>ilimitados</strong></li>
        <li>♾️ Ediciones (refine) <strong>ilimitadas</strong></li>
        <li>🎬 ${product.credits.toLocaleString("es-MX")} créditos mensuales para Flyers Animados</li>
        <li>📅 Tus créditos mensuales se renuevan cada 30 días</li>
      `;
    } else {
      intro = `Tu compra del plan <strong style="color:#ffffff;">${product.productName}</strong> fue confirmada. Tus créditos mensuales ya están disponibles.`;
      benefitsList = `
        <li>💎 ${product.credits.toLocaleString("es-MX")} créditos mensuales</li>
        <li>🎨 Crea flyers profesionales con IA</li>
        <li>🎬 Anima tus flyers con Motion AI</li>
        <li>📅 Tus créditos se renuevan cada 30 días</li>
      `;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0D0221;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0221;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background-color:#1A0A2E;border-radius:12px;border:1px solid rgba(139,92,246,0.2);padding:40px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="color:#ffffff;font-size:26px;margin:0;">🎉 ¡Bienvenido a Arcano App!</h1>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <p style="color:#c4b5fd;font-size:16px;line-height:1.6;margin:0;text-align:center;">
            ${intro}
          </p>
        </td></tr>
        <tr><td style="padding-bottom:20px;">
          <div style="background-color:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:8px;padding:20px;">
            <p style="color:#ffffff;font-size:15px;font-weight:bold;margin:0 0 12px 0;">Lo que tienes liberado:</p>
            <ul style="color:#c4b5fd;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
              ${benefitsList}
            </ul>
          </div>
        </td></tr>
        <tr><td style="padding-bottom:16px;">
          <p style="color:#c4b5fd;font-size:15px;line-height:1.6;margin:0;text-align:center;">
            Tu cuenta ya está creada con tu correo de compra. Solo necesitas establecer tu contraseña para acceder.
          </p>
        </td></tr>
        <tr><td style="padding-bottom:8px;">
          <p style="color:#c4b5fd;font-size:14px;line-height:1.7;margin:0;text-align:center;">
            <strong style="color:#ffffff;">1.</strong> Haz clic en el botón abajo &nbsp;
            <strong style="color:#ffffff;">2.</strong> Ingresa tu correo &nbsp;
            <strong style="color:#ffffff;">3.</strong> Crea tu contraseña &nbsp;
            <strong style="color:#ffffff;">4.</strong> ¡Empieza a usar!
          </p>
        </td></tr>
        <tr><td align="center" style="padding:24px 0;">
          <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:bold;">
            Acceder a Arcano App
          </a>
        </td></tr>
        <tr><td style="padding-top:24px;border-top:1px solid rgba(139,92,246,0.2);">
          <p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">
            ¿Dudas? Responde a este correo y te ayudamos.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Ensure user exists (case-insensitive lookup, creates if missing) ──
async function ensureUser(supabaseAdmin: any, customerEmail: string, customerName?: string): Promise<string> {
  // Lookup case-insensitive via RPC
  const { data: existingUserId } = await supabaseAdmin.rpc("arcano_find_user_id_by_email", { _email: customerEmail });

  if (existingUserId) {
    if (customerName) {
      await supabaseAdmin.from("profiles")
        .update({ name: customerName })
        .eq("id", existingUserId)
        .is("name", null);
    }
    console.log(`[hotmart-webhook] Existing user (case-insensitive match): ${existingUserId}`);
    return existingUserId;
  }

  // Try to create user
  const tempPassword = customerEmail;
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: customerEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { source: "hotmart_purchase", name: customerName },
  });

  let userId: string;

  if (createError) {
    // Race: user might have been created between our check and createUser
    if (createError.message?.includes("already") || createError.message?.includes("exists")) {
      // Re-check via case-insensitive RPC
      const { data: foundId } = await supabaseAdmin.rpc("arcano_find_user_id_by_email", { _email: customerEmail });
      if (foundId) {
        return foundId;
      }
      // Fallback: list users (slow but reliable)
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const found = authUsers?.users?.find(
        (u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase()
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

  // Upsert profile — só seta password_changed=false e has_logged_in=false se profile NÃO existir
  // (evita resetar flags de user existente em race condition)
  const { data: existingProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, password_changed, has_logged_in")
    .eq("id", userId)
    .maybeSingle();

  if (!existingProfile) {
    await supabaseAdmin.from("profiles").insert({
      id: userId,
      email: customerEmail,
      name: customerName || null,
      email_verified: true,
      password_changed: false,
      has_logged_in: false,
    });
  } else {
    // Profile já existe — só atualiza email/name se vazios
    const updates: any = {};
    if (customerName) updates.name = customerName;
    updates.email_verified = true;
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from("profiles").update(updates).eq("id", userId);
    }
  }

  return userId;
}

function buildEmailSubject(product: HotmartProduct): string {
  return `🎉 ¡Bienvenido a Arcano App! Tu plan ${product.productName} está listo`;
}

async function updateLog(supabaseAdmin: any, logId: string | null, patch: Record<string, any>) {
  if (!logId) return;
  await supabaseAdmin.from("webhook_logs").update(patch).eq("id", logId);
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

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

  const event = payload.event || payload.status || "unknown";
  const purchaseData = payload.data?.purchase || payload.data || {};
  const buyerData = payload.data?.buyer || {};
  const productData = payload.data?.product || {};
  const subscriptionData = payload.data?.subscription || {};

  // ── Insert log capturing ID for safe updates later ──
  const { data: logRow } = await supabaseAdmin.from("webhook_logs").insert({
    source: "hotmart",
    event_type: event,
    payload: payload,
    status: "received",
    processed: false,
  }).select("id").single();
  const logId = logRow?.id ?? null;

  // ── Handle cancellation / chargeback / refund / dispute events ──
  const cancellationEvents = [
    "PURCHASE_CANCELED",
    "PURCHASE_REFUNDED",
    "PURCHASE_CHARGEBACK",
    "PURCHASE_EXPIRED",
    "PURCHASE_PROTEST",
    "SUBSCRIPTION_CANCELLATION",
  ];

  if (cancellationEvents.includes(event)) {
    console.log(`[hotmart-webhook] Cancellation event: ${event}`);
    const cancelEmail = (
      buyerData.email || purchaseData.buyer?.email || payload.data?.email || ""
    ).trim().toLowerCase();

    const cancelProductId = String(
      productData.id || purchaseData.product?.id || payload.data?.product_id || ""
    );
    const cancelProduct = HOTMART_PRODUCTS[cancelProductId];

    if (cancelEmail) {
      const { data: profileId } = await supabaseAdmin.rpc("arcano_find_user_id_by_email", { _email: cancelEmail });

      if (profileId) {
        // 1) Desativa premium_artes_users
        await supabaseAdmin.from("premium_artes_users")
          .update({ is_active: false })
          .eq("user_id", profileId)
          .eq("payment_gateway", "hotmart");

        // 2) Marca pack purchases como cancelled
        if (cancelProduct?.slug) {
          await supabaseAdmin.from("user_pack_purchases")
            .update({ payment_status: "cancelled" })
            .eq("user_id", profileId)
            .eq("gateway", "hotmart")
            .eq("pack_slug", cancelProduct.slug);
        } else {
          await supabaseAdmin.from("user_pack_purchases")
            .update({ payment_status: "cancelled" })
            .eq("user_id", profileId)
            .eq("gateway", "hotmart");
        }

        // 3) Revoga créditos conforme família do produto
        if (cancelProduct?.family === "flyer") {
          const { data: revokedAmount } = await supabaseAdmin.rpc("revoke_flyer_monthly_credits", {
            _user_id: profileId,
            _description: `Reembolso/cancelación Hotmart — ${cancelProduct.productName}`,
          });
          console.log(`[hotmart-webhook] Revoked ${revokedAmount} monthly credits for user ${profileId}`);
        } else if (cancelProduct?.family === "upscaler" && cancelProduct.type === "creditos" && cancelProduct.credits > 0) {
          // Revoga créditos lifetime na quantidade comprada
          const { data: revokedAmount } = await supabaseAdmin.rpc("arcano_revoke_lifetime_credits", {
            _user_id: profileId,
            _amount: cancelProduct.credits,
            _description: `Reembolso/cancelación Hotmart — ${cancelProduct.productName}`,
          });
          console.log(`[hotmart-webhook] Revoked ${revokedAmount} lifetime credits for user ${profileId}`);
        } else if (!cancelProduct) {
          // Produto desconhecido — revoga monthly por garantia mínima
          const { data: revokedAmount } = await supabaseAdmin.rpc("revoke_flyer_monthly_credits", {
            _user_id: profileId,
            _description: `Reembolso/cancelación Hotmart (${event})`,
          });
          console.log(`[hotmart-webhook] Revoked ${revokedAmount} monthly credits (unknown product) for user ${profileId}`);
        }

        console.log(`[hotmart-webhook] Access revoked for user ${profileId} due to ${event}`);
      }
    }

    await updateLog(supabaseAdmin, logId, {
      status: `processed_${event.toLowerCase()}`,
      processed: true,
    });

    return json({ received: true, action: `access_revoked_${event.toLowerCase()}` });
  }

  // Only process approved purchases
  const approvedEvents = ["PURCHASE_APPROVED", "PURCHASE_COMPLETE"];
  const purchaseStatus = purchaseData.status || purchaseData.transaction?.status || "";

  if (!approvedEvents.includes(event) && purchaseStatus !== "APPROVED" && purchaseStatus !== "COMPLETE") {
    console.log(`[hotmart-webhook] Event not actionable: ${event} / status: ${purchaseStatus}`);
    await updateLog(supabaseAdmin, logId, {
      status: `skipped_event_${event}`,
      processed: true,
    });
    return json({ received: true, action: "skipped" });
  }

  const customerEmail = (
    buyerData.email || purchaseData.buyer?.email || payload.data?.email || ""
  ).trim().toLowerCase();

  if (!customerEmail) {
    console.error("[hotmart-webhook] No customer email found");
    await updateLog(supabaseAdmin, logId, { status: "error_no_email", processed: true });
    return json({ received: true, warning: "no_email" });
  }

  const customerName = (
    buyerData.name || purchaseData.buyer?.name || ""
  ).trim() || null;

  const productId = String(
    productData.id || purchaseData.product?.id || payload.data?.product_id || ""
  );

  const hotmartProduct = HOTMART_PRODUCTS[productId];

  if (!hotmartProduct) {
    console.log(`[hotmart-webhook] Unknown product ID: ${productId}`);
    await updateLog(supabaseAdmin, logId, {
      status: "skipped_unknown_product",
      processed: true,
    });
    return json({ received: true, action: "skipped_unknown_product" });
  }

  const transactionId = String(
    purchaseData.transaction || purchaseData.transaction_id ||
    subscriptionData.subscriber?.code || `hotmart_${Date.now()}`
  );
  const purchaseAmount = purchaseData.price?.value ?? purchaseData.original_offer_price?.value ?? null;

  // ========== IDEMPOTENCY CHECK ==========
  // Hotmart re-envia webhook em timeout. Se já processamos este transaction_id
  // com sucesso, retornamos cedo sem duplicar nada.
  const { data: existingProcessed } = await supabaseAdmin
    .from("user_pack_purchases")
    .select("id, user_id")
    .eq("gateway", "hotmart")
    .eq("external_id", transactionId)
    .in("payment_status", ["active", "superseded", "cancelled"])
    .maybeSingle();

  if (existingProcessed) {
    console.log(`[hotmart-webhook] Transaction ${transactionId} already processed (pack ${existingProcessed.id}). Idempotent skip.`);
    await updateLog(supabaseAdmin, logId, {
      status: "idempotent_duplicate",
      processed: true,
    });
    return json({
      received: true,
      action: "idempotent_skip",
      user_id: existingProcessed.user_id,
      transaction_id: transactionId,
    });
  }

  try {
    const userId = await ensureUser(supabaseAdmin, customerEmail, customerName);
    const actions: string[] = [];

    // Mesmo timestamp para pack.expires_at e monthly_expires_at (consistência)
    const isMonthly = hotmartProduct.type === "monthly_credits" || hotmartProduct.type === "unlimited";
    const expiresAt = isMonthly ? new Date(Date.now() + MONTHLY_DURATION_MS).toISOString() : null;

    if (hotmartProduct.type === "vitalicio") {
      const { data: existingPurchase } = await supabaseAdmin
        .from("user_pack_purchases")
        .select("id")
        .eq("user_id", userId)
        .eq("pack_slug", hotmartProduct.slug)
        .eq("payment_status", "active")
        .limit(1);

      if (!existingPurchase || existingPurchase.length === 0) {
        await supabaseAdmin.from("user_pack_purchases").insert({
          user_id: userId,
          pack_slug: hotmartProduct.slug,
          payment_status: "active",
          gateway: "hotmart",
          plan_type: "v3",
          external_id: transactionId,
          amount: purchaseAmount,
        });
        actions.push("v3_access_granted");
      } else {
        actions.push("v3_already_active");
      }
    } else if (hotmartProduct.type === "creditos") {
      // Upscaler créditos lifetime via RPC atomic
      const { error: grantError } = await supabaseAdmin.rpc("arcano_grant_lifetime_credits", {
        _user_id: userId,
        _amount: hotmartProduct.credits,
        _description: `Compra Hotmart pack ${hotmartProduct.label} (${hotmartProduct.credits} créditos)`,
      });
      if (grantError) {
        console.error(`[hotmart-webhook] grant_lifetime_credits error:`, grantError);
        throw grantError;
      }

      await supabaseAdmin.from("user_pack_purchases").insert({
        user_id: userId,
        pack_slug: hotmartProduct.slug,
        payment_status: "active",
        gateway: "hotmart",
        plan_type: hotmartProduct.slug,
        external_id: transactionId,
        amount: purchaseAmount,
      });
      actions.push(`credits_granted_${hotmartProduct.label.toLowerCase()}`);
    } else if (hotmartProduct.type === "monthly_credits" || hotmartProduct.type === "unlimited") {
      // Flyer Maker — concede créditos mensais (substitui anterior se houver)
      const { error: grantError } = await supabaseAdmin.rpc("grant_flyer_monthly_credits", {
        _user_id: userId,
        _amount: hotmartProduct.credits,
        _description: `Compra Hotmart ${hotmartProduct.productName} (${hotmartProduct.credits} créditos mensales)`,
        _months: 1,
      });
      if (grantError) {
        console.error(`[hotmart-webhook] grant_flyer_monthly_credits error:`, grantError);
        throw grantError;
      }

      // Cancela qualquer outro pack flyer ativo (evita stacking de planos)
      await supabaseAdmin.from("user_pack_purchases")
        .update({ payment_status: "superseded" })
        .eq("user_id", userId)
        .eq("gateway", "hotmart")
        .eq("payment_status", "active")
        .in("pack_slug", FLYER_PACK_SLUGS);

      await supabaseAdmin.from("user_pack_purchases").insert({
        user_id: userId,
        pack_slug: hotmartProduct.slug,
        payment_status: "active",
        gateway: "hotmart",
        plan_type: hotmartProduct.slug,
        external_id: transactionId,
        amount: purchaseAmount,
        expires_at: expiresAt,
      });
      actions.push(`flyer_${hotmartProduct.type}_granted_${hotmartProduct.label.toLowerCase()}`);
    }

    // ── Send welcome email (best effort, não bloqueia venda) ──
    let emailSent = false;
    try {
      const APP_URL = "https://arcanoapp-es.voxvisual.com.br";
      const htmlContent = buildWelcomeEmailHtml(APP_URL, hotmartProduct);
      const sendPulseToken = await getSendPulseToken();
      const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

      const emailPayload = {
        email: {
          html: htmlBase64,
          text: "",
          subject: buildEmailSubject(hotmartProduct),
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
      console.log(`[hotmart-webhook] SendPulse: status=${emailRes.status} ok=${emailSent} body=${emailResBody.substring(0, 200)}`);
    } catch (emailErr: any) {
      console.error(`[hotmart-webhook] Email error (não bloqueia venda):`, emailErr.message);
    }

    if (emailSent) {
      await supabaseAdmin.from("user_pack_purchases")
        .update({ welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("external_id", transactionId);
    }

    await updateLog(supabaseAdmin, logId, {
      status: emailSent ? "processed" : "processed_email_failed",
      processed: true,
    });

    console.log(`[hotmart-webhook] Done: ${userId} / ${actions.join(", ")} / email=${emailSent}`);
    return json({ received: true, user_id: userId, actions, email_sent: emailSent });

  } catch (err: any) {
    console.error("[hotmart-webhook] Error:", err);

    // Detecta erro de unique violation no external_id (= duplicado, não é erro real)
    const isDuplicate = err?.code === "23505" || err?.message?.includes("uniq_user_pack_purchases_gateway_external_id");
    if (isDuplicate) {
      console.log(`[hotmart-webhook] Unique constraint hit on external_id ${transactionId} — idempotent skip`);
      await updateLog(supabaseAdmin, logId, {
        status: "idempotent_duplicate_unique",
        processed: true,
      });
      return json({ received: true, action: "idempotent_unique_violation" });
    }

    await updateLog(supabaseAdmin, logId, {
      status: "error",
      error_message: err.message,
      processed: true,
    });
    return json({ received: true, error: err.message }, 500);
  }
});
