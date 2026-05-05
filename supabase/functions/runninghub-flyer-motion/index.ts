import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_ID = "2048520932163063810";
const MAX_POLLS = 48; 
const POLL_INTERVAL_MS = 5000;
const FETCH_TIMEOUT_MS = 30000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const runningHubApiKey = (
  Deno.env.get("RUNNINGHUB_API_KEY") ||
  Deno.env.get("RUNNINGHUB_APIKEY") ||
  ""
).trim();

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    if (!runningHubApiKey) return jsonResponse({ error: "RUNNINGHUB_API_KEY not configured" }, 500);

    if (path === "process") {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader !== `Bearer ${supabaseKey}`) return jsonResponse({ error: "Unauthorized" }, 401);

      const { jobId, imageUrl } = await req.json();
      if (!jobId || !imageUrl) return jsonResponse({ error: "Missing jobId or imageUrl" }, 400);

      try {
        const prompt = await analyzeFlyer(imageUrl);
        const { error: updateError } = await supabase.from("image_generator_jobs").update({ prompt, status: "pending" }).eq("id", jobId);
        if (updateError) throw updateError;
        
        // Trigger refined generation
        return jsonResponse({ success: true });
      } catch (err: any) {
        await supabase.from("image_generator_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    const { imageUrl, jobId } = await req.json();
    if (!imageUrl || !jobId) return jsonResponse({ error: "imageUrl and jobId are required" }, 400);

    // Run background process
    fetch(`${supabaseUrl}/functions/v1/runninghub-flyer-motion/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({ jobId, imageUrl }),
    }).catch(err => console.error("[flyer-motion] background error:", err));

    return jsonResponse({ success: true, queued: true, jobId });

  } catch (err: any) {
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});

async function analyzeFlyer(imageUrl: string): Promise<string> {
    const startResponse = await fetch(`https://www.runninghub.ai/openapi/v2/run/ai-app/${WEBAPP_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${runningHubApiKey}` },
        body: JSON.stringify({
          nodeInfoList: [{ nodeId: "2", fieldName: "image", fieldValue: imageUrl }],
          instanceType: "default",
          usePersonalQueue: false,
        }),
    });

    const startData = await startResponse.json();
    const taskId = startData?.taskId || startData?.data?.taskId;
    if (!taskId) throw new Error("No taskId from RunningHub");

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const statusRes = await fetch("https://www.runninghub.ai/task/openapi/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
      });
      const statusData = await statusRes.json();
      const taskStatus = (typeof statusData.data === "string" ? statusData.data : statusData.data?.status || "").toUpperCase();

      if (taskStatus === "FAILED" || taskStatus === "ERROR") throw new Error(statusData.msg || "Job failed");
      if (taskStatus === "SUCCESS" || taskStatus === "COMPLETED") {
        const outRes = await fetch("https://www.runninghub.ai/task/openapi/outputs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
        });
        const outData = await outRes.json();
        const results = outData?.data?.outputFileList || outData?.data || [];
        const target = results.find((r: any) => (r?.outputType || "").toLowerCase() === "txt") || results[0];
        const fileUrl = target?.fileUrl || target?.url || target?.text || target;
        if (typeof fileUrl === "string" && !fileUrl.startsWith("http")) return fileUrl.trim();
        const dlRes = await fetch(fileUrl);
        return (await dlRes.text()).trim();
      }
    }
    throw new Error("Timeout");
}
