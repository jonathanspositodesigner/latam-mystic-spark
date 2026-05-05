import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_ID = "2048520932163063810";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 48; // ~4min
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

      console.log(`[flyer-motion-bg] Processing Job ${jobId} for Image: ${imageUrl.substring(0, 50)}...`);
      
      try {
        const prompt = await analyzeFlyer(imageUrl);
        
        const { error: updateError } = await supabase
          .from("seedance_jobs")
          .update({ prompt, status: "pending" })
          .eq("id", jobId);

        if (updateError) throw updateError;

        console.log(`[flyer-motion-bg] Analysis done for Job ${jobId}. Triggering generation...`);
        
        fetch(`${supabaseUrl}/functions/v1/seedance-generate/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ jobId }),
        }).catch(err => console.error("[flyer-motion-bg] Failed to trigger seedance-generate:", err));

        return jsonResponse({ success: true });
      } catch (err: any) {
        console.error(`[flyer-motion-bg] Error processing job ${jobId}:`, err.message);
        await supabase.from("seedance_jobs").update({ status: "failed", error_message: err.message }).eq("id", jobId);
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "No auth" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { imageUrl, jobId } = body;
    if (!imageUrl || !jobId) return jsonResponse({ error: "imageUrl and jobId are required" }, 400);

    console.log("[flyer-motion] Queuing analysis for Job:", jobId);

    fetch(`${supabaseUrl}/functions/v1/runninghub-flyer-motion/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ jobId, imageUrl }),
    }).catch(err => console.error("[flyer-motion] background process trigger failed:", err));

    return jsonResponse({ success: true, queued: true, jobId });

  } catch (err: any) {
    console.error("[flyer-motion] FATAL:", err.message, err.stack);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});

async function analyzeFlyer(imageUrl: string): Promise<string> {
    console.log("[flyer-motion] Starting Analysis for:", imageUrl.substring(0, 60));

    const startResponse = await fetch(
      `https://www.runninghub.ai/openapi/v2/run/ai-app/${WEBAPP_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${runningHubApiKey}`,
        },
        body: JSON.stringify({
          nodeInfoList: [
            { nodeId: "2", fieldName: "image", fieldValue: imageUrl },
          ],
          instanceType: "default",
          usePersonalQueue: false,
        }),
      }
    );

    const startData = await startResponse.json();
    const taskId = startData?.taskId || startData?.data?.taskId;

    if (!taskId) {
      throw new Error("No taskId from RunningHub: " + (startData?.msg || startData?.message));
    }

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(
        "https://www.runninghub.ai/task/openapi/status",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
        }
      );
      
      const statusData = await statusRes.json();

      if (statusData.code !== undefined && statusData.code !== 0) {
        if (statusData.code === 401 || statusData.code === 403) {
          throw new Error("RunningHub auth error: " + (statusData.msg || statusData.code));
        }
        continue;
      }

      const rawData = statusData.data;
      const taskStatus = (
        typeof rawData === "string"
          ? rawData
          : rawData?.status || rawData?.taskStatus || ""
      ).toUpperCase();

      if (taskStatus === "FAILED" || taskStatus === "ERROR") {
        throw new Error(statusData.msg || "RunningHub job failed");
      }

      if (taskStatus === "SUCCESS" || taskStatus === "COMPLETED") {
        let results: any[] = [];
        if (typeof rawData === "string") {
          const outRes = await fetch(
            "https://www.runninghub.ai/task/openapi/outputs",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
            }
          );
          const outData = await outRes.json();
          results = outData?.data?.outputFileList || outData?.data || outData?.data?.results || [];
          if (!Array.isArray(results)) results = [results].filter(Boolean);
        } else {
          results = rawData?.outputFileList || rawData?.results || [];
        }

        if (results.length === 0) {
          throw new Error("No output from RunningHub workflow");
        }

        const txtResult = results.find((r: any) => {
          const type = (r?.outputType || r?.fileType || "").toLowerCase();
          const url = (r?.fileUrl || r?.url || "").toLowerCase();
          return type === "txt" || url.endsWith(".txt");
        });
        const target = txtResult || results[0];
        const fileUrl = target?.fileUrl || target?.url || target?.text || target;

        if (typeof fileUrl === "string" && !fileUrl.startsWith("http")) {
          return fileUrl.trim();
        }

        if (!fileUrl) throw new Error("No file URL in RunningHub output");

        const dlRes = await fetch(fileUrl);
        if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status} downloading prompt`);
        return (await dlRes.text()).trim();
      }
    }

    throw new Error("RunningHub job timed out after 4 minutes");
}
