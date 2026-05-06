import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolinkGenerate } from "../_shared/evolink-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICING: Record<string, number> = {
  "fast-480p-i2v": 100,
  "fast-480p-t2v": 100,
  "fast-480p-r2v": 100,
  "fast-720p-i2v": 150,
  "fast-720p-t2v": 150,
  "fast-720p-r2v": 150,
  "standard-480p-i2v": 100,
  "standard-480p-t2v": 100,
  "standard-480p-r2v": 100,
  "standard-720p-i2v": 150,
  "standard-720p-t2v": 150,
  "standard-720p-r2v": 150,
};

const FLYER_PRICING: Record<string, number> = {
  "fast-720p-i2v": 200,
  "fast-720p-t2v": 200,
  "fast-720p-r2v": 200,
  "standard-720p-i2v": 200,
  "standard-720p-t2v": 200,
  "standard-720p-r2v": 200,
};

function computeCreditCost(
  model: string,
  quality: string,
  duration: number,
  explicitGenType?: string | null,
  sourceTool?: string | null,
): number {
  const isFast = model.includes("fast");
  const speed = isFast ? "fast" : "standard";
  let genType: "i2v" | "t2v" | "r2v";
  if (explicitGenType === "i2v" || explicitGenType === "t2v" || explicitGenType === "r2v") {
    genType = explicitGenType;
  } else {
    const isR2V = model.includes("reference-to-video");
    const isI2V = model.includes("image-to-video");
    genType = isR2V ? "r2v" : (isI2V ? "i2v" : "t2v");
  }
  const key = `${speed}-${quality}-${genType}`;
  const isFlyer = sourceTool === "flyer_motion" || sourceTool === "flyer_maker";
  const rate = isFlyer ? (FLYER_PRICING[key] ?? PRICING[key]) : PRICING[key];

  if (!rate) return 300 * duration;
  return rate * duration;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function consumeCredits(supabase: any, userId: string, amount: number, description: string) {
  const { data: creditRow } = await supabase
    .from("upscaler_credits")
    .select("monthly_balance, lifetime_balance")
    .eq("user_id", userId)
    .single();

  const totalBalance = (creditRow?.monthly_balance || 0) + (creditRow?.lifetime_balance || 0);
  if (totalBalance < amount) {
    return { success: false, error: "Créditos insuficientes" };
  }

  const { data: consumeResult, error: consumeError } = await supabase.rpc("consume_upscaler_credits_forced", {
    _user_id: userId,
    _amount: amount,
    _description: description,
  });

  if (!consumeError) {
    const result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;
    if (result && result.success === false) {
      return { success: false, error: result.error_message || "Erro ao cobrar créditos" };
    }
    return { success: true };
  }

  const monthly = creditRow?.monthly_balance || 0;
  const lifetime = creditRow?.lifetime_balance || 0;
  let monthlyDeduct = 0;
  let lifetimeDeduct = 0;
  let txCreditType = "monthly";

  if (monthly >= amount) {
    monthlyDeduct = amount;
    txCreditType = "monthly";
  } else if (monthly > 0) {
    monthlyDeduct = monthly;
    lifetimeDeduct = amount - monthly;
    txCreditType = "mixed";
  } else {
    lifetimeDeduct = amount;
    txCreditType = "lifetime";
  }

  const newMonthly = monthly - monthlyDeduct;
  const newLifetime = lifetime - lifetimeDeduct;
  const newBalance = newMonthly + newLifetime;

  const { error: updateErr } = await supabase
    .from("upscaler_credits")
    .update({
      monthly_balance: newMonthly,
      lifetime_balance: newLifetime,
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) return { success: false, error: "Erro ao cobrar créditos" };

  await supabase.from("upscaler_credit_transactions").insert({
    user_id: userId,
    amount: -amount,
    balance_after: newBalance,
    transaction_type: "consumption",
    description,
    credit_type: txCreditType,
  });

  return { success: true };
}

async function refundJob(
  supabase: any,
  jobId: string,
  reason: string,
) {
  const { data, error } = await supabase.rpc("refund_seedance_job", {
    _job_id: jobId,
    _reason: reason,
  });
  if (error) {
    console.error(`[seedance-generate] refund_seedance_job failed for ${jobId}:`, error);
  } else {
    console.log(`[seedance-generate] refund_seedance_job result for ${jobId}:`, data);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolinkKey = Deno.env.get("EVOLINK_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!evolinkKey) return json({ success: false, error: "EVOLINK_API_KEY not configured" }, 500);

    if (path === "process") {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader !== `Bearer ${supabaseKey}`) return json({ success: false, error: "Unauthorized" }, 401);

      const { jobId } = await req.json();
      if (!jobId) return json({ success: false, error: "Missing jobId" }, 400);

      const { data: job } = await supabase
        .from("seedance_jobs")
        .select("id, user_id, model, prompt, duration, quality, aspect_ratio, generate_audio, input_image_urls, input_video_urls, input_audio_urls, task_id, status, credits_charged, generation_type, source_tool")
        .eq("id", jobId)
        .maybeSingle();

      if (!job) return json({ success: false, error: "Job not found" }, 404);
      if (job.task_id || job.status === "completed") return json({ success: true, skipped: true, taskId: job.task_id });

      const parsedDuration = Number(job.duration || 5);
      const parsedQuality = (job.quality === "720p" || job.quality === "480p") ? job.quality : "480p";
      const rhCost = parsedQuality === "720p" ? 3600 : 1400;

      const creditsToCharge = computeCreditCost(
        job.model,
        parsedQuality,
        parsedDuration,
        (job as any).generation_type ?? null,
        job.source_tool
      );

      if (!job.credits_charged || job.credits_charged <= 0) {
        const creditResult = await consumeCredits(supabase, job.user_id, creditsToCharge, `Seedance 2 (${job.model})`);
        if (!creditResult.success) {
          await supabase.from("seedance_jobs").update({
            status: "failed",
            error_message: creditResult.error || "Créditos insuficientes",
          }).eq("id", jobId);
          return json({ success: false, error: creditResult.error || "Créditos insuficientes" }, 400);
        }

        await supabase.from("seedance_jobs").update({
          credits_charged: creditsToCharge,
          rh_cost: rhCost,
          status: "queued",
          error_message: null,
        }).eq("id", jobId);
      }

      const normalizedImageUrls = (Array.isArray(job.input_image_urls) ? job.input_image_urls : [job.input_image_urls]).filter(Boolean);
      const normalizedVideoUrls = (Array.isArray(job.input_video_urls) ? job.input_video_urls : [job.input_video_urls]).filter(Boolean);
      const normalizedAudioUrls = (Array.isArray(job.input_audio_urls) ? job.input_audio_urls : [job.input_audio_urls]).filter(Boolean);

      const isReferenceToVideo = job.model.includes("reference-to-video");
      const hasAudio = normalizedAudioUrls.length > 0;

      let finalModel = job.model;
      if (hasAudio && !isReferenceToVideo) {
        finalModel = job.model.replace("image-to-video", "reference-to-video");
      }

      if (normalizedImageUrls.length === 0 && normalizedVideoUrls.length === 0) {
        const errorMsg = hasAudio 
          ? "Referência de áudio exige ao menos uma imagem ou vídeo de referência."
          : "É necessário fornecer ao menos uma imagem para gerar o vídeo.";
        await refundJob(supabase, jobId, `Estorno - Seedance falhou: sem mídia de referência (${finalModel})`);
        await supabase.from("seedance_jobs").update({ status: "failed", error_message: errorMsg }).eq("id", jobId);
        return json({ success: false, error: errorMsg }, 400);
      }

      const extOf = (u: string) => {
        const clean = (u || '').split('?')[0];
        return clean.substring(clean.lastIndexOf('.') + 1).toLowerCase();
      };
      const allowedAudioExts = ['mp3', 'wav'];
      const allowedImageExts = ['jpg', 'jpeg', 'png', 'webp'];
      const allowedVideoExts = ['mp4', 'mov'];

      const failValidation = async (msg: string) => {
        await refundJob(supabase, jobId, `Estorno - Seedance: payload inválido (${msg})`);
        await supabase.from("seedance_jobs").update({ status: "failed", error_message: msg }).eq("id", jobId);
        return json({ success: false, error: msg }, 400);
      };

      for (const u of normalizedImageUrls) {
        if (!allowedImageExts.includes(extOf(u))) return await failValidation(`Imagem com extensão não suportada: .${extOf(u)} (apenas .jpg/.jpeg/.png/.webp)`);
      }
      for (const u of normalizedAudioUrls) {
        if (!allowedAudioExts.includes(extOf(u))) return await failValidation(`Áudio com extensão não suportada: .${extOf(u)} (apenas .mp3/.wav)`);
      }
      for (const u of normalizedVideoUrls) {
        if (!allowedVideoExts.includes(extOf(u))) return await failValidation(`Vídeo com extensão não suportada: .${extOf(u)} (apenas .mp4/.mov)`);
      }

      if (normalizedAudioUrls.length > 3) return await failValidation("Máximo de 3 áudios de referência.");
      if (normalizedImageUrls.length > 9) return await failValidation("Máximo de 9 imagens de referência.");
      if (normalizedVideoUrls.length > 3) return await failValidation("Máximo de 3 vídeos de referência.");
      if (parsedDuration < 4 || parsedDuration > 15) return await failValidation("Duração deve estar entre 4 e 15 segundos.");

      const webhookUrl = `${supabaseUrl}/functions/v1/runninghub-webhook`;
      const payload: any = {
        model: finalModel,
        prompt: job.prompt,
        duration: parsedDuration,
        quality: parsedQuality,
        aspect_ratio: job.aspect_ratio || "9:16",
        generate_audio: job.generate_audio !== false,
        webhook_url: webhookUrl,
      };

      if (normalizedImageUrls.length > 0) payload.image_urls = normalizedImageUrls;
      if (normalizedVideoUrls.length > 0) payload.video_urls = normalizedVideoUrls;
      if (normalizedAudioUrls.length > 0) payload.audio_urls = normalizedAudioUrls;

      const res = await evolinkGenerate(evolinkKey, payload);

      if (!res.success) {
        await refundJob(supabase, jobId, `Estorno - Evolink falhou: ${res.error}`);
        await supabase.from("seedance_jobs").update({ 
          status: "failed", 
          error_message: `Evolink generation error: ${res.error}` 
        }).eq("id", jobId);
        return json({ success: false, error: res.error }, 400);
      }

      let updateSuccess = false;
      for (let i = 0; i < 3; i++) {
        const { error: updateError } = await supabase
          .from("seedance_jobs")
          .update({ task_id: res.taskId, status: "running", updated_at: new Date().toISOString() })
          .eq("id", jobId);
        if (!updateError) {
          updateSuccess = true;
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      return json({ success: true, taskId: res.taskId, jobId });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "No auth" }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ error: "Missing jobId" }, 400);

    fetch(`${supabaseUrl}/functions/v1/seedance-generate/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({ jobId }),
    }).catch(err => console.error("[seedance-generate] background trigger error:", err));

    return json({ success: true, queued: true, jobId });

  } catch (err: any) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
