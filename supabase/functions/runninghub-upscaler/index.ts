import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNNINGHUB_API_KEY = (
  Deno.env.get('RUNNINGHUB_API_KEY') ||
  Deno.env.get('RUNNINGHUB_APIKEY') ||
  ''
).trim();

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

if (!RUNNINGHUB_API_KEY) {
  console.error('[RunningHub] CRITICAL: Missing RUNNINGHUB_API_KEY secret');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========== OBSERVABILITY HELPER ==========

async function logStep(jobId: string, step: string, details?: Record<string, any>): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = { step, timestamp, ...details };
  try {
    const { data: job } = await supabase.from('upscaler_jobs').select('step_history').eq('id', jobId).maybeSingle();
    const currentHistory = (job?.step_history as any[]) || [];
    await supabase.from('upscaler_jobs').update({
      current_step: step,
      step_history: [...currentHistory, entry],
    }).eq('id', jobId);
    console.log(`[RunningHub] Job ${jobId}: ${step}`, details || '');
  } catch (e) {
    console.error(`[logStep] Error:`, e);
  }
}

async function logStepFailure(jobId: string, failedAtStep: string, errorMessage: string, rawResponse?: Record<string, any>): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = { step: 'failed', timestamp, at_step: failedAtStep, error: errorMessage };
  try {
    const { data: job } = await supabase.from('upscaler_jobs').select('step_history').eq('id', jobId).maybeSingle();
    const currentHistory = (job?.step_history as any[]) || [];
    const updateData: Record<string, any> = {
      current_step: 'failed',
      failed_at_step: failedAtStep,
      step_history: [...currentHistory, entry],
    };
    if (rawResponse) updateData.raw_api_response = rawResponse;
    await supabase.from('upscaler_jobs').update(updateData).eq('id', jobId);
    console.log(`[RunningHub] Job ${jobId}: FAILED at ${failedAtStep}:`, errorMessage);
  } catch (e) {
    console.error(`[logStepFailure] Error:`, e);
  }
}

// ========== SAFE JSON + FETCH HELPERS ==========

