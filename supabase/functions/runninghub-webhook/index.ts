import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * RUNNINGHUB WEBHOOK — Centralized webhook for all AI tool jobs.
 * Handles TASK_END events from RunningHub API v2.
 * Delegates finalization to queue-manager/finish.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_JOB_TABLES = ['upscaler_jobs'] as const;

async function logStep(table: string, jobId: string, step: string, details?: Record<string, any>): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = { step, timestamp, ...details };
  try {
    const { data: job } = await supabase.from(table).select('step_history').eq('id', jobId).maybeSingle();
    const currentHistory = (job?.step_history as any[]) || [];
    await supabase.from(table).update({
      current_step: step,
      step_history: [...currentHistory, entry],
    }).eq('id', jobId);
    console.log(`[Webhook] ${table} Job ${jobId}: ${step}`, details || '');
  } catch (e) {
    console.error(`[logStep] Error:`, e);
  }
}

function isLongDistancePeopleCategory(category?: string | null): boolean {
  return category === 'pessoas_longe' || category === 'personas_lejos' || category === 'personas_longe';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log('[Webhook] Received:', JSON.stringify(payload));

    const event = payload.event;
    const taskId = payload.taskId;
    const eventData = payload.eventData || {};
    const taskStatus = eventData.status;

    console.log(`[Webhook] Event: ${event}, TaskId: ${taskId}, Status: ${taskStatus}`);

    // Only process TASK_END
    if (event !== 'TASK_END') {
      return new Response(JSON.stringify({ success: true, message: 'Event ignored' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Missing taskId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract output
    let outputUrl: string | null = null;
    let errorMessage: string | null = null;

    const results = eventData.results || [];
    if (Array.isArray(results) && results.length > 0) {
      const imageResult = results.find((r: any) =>
        ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType)
      );
      outputUrl = imageResult?.url || results[0]?.url || null;
    }

    if (taskStatus === 'FAILED') {
      const realError = eventData.failedReason?.exception_message;
      const genericError = eventData.errorMessage || eventData.errorCode || 'Processing failed';
      errorMessage = realError || genericError;
    }

    // Auto-retry for transient RunningHub infrastructure errors
    const TRANSIENT_INFRA_ERRORS = [
      'stale file handle', 'errno 116', 'oserror', 'filenotfounderror',
      'no such file or directory', 'input/output error', 'errno 5',
      'broken pipe', 'connection reset',
    ];

    const isTransientInfraError = errorMessage && TRANSIENT_INFRA_ERRORS.some(p =>
      errorMessage!.toLowerCase().includes(p)
    );
    const failedNodeName = eventData.failedReason?.node_name || '';
    const isLoadImageFailure = failedNodeName === 'LoadImage' || failedNodeName === 'LoadVideo';

    // Find job by task_id
    let jobTable: string | null = null;
    let jobData: any = null;

    for (const table of IMAGE_JOB_TABLES) {
      const { data: job, error: lookupError } = await supabase
        .from(table)
        .select('id, started_at, user_credit_cost, status')
        .eq('task_id', taskId)
        .maybeSingle();

      if (lookupError) { console.error(`[Webhook] Error querying ${table}:`, lookupError.message); continue; }

      if (job) {
        jobTable = table;
        jobData = job;
        console.log(`[Webhook] Found job in ${table}: ${job.id}, status: ${job.status}`);

        // Idempotency: skip if already terminal
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          console.log(`[Webhook] Job ${job.id} already terminal (${job.status}), skipping`);
          return new Response(JSON.stringify({ success: true, message: 'Duplicate webhook ignored' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Enrich with upscaler-specific columns for fallback logic
        if (table === 'upscaler_jobs') {
          const { data: enriched } = await supabase
            .from('upscaler_jobs')
            .select('category, fallback_attempted, input_file_name, detail_denoise, resolution, prompt, version')
            .eq('id', job.id)
            .maybeSingle();
          if (enriched) jobData = { ...jobData, ...enriched };
        }
        break;
      }
    }

    if (!jobData || !jobTable) {
      console.log('[Webhook] Job not found for taskId:', taskId);
      return new Response(JSON.stringify({ success: true, message: 'Job not found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save raw webhook payload
    await supabase.from(jobTable).update({ raw_webhook_payload: payload }).eq('id', jobData.id);
    await logStep(jobTable, jobData.id, 'webhook_received', { event, taskStatus, hasOutput: !!outputUrl });

    // Auto-retry for transient infra errors
    if (isTransientInfraError && (isLoadImageFailure || failedNodeName === '')) {
      const { data: jobHistory } = await supabase
        .from(jobTable)
        .select('step_history, job_payload')
        .eq('id', jobData.id)
        .maybeSingle();

      const history = (jobHistory?.step_history as any[]) || [];
      const retryCount = history.filter((h: any) => h.step === 'auto_retry').length;

      if (retryCount < 2 && jobHistory?.job_payload) {
        console.log(`[Webhook] AUTO-RETRY ${retryCount + 1}/2 for job ${jobData.id}: ${errorMessage}`);
        await logStep(jobTable, jobData.id, 'auto_retry', { attempt: retryCount + 1, originalError: errorMessage, failedNode: failedNodeName });

        try {
          const retryResponse = await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/retry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ table: jobTable, jobId: jobData.id }),
          });
          const retryResult = await retryResponse.json();
          if (retryResult.success) {
            return new Response(JSON.stringify({ success: true, autoRetry: true, attempt: retryCount + 1 }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (retryError) {
          console.error(`[Webhook] Auto-retry failed:`, retryError);
          await logStep(jobTable, jobData.id, 'auto_retry_failed', { error: String(retryError) });
        }
      } else if (retryCount >= 2) {
        errorMessage = `Error de infraestructura del servidor (${retryCount + 1}x): ${errorMessage}`;
      }
    }

    // Calculate RH cost
    const completedAt = new Date();
    let rhCost = 0;
    if (jobData.started_at && !errorMessage) {
      const processingSeconds = Math.max(1, Math.ceil((completedAt.getTime() - new Date(jobData.started_at).getTime()) / 1000));
      rhCost = Math.round(processingSeconds * 0.2);
    }

    // Auto-reconciliation if COMPLETED but no output
    if (!errorMessage && !outputUrl && taskStatus !== 'FAILED') {
      console.log(`[Webhook] COMPLETED without output, attempting auto-reconciliation...`);
      try {
        const statusResponse = await fetch('https://www.runninghub.ai/task/openapi/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: (Deno.env.get('RUNNINGHUB_API_KEY') || '').trim(), taskId }),
        });
        const statusData = await statusResponse.json();
        if (statusData.code === 0 && statusData.data) {
          const reconResults = statusData.data.outputFileList || statusData.data.results || [];
          if (Array.isArray(reconResults) && reconResults.length > 0) {
            const reconImage = reconResults.find((r: any) => ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType || r.fileType));
            outputUrl = reconImage?.fileUrl || reconImage?.url || reconResults[0]?.fileUrl || reconResults[0]?.url || null;
            console.log(`[Webhook] Auto-reconcile found output: ${outputUrl}`);
          }
        }
      } catch (reconError) {
        console.error(`[Webhook] Auto-reconcile failed:`, reconError);
      }
    }

    const newStatus = errorMessage ? 'failed' : (outputUrl ? 'completed' : 'failed');
    const finalError = errorMessage || (newStatus === 'failed' ? 'No output received' : null);

    // Fallback: De Longe → Standard (upscaler only)
    if (
      jobTable === 'upscaler_jobs' &&
      newStatus === 'failed' &&
      isLongDistancePeopleCategory(jobData.category) &&
      !jobData.fallback_attempted &&
      jobData.input_file_name
    ) {
      console.log(`[Webhook] FALLBACK TRIGGERED for job ${jobData.id}`);
      await supabase.from('upscaler_jobs').update({
        fallback_attempted: true, original_task_id: taskId,
        current_step: 'fallback_starting', error_message: null,
      }).eq('id', jobData.id);
      await logStep('upscaler_jobs', jobData.id, 'fallback_starting', { originalError: finalError, originalTaskId: taskId });

      try {
        const fallbackResponse = await fetch(`${SUPABASE_URL}/functions/v1/runninghub-upscaler/fallback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            jobId: jobData.id,
            inputFileName: jobData.input_file_name,
            detailDenoise: jobData.detail_denoise || 0.15,
            resolution: jobData.resolution || 2048,
            prompt: jobData.prompt,
          }),
        });
        const fallbackResult = await fallbackResponse.json();
        if (fallbackResult.success) {
          return new Response(JSON.stringify({ success: true, fallback: true }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (fallbackError) {
        console.error('[Webhook] Fallback failed:', fallbackError);
      }
    }

    // Delegate to Queue Manager /finish
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          table: jobTable, jobId: jobData.id, status: newStatus,
          outputUrl, errorMessage: finalError, taskId, rhCost, webhookPayload: payload,
        }),
      });
      const result = await response.json();
      console.log('[Webhook] Queue Manager /finish response:', JSON.stringify(result));
    } catch (queueError) {
      console.error('[Webhook] Error calling Queue Manager:', queueError);
      // Fallback: update directly
      await supabase.from(jobTable).update({
        status: newStatus, current_step: newStatus, output_url: outputUrl,
        error_message: finalError, failed_at_step: newStatus === 'failed' ? 'webhook_received' : null,
        completed_at: completedAt.toISOString(), rh_cost: rhCost > 0 ? rhCost : null,
      }).eq('task_id', taskId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
