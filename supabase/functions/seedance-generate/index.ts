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
  "standard-480p-i2v": 100, // 1000 credits for 10s
  "standard-480p-t2v": 100,
  "standard-480p-r2v": 100,
  "standard-720p-i2v": 150, // 1500 credits for 10s
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
  // Prefer explicit generation_type (from the job row); fall back to inference
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

async function consumeCredits(supabase: ReturnType<typeof createClient>, userId: string, amount: number, description: string) {
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
    tool_type: "seedance"
  });

  return { success: true };
}

async function refundJob(
  supabase: ReturnType<typeof createClient>,
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
      
      // Custo interno em RH Coins (para bater com R$ 2,80 e R$ 7,20 no admin com taxa 0.002)
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
          // NÃO debitamos nada aqui — apenas marca como falho. Não há nada a estornar.
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
      const isImageToVideo = job.model.includes("image-to-video");
      const hasAudio = normalizedAudioUrls.length > 0;

      // Seedance 2.0 Reference-to-Video requirements:
      // 1. Cannot have ONLY audio_urls. Need at least 1 image or 1 video.
      // 2. If it has audio but the model is not reference-to-video, we should switch it
      let finalModel = job.model;
      if (hasAudio && !isReferenceToVideo) {
        console.log(`[seedance-generate] Switching to r2v model because audio is present`);
        finalModel = job.model.replace("image-to-video", "reference-to-video");
      }

      if (normalizedImageUrls.length === 0 && normalizedVideoUrls.length === 0) {
        const errorMsg = hasAudio 
          ? "Referência de áudio exige ao menos uma imagem ou vídeo de referência."
          : "É necessário fornecer ao menos uma imagem para gerar o vídeo.";
          
        await refundJob(supabase, jobId, `Estorno - Seedance falhou: sem mídia de referência (${finalModel})`);
        await supabase.from("seedance_jobs").update({
          status: "failed",
          error_message: errorMsg,
        }).eq("id", jobId);
        return json({ success: false, error: errorMsg }, 400);
      }

      if (isImageToVideo && normalizedImageUrls.length === 0) {
        await refundJob(supabase, jobId, `Estorno - Seedance falhou: sem imagem inicial (${job.model})`);
        await supabase.from("seedance_jobs").update({
          status: "failed",
          error_message: "Image-to-video requires at least one input image",
        }).eq("id", jobId);
        return json({ success: false, error: "Adicione a imagem inicial para gerar o vídeo." }, 400);
      }

      // ===== Validação ESTRITA conforme documentação Evolink Seedance 2.0 =====
      const extOf = (u: string) => {
        const clean = (u || '').split('?')[0];
        return clean.substring(clean.lastIndexOf('.') + 1).toLowerCase();
      };
      const allowedAudioExts = ['mp3', 'wav'];
      const allowedImageExts = ['jpg', 'jpeg', 'png', 'webp'];
      const allowedVideoExts = ['mp4', 'mov'];
      const failValidation = async (msg: string) => {
        await refundJob(supabase, jobId, `Estorno - Seedance: payload inválido (${msg})`);
        await supabase.from("seedance_jobs").update({
          status: "failed",
          error_message: msg,
        }).eq("id", jobId);
        return json({ success: false, error: msg }, 400);
      };

      for (const u of normalizedImageUrls) {
        if (!allowedImageExts.includes(extOf(u))) {
          return await failValidation(`Imagem com extensão não suportada: .${extOf(u)} (apenas .jpg/.jpeg/.png/.webp)`);
        }
      }
      for (const u of normalizedAudioUrls) {
        if (!allowedAudioExts.includes(extOf(u))) {
          return await failValidation(`Áudio com extensão não suportada: .${extOf(u)} (apenas .mp3/.wav)`);
        }
      }
      for (const u of normalizedVideoUrls) {
        if (!allowedVideoExts.includes(extOf(u))) {
          return await failValidation(`Vídeo com extensão não suportada: .${extOf(u)} (apenas .mp4/.mov)`);
        }
      }
      if (normalizedAudioUrls.length > 3) return await failValidation("Máximo de 3 áudios de referência.");
      if (normalizedImageUrls.length > 9) return await failValidation("Máximo de 9 imagens de referência.");
      if (normalizedVideoUrls.length > 3) return await failValidation("Máximo de 3 vídeos de referência.");
      if (parsedDuration < 4 || parsedDuration > 15) return await failValidation("Duração deve estar entre 4 e 15 segundos.");

      const result = await evolinkGenerate(evolinkKey, {
        model: finalModel,
        prompt: job.prompt,
        duration: job.duration || 5,
        quality: (job.quality === "720p" || job.quality === "480p") ? job.quality : "480p",
        aspectRatio: job.aspect_ratio || "16:9",
        generateAudio: job.generate_audio !== false,
        imageUrls: normalizedImageUrls.length > 0 ? normalizedImageUrls : undefined,
        videoUrls: normalizedVideoUrls.length > 0 ? normalizedVideoUrls : undefined,
        audioUrls: normalizedAudioUrls.length > 0 ? normalizedAudioUrls : undefined,
        // NOTE: Seedance NÃO aceita generation_type na API (documentação Evolink).
        // O cliente já filtra esse campo para modelos seedance, mas não enviamos aqui mesmo.
      });

       if (!result.success) {
         await refundJob(supabase, jobId, `Estorno - Seedance falhou na criação da task (${job.model})`);
         await supabase.from("seedance_jobs").update({
           status: "failed",
           error_message: result.error,
         }).eq("id", jobId);
         return json({ success: false, error: result.error }, 400);
       }

      await supabase.from("seedance_jobs").update({
        task_id: result.taskId,
        status: "running",
        error_message: null,
      }).eq("id", jobId);

      return json({ success: true, taskId: result.taskId, jobId });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "No auth" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: "Invalid token" }, 401);

    const body = await req.json();
    const jobId = body.jobId as string | undefined;
    if (!body.model || !body.prompt || !jobId) return json({ success: false, error: "Missing required fields" }, 400);

    const { data: job } = await supabase
      .from("seedance_jobs")
      .select("id, user_id, model, duration, quality, task_id, status, credits_charged")
      .eq("id", jobId)
      .maybeSingle();

    if (!job || job.user_id !== user.id) return json({ success: false, error: "Job not found" }, 404);
    if (job.task_id) return json({ success: true, taskId: job.task_id, jobId, queued: false });

    await supabase.from("seedance_jobs").update({ status: "pending", error_message: null }).eq("id", jobId);

    fetch(`${supabaseUrl}/functions/v1/seedance-generate/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ jobId }),
    }).catch((err) => console.error("[seedance-generate] background process failed:", err));

    return json({ success: true, queued: true, jobId });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[seedance-generate] Unhandled error:", errMsg);
    return json({ success: false, error: errMsg }, 500);
  }
});