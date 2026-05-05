import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { RUNNINGHUB_API_KEYS, logStep } from "../_shared/runninghub.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function startJobOnRunningHub(table: string, job: any) {
  const p = job.job_payload || {};
  const webhookUrl = `${SUPABASE_URL}/functions/v1/runninghub-webhook`;
  let lastError = 'No keys available';

  for (const apiKey of RUNNINGHUB_API_KEYS) {
    try {
      console.log(`[QueueManager] Starting job ${job.id} on ${p.webappId} with key ${apiKey.slice(-4)}`);
      const response = await fetch(`https://www.runninghub.ai/openapi/v2/run/ai-app/${p.webappId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}`,
          'apiKey': apiKey 
        },
        body: JSON.stringify({ nodeInfoList: p.nodeInfoList, instanceType: "default", webhookUrl }),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }
      
      console.log(`[QueueManager] RH Response:`, JSON.stringify(data));
      const taskId = data.taskId || data.data?.taskId;
      
      if (taskId) {
        await supabase.from(table).update({ status: 'running', task_id: taskId, started_at: new Date().toISOString() }).eq('id', job.id);
        await logStep(table, job.id, 'running', { taskId });
        return;
      }
      
      lastError = data.msg || data.error || data.errorMessage || text || 'Unknown error';
    } catch (err: any) {
      lastError = err.message;
    }
  }

  await supabase.from(table).update({ status: 'failed', error_message: lastError, completed_at: new Date().toISOString() }).eq('id', job.id);
  await logStep(table, job.id, 'failed', { error: lastError });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    const body = await req.json().catch(() => ({}));

    if (path === 'check-user-active') {
      const { userId } = body;
      if (!userId) {
        return new Response(JSON.stringify({ hasActiveJob: false, activeTool: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const tables = [
        { table: 'flyer_maker_jobs', tool: 'flyer_maker' },
        { table: 'upscaler_jobs', tool: 'upscaler' },
        { table: 'seedance_jobs', tool: 'seedance' },
      ];
      for (const { table, tool } of tables) {
        const { data } = await supabase
          .from(table)
          .select('id, status, current_step')
          .eq('user_id', userId)
          .in('status', ['pending', 'queued', 'starting', 'running'])
          .limit(1)
          .maybeSingle();
        if (data) {
          return new Response(JSON.stringify({ hasActiveJob: true, activeTool: tool, jobId: data.id, status: data.status, currentStep: data.current_step }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ hasActiveJob: false, activeTool: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (path === 'run-or-queue') {
      const { table, jobId, job_payload } = body;
      const { data: job } = await supabase.from(table).update({ job_payload, status: 'starting' }).eq('id', jobId).select().single();
      startJobOnRunningHub(table, job);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (path === 'finish') {
      const { table, jobId, status, outputUrl, errorMessage, rhCost } = body;
      await supabase.from(table).update({ 
        status, 
        output_url: outputUrl, 
        error_message: errorMessage, 
        rh_cost: rhCost, 
        completed_at: new Date().toISOString() 
      }).eq('id', jobId);
      await logStep(table, jobId, status, { outputUrl, errorMessage });
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
