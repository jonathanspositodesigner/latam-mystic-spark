import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evolinkPoll } from "../_shared/evolink-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const evolinkKey = Deno.env.get("EVOLINK_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { taskId, jobId } = await req.json();

  if (!jobId && !taskId) return new Response(JSON.stringify({ error: "Missing jobId or taskId" }), { status: 400, headers: corsHeaders });

  // 1. Check database first - maybe webhook already finished it
  const { data: job } = await supabase
    .from("seedance_jobs")
    .select("status, output_url, task_id")
    .eq("id", jobId)
    .maybeSingle();

  if (job?.status === "completed" && job?.output_url) {
    return new Response(JSON.stringify({ status: "completed", outputUrl: job.output_url, progress: 100 }), { headers: corsHeaders });
  }

  // Use taskId from DB if not provided
  const finalTaskId = taskId || job?.task_id;
  if (!finalTaskId) return new Response(JSON.stringify({ status: "pending", progress: 0 }), { headers: corsHeaders });

  const pollResult = await evolinkPoll(evolinkKey!, finalTaskId);

  if (pollResult.status === "completed") {
    await supabase.from("seedance_jobs").update({
      status: "completed",
      output_url: pollResult.outputUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    
    return new Response(JSON.stringify({ status: "completed", outputUrl: pollResult.outputUrl, progress: 100 }), { headers: corsHeaders });
  }

  if (pollResult.status === "failed") {
    await supabase.rpc("refund_seedance_job", { _job_id: jobId, _reason: "Seedance generation failed" });
    return new Response(JSON.stringify({ status: "failed", error: pollResult.error }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ status: pollResult.status, progress: pollResult.progress }), { headers: corsHeaders });
});
