import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GLOBAL_MAX_CONCURRENT = 20;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logStep(table: string, jobId: string, step: string, details?: Record<string, any>) {
  try {
    const { data: job } = await supabase.from(table).select('step_history').eq('id', jobId).maybeSingle();
    const history = (job?.step_history as any[]) || [];
    await supabase.from(table).update({ current_step: step, step_history: [...history, { step, timestamp: new Date().toISOString(), ...details }] }).eq('id', jobId);
  } catch (e) { console.error(`[QueueManager] logStep error:`, e); }
}

async function startJobOnRunningHub(table: string, job: any) {
  const p = job.job_payload || {};
  const apiKey = Deno.env.get('RUNNINGHUB_API_KEY')?.trim();
  const webhookUrl = `${SUPABASE_URL}/functions/v1/runninghub-webhook`;

  try {
    const response = await fetch(`https://www.runninghub.ai/openapi/v2/run/ai-app/${p.webappId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ nodeInfoList: p.nodeInfoList, instanceType: "default", webhookUrl }),
    });
    const data = await response.json();
    const taskId = data.taskId || data.data?.taskId;
    if (!taskId) throw new Error(data.msg || 'No taskId');

    await supabase.from(table).update({ status: 'running', task_id: taskId, started_at: new Date().toISOString() }).eq('id', job.id);
    await logStep(table, job.id, 'running', { taskId });
  } catch (err: any) {
    await supabase.from(table).update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', job.id);
    await logStep(table, job.id, 'failed', { error: err.message });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    const body = await req.json();
    if (path === 'run-or-queue') {
      const { table, jobId, job_payload } = body;
      const { data: job } = await supabase.from(table).update({ job_payload, status: 'starting' }).eq('id', jobId).select().single();
      
      // Immediate start for MVP
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
