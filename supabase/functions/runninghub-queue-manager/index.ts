import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * RUNNINGHUB QUEUE MANAGER — Centralized job orchestrator
 *
 * Endpoints:
 * - /check-user-active — Check if user has active job
 * - /run-or-queue — Decide: run immediately or enqueue (FIFO)
 * - /process-next — Process next queued job
 * - /finish — Finalize job (called by webhook)
 * - /cancel-session — Cancel queued jobs for a session
 * - /retry — Re-submit a failed job
 * - /reconcile — Query RunningHub for actual status
 * - /check — Check global capacity
 * - /status — Full queue status
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GLOBAL_MAX_CONCURRENT = 20;
const SLOTS_PER_ACCOUNT = 20;

const WEBAPP_IDS: Record<string, any> = {
  upscaler_jobs: {
    personas_sin_rostro: '2037188547966406658',
    personas_con_rostro: '2037184937371115522',
    fotoAntigua: '2018913880214343681',
    comida: '2015855359243587585',
    logo: '2019239272464785409',
    render3d: '2019234965992509442',
  },
};

const JOB_TABLES = ['upscaler_jobs'] as const;
type JobTable = typeof JOB_TABLES[number];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TOOL_NAMES: Record<JobTable, string> = {
  upscaler_jobs: 'Upscaler Arcano',
};

interface ApiAccount { name: string; apiKey: string; maxSlots: number; }

// ==================== HELPERS ====================

function normalizeUpscalerCategory(category?: string | null): string {
  if (!category) return 'pessoas_perto';

  const normalized = category.trim();

  if (normalized === 'personas_cerca' || normalized === 'personas_perto') return 'pessoas_perto';
  if (normalized === 'personas_lejos' || normalized === 'personas_longe') return 'pessoas_longe';
  if (normalized === 'fotoAntigua') return 'fotoAntiga';

  return normalized;
}

function getAvailableApiAccounts(): ApiAccount[] {
  const accounts: ApiAccount[] = [];
  const key1 = (Deno.env.get('RUNNINGHUB_API_KEY') || '').trim();
  if (key1) accounts.push({ name: 'primary', apiKey: key1, maxSlots: SLOTS_PER_ACCOUNT });
  return accounts;
}

async function getRunningCountByAccount(accountName: string): Promise<number> {
  let total = 0;
  for (const table of JOB_TABLES) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('status', ['running', 'starting']).eq('api_account', accountName);
    total += count || 0;
  }
  return total;
}

async function getGlobalRunningCount(): Promise<number> {
  let total = 0;
  for (const table of JOB_TABLES) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('status', ['running', 'starting']);
    total += count || 0;
  }
  return total;
}

async function getAccountWithAvailableSlot(): Promise<ApiAccount | null> {
  for (const account of getAvailableApiAccounts()) {
    const running = await getRunningCountByAccount(account.name);
    if (running < account.maxSlots) return account;
  }
  return null;
}

async function getTotalQueuedCount(): Promise<number> {
  let total = 0;
  for (const table of JOB_TABLES) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('status', 'queued');
    total += count || 0;
  }
  return total;
}

async function updateAllQueuePositions(): Promise<void> {
  const allQueued: { id: string; created_at: string; table: JobTable }[] = [];
  for (const table of JOB_TABLES) {
    const { data: jobs } = await supabase.from(table).select('id, created_at').eq('status', 'queued');
    if (jobs) for (const job of jobs) allQueued.push({ ...job, table });
  }
  allQueued.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (let i = 0; i < allQueued.length; i++) {
    await supabase.from(allQueued[i].table).update({ position: i + 1 }).eq('id', allQueued[i].id);
  }
}

async function refundCreditsIfNeeded(table: string, jobId: string, userId: string | null, creditCost: number | null, creditsCharged: boolean, creditsRefunded: boolean): Promise<number> {
  if (!creditsCharged || creditsRefunded || !creditCost || creditCost <= 0 || !userId) return 0;
  try {
    await supabase.rpc('refund_upscaler_credits', { _user_id: userId, _amount: creditCost, _description: 'Estorno automático: job falló' });
    await supabase.from(table).update({ credits_refunded: true }).eq('id', jobId);
    console.log(`[QueueManager] Refunded ${creditCost} credits to ${userId}`);
    return creditCost;
  } catch (error) {
    console.error('[QueueManager] Refund error:', error);
    return 0;
  }
}

