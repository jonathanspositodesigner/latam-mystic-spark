import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const JOB_TABLES = ['upscaler_jobs', 'flyer_maker_jobs', 'image_generator_jobs', 'seedance_jobs'];

async function finishJob(jobTable: string, jobId: string, status: 'completed' | 'failed', outputUrl: string | null, errorMessage: string | null, taskId: string) {
  const finishUrl = `${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`;
  const res = await fetch(finishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ table: jobTable, jobId, status, outputUrl, errorMessage, taskId }),
  });
  console.log(`[webhook] finishJob -> ${jobTable}/${jobId} status=${status} outputUrl=${outputUrl} resp=${res.status}`);

  // Fallback: if queue-manager fails, write directly to the table to avoid stuck jobs
  if (!res.ok && jobTable === 'seedance_jobs') {
    const update: Record<string, unknown> = {
      status,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (outputUrl) update.output_url = outputUrl;
    if (errorMessage) update.error_message = errorMessage;
    await supabase.from('seedance_jobs').update(update).eq('id', jobId);
    if (status === 'failed') {
      await supabase.rpc('refund_seedance_job', { _job_id: jobId, _reason: errorMessage || 'Evolink reported failure' });
    }
    console.log(`[webhook] direct seedance_jobs update applied (queue-manager failed)`);
  }
}

async function findJobByTaskId(taskId: string) {
  for (const table of JOB_TABLES) {
    const { data } = await supabase.from(table).select('id, status').eq('task_id', taskId).maybeSingle();
    if (data) return { table, job: data };
  }
  return null;
}

function extractEvolinkOutput(data: any): string | null {
  // Evolink returns results as array of URLs (strings) or objects
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

    // ============ EVOLINK FORMAT ============
    // Evolink posts task object directly: { id, status, results, error, progress, ... }
    // Detect by presence of `id` + `status` (and absence of `event`)
    const isEvolink = !payload.event && (payload.id || payload.task_id) && payload.status;
    if (isEvolink) {
      const taskId = payload.id || payload.task_id;
      const status = String(payload.status).toLowerCase();
      console.log(`[webhook] Evolink format detected. taskId=${taskId} status=${status}`);

      const found = await findJobByTaskId(taskId);
      if (!found) {
        console.warn(`[webhook] Evolink job not found for taskId=${taskId}`);
        return new Response(JSON.stringify({ ok: true, found: false }), { headers: corsHeaders });
      }

      if (found.job.status === 'completed' || found.job.status === 'failed') {
        console.log(`[webhook] Job ${found.job.id} already in terminal state (${found.job.status}), skipping`);
        return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
      }

      if (status === 'completed' || status === 'success' || status === 'succeeded') {
        const outputUrl = extractEvolinkOutput(payload);
        if (!outputUrl) {
          console.error(`[webhook] Evolink completed but no outputUrl in payload`);
          await finishJob(found.table, found.job.id, 'failed', null, 'Evolink completed without output URL', taskId);
        } else {
          await finishJob(found.table, found.job.id, 'completed', outputUrl, null, taskId);
        }
      } else if (status === 'failed' || status === 'error' || status === 'cancelled') {
        const errMsg = payload.error?.message || payload.error || payload.failure_reason || 'Evolink generation failed';
        await finishJob(found.table, found.job.id, 'failed', null, typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), taskId);
      } else {
        // intermediate (processing/pending) — just ack
        console.log(`[webhook] Evolink intermediate status=${status}, no action`);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // ============ RUNNINGHUB FORMAT ============
    const { event, taskId, eventData } = payload;
    if (event !== 'TASK_END') return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    const found = await findJobByTaskId(taskId);
    if (!found) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 200, headers: corsHeaders });

    const taskStatus = eventData?.status;
    const results = eventData?.results || [];
    const imageResult = results.find((r: any) => ['png', 'jpg', 'jpeg', 'webp', 'mp4'].includes((r.outputType || '').toLowerCase()));
    const outputUrl = imageResult?.url || results[0]?.url || null;
    const errorMessage = taskStatus === 'FAILED' ? (eventData.failedReason?.exception_message || eventData.errorMessage || 'Failed') : null;

    await finishJob(found.table, found.job.id, errorMessage ? 'failed' : 'completed', outputUrl, errorMessage, taskId);

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    console.error(`[webhook] error:`, error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
