import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * RunningHub Webhook — Called by RunningHub when a task completes or fails.
 * Forwards the result to queue-manager/finish.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log('[RH-Webhook] Received:', JSON.stringify(body));

    // RunningHub sends: { taskId, status, output (array of images), callbackBody }
    const { taskId, status: rhStatus, output, callbackBody } = body;

    let jobId: string | undefined;
    let table = 'upscaler_jobs';

    // Parse callbackBody (sent during task creation)
    if (callbackBody) {
      try {
        const parsed = typeof callbackBody === 'string' ? JSON.parse(callbackBody) : callbackBody;
        jobId = parsed.jobId;
        table = parsed.table || 'upscaler_jobs';
      } catch (e) {
        console.error('[RH-Webhook] Failed to parse callbackBody:', e);
      }
    }

    // Fallback: find job by task_id
    if (!jobId && taskId) {
      const { data } = await supabase.from(table).select('id').eq('task_id', taskId).maybeSingle();
      if (data) jobId = data.id;
    }

    if (!jobId) {
      console.error('[RH-Webhook] Could not determine jobId');
      return new Response(JSON.stringify({ error: 'jobId not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determine final status and output URL
    let finalStatus = 'failed';
    let outputUrl: string | undefined;
    let errorMessage: string | undefined;

    if (rhStatus === 'success' || rhStatus === 'COMPLETED') {
      finalStatus = 'completed';
      // Output is typically an array of image URLs
      if (Array.isArray(output) && output.length > 0) {
        // Each output item can be { fileUrl } or just a string
        const firstOutput = output[0];
        outputUrl = typeof firstOutput === 'string' ? firstOutput : firstOutput?.fileUrl;
      }
    } else {
      finalStatus = 'failed';
      errorMessage = `RunningHub task ${rhStatus || 'failed'}`;
    }

    // Forward to queue-manager/finish
    const finishResponse = await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        table,
        jobId,
        status: finalStatus,
        outputUrl,
        errorMessage,
        taskId,
        webhookPayload: body,
      }),
    });

    const result = await finishResponse.json();
    console.log('[RH-Webhook] Finish result:', result);

    return new Response(JSON.stringify({ success: true, jobId, status: finalStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[RH-Webhook] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
