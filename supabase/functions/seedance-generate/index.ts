import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolinkGenerate } from "../_shared/evolink-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLYER_PRICING: Record<string, number> = {
  "fast-720p-i2v": 200,
  "fast-720p-t2v": 200,
  "fast-720p-r2v": 200,
  "standard-720p-i2v": 200,
  "standard-720p-t2v": 200,
  "standard-720p-r2v": 200,
};

function computeCreditCost(model: string, quality: string, duration: number, genType: string, sourceTool: string): number {
  const isFast = model.includes("fast");
  const speed = isFast ? "fast" : "standard";
  const type = genType || (model.includes("reference") ? "r2v" : (model.includes("image") ? "i2v" : "t2v"));
  const key = `${speed}-${quality}-${type}`;
  const rate = FLYER_PRICING[key] || 200;
  return rate * duration;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const evolinkKey = Deno.env.get("EVOLINK_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  if (path === "process") {
    const { jobId } = await req.json();
    const { data: job } = await supabase.from("seedance_jobs").select("*").eq("id", jobId).single();
    if (!job) return new Response("Job not found", { status: 404 });

    const creditsToCharge = computeCreditCost(job.model, job.quality, job.duration, job.generation_type, job.source_tool);
    
    // Simples cobrança de créditos (pode ser melhorado para usar RPC central)
    const { data: consumeResult } = await supabase.rpc('consume_upscaler_credits', {
      _user_id: job.user_id, _amount: creditsToCharge, _description: `Flyer Animado Pro (${job.model})`
    });

    if (!consumeResult?.[0]?.success) {
      await supabase.from("seedance_jobs").update({ status: "failed", error_message: "Créditos insuficientes" }).eq("id", jobId);
      return new Response("Créditos insuficientes", { status: 400 });
    }

    await supabase.from("seedance_jobs").update({ credits_charged: creditsToCharge, status: "running" }).eq("id", jobId);

    const result = await evolinkGenerate(evolinkKey!, {
      model: job.model,
      prompt: job.prompt,
      duration: job.duration,
      quality: job.quality,
      aspectRatio: job.aspect_ratio,
      generateAudio: job.generate_audio,
      imageUrls: job.input_image_urls,
      audioUrls: job.input_audio_urls,
    });

    if (!result.success) {
      await supabase.rpc('refund_seedance_job', { _job_id: jobId, _reason: "Evolink failed" });
      return new Response(JSON.stringify(result), { status: 500, headers: corsHeaders });
    }

    await supabase.from("seedance_jobs").update({ task_id: result.taskId }).eq("id", jobId);
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  }

  return new Response("Invalid endpoint", { status: 400 });
});
