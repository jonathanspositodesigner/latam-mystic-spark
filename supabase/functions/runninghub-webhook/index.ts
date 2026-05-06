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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { event, taskId, eventData } = payload;
    if (event !== 'TASK_END') return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

    let jobTable = '';
    let jobData = null;

    for (const table of JOB_TABLES) {
      const { data } = await supabase.from(table).select('id, status').eq('task_id', taskId).maybeSingle();
      if (data) { jobTable = table; jobData = data; break; }
    }

    if (!jobData) return new Response(JSON.stringify({ error: 'Job not found' }), { status: 200, headers: corsHeaders });

    const taskStatus = eventData?.status;
    const results = eventData?.results || [];
    const imageResult = results.find((r: any) => ['png', 'jpg', 'jpeg', 'webp', 'mp4'].includes((r.outputType || '').toLowerCase()));
    const outputUrl = imageResult?.url || results[0]?.url || null;
    const errorMessage = taskStatus === 'FAILED' ? (eventData.failedReason?.exception_message || eventData.errorMessage || 'Failed') : null;

    const finishUrl = `${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`;
    await fetch(finishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        table: jobTable,
        jobId: jobData.id,
        status: errorMessage ? 'failed' : 'completed',
        outputUrl,
        errorMessage,
        taskId
      }),
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
