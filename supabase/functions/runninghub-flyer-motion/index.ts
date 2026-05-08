import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * runninghub-flyer-motion — Pipeline ÚNICA pra geração de flyer animado.
 *
 * Arquitetura:
 *   - Main route retorna 200 imediatamente com `{ success: true, queued: true }`
 *   - Pipeline completa roda em background via `EdgeRuntime.waitUntil`:
 *     1. Analisa flyer no RunningHub (WebApp 2048520932163063810) → prompt
 *     2. Atualiza seedance_jobs.prompt
 *     3. Chama seedance-generate/process (AWAITED, não fire-and-forget) que:
 *        - Cobra créditos
 *        - Chama Evolink Seedance 2.0
 *        - Atualiza seedance_jobs.task_id + status='running'
 *
 * Qualquer falha na pipeline marca o job como 'failed' com error_message,
 * o frontend (que faz polling) detecta e para o spinner. Se já tiver cobrado,
 * o seedance-generate é responsável pelo estorno via refund_seedance_job.
 *
 * Tudo dentro de waitUntil — não há mais 2 níveis de fire-and-forget.
 */

const WEBAPP_ID = "2048520932163063810";
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 36; // 3 min (margem pra Evolink dentro do limite de 5min do waitUntil)
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

async function markJobFailed(jobId: string, message: string) {
  try {
    await supabase
      .from("seedance_jobs")
      .update({
        status: "failed",
        error_message: (message || "Pipeline failed").substring(0, 500),
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (e: any) {
    console.error(`[flyer-motion] markJobFailed error for ${jobId}:`, e.message);
  }
}

/**
 * Pipeline completa: análise RH → update prompt → trigger seedance-generate (awaited).
 * Mantida viva por EdgeRuntime.waitUntil. Qualquer erro marca job como failed.
 */
async function runFullPipeline(jobId: string, imageUrl: string) {
  const t0 = Date.now();
  console.log(`[flyer-motion] Pipeline START job=${jobId}`);

  try {
    // ─── Step 1: Analisa flyer no RunningHub ───
    console.log(`[flyer-motion] Step 1/3: Analyzing flyer...`);
    const prompt = await analyzeFlyer(imageUrl);
    console.log(`[flyer-motion] Step 1/3 OK (${Date.now() - t0}ms): prompt=${prompt.substring(0, 80)}...`);

    // ─── Step 2: Atualiza job com prompt ───
    const { error: upErr } = await supabase
      .from("seedance_jobs")
      .update({ prompt, status: "pending" })
      .eq("id", jobId);
    if (upErr) throw new Error("DB update prompt failed: " + upErr.message);
    console.log(`[flyer-motion] Step 2/3 OK: job updated with prompt`);

    // ─── Step 3: Aciona seedance-generate/process (awaited) ───
    console.log(`[flyer-motion] Step 3/3: Triggering seedance-generate...`);
    const sgController = new AbortController();
    const sgTimer = setTimeout(() => sgController.abort(), 90_000); // 90s pra Evolink
    let sgResp: Response;
    try {
      sgResp = await fetch(`${supabaseUrl}/functions/v1/seedance-generate/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
          "apikey": supabaseKey, // gateway requer apikey
          "x-internal-key": supabaseKey, // backup caso gateway reescreva Authorization
        },
        body: JSON.stringify({ jobId }),
        signal: sgController.signal,
      });
    } finally {
      clearTimeout(sgTimer);
    }

    const sgText = await sgResp.text();
    console.log(`[flyer-motion] Step 3/3: seedance-generate ${sgResp.status} body=${sgText.substring(0, 300)}`);

    if (!sgResp.ok) {
      throw new Error(`seedance-generate returned ${sgResp.status}: ${sgText.substring(0, 200)}`);
    }

    console.log(`[flyer-motion] Pipeline COMPLETE (${Date.now() - t0}ms) job=${jobId}`);
  } catch (err: any) {
    console.error(`[flyer-motion] Pipeline FAILED (${Date.now() - t0}ms) job=${jobId}:`, err.message);
    await markJobFailed(jobId, err.message);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!runningHubApiKey) {
      return jsonResponse({ error: "RUNNINGHUB_API_KEY not configured" }, 500);
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
    if (!imageUrl || !jobId) {
      return jsonResponse({ error: "imageUrl and jobId are required" }, 400);
    }

    console.log(`[flyer-motion] Queuing pipeline for jobId=${jobId}`);

    // Inicia pipeline em background. EdgeRuntime.waitUntil garante que o runtime
    // não mate a execução antes da pipeline terminar (até ~5min).
    const work = runFullPipeline(jobId, imageUrl);

    // @ts-ignore — EdgeRuntime existe no Deno Deploy do Supabase
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any)?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      // Fallback: roda sem waitUntil (ambiente local/teste)
      work.catch((e) => console.error("[flyer-motion] no-waitUntil work error:", e));
    }

    return jsonResponse({ success: true, queued: true, jobId });
  } catch (err: any) {
    console.error("[flyer-motion] FATAL:", err.message, err.stack);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});

/**
 * Analisa o flyer no RunningHub via WebApp 2048520932163063810.
 * Retorna o prompt de animação como string (texto extraído do output).
 */
async function analyzeFlyer(imageUrl: string): Promise<string> {
    console.log("[flyer-motion] analyzeFlyer START:", imageUrl.substring(0, 60));

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
      console.error("[flyer-motion] START fetch failed:", e.message);
      throw new Error("Failed to connect to RunningHub: " + e.message);
    } finally {
      clearTimeout(startTimer);
    }

    const startText = await startResponse.text();
    console.log("[flyer-motion] START raw:", startText.substring(0, 500));

    let startData: any;
    try {
      startData = JSON.parse(startText);
    } catch {
      throw new Error("RunningHub non-JSON: " + startText.substring(0, 100));
    }

    const taskId = startData?.taskId || startData?.data?.taskId;
    if (!taskId) {
      throw new Error("No taskId from RunningHub: " + (startData?.msg || startData?.message || startText.substring(0, 100)));
    }
    console.log("[flyer-motion] Got taskId:", taskId);

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
        console.warn(`[flyer-motion] Poll ${i + 1} network error:`, e.message);
        continue;
      }

      let statusData: any;
      try {
        statusData = JSON.parse(statusText);
      } catch {
        console.warn(`[flyer-motion] Poll ${i + 1} non-JSON:`, statusText.substring(0, 100));
        continue;
      }

      if (statusData.code !== undefined && statusData.code !== 0) {
        console.warn(`[flyer-motion] Poll ${i + 1} code=${statusData.code} msg=${statusData.msg}`);
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
        const errMsg =
          rawData?.failedReason?.exception_message ||
          rawData?.errorMessage ||
          statusData.msg ||
          "RunningHub job failed";
        throw new Error(errMsg);
      }

      if (taskStatus === "SUCCESS" || taskStatus === "COMPLETED") {
        console.log("[flyer-motion] Job completed! Fetching outputs...");

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
            console.log("[flyer-motion] outputs raw:", outText.substring(0, 500));
            const outData = JSON.parse(outText);
            results = outData?.data?.outputFileList || outData?.data || outData?.data?.results || [];
            if (!Array.isArray(results)) results = [results].filter(Boolean);
          } catch (e: any) {
            throw new Error("Failed to fetch RunningHub outputs: " + e.message);
          }
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
          console.log("[flyer-motion] SUCCESS (inline text)");
          return fileUrl.trim();
        }

        if (!fileUrl) {
          throw new Error("No file URL in RunningHub output");
        }

        console.log("[flyer-motion] Downloading:", fileUrl.substring(0, 100));

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
            console.warn(`[flyer-motion] Download attempt ${attempt} failed:`, e.message);
            if (attempt < 4) await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
        if (!prompt) {
          throw new Error("Failed to download prompt: " + (lastErr?.message || "unknown"));
        }

        console.log("[flyer-motion] SUCCESS! Prompt:", prompt.substring(0, 120));
        return prompt;
      }

      console.log(`[flyer-motion] Poll ${i + 1}: still ${taskStatus || "unknown"}`);
    }

    throw new Error(`RunningHub job timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 60000} min`);
}
