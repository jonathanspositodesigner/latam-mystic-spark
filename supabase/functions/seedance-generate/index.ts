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
  const { data: consumeResult, error: consumeError } = await supabase.rpc("consume_upscaler_credits_forced", {
    _user_id: userId,
    _amount: amount,
    _description: description,
  });

  if (consumeError) return { success: false, error: "Error al cobrar créditos" };
  const result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;
  if (result && result.success === false) {
    return { success: false, error: result.error_message || "Créditos insuficientes" };
  }
  return { success: true };
}

async function refundJob(supabase: any, jobId: string, reason: string) {
  await supabase.rpc("refund_seedance_job", { _job_id: jobId, _reason: reason });
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
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (!job) return json({ success: false, error: "Job not found" }, 404);
      if (job.task_id || job.status === "completed") return json({ success: true, taskId: job.task_id });

      const parsedDuration = Number(job.duration || 5);
      const parsedQuality = (job.quality === "720p" || job.quality === "480p") ? job.quality : "480p";

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
          await supabase.from("seedance_jobs").update({ status: "failed", error_message: creditResult.error }).eq("id", jobId);
          return json({ success: false, error: creditResult.error }, 400);
        }
        await supabase.from("seedance_jobs").update({ credits_charged: creditsToCharge, status: "queued" }).eq("id", jobId);
      }

      const normalizedImageUrls = (Array.isArray(job.input_image_urls) ? job.input_image_urls : [job.input_image_urls]).filter(Boolean);
      const normalizedVideoUrls = (Array.isArray(job.input_video_urls) ? job.input_video_urls : [job.input_video_urls]).filter(Boolean);
      const normalizedAudioUrls = (Array.isArray(job.input_audio_urls) ? job.input_audio_urls : [job.input_audio_urls]).filter(Boolean);
      
      const isReferenceToVideo = job.model.includes("reference-to-video");
      const hasAudio = normalizedAudioUrls.length > 0;

      // Seedance 2.0 Reference-to-Video requirements:
      // If it has audio but the model is not reference-to-video, we should switch it
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
        await supabase.from("seedance_jobs").update({ status: "failed", error_message: errorMsg }).eq("id", jobId);
        return json({ success: false, error: errorMsg }, 400);
      }

      // ===== Validação ESTRITA conforme documentação Evolink Seedance 2.0 (igual ArcanoApp) =====
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

      console.log(`[seedance-generate] Calling Evolink for jobId: ${jobId}, model: ${finalModel}`);
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

      console.log(`[seedance-generate] Calling Evolink for jobId: ${jobId}, model: ${finalModel}. Payload keys: ${Object.keys(payload)}`);
      
      const res = await evolinkGenerate(evolinkKey, payload);

      if (!res.success) {
        console.error(`[seedance-generate] Evolink error for jobId ${jobId}: ${res.error}`);
        await refundJob(supabase, jobId, `Estorno - Evolink falhou: ${res.error}`);
        await supabase.from("seedance_jobs").update({ 
          status: "failed", 
          error_message: `Evolink generation error: ${res.error}` 
        }).eq("id", jobId);
        return json({ success: false, error: res.error }, 400);
      }

      console.log(`[seedance-generate] Evolink Success! TaskId: ${res.taskId}`);
      
      // Retry database update to ensure task_id is NEVER lost
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
        console.error(`[seedance-generate] Database update attempt ${i+1} failed for jobId ${jobId}:`, updateError);
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!updateSuccess) {
        // Even if DB update failed after retries, we return success but log a critical error
        console.error(`[seedance-generate] CRITICAL: Failed to save task_id ${res.taskId} for jobId ${jobId} after retries.`);
      }

      return json({ success: true, taskId: res.taskId, jobId });
    }

    // Client request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "No auth" }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ success: false, error: "Missing jobId" }, 400);

    const processUrl = `${supabaseUrl}/functions/v1/seedance-generate/process`;
    console.log(`[seedance-generate] Triggering background process for jobId: ${jobId}`);
    
    fetch(processUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${supabaseKey}` 
      },
      body: JSON.stringify({ jobId }),
    }).then(async res => {
      const text = await res.text();
      console.log(`[seedance-generate] Background trigger response status: ${res.status}, body: ${text}`);
    }).catch(err => console.error("[seedance-generate] background trigger failed:", err));

    return json({ success: true, queued: true, jobId });
  } catch (error: any) {
    return json({ success: false, error: error.message }, 500);
  }
});