async function safeParseResponse(response: Response, context: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  console.log(`[RunningHub] ${context} - Status: ${response.status}, ContentType: ${contentType}, BodyLength: ${text.length}`);
  if (!response.ok) {
    const snippet = text.slice(0, 300);
    throw new Error(`${context} failed (${response.status}): ${snippet.slice(0, 100)}`);
  }
  if (!contentType.includes('application/json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    throw new Error(`${context} returned non-JSON (${response.status}): ${text.slice(0, 100)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${context} invalid JSON (${response.status}): ${text.slice(0, 100)}`);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, context: string, maxRetries = 6): Promise<Response> {
  const retryableStatuses = [429, 502, 503, 504];
  const baseDelays = [2000, 4000, 8000, 15000, 25000, 40000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!retryableStatuses.includes(response.status)) return response;
      await response.text();
      if (attempt < maxRetries - 1) {
        const delay = (baseDelays[attempt] || 5000) + Math.random() * 2000;
        console.warn(`[RunningHub] ${context} got ${response.status}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw new Error(`${context} failed after ${maxRetries} retries (${response.status})`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (attempt >= maxRetries - 1) throw new Error(`${context} timed out after ${maxRetries} attempts`);
        await new Promise(r => setTimeout(r, (baseDelays[attempt] || 5000) + Math.random() * 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${context} failed - unexpected retry loop exit`);
}

function normalizeUpscalerCategory(category?: string | null): string {
  if (!category) return 'pessoas_perto';

  const normalized = category.trim();

  if (normalized === 'personas_cerca' || normalized === 'personas_perto') return 'pessoas_perto';
  if (normalized === 'personas_lejos' || normalized === 'personas_longe') return 'pessoas_longe';
  if (normalized === 'fotoAntigua') return 'fotoAntiga';

  return normalized;
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (path === 'upload') return await handleUpload(req);
    if (path === 'run') return await handleRun(req);
    if (path === 'queue-status') return await handleQueueStatus(req);
    if (path === 'fallback') return await handleFallback(req);
    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RunningHub] Unhandled error:', error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ========== UPLOAD ==========

async function handleUpload(req: Request) {
  if (!RUNNINGHUB_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured', code: 'MISSING_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { imageBase64, fileName } = await req.json();
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'imageBase64 is required', code: 'MISSING_IMAGE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const ext = (fileName || 'image.png').split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';

    const formData = new FormData();
    formData.append('apiKey', RUNNINGHUB_API_KEY);
    formData.append('fileType', 'image');
    formData.append('file', new Blob([bytes], { type: mimeType }), fileName || 'upload.png');

    const response = await fetchWithRetry('https://www.runninghub.ai/task/openapi/upload', { method: 'POST', body: formData }, 'Upload to RunningHub');
    const data = await safeParseResponse(response, 'Upload response');

    if (data.code !== 0) {
      return new Response(JSON.stringify({ error: data.msg || 'Upload failed', code: data.code }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, fileName: data.data.fileName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown upload error';
    console.error('[RunningHub] Upload error:', error);
    return new Response(JSON.stringify({ error: msg, code: 'UPLOAD_EXCEPTION' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// ========== RUN ==========

async function handleRun(req: Request) {
  if (!RUNNINGHUB_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured', code: 'MISSING_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const {
    jobId, imageUrl, fileName, detailDenoise, resolution, prompt,
    version, framingMode, userId, creditCost, category, editingLevel
  } = await req.json();

  // ========== JWT AUTH ==========
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_TOKEN' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const effectiveUserId = authUser.id;
  const normalizedCategory = normalizeUpscalerCategory(category);

  // ========== INPUT VALIDATION ==========
  if (!jobId || typeof jobId !== 'string') {
    return new Response(JSON.stringify({ error: 'Valid jobId is required', code: 'INVALID_JOB_ID' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (!imageUrl && !fileName) {
    return new Response(JSON.stringify({ error: 'imageUrl or fileName is required', code: 'MISSING_PARAMS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Validate imageUrl domain
  if (imageUrl) {
    const allowedDomains = ['supabase.co', 'supabase.in', SUPABASE_URL.replace('https://', '')];
    try {
      const urlObj = new URL(imageUrl);
      if (!allowedDomains.some(d => urlObj.hostname.endsWith(d))) {
        return new Response(JSON.stringify({ error: 'Image URL must be from Supabase storage', code: 'INVALID_IMAGE_SOURCE' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid image URL format', code: 'INVALID_IMAGE_URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  const validCategories = ['pessoas_perto', 'pessoas_longe', 'comida', 'fotoAntiga', 'logo', 'render3d'];
  if (category !== undefined && !validCategories.includes(normalizedCategory)) {
    return new Response(JSON.stringify({ error: 'Invalid category', code: 'INVALID_CATEGORY' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (typeof creditCost !== 'number' || creditCost < 1 || creditCost > 500) {
    return new Response(JSON.stringify({ error: 'Invalid credit cost', code: 'INVALID_CREDIT_COST' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ========== RATE LIMITING (1 job per 60s per user) ==========
  const RATE_LIMIT_SECONDS = 60;
  const rateLimitCutoff = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
  const { count: recentJobCount } = await supabase
    .from('upscaler_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', effectiveUserId)
    .in('status', ['pending', 'starting', 'running', 'queued'])
    .gt('created_at', rateLimitCutoff);

  if ((recentJobCount || 0) > 1) {
    console.log(`[RunningHub] Rate limit hit for user ${effectiveUserId}: ${recentJobCount} recent jobs`);
    return new Response(JSON.stringify({
      error: 'Demasiadas solicitudes. Espera 1 minuto entre cada trabajo.',
      code: 'RATE_LIMIT_EXCEEDED',
    }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await logStep(jobId, 'validating', { category: normalizedCategory, version, framingMode });

  // ========== TRANSFER IMAGE TO RUNNINGHUB ==========
  let rhFileName = fileName;

  if (imageUrl && !fileName) {
    console.log('[RunningHub] Downloading image from storage:', imageUrl);
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) throw new Error(`Failed to download image (${imageResponse.status})`);

      const imageBlob = await imageResponse.blob();
      const imageName = imageUrl.split('/').pop() || 'image.png';

      const formData = new FormData();
      formData.append('apiKey', RUNNINGHUB_API_KEY);
      formData.append('fileType', 'image');
      formData.append('file', imageBlob, imageName);

      const uploadResponse = await fetchWithRetry('https://www.runninghub.ai/task/openapi/upload', { method: 'POST', body: formData }, 'Image upload to RunningHub');
      const uploadData = await safeParseResponse(uploadResponse, 'Upload to RH');

      if (uploadData.code !== 0) throw new Error('RunningHub upload failed: ' + (uploadData.msg || 'Unknown'));
      rhFileName = uploadData.data.fileName;
      console.log('[RunningHub] Uploaded to RH, fileName:', rhFileName);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Image transfer failed';
      await logStepFailure(jobId, 'image_transfer', errorMsg);
      await supabase.from('upscaler_jobs').update({
        status: 'failed',
        error_message: `IMAGE_TRANSFER_ERROR: ${errorMsg.slice(0, 200)}`,
        failed_at_step: 'image_transfer',
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
      return new Response(JSON.stringify({ error: errorMsg, code: 'IMAGE_TRANSFER_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // ========== CONSUME CREDITS ==========
  console.log(`[RunningHub] Consuming ${creditCost} credits for user ${effectiveUserId}`);
  const { data: creditResult, error: creditError } = await supabase.rpc('consume_upscaler_credits', {
    _user_id: effectiveUserId,
    _amount: creditCost,
    _description: `Upscaler ${version || 'standard'} - ${resolution || 'auto'}`,
  });

  if (creditError) {
    return new Response(JSON.stringify({ error: 'Error al procesar créditos', code: 'CREDIT_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (!creditResult || creditResult.length === 0 || !creditResult[0].success) {
    return new Response(JSON.stringify({
      error: creditResult?.[0]?.error_message || 'Créditos insuficientes',
      code: 'INSUFFICIENT_CREDITS',
      currentBalance: creditResult?.[0]?.new_balance,
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Mark credits as charged
  await supabase.from('upscaler_jobs').update({ credits_charged: true, user_credit_cost: creditCost }).eq('id', jobId);
  console.log(`[RunningHub] Job ${jobId} credits_charged=true, new balance: ${creditResult[0].new_balance}`);

  // ========== SAVE JOB PAYLOAD FOR QUEUE MANAGER ==========
  await supabase.from('upscaler_jobs').update({
    input_file_name: rhFileName,
    job_payload: {
      category: normalizedCategory,
      version: version || 'standard',
      framingMode: framingMode || 'perto',
      detailDenoise,
      resolution,
      prompt,
      editingLevel,
      inputFileName: rhFileName,
    },
  }).eq('id', jobId);

  // ========== DELEGATE TO QUEUE MANAGER ==========
  try {
    await logStep(jobId, 'delegating_to_queue');

    const qmUrl = `${SUPABASE_URL}/functions/v1/runninghub-queue-manager/run-or-queue`;
    const qmResponse = await fetch(qmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ table: 'upscaler_jobs', jobId }),
    });
    const qmResult = await qmResponse.json();

    if (qmResult.queued) {
      console.log(`[RunningHub] Job ${jobId} queued at position ${qmResult.position}`);
      return new Response(JSON.stringify({ success: true, queued: true, position: qmResult.position }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (qmResult.taskId) {
      console.log(`[RunningHub] Job ${jobId} started with taskId: ${qmResult.taskId}`);
      return new Response(JSON.stringify({ success: true, taskId: qmResult.taskId, method: 'ai-app-v2' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: qmResult.error || 'Failed to start job', code: 'RUN_FAILED', refunded: true }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RunningHub] Queue Manager call failed:', errorMessage);
    // Refund on exception
    try {
      await supabase.rpc('refund_upscaler_credits', { _user_id: effectiveUserId, _amount: creditCost, _description: `QM_EXCEPTION_REFUNDED: ${errorMessage.slice(0, 100)}` });
      await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: `QM_EXCEPTION_REFUNDED: ${errorMessage.slice(0, 200)}`, credits_refunded: true, completed_at: new Date().toISOString() }).eq('id', jobId);
    } catch {
      await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: `QM_EXCEPTION: ${errorMessage.slice(0, 200)}`, completed_at: new Date().toISOString() }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ error: errorMessage, code: 'RUN_EXCEPTION', refunded: true }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

// ========== QUEUE STATUS ==========

async function handleQueueStatus(req: Request) {
  const { jobId } = await req.json();
  if (!jobId) return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: job, error } = await supabase.from('upscaler_jobs').select('status, position, output_url, error_message').eq('id', jobId).single();
  if (error || !job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ success: true, status: job.status, position: job.position, outputUrl: job.output_url, errorMessage: job.error_message }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ========== FALLBACK (De Longe → Standard) ==========

const WEBAPP_ID_STANDARD = '2017030861371219969';

async function handleFallback(req: Request) {
  const { jobId, inputFileName, detailDenoise, resolution, prompt } = await req.json();
  if (!jobId || !inputFileName) {
    return new Response(JSON.stringify({ error: 'jobId and inputFileName required', success: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    await supabase.from('upscaler_jobs').update({ status: 'running', current_step: 'fallback_running', started_at: new Date().toISOString() }).eq('id', jobId);
    await logStep(jobId, 'fallback_running', { workflow: 'standard', webappId: WEBAPP_ID_STANDARD });

    const nodeInfoList: any[] = [
      { nodeId: "26", fieldName: "image", fieldValue: inputFileName },
      { nodeId: "25", fieldName: "value", fieldValue: detailDenoise || 0.15 },
      { nodeId: "75", fieldName: "value", fieldValue: String(resolution || 2048) },
    ];
    if (prompt) nodeInfoList.push({ nodeId: "128", fieldName: "text", fieldValue: prompt });

    const response = await fetchWithRetry(
      `https://www.runninghub.ai/openapi/v2/run/ai-app/${WEBAPP_ID_STANDARD}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: RUNNINGHUB_API_KEY,
          webappId: WEBAPP_ID_STANDARD,
          nodeInfoList,
          callbackUrl: `${SUPABASE_URL}/functions/v1/runninghub-webhook`,
        }),
      },
      'Fallback RunningHub v2 call'
    );

    const data = await safeParseResponse(response, 'Fallback response');
    if (data.code !== 0) {
      await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: `FALLBACK_FAILED: ${data.msg}`, failed_at_step: 'fallback_start' }).eq('id', jobId);
      return new Response(JSON.stringify({ success: false, error: data.msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: 'FALLBACK_NO_TASKID', failed_at_step: 'fallback_start' }).eq('id', jobId);
      return new Response(JSON.stringify({ success: false, error: 'No taskId from fallback' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await supabase.from('upscaler_jobs').update({ task_id: taskId, current_step: 'fallback_processing', raw_api_response: data }).eq('id', jobId);
    await logStep(jobId, 'fallback_processing', { newTaskId: taskId, workflow: 'standard' });

    return new Response(JSON.stringify({ success: true, taskId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown fallback error';
    await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: `FALLBACK_EXCEPTION: ${msg}`, failed_at_step: 'fallback_start' }).eq('id', jobId);
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
