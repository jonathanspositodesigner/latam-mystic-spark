import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNNINGHUB_API_KEY = (Deno.env.get('RUNNINGHUB_API_KEY') || '').trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const WEBAPP_ID_EVENTO = '2025656642724962305';
const WEBAPP_ID_AGENDA = '2044904569490120705';
const WEBAPP_ID_CONTRATE = '2045273255975591938';
const WEBAPP_ID_OUTRO = '2046326522990043138';
const WEBAPP_ID_MOTION_STANDARD = '2050034000953135105';
const JOB_TABLE = 'flyer_maker_jobs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logStep(jobId: string, step: string, details?: Record<string, any>) {
  const { data: job } = await supabase.from(JOB_TABLE).select('step_history').eq('id', jobId).maybeSingle();
  const currentHistory = (job?.step_history as any[]) || [];
  await supabase.from(JOB_TABLE).update({ 
    current_step: step, 
    step_history: [...currentHistory, { step, timestamp: new Date().toISOString(), ...details }] 
  }).eq('id', jobId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (path === 'run') {
      const body = await req.json();
      const { jobId, flyerSubType, referenceImageUrl, artistPhotoUrls, logoUrl, title, artistNames, dateTimeLocation, footerPromo, address, imageSize, creativity, creditCost } = body;

      const webappId = flyerSubType === 'agenda' ? WEBAPP_ID_AGENDA : 
                       flyerSubType === 'contrate' ? WEBAPP_ID_CONTRATE :
                       flyerSubType === 'outro' ? WEBAPP_ID_OUTRO :
                       flyerSubType === 'motion_standard' ? WEBAPP_ID_MOTION_STANDARD : WEBAPP_ID_EVENTO;

      await logStep(jobId, 'starting', { flyerSubType, webappId });

      // Chamada simplificada para o Queue Manager (integrando com a lógica do original)
      const { data: queueResult, error: queueError } = await supabase.functions.invoke('runninghub-queue-manager/enqueue', {
        body: {
          table: JOB_TABLE,
          jobId,
          webappId,
          payload: {
            // Mapeamento de Nodes ArcanoApp
            nodes: [
              { nodeId: '1', fieldName: 'image', fieldValue: referenceImageUrl },
              { nodeId: '6', fieldName: 'text', fieldValue: dateTimeLocation },
              { nodeId: '7', fieldName: 'text', fieldValue: title },
              { nodeId: '9', fieldName: 'text', fieldValue: footerPromo },
              { nodeId: '10', fieldName: 'text', fieldValue: artistNames },
              { nodeId: '28', fieldName: 'image', fieldValue: logoUrl || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
              { nodeId: '103', fieldName: 'text', fieldValue: address },
              { nodeId: '111', fieldName: 'value', fieldValue: creativity || 0 },
              ...(artistPhotoUrls || []).map((url: string, i: number) => ({
                nodeId: String(11 + i),
                fieldName: 'image',
                fieldValue: url
              }))
            ]
          }
        }
      });

      return new Response(JSON.stringify(queueResult || { success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
