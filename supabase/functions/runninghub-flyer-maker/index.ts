import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNNINGHUB_API_KEYS = [
  Deno.env.get('RUNNINGHUB_API_KEY'),
  Deno.env.get('RUNNINGHUB_APIKEY'),
  Deno.env.get('RUNNINGHUB_API_KEY_SECONDARY'),
].map(k => (k || '').trim()).filter(Boolean);
const RUNNINGHUB_API_KEY = RUNNINGHUB_API_KEYS[0] || '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const WEBAPP_ID_EVENTO = '2025656642724962305';
const WEBAPP_ID_AGENDA = '2044904569490120705';
const WEBAPP_ID_CONTRATE = '2045273255975591938';
const WEBAPP_ID_OUTRO = '2046326522990043138';
const WEBAPP_ID_MOTION_STANDARD = '2050034000953135105';
const WEBAPP_ID = WEBAPP_ID_EVENTO;
const JOB_TABLE = 'flyer_maker_jobs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logStep(jobId: string, step: string, details?: Record<string, any>) {
  try {
    const { data: job } = await supabase.from(JOB_TABLE).select('step_history').eq('id', jobId).maybeSingle();
    const currentHistory = (job?.step_history as any[]) || [];
    await supabase.from(JOB_TABLE).update({ 
      current_step: step, 
      step_history: [...currentHistory, { step, timestamp: new Date().toISOString(), ...details }] 
    }).eq('id', jobId);
  } catch (e) {
    console.error('[FlyerMaker] logStep error:', e);
  }
}

async function uploadImageToRunningHub(imageUrl: string, label: string, jobId: string): Promise<string> {
  await logStep(jobId, `downloading_${label}`);
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) throw new Error(`Failed to download ${label} (${imgResponse.status})`);
  const blob = await imgResponse.blob();
  const name = imageUrl.split('/').pop() || `${label}.png`;

  const formData = new FormData();
  formData.append('apiKey', RUNNINGHUB_API_KEY);
  formData.append('fileType', 'image');
  formData.append('file', blob, name);

  await logStep(jobId, `uploading_${label}`);
  const uploadResponse = await fetch('https://www.runninghub.ai/task/openapi/upload', { method: 'POST', body: formData });
  const data = await uploadResponse.json();
  if (data.code !== 0) throw new Error(`${label} upload failed: ${data.msg || 'Unknown'}`);
  return data.data.fileName;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (path === 'run') {
      const body = await req.json();
      const { 
        jobId, flyerSubType, referenceImageUrl, artistPhotoUrls, logoUrl, 
        title, artistNames, dateTimeLocation, footerPromo, address, 
        imageSize, creativity, creditCost 
      } = body;

      const webappId = flyerSubType === 'agenda' ? WEBAPP_ID_AGENDA : 
                       flyerSubType === 'contrate' ? WEBAPP_ID_CONTRATE :
                       flyerSubType === 'outro' ? WEBAPP_ID_OUTRO :
                       flyerSubType === 'motion_standard' ? WEBAPP_ID_MOTION_STANDARD : WEBAPP_ID_EVENTO;

      await logStep(jobId, 'starting', { flyerSubType, webappId });

      // Port original logic for image transfer
      let referenceFileName = '';
      const artistFileNames: string[] = [];
      let logoFileName: string | null = null;

      try {
        referenceFileName = await uploadImageToRunningHub(referenceImageUrl, 'reference', jobId);
        for (let i = 0; i < (artistPhotoUrls?.length || 0); i++) {
          artistFileNames.push(await uploadImageToRunningHub(artistPhotoUrls[i], `artist_${i+1}`, jobId));
        }
        if (logoUrl) logoFileName = await uploadImageToRunningHub(logoUrl, 'logo', jobId);
      } catch (err: any) {
        await logStep(jobId, 'failed', { error: err.message, at: 'image_transfer' });
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }

      const nodeInfoList = [
        { nodeId: '1', fieldName: 'image', fieldValue: referenceFileName },
        { nodeId: '6', fieldName: 'text', fieldValue: dateTimeLocation || '' },
        { nodeId: '7', fieldName: 'text', fieldValue: title || '' },
        { nodeId: '9', fieldName: 'text', fieldValue: footerPromo || '' },
        { nodeId: '10', fieldName: 'text', fieldValue: artistNames || '' },
        { nodeId: '28', fieldName: 'image', fieldValue: logoFileName || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
        { nodeId: '103', fieldName: 'text', fieldValue: address || '' },
        { nodeId: '111', fieldName: 'value', fieldValue: String(creativity || 0) },
        ...artistFileNames.map((fn, i) => ({
          nodeId: String(11 + i),
          fieldName: 'image',
          fieldValue: fn
        }))
      ];

      // Invoke Queue Manager
      const { data: queueResult, error: queueError } = await supabase.functions.invoke('runninghub-queue-manager/run-or-queue', {
        body: {
          table: JOB_TABLE,
          jobId,
          webappId,
          creditCost: creditCost || 1,
          job_payload: {
            nodeInfoList,
            webappId,
            flyerSubType
          }
        }
      });

      if (queueError) throw queueError;
      return new Response(JSON.stringify(queueResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
