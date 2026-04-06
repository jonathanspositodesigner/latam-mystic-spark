import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNNINGHUB_API_KEY = (Deno.env.get('RUNNINGHUB_API_KEY') || '').trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBAPP_ID_STANDARD = '2017030861371219969';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchWithRetry(url: string, options: RequestInit, context: string, maxRetries = 3): Promise<Response> {
  const retryableStatuses = [429, 502, 503, 504];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!retryableStatuses.includes(response.status)) return response;
      await response.text();
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, (2000 * Math.pow(2, attempt)) + Math.random() * 2000));
      } else {
        throw new Error(`${context} failed after ${maxRetries} retries (${response.status})`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
        continue;
      }
      if (attempt >= maxRetries - 1) throw err;
    }
  }
  throw new Error(`${context} failed`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (path === 'upload') return await handleUpload(req);
    if (path === 'run') return await handleRun(req);
    return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleUpload(req: Request) {
  if (!RUNNINGHUB_API_KEY) return new Response(JSON.stringify({ error: 'API key not configured', code: 'MISSING_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const { imageBase64, fileName } = await req.json();
  if (!imageBase64) return new Response(JSON.stringify({ error: 'imageBase64 is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const binaryString = atob(imageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const ext = (fileName || 'image.png').split('.').pop()?.toLowerCase() || 'png';
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  const formData = new FormData();
  formData.append('apiKey', RUNNINGHUB_API_KEY);
  formData.append('fileType', 'image');
  formData.append('file', new Blob([bytes], { type: mimeType }), fileName || 'upload.png');
  const response = await fetchWithRetry('https://www.runninghub.ai/task/openapi/upload', { method: 'POST', body: formData }, 'Upload');
  const text = await response.text();
  const data = JSON.parse(text);
  if (data.code !== 0) return new Response(JSON.stringify({ error: data.msg || 'Upload failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ success: true, fileName: data.data.fileName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleRun(req: Request) {
  if (!RUNNINGHUB_API_KEY) return new Response(JSON.stringify({ error: 'API key not configured', code: 'MISSING_API_KEY' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const { jobId, imageUrl, userId, creditCost } = await req.json();

  // JWT Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user: authUser }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !authUser) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const effectiveUserId = authUser.id;

  if (!jobId || !imageUrl) return new Response(JSON.stringify({ error: 'jobId and imageUrl required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // Consume credits
  const cost = typeof creditCost === 'number' ? creditCost : 1;
  const { data: creditResult, error: creditError } = await supabase.rpc('consume_upscaler_credits', { _user_id: effectiveUserId, _amount: cost, _description: 'Upscaler Arcano' });
  if (creditError || !creditResult?.[0]?.success) {
    return new Response(JSON.stringify({ error: creditResult?.[0]?.error_message || 'Créditos insuficientes', code: 'INSUFFICIENT_CREDITS' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  await supabase.from('upscaler_jobs').update({ credits_charged: true, user_credit_cost: cost }).eq('id', jobId);

  // Download image and upload to RunningHub
  let rhFileName: string;
  try {
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error(`Failed to download image (${imgResp.status})`);
    const imgBlob = await imgResp.blob();
    const formData = new FormData();
    formData.append('apiKey', RUNNINGHUB_API_KEY);
    formData.append('fileType', 'image');
    formData.append('file', imgBlob, 'image.png');
    const uploadResp = await fetchWithRetry('https://www.runninghub.ai/task/openapi/upload', { method: 'POST', body: formData }, 'RH Upload');
    const uploadData = JSON.parse(await uploadResp.text());
    if (uploadData.code !== 0) throw new Error('RunningHub upload failed');
    rhFileName = uploadData.data.fileName;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Image transfer failed';
    await supabase.from('upscaler_jobs').update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() }).eq('id', jobId);
    // Refund
    await supabase.rpc('refund_upscaler_credits', { _user_id: effectiveUserId, _amount: cost, _description: 'Estorno: error de transferencia' });
    await supabase.from('upscaler_jobs').update({ credits_refunded: true }).eq('id', jobId);
    return new Response(JSON.stringify({ error: msg, code: 'IMAGE_TRANSFER_ERROR' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Start RunningHub task
  try {
    const webhookUrl = `${SUPABASE_URL}/functions/v1/runninghub-webhook`;
    const taskBody = {
      apiKey: RUNNINGHUB_API_KEY,
      webAppId: WEBAPP_ID_STANDARD,
      nodeInfoList: [{ nodeId: '25', fieldName: 'image', fieldValue: rhFileName }],
      callbackUrl: webhookUrl,
      callbackBody: JSON.stringify({ jobId, table: 'upscaler_jobs' }),
    };

    const taskResp = await fetchWithRetry('https://www.runninghub.ai/task/openapi/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskBody),
    }, 'Create task');
    const taskData = JSON.parse(await taskResp.text());
    if (taskData.code !== 0) throw new Error(taskData.msg || 'Task creation failed');

    const taskId = taskData.data?.taskId;
    await supabase.from('upscaler_jobs').update({ status: 'running', task_id: taskId, started_at: new Date().toISOString(), current_step: 'running' }).eq('id', jobId);

    return new Response(JSON.stringify({ success: true, jobId, taskId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Task creation failed';
    // Mark failed and refund via queue manager
    await fetch(`${SUPABASE_URL}/functions/v1/runninghub-queue-manager/finish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ table: 'upscaler_jobs', jobId, status: 'failed', errorMessage: msg }),
    }).catch(console.error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
