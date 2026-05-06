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
  if (req.method === 'OPTIONS') return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    if (!runningHubApiKey) {
      console.error("[flyer-motion] RUNNINGHUB_API_KEY missing");
      return jsonResponse({ error: "RUNNINGHUB_API_KEY not configured" }, 500);
    }

    if (path === "process") {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader !== `Bearer ${supabaseKey}`) {
        console.error("[flyer-motion] Unauthorized background request");
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const { jobId, imageUrl } = await req.json();
      console.log(`[flyer-motion] Processing background task for jobId: ${jobId}`);
      
      if (!jobId || !imageUrl) {
        console.error("[flyer-motion] Missing parameters in process");
        return jsonResponse({ error: "Missing jobId or imageUrl" }, 400);
      }

      try {
        console.log(`[flyer-motion] Analyzing flyer: ${imageUrl}`);
        const prompt = await analyzeFlyer(imageUrl);
        console.log(`[flyer-motion] Analysis complete. Prompt: ${prompt.substring(0, 50)}...`);
        
        const { error: updateError } = await supabase
          .from("seedance_jobs")
          .update({ prompt, status: "pending" })
          .eq("id", jobId);
          
        if (updateError) {
          console.error(`[flyer-motion] DB Update error: ${updateError.message}`);
          throw updateError;
        }
        
        // Trigger refined generation
        console.log(`[flyer-motion] Triggering seedance-generate for jobId: ${jobId}`);
        const genRes = await fetch(`${supabaseUrl}/functions/v1/seedance-generate`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": req.headers.get("Authorization") || `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ jobId }),
        });
        
        const genText = await genRes.text();
        console.log(`[flyer-motion] seedance-generate trigger response: ${genRes.status} - ${genText}`);
        
        return jsonResponse({ success: true });
      } catch (err: any) {
        console.error(`[flyer-motion] Process failed: ${err.message}`);
        await supabase.from("seedance_jobs").update({ 
          status: "failed", 
          error_message: `Flyer analysis failed: ${err.message}` 
        }).eq("id", jobId);
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    const { imageUrl, jobId } = await req.json();
    if (!imageUrl || !jobId) return jsonResponse({ error: "imageUrl and jobId are required" }, 400);

    console.log(`[flyer-motion] Queueing background process for jobId: ${jobId}`);

    // Run background process
    const processUrl = `${supabaseUrl}/functions/v1/runninghub-flyer-motion/process`;
    
    fetch(processUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${supabaseKey}` 
      },
      body: JSON.stringify({ jobId, imageUrl }),
    }).then(async res => {
      const text = await res.text();
      console.log(`[flyer-motion] Background trigger response status: ${res.status}, body: ${text}`);
    }).catch(err => console.error("[flyer-motion] background error:", err));

    return jsonResponse({ success: true, queued: true, jobId });

  } catch (err: any) {
    console.error(`[flyer-motion] Fatal error: ${err.message}`);
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