async function logStep(table: string, jobId: string, step: string, details?: Record<string, any>): Promise<void> {
  const entry = { step, timestamp: new Date().toISOString(), ...details };
  try {
    const { data: job } = await supabase.from(table).select('step_history').eq('id', jobId).maybeSingle();
    const history = (job?.step_history as any[]) || [];
    await supabase.from(table).update({ current_step: step, step_history: [...history, entry] }).eq('id', jobId);
    console.log(`[${table}] Job ${jobId}: ${step}`, details || '');
  } catch (e) { console.error(`[logStep] Error:`, e); }
}

async function cleanupOrphanPendingJobs(): Promise<number> {
  const PENDING_TIMEOUT_SECONDS = 180;
  let totalCleaned = 0;
  for (const table of JOB_TABLES) {
    const { data: orphans } = await supabase.from(table).select('id, step_history, current_step')
      .eq('status', 'pending').is('task_id', null)
      .lt('created_at', new Date(Date.now() - PENDING_TIMEOUT_SECONDS * 1000).toISOString());
    if (!orphans) continue;
    for (const orphan of orphans) {
      const stepHistory = (orphan as any).step_history;
      const currentStep = (orphan as any).current_step;
      if (stepHistory && Array.isArray(stepHistory) && stepHistory.length > 0) continue;
      if (currentStep && currentStep !== 'pending') continue;
      await supabase.from(table).update({
        status: 'failed', error_message: 'Timeout: servidor no respondió', current_step: 'failed',
        failed_at_step: 'pending_timeout', completed_at: new Date().toISOString(),
      }).eq('id', orphan.id).eq('status', 'pending');
      totalCleaned++;
    }
  }
  return totalCleaned;
}

// ==================== PUSH NOTIFICATIONS ====================

async function sendPushNotification(userId: string, jobStatus: string, toolName: string, refundedAmount: number): Promise<void> {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subscriptions || subscriptions.length === 0) return;

  const title = jobStatus === 'completed'
    ? `✅ ${toolName} — ¡Listo!`
    : `❌ ${toolName} — Error`;

  const body = jobStatus === 'completed'
    ? 'Tu imagen fue procesada con éxito. Toca para descargar.'
    : refundedAmount > 0
      ? `Hubo un error. ${refundedAmount} créditos fueron devueltos.`
      : 'Hubo un error en el procesamiento. Intenta de nuevo.';

  // Web Push requires VAPID keys — use simple fetch-based approach
  // Since we don't have VAPID keys, we'll store the notification in a lightweight way
  // and let the service worker poll, OR use the Notification API via the open tab
  // For now, log that we'd send and the frontend handles via Realtime
  console.log(`[QueueManager] Push notification for ${userId}: ${title} - ${body}`);
  
  // If VAPID keys are configured, send actual push
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
  const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
  
  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    console.log('[QueueManager] VAPID keys not configured, skipping web push');
    return;
  }

  for (const sub of subscriptions) {
    try {
      // Use web-push compatible fetch
      const pushPayload = JSON.stringify({ title, body, icon: '/favicon.ico', data: { url: '/upscaler-arcano-tool' } });
      
      // Simple notification via the endpoint (requires proper VAPID signing)
      // For MVP: the frontend already handles notifications via Realtime subscriptions
      console.log(`[QueueManager] Would send push to endpoint: ${sub.endpoint.slice(0, 50)}...`);
    } catch (e) {
      console.error('[QueueManager] Push send error:', e);
    }
  }
}

// ==================== RUNNINGHUB API v2 ====================

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
        await new Promise(r => setTimeout(r, (baseDelays[attempt] || 5000) + Math.random() * 2000));
      } else {
        throw new Error(`${context} failed after ${maxRetries} retries`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (baseDelays[attempt] || 5000) + Math.random() * 2000));
        continue;
      }
      if (attempt >= maxRetries - 1) throw err;
    }
  }
  throw new Error(`${context} failed`);
}

