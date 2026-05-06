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

      const creditsToCharge = computeCreditCost(
        job.model,
        job.quality || "480p",
        job.duration || 5,
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

      console.log(`[seedance-generate] Calling Evolink for jobId: ${jobId}, model: ${job.model}`);
      const res = await evolinkGenerate(evolinkKey, {
        model: job.model,
        prompt: job.prompt,
        duration: job.duration || 10,
        quality: job.quality || "720p",
        aspectRatio: job.aspect_ratio || "9:16",
        generateAudio: job.generate_audio !== false,
        imageUrls: job.input_image_urls,
        videoUrls: job.input_video_urls,
        audioUrls: job.input_audio_urls,
      });

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
      await supabase.from("seedance_jobs").update({ task_id: res.taskId, status: "running" }).eq("id", jobId);
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
