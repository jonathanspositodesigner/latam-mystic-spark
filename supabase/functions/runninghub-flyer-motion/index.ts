import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const WEBAPP_ID = "2048520932163063810";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 48; // ~4min
const FETCH_TIMEOUT_MS = 30000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    // Background process for internal calls
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

      console.log(`[flyer-motion-bg] Processing Job ${jobId} for Image: ${imageUrl.substring(0, 50)}...`);

      try {
        console.log(`[flyer-motion] Analyzing flyer: ${imageUrl}`);
        const prompt = await analyzeFlyer(imageUrl);
<<<<<<< Updated upstream
        console.log(`[flyer-motion] Analysis complete. Prompt: ${prompt.substring(0, 50)}...`);
        
=======

        // Update the job with the generated prompt
>>>>>>> Stashed changes
        const { error: updateError } = await supabase
          .from("seedance_jobs")
          .update({ prompt, status: "pending" })
          .eq("id", jobId);
<<<<<<< Updated upstream
          
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
=======

        if (updateError) throw updateError;

        // Trigger the next step: seedance-generate/process
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
>>>>>>> Stashed changes
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // Standard request from client
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

<<<<<<< Updated upstream
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
=======
    console.log("[flyer-motion-v3] Queuing analysis for Job:", jobId);

    // Fire and forget background process
    fetch(`${supabaseUrl}/functions/v1/runninghub-flyer-motion/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ jobId, imageUrl }),
    }).catch(err => console.error("[flyer-motion-v3] background process trigger failed:", err));
>>>>>>> Stashed changes

    return jsonResponse({ success: true, queued: true, jobId });

  } catch (err: any) {
<<<<<<< Updated upstream
    console.error(`[flyer-motion] Fatal error: ${err.message}`);
=======
    console.error("[flyer-motion-v3] FATAL:", err.message, err.stack);
>>>>>>> Stashed changes
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});

async function analyzeFlyer(imageUrl: string): Promise<string> {
    console.log("[flyer-motion-v3] Starting Analysis for:", imageUrl.substring(0, 60));

    // ========== 1. START ==========
    const startController = new AbortController();
    const startTimer = setTimeout(() => startController.abort(), FETCH_TIMEOUT_MS);

    let startResponse: Response;
    try {
      startResponse = await fetch(
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
          signal: startController.signal,
        }
      );
    } catch (e: any) {
      console.error("[flyer-motion-v3] START fetch failed:", e.message);
      throw new Error("Failed to connect to RunningHub: " + e.message);
    } finally {
      clearTimeout(startTimer);
    }

    const startText = await startResponse.text();
    console.log("[flyer-motion-v3] START raw response:", startText.substring(0, 500));

    let startData: any;
    try {
      startData = JSON.parse(startText);
    } catch {
      console.error("[flyer-motion-v3] START response not JSON:", startText.substring(0, 200));
      throw new Error("RunningHub returned non-JSON: " + startText.substring(0, 100));
    }

    // queue-manager reads: data.taskId
    const taskId = startData?.taskId || startData?.data?.taskId;

    if (!taskId) {
      console.error("[flyer-motion-v3] No taskId. Full response:", startText.substring(0, 500));
      throw new Error("No taskId from RunningHub: " + (startData?.msg || startData?.message || startText.substring(0, 100)));
    }

    console.log("[flyer-motion-v3] Got taskId:", taskId);

    // ========== 2. POLLING ==========
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      let statusText: string;
      try {
        const ctrl = new AbortController();
        const tmr = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const statusRes = await fetch(
          "https://www.runninghub.ai/task/openapi/status",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
            signal: ctrl.signal,
          }
        );
        clearTimeout(tmr);
        statusText = await statusRes.text();
      } catch (e: any) {
        console.warn(`[flyer-motion-v3] Poll ${i + 1} network error:`, e.message);
        continue;
      }

      let statusData: any;
      try {
        statusData = JSON.parse(statusText);
      } catch {
        console.warn(`[flyer-motion-v3] Poll ${i + 1} non-JSON:`, statusText.substring(0, 100));
        continue;
      }

      // Log FULL raw response for debugging
      console.log(`[flyer-motion-v3] Poll ${i + 1} raw:`, statusText.substring(0, 400));

      // queue-manager checks: statusData.code !== 0 → error
      if (statusData.code !== undefined && statusData.code !== 0) {
        console.warn(`[flyer-motion-v3] Poll ${i + 1} code=${statusData.code} msg=${statusData.msg}`);
        // Don't continue forever on auth errors
        if (statusData.code === 401 || statusData.code === 403) {
          throw new Error("RunningHub auth error: " + (statusData.msg || statusData.code));
        }
        continue;
      }

      // RunningHub status endpoint returns `data` as a STRING ("RUNNING" | "SUCCESS" | "FAILED")
      // Some workflows return an object with .status/.taskStatus — handle both shapes.
      const rawData = statusData.data;
      const taskStatus = (
        typeof rawData === "string"
          ? rawData
          : rawData?.status || rawData?.taskStatus || ""
      ).toUpperCase();

      if (taskStatus === "FAILED" || taskStatus === "ERROR") {
        const errMsg =
          rawData?.failedReason?.exception_message ||
          rawData?.errorMessage ||
          statusData.msg ||
          "RunningHub job failed";
        console.error("[flyer-motion-v3] FAILED:", errMsg);
        throw new Error(errMsg);
      }

      if (taskStatus === "SUCCESS" || taskStatus === "COMPLETED") {
        console.log("[flyer-motion-v3] Job completed! Fetching outputs...");

        // When `data` is a string, the status endpoint does NOT include the file list.
        // Need to call the outputs endpoint to get the actual results.
        let results: any[] = [];
        if (typeof rawData === "string") {
          try {
            const ctrl = new AbortController();
            const tmr = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
            const outRes = await fetch(
              "https://www.runninghub.ai/task/openapi/outputs",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey: runningHubApiKey, taskId }),
                signal: ctrl.signal,
              }
            );
            clearTimeout(tmr);
            const outText = await outRes.text();
            console.log("[flyer-motion-v3] outputs raw:", outText.substring(0, 500));
            const outData = JSON.parse(outText);
            results = outData?.data?.outputFileList || outData?.data || outData?.data?.results || [];
            if (!Array.isArray(results)) results = [results].filter(Boolean);
          } catch (e: any) {
            console.error("[flyer-motion-v3] outputs fetch failed:", e.message);
            throw new Error("Failed to fetch RunningHub outputs: " + e.message);
          }
        } else {
          results = rawData?.outputFileList || rawData?.results || [];
        }
        console.log("[flyer-motion-v3] results count:", results.length);

        if (results.length === 0) {
          console.error("[flyer-motion-v3] No results in completed response:", statusText.substring(0, 500));
          throw new Error("No output from RunningHub workflow");
        }

        // Find .txt file, or use first result
        const txtResult = results.find((r: any) => {
          const type = (r?.outputType || r?.fileType || "").toLowerCase();
          const url = (r?.fileUrl || r?.url || "").toLowerCase();
          return type === "txt" || url.endsWith(".txt");
        });
        const target = txtResult || results[0];
        const fileUrl = target?.fileUrl || target?.url || target?.text || target;

        // If outputs returned plain text directly (not a URL), use it
        if (typeof fileUrl === "string" && !fileUrl.startsWith("http")) {
          console.log("[flyer-motion-v3] SUCCESS (inline text)");
          return fileUrl.trim();
        }

        if (!fileUrl) {
          console.error("[flyer-motion-v3] No fileUrl in result:", JSON.stringify(target));
          throw new Error("No file URL in RunningHub output");
        }

        console.log("[flyer-motion-v3] Downloading:", fileUrl.substring(0, 100));

        // Download with retries — RunningHub CDN frequently throws http2 stream errors
        let prompt = "";
        let lastErr: any = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const ctrl = new AbortController();
            const tmr = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
            const dlRes = await fetch(fileUrl, {
              signal: ctrl.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ArcanoBot/1.0)",
                "Accept": "text/plain, */*",
              },
            });
            clearTimeout(tmr);
            if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status}`);
            prompt = (await dlRes.text()).trim();
            if (!prompt) throw new Error("Empty file");
            break;
          } catch (e: any) {
            lastErr = e;
            console.warn(`[flyer-motion-v3] Download attempt ${attempt} failed:`, e.message);
            if (attempt < 4) await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
        if (!prompt) {
          console.error("[flyer-motion-v3] Download failed after retries:", lastErr?.message);
          throw new Error("Failed to download prompt: " + (lastErr?.message || "unknown"));
        }

        console.log("[flyer-motion-v3] SUCCESS! Prompt:", prompt.substring(0, 120));
        return prompt;
      }

      // Still processing — taskStatus might be RUNNING, QUEUED, etc
      console.log(`[flyer-motion-v3] Poll ${i + 1}: still ${taskStatus || "unknown"}`);
    }

    throw new Error("RunningHub job timed out after 4 minutes");
}
