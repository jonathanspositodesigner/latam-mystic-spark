import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { normalizeAIError } from "../_shared/error-normalizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_JOB_TABLES = ['upscaler_jobs', 'flyer_maker_jobs', 'image_generator_jobs', 'seedance_jobs'] as const;

async function logStep(
  table: string,
  jobId: string,
  step: string,
  details?: Record<string, any>
): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = { step, timestamp, ...details };

  try {
    const { data: job } = await supabase
      .from(table)
      .select('step_history')
      .eq('id', jobId)
      .maybeSingle();

    const currentHistory = (job?.step_history as any[]) || [];
    const newHistory = [...currentHistory, entry];

    await supabase
      .from(table)
      .update({
        current_step: step,
        step_history: newHistory,
      })
      .eq('id', jobId);

    console.log(`[Webhook] ${table} Job ${jobId}: ${step}`, details || '');
  } catch (e) {
    console.error(`[logStep] Error:`, e);
  }
}

async function finishJob(jobTable: string, jobId: string, status: 'completed' | 'failed', outputUrl: string | null, errorMessage: string | null, taskId: string, rhCost: number = 0, payload: any = {}) {
  const finishUrl = `${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`;
  
  if (status === 'failed' && jobTable === 'seedance_jobs') {
    console.log(`[webhook] Failure detected for seedance job ${jobId}, triggering refund...`);
    await supabase.rpc('refund_seedance_job', { _job_id: jobId, _reason: errorMessage || 'Evolink reported failure' });
  }

  try {
    const res = await fetch(finishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ table: jobTable, jobId, status, outputUrl, errorMessage, taskId, rhCost, webhookPayload: payload }),
    });
    
    console.log(`[webhook] finishJob -> ${jobTable}/${jobId} status=${status} outputUrl=${outputUrl} resp=${res.status}`);

    if (!res.ok) {
      const update: Record<string, any> = {
        status,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        rh_cost: rhCost > 0 ? rhCost : null
      };
      if (outputUrl) update.output_url = outputUrl;
      if (errorMessage) update.error_message = errorMessage;
      await supabase.from(jobTable).update(update).eq('id', jobId);
      console.log(`[webhook] direct ${jobTable} update applied (queue-manager failed)`);
    }
  } catch (err) {
    console.error(`[webhook] Error calling finish:`, err);
    await supabase.from(jobTable).update({
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      output_url: outputUrl,
      rh_cost: rhCost > 0 ? rhCost : null
    }).eq('id', jobId);
  }
}

async function findJobByTaskId(taskId: string) {
  for (const table of IMAGE_JOB_TABLES) {
    const { data } = await supabase.from(table).select('id, status, started_at').eq('task_id', taskId).maybeSingle();
    if (data) return { table, job: data };
  }
  return null;
}

function extractEvolinkOutput(data: any): string | null {
  if (Array.isArray(data?.results) && data.results.length > 0) {
    const first = data.results[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.output_url) return first.output_url;
  }
  return data?.output_url || data?.video_url || data?.url || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log(`[webhook] Received payload:`, JSON.stringify(payload).slice(0, 1000));

    const isEvolink = !payload.event && (payload.id || payload.task_id) && payload.status;
    
    if (isEvolink) {
      const taskId = payload.id || payload.task_id;
      const status = String(payload.status).toLowerCase();
      const found = await findJobByTaskId(taskId);
      
      if (!found) return new Response(JSON.stringify({ ok: true, found: false }), { headers: corsHeaders });
      if (['completed', 'failed'].includes(found.job.status)) return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });

      if (['completed', 'success', 'succeeded'].includes(status)) {
        const outputUrl = extractEvolinkOutput(payload);
        await finishJob(found.table, found.job.id, outputUrl ? 'completed' : 'failed', outputUrl, outputUrl ? null : 'No output URL', taskId, 0, payload);
      } else if (['failed', 'error', 'cancelled'].includes(status)) {
        const errMsg = payload.error?.message || payload.error || payload.failure_reason || 'Evolink generation failed';
        await finishJob(found.table, found.job.id, 'failed', null, typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), taskId, 0, payload);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const { event, taskId, eventData = {} } = payload;
    if (event !== 'TASK_END') return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    const found = await findJobByTaskId(taskId);
    if (!found) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 200, headers: corsHeaders });
    if (['completed', 'failed'].includes(found.job.status)) return new Response(JSON.stringify({ success: true, skipped: true }), { headers: corsHeaders });

    let outputUrl: string | null = null;
    let errorMessage: string | null = null;
    const results = eventData.results || [];
    
    if (Array.isArray(results) && results.length > 0) {
      const videoResult = results.find((r: any) => ['mp4', 'webm', 'mov', 'avi'].includes(r.outputType));
      const imageResult = results.find((r: any) => ['png', 'jpg', 'jpeg', 'webp'].includes(r.outputType));
      outputUrl = videoResult?.url || imageResult?.url || results[0]?.url || null;
    }

    if (eventData.status === 'FAILED') {
      errorMessage = eventData.failedReason?.exception_message || eventData.errorMessage || 'Processing failed';
    }

    let rhCost = 0;
    if (!errorMessage) {
      const usageDirect = Number(eventData?.usage?.consumeCoins);
      if (usageDirect > 0) rhCost = Math.round(usageDirect);
      else if (found.job.started_at) {
        const duration = (new Date().getTime() - new Date(found.job.started_at).getTime()) / 1000;
        rhCost = Math.round(Math.max(1, duration) * 0.2);
      }
    }

    const finalError = errorMessage ? normalizeAIError(errorMessage).message : (outputUrl ? null : 'No output received');
    await finishJob(found.table, found.job.id, finalError ? 'failed' : 'completed', outputUrl, finalError, taskId, rhCost, payload);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (error) {
    console.error('[Webhook] Fatal Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
});
