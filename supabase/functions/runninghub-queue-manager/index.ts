import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JOB_TABLES = ['upscaler_jobs'] as const;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'check-user-active': return await handleCheckUserActive(req);
      case 'finish': return await handleFinish(req);
      case 'cancel-session': return await handleCancelSession(req);
      default: return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

const TOOL_NAMES: Record<string, string> = { upscaler_jobs: 'Upscaler Arcano' };

async function handleCheckUserActive(req: Request): Promise<Response> {
  const { userId } = await req.json();
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  for (const table of JOB_TABLES) {
    const { data: activeJob } = await supabase.from(table).select('id, status').eq('user_id', userId).in('status', ['running', 'queued', 'starting']).limit(1).maybeSingle();
    if (activeJob) {
      return new Response(JSON.stringify({ hasActiveJob: true, activeTool: TOOL_NAMES[table] || table, activeJobId: activeJob.id, activeStatus: activeJob.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Check recent pending
    const cutoff = new Date(Date.now() - 180000).toISOString();
    const { data: pendingJob } = await supabase.from(table).select('id, status').eq('user_id', userId).eq('status', 'pending').is('task_id', null).gt('created_at', cutoff).limit(1).maybeSingle();
    if (pendingJob) {
      return new Response(JSON.stringify({ hasActiveJob: true, activeTool: TOOL_NAMES[table] || table, activeJobId: pendingJob.id, activeStatus: 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ hasActiveJob: false, activeTool: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleFinish(req: Request): Promise<Response> {
  const { table, jobId, status, outputUrl, errorMessage } = await req.json();
  if (!table || !jobId) return new Response(JSON.stringify({ error: 'table and jobId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const { data: job } = await supabase.from(table).select('user_id, user_credit_cost, credits_charged, credits_refunded, status').eq('id', jobId).maybeSingle();
  if (!job) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Idempotency
  if (['completed', 'failed', 'cancelled'].includes(job.status)) {
    return new Response(JSON.stringify({ success: true, skipped: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const isFailure = status === 'failed' || status === 'cancelled';
  let refundedAmount = 0;

  if (isFailure && job.credits_charged && !job.credits_refunded && job.user_credit_cost > 0 && job.user_id) {
    await supabase.rpc('refund_upscaler_credits', { _user_id: job.user_id, _amount: job.user_credit_cost, _description: 'Estorno automático: job falló' });
    await supabase.from(table).update({ credits_refunded: true }).eq('id', jobId);
    refundedAmount = job.user_credit_cost;
  }

  const updateData: Record<string, any> = { status, completed_at: new Date().toISOString(), current_step: status };
  if (outputUrl) updateData.output_url = outputUrl;
  if (errorMessage) updateData.error_message = errorMessage;
  await supabase.from(table).update(updateData).eq('id', jobId);

  return new Response(JSON.stringify({ success: true, refundedAmount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleCancelSession(req: Request): Promise<Response> {
  const { sessionId } = await req.json();
  if (!sessionId) return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let cancelled = 0;
  for (const table of JOB_TABLES) {
    const { data: jobs } = await supabase.from(table).select('id, user_id, user_credit_cost, credits_charged, credits_refunded').eq('session_id', sessionId).eq('status', 'queued');
    if (!jobs) continue;
    for (const job of jobs) {
      await supabase.from(table).update({ status: 'cancelled', cancelled_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq('id', job.id);
      if (job.credits_charged && !job.credits_refunded && job.user_credit_cost > 0) {
        await supabase.rpc('refund_upscaler_credits', { _user_id: job.user_id, _amount: job.user_credit_cost, _description: 'Cancelación de sesión' });
        await supabase.from(table).update({ credits_refunded: true }).eq('id', job.id);
      }
      cancelled++;
    }
  }

  return new Response(JSON.stringify({ success: true, cancelled }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