async function startJobOnRunningHub(table: JobTable, job: any, account: ApiAccount): Promise<{ taskId: string | null }> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/runninghub-webhook`;
  const p = job.job_payload || {};

  let webappId: string;
  let nodeInfoList: any[];

  if (table === 'upscaler_jobs') {
    const category = normalizeUpscalerCategory(p.category || job.category || 'pessoas_perto');
    const inputFile = p.inputFileName || job.input_file_name;
    const detailDenoise = p.detailDenoise ?? job.detail_denoise;
    let resolution = p.resolution || job.resolution;
    const prompt = p.prompt || job.prompt;

    // VRAM guardrail
    if (resolution && Number(resolution) > 2048) {
      console.log(`[QueueManager] VRAM guardrail: capping resolution from ${resolution} to 2048`);
      resolution = 2048;
    }

    if (category === 'fotoAntiga') {
      webappId = WEBAPP_IDS.upscaler_jobs.fotoAntigua;
      nodeInfoList = [{ nodeId: "139", fieldName: "image", fieldValue: inputFile }];
    } else if (category === 'comida') {
      webappId = WEBAPP_IDS.upscaler_jobs.comida;
      nodeInfoList = [{ nodeId: "50", fieldName: "image", fieldValue: inputFile }];
      if (detailDenoise !== undefined) nodeInfoList.push({ nodeId: "48", fieldName: "value", fieldValue: String(detailDenoise) });
    } else if (category === 'logo') {
      webappId = WEBAPP_IDS.upscaler_jobs.logo;
      nodeInfoList = [{ nodeId: "39", fieldName: "image", fieldValue: inputFile }];
      if (detailDenoise !== undefined) nodeInfoList.push({ nodeId: "33", fieldName: "value", fieldValue: String(detailDenoise) });
    } else if (category === 'render3d') {
      webappId = WEBAPP_IDS.upscaler_jobs.render3d;
      nodeInfoList = [{ nodeId: "301", fieldName: "image", fieldValue: inputFile }];
      if (detailDenoise !== undefined) nodeInfoList.push({ nodeId: "300", fieldName: "value", fieldValue: String(detailDenoise) });
    } else if (category.startsWith('pessoas') && (!detailDenoise || detailDenoise <= 0)) {
      // Pessoas sem detalhar rosto
      webappId = WEBAPP_IDS.upscaler_jobs.personas_sin_rostro;
      nodeInfoList = [
        { nodeId: "1", fieldName: "image", fieldValue: inputFile },
        { nodeId: "548", fieldName: "value", fieldValue: String(resolution || 4096) },
      ];
    } else {
      // Pessoas com detalhar rosto
      webappId = WEBAPP_IDS.upscaler_jobs.personas_con_rostro;
      nodeInfoList = [
        { nodeId: "1", fieldName: "image", fieldValue: inputFile },
        { nodeId: "102", fieldName: "value", fieldValue: String(detailDenoise) },
        { nodeId: "547", fieldName: "value", fieldValue: String(resolution || 4096) },
      ];
    }
  } else {
    console.error(`[QueueManager] Unknown table: ${table}`);
    return { taskId: null };
  }

  console.log(`[QueueManager] Starting job ${job.id} on RunningHub v2 - webapp: ${webappId}`);

  try {
    const requestBody = {
      nodeInfoList,
      instanceType: "default",
      usePersonalQueue: false,
      webhookUrl,
    };

    console.log(`[QueueManager] Request body:`, JSON.stringify(requestBody));

    const response = await fetchWithRetry(
      `https://www.runninghub.ai/openapi/v2/run/ai-app/${webappId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${account.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
      'RunningHub v2 API call'
    );

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch {
      throw new Error(`RunningHub returned non-JSON: ${text.slice(0, 200)}`);
    }

    console.log(`[QueueManager] RunningHub response:`, JSON.stringify(data));

    // v2 API returns taskId directly at root level
    const taskId = data.taskId || data.data?.taskId;
    if (!taskId && data.code && data.code !== 0) {
      throw new Error(data.msg || `RunningHub error code ${data.code}`);
    }
    if (!taskId) throw new Error('No taskId in RunningHub response');

    // Update job with taskId and running status
    await supabase.from(table).update({
      status: 'running', task_id: taskId, current_step: 'running',
      started_at: new Date().toISOString(), raw_api_response: data,
    }).eq('id', job.id);

    await logStep(table, job.id, 'running', { taskId, webappId, account: account.name });

    return { taskId };
  } catch (error: any) {
    const errorMsg = error.message || 'RunningHub API call failed';
    console.error(`[QueueManager] startJobOnRunningHub failed:`, errorMsg);

    // Refund and mark failed
    await refundCreditsIfNeeded(table, job.id, job.user_id, job.user_credit_cost, job.credits_charged ?? false, job.credits_refunded ?? false);

    await supabase.from(table).update({
      status: 'failed', error_message: errorMsg, current_step: 'failed',
      failed_at_step: 'runninghub_api', completed_at: new Date().toISOString(),
    }).eq('id', job.id);

    await logStep(table, job.id, 'failed', { error: errorMsg, at: 'runninghub_api' });
    return { taskId: null };
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    console.log(`[QueueManager] Endpoint: ${path}`);

    switch (path) {
      case 'check': return await handleCheck();
      case 'check-user-active': return await handleCheckUserActive(req);
      case 'process-next': return await handleProcessNext();
      case 'finish': return await handleFinish(req);
      case 'cancel-session': return await handleCancelSession(req);
      case 'run-or-queue': return await handleRunOrQueue(req);
      case 'retry': return await handleRetry(req);
      case 'reconcile': return await handleReconcile(req);
      case 'status': return await handleStatus();
      default:
        return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ==================== ENDPOINT HANDLERS ====================

async function handleCheck(): Promise<Response> {
  const running = await getGlobalRunningCount();
  const queued = await getTotalQueuedCount();
  const available = await getAccountWithAvailableSlot();
  const mustQueue = running >= GLOBAL_MAX_CONCURRENT || queued > 0;
  return new Response(JSON.stringify({
    available: !mustQueue && available !== null, running, maxConcurrent: GLOBAL_MAX_CONCURRENT,
    slotsAvailable: Math.max(0, GLOBAL_MAX_CONCURRENT - running), totalQueued: queued,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCheckUserActive(req: Request): Promise<Response> {
  const { userId } = await req.json();
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const PENDING_GRACE_SECONDS = 185;
  const pendingCutoff = new Date(Date.now() - PENDING_GRACE_SECONDS * 1000).toISOString();

  for (const table of JOB_TABLES) {
    const { data: activeJob } = await supabase.from(table).select('id, status').eq('user_id', userId).in('status', ['running', 'queued', 'starting']).limit(1).maybeSingle();
    if (activeJob) {
      return new Response(JSON.stringify({ hasActiveJob: true, activeTool: TOOL_NAMES[table], activeJobId: activeJob.id, activeStatus: activeJob.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: pendingJob } = await supabase.from(table).select('id, status').eq('user_id', userId).eq('status', 'pending').is('task_id', null).gt('created_at', pendingCutoff).limit(1).maybeSingle();
    if (pendingJob) {
      return new Response(JSON.stringify({ hasActiveJob: true, activeTool: TOOL_NAMES[table], activeJobId: pendingJob.id, activeStatus: 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
  return new Response(JSON.stringify({ hasActiveJob: false, activeTool: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRunOrQueue(req: Request): Promise<Response> {
  const { table, jobId } = await req.json();
  if (!table || !jobId || !JOB_TABLES.includes(table as JobTable)) {
    return new Response(JSON.stringify({ error: 'Valid table and jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log(`[QueueManager] /run-or-queue: table=${table}, jobId=${jobId}`);
  await cleanupOrphanPendingJobs();

  const globalRunning = await getGlobalRunningCount();
  const totalQueued = await getTotalQueuedCount();
  console.log(`[QueueManager] running=${globalRunning}, queued=${totalQueued}, max=${GLOBAL_MAX_CONCURRENT}`);

  // Can start immediately if below limit and no queue
  if (globalRunning < GLOBAL_MAX_CONCURRENT && totalQueued === 0) {
    const available = await getAccountWithAvailableSlot();
    if (available) {
      const { data: job } = await supabase.from(table).select('*').eq('id', jobId).maybeSingle();
      if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await supabase.from(table).update({
        status: 'starting', current_step: 'starting', started_at: new Date().toISOString(),
        position: 0, waited_in_queue: false, api_account: available.name,
      }).eq('id', jobId);
      await logStep(table, jobId, 'starting', { accountName: available.name, via: 'run-or-queue' });

      const result = await startJobOnRunningHub(table as JobTable, job, available);
      if (result.taskId) {
        return new Response(JSON.stringify({ success: true, taskId: result.taskId, accountUsed: available.name }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: 'Failed to start on RunningHub', refunded: true }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  // Enqueue (FIFO)
  const { data: job } = await supabase.from(table).select('created_at').eq('id', jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let position = 1;
  for (const t of JOB_TABLES) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('status', 'queued').lt('created_at', job.created_at);
    position += count || 0;
  }

  await supabase.from(table).update({ status: 'queued', current_step: 'queued', position, waited_in_queue: true }).eq('id', jobId);
  await logStep(table, jobId, 'queued', { position, via: 'run-or-queue' });

  return new Response(JSON.stringify({ success: true, queued: true, position, totalQueued: await getTotalQueuedCount() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleProcessNext(): Promise<Response> {
  await cleanupOrphanPendingJobs();
  const running = await getGlobalRunningCount();
  if (running >= GLOBAL_MAX_CONCURRENT) {
    return new Response(JSON.stringify({ processed: false, reason: 'Global limit reached' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const available = await getAccountWithAvailableSlot();
  if (!available) return new Response(JSON.stringify({ processed: false, reason: 'No slots' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let oldest: { table: JobTable; job: any } | null = null;
  for (const table of JOB_TABLES) {
    const { data: job } = await supabase.from(table).select('*').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (!job) continue;
    if (!oldest || new Date(job.created_at) < new Date(oldest.job.created_at)) oldest = { table, job };
  }
  if (!oldest) return new Response(JSON.stringify({ processed: false, reason: 'No queued jobs' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const queueWait = Math.round((Date.now() - new Date(oldest.job.created_at).getTime()) / 1000);
  await supabase.from(oldest.table).update({
    status: 'starting', current_step: 'starting', started_at: new Date().toISOString(),
    position: 0, queue_wait_seconds: queueWait, api_account: available.name,
  }).eq('id', oldest.job.id);

  const result = await startJobOnRunningHub(oldest.table, oldest.job, available);
  await updateAllQueuePositions();

  return new Response(JSON.stringify({ processed: true, table: oldest.table, jobId: oldest.job.id, taskId: result.taskId, queueWait }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleFinish(req: Request): Promise<Response> {
  const { table, jobId, status, outputUrl, errorMessage, taskId, rhCost, webhookPayload } = await req.json();
  if (!table || !jobId) return new Response(JSON.stringify({ error: 'table and jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: job } = await supabase.from(table).select('user_id, user_credit_cost, credits_charged, credits_refunded, status').eq('id', jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Idempotency
  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
    return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isFailure = status === 'failed' || status === 'cancelled';
  let refundedAmount = 0;
  if (isFailure) {
    refundedAmount = await refundCreditsIfNeeded(table, jobId, job.user_id, job.user_credit_cost, job.credits_charged ?? false, job.credits_refunded ?? false);
  }

  const updateData: Record<string, any> = { status, completed_at: new Date().toISOString(), current_step: status };
  if (outputUrl) updateData.output_url = outputUrl;
  if (errorMessage) { updateData.error_message = errorMessage; updateData.failed_at_step = 'webhook_received'; }
  if (rhCost) updateData.rh_cost = rhCost;
  if (webhookPayload) updateData.raw_webhook_payload = webhookPayload;
  await supabase.from(table).update(updateData).eq('id', jobId);
  await logStep(table, jobId, status, { outputUrl: outputUrl ? 'received' : null, error: errorMessage, refundedAmount });

  // ========== PUSH NOTIFICATION ==========
  if (job.user_id && (status === 'completed' || status === 'failed')) {
    sendPushNotification(job.user_id, status, TOOL_NAMES[table as JobTable] || 'Herramienta IA', refundedAmount).catch(e =>
      console.error('[QueueManager] Push notification error:', e)
    );
  }

  // Process next (fire-and-forget)
  fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/process-next`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }, body: '{}',
  }).catch(e => console.error('[QueueManager] process-next error:', e));

  return new Response(JSON.stringify({ success: true, refundedAmount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCancelSession(req: Request): Promise<Response> {
  const { sessionId, userId } = await req.json();
  if (!sessionId && !userId) return new Response(JSON.stringify({ error: 'sessionId or userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let cancelled = 0;
  for (const table of JOB_TABLES) {
    let query = supabase.from(table).select('id, user_id, user_credit_cost, credits_charged, credits_refunded').eq('status', 'queued');
    if (sessionId) query = query.eq('session_id', sessionId);
    else if (userId) query = query.eq('user_id', userId);
    const { data: jobs } = await query;
    if (!jobs) continue;
    for (const job of jobs) {
      await refundCreditsIfNeeded(table, job.id, job.user_id, job.user_credit_cost, job.credits_charged ?? false, job.credits_refunded ?? false);
      await supabase.from(table).update({ status: 'cancelled', error_message: 'Session cancelled', completed_at: new Date().toISOString(), credits_refunded: true }).eq('id', job.id);
      cancelled++;
    }
  }
  if (cancelled > 0) await updateAllQueuePositions();
  return new Response(JSON.stringify({ success: true, cancelled }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRetry(req: Request): Promise<Response> {
  const { table, jobId } = await req.json();
  if (!table || !jobId) return new Response(JSON.stringify({ error: 'table and jobId required', success: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: job } = await supabase.from(table).select('*').eq('id', jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'Job not found', success: false }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const account = await getAccountWithAvailableSlot();
  if (!account) {
    // Re-queue
    await supabase.from(table).update({ status: 'queued', current_step: 'queued' }).eq('id', jobId);
    return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await supabase.from(table).update({ status: 'starting', current_step: 'retry_starting', api_account: account.name }).eq('id', jobId);
  const result = await startJobOnRunningHub(table as JobTable, job, account);
  return new Response(JSON.stringify({ success: !!result.taskId, taskId: result.taskId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleReconcile(req: Request): Promise<Response> {
  const { table, jobId } = await req.json();
  if (!table || !jobId) return new Response(JSON.stringify({ resolved: false, error: 'table and jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: job } = await supabase.from(table).select('task_id, status, api_account').eq('id', jobId).maybeSingle();
  if (!job || !job.task_id) return new Response(JSON.stringify({ resolved: false, reason: 'no_task_id' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (['completed', 'failed', 'cancelled'].includes(job.status)) return new Response(JSON.stringify({ resolved: true, status: job.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const accounts = getAvailableApiAccounts();
  const account = accounts.find(a => a.name === job.api_account) || accounts[0];
  if (!account) return new Response(JSON.stringify({ resolved: false, reason: 'no_api_key' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const statusResponse = await fetch('https://www.runninghub.ai/task/openapi/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: account.apiKey, taskId: job.task_id }),
    });
    const statusData = await statusResponse.json();
    const taskStatus = statusData.data?.status || statusData.data?.taskStatus;

    if (taskStatus === 'SUCCESS' || taskStatus === 'COMPLETED') {
      const results = statusData.data?.outputFileList || statusData.data?.results || [];
      let outputUrl: string | null = null;
      if (Array.isArray(results) && results.length > 0) {
        const img = results.find((r: any) => ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType || r.fileType));
        outputUrl = img?.fileUrl || img?.url || results[0]?.fileUrl || results[0]?.url || null;
      }
      if (outputUrl) {
        await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ table, jobId, status: 'completed', outputUrl, taskId: job.task_id }),
        });
        return new Response(JSON.stringify({ resolved: true, status: 'completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (taskStatus === 'FAILED' || taskStatus === 'ERROR') {
      const errorMsg = statusData.data?.errorMessage || 'Provider task failed';
      await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ table, jobId, status: 'failed', errorMessage: errorMsg }),
      });
      return new Response(JSON.stringify({ resolved: true, status: 'failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ resolved: false, reason: 'still_running', providerStatus: taskStatus }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ resolved: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

async function handleStatus(): Promise<Response> {
  const accounts = getAvailableApiAccounts();
  const accountsStats = [];
  for (const account of accounts) {
    const running = await getRunningCountByAccount(account.name);
    accountsStats.push({ name: account.name, running, maxSlots: account.maxSlots, available: Math.max(0, account.maxSlots - running) });
  }
  const totalRunning = accountsStats.reduce((s, a) => s + a.running, 0);
  const totalQueued = await getTotalQueuedCount();
  return new Response(JSON.stringify({
    totalRunning, totalQueued, totalMaxSlots: GLOBAL_MAX_CONCURRENT,
    slotsAvailable: Math.max(0, GLOBAL_MAX_CONCURRENT - totalRunning), accounts: accountsStats,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
