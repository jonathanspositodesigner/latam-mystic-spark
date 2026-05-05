import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { RH_CONFIG, logStep, uploadToRH } from "../_shared/runninghub.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { 
      jobId, flyerSubType, referenceImageUrl, artistPhotoUrls, logoUrl, 
      title, artistNames, dateTimeLocation, footerPromo, address, 
      creativity, creditCost 
    } = body;

    const type = flyerSubType?.toUpperCase();
    const webappId = RH_CONFIG.WEBAPP_IDS[type as keyof typeof RH_CONFIG.WEBAPP_IDS] || RH_CONFIG.DEFAULT_WEBAPP;

    await logStep(RH_CONFIG.JOB_TABLE, jobId, 'starting', { flyerSubType, webappId });

    const artistFileNames: string[] = [];
    let referenceFileName = '';
    let logoFileName: string | null = null;

    try {
      // Reference
      const refRes = await fetch(referenceImageUrl);
      referenceFileName = await uploadToRH(await refRes.blob(), 'reference.png', 'reference', jobId, RH_CONFIG.JOB_TABLE);

      // Artists
      for (let i = 0; i < (artistPhotoUrls?.length || 0); i++) {
        const artRes = await fetch(artistPhotoUrls[i]);
        artistFileNames.push(await uploadToRH(await artRes.blob(), `artist_${i}.png`, `artist_${i+1}`, jobId, RH_CONFIG.JOB_TABLE));
      }

      // Logo
      if (logoUrl) {
        const logoRes = await fetch(logoUrl);
        logoFileName = await uploadToRH(await logoRes.blob(), 'logo.png', 'logo', jobId, RH_CONFIG.JOB_TABLE);
      }
    } catch (err: any) {
      await logStep(RH_CONFIG.JOB_TABLE, jobId, 'failed', { error: err.message, at: 'image_transfer' });
      await supabase.from(RH_CONFIG.JOB_TABLE).update({ status: 'failed', error_message: err.message }).eq('id', jobId);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }

    // MAPA DE NODOS POR TIPO DE ARTE (SINCRONIZADO COM ARCANOAPP)
    let nodeInfoList = [];
    
    if (type === 'AGENDA') {
      nodeInfoList = [
        { nodeId: '1', fieldName: 'image', fieldValue: referenceFileName },
        { nodeId: '11', fieldName: 'image', fieldValue: artistFileNames[0] || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
        { nodeId: '7', fieldName: 'text', fieldValue: title || 'TITULO: AGENDA MENSAL' },
        { nodeId: '10', fieldName: 'text', fieldValue: artistNames || 'NOMES DOS ARTISTAS:' },
        { nodeId: '140', fieldName: 'text', fieldValue: dateTimeLocation || '' },
        { nodeId: '28', fieldName: 'image', fieldValue: logoFileName || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' }
      ];
    } else if (type === 'CONTRATE') {
      nodeInfoList = [
        { nodeId: '1', fieldName: 'image', fieldValue: referenceFileName },
        { nodeId: '11', fieldName: 'image', fieldValue: artistFileNames[0] || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
        { nodeId: '7', fieldName: 'text', fieldValue: title || 'CONTRATE' },
        { nodeId: '10', fieldName: 'text', fieldValue: artistNames || 'NOME DO ARTISTA' },
        { nodeId: '28', fieldName: 'image', fieldValue: logoFileName || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' }
      ];
    } else if (type === 'OUTRO') {
      nodeInfoList = [
        { nodeId: '1', fieldName: 'image', fieldValue: referenceFileName },
        { nodeId: '7', fieldName: 'text', fieldValue: title || '' },
        { nodeId: '10', fieldName: 'text', fieldValue: artistNames || '' },
        { nodeId: '28', fieldName: 'image', fieldValue: logoFileName || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
        ...artistFileNames.map((fn, i) => ({
          nodeId: String(11 + i),
          fieldName: 'image',
          fieldValue: fn
        }))
      ];
    } else if (type === 'MOTION_STANDARD') {
      // O Motion Standard no ArcanoApp usa apenas o nodeId 2 para a imagem (analisado via flyer-motion-v3)
      nodeInfoList = [
        { nodeId: '2', fieldName: 'image', fieldValue: referenceFileName }
      ];
    } else {
      // EVENTO (WebApp 2025656642724962305)
      nodeInfoList = [
        { nodeId: '1', fieldName: 'image', fieldValue: referenceFileName },
        { nodeId: '6', fieldName: 'text', fieldValue: dateTimeLocation || '' },
        { nodeId: '7', fieldName: 'text', fieldValue: title || '' },
        { nodeId: '9', fieldName: 'text', fieldValue: footerPromo || '' },
        { nodeId: '10', fieldName: 'text', fieldValue: artistNames || '' },
        { nodeId: '28', fieldName: 'image', fieldValue: logoFileName || 'https://jooojbaljrshgpaxdlou.supabase.co/storage/v1/object/public/temp//pixel.png' },
        { nodeId: '103', fieldName: 'text', fieldValue: address || '' },
        { nodeId: '111', fieldName: 'value', fieldValue: String(creativity || 0) },
        ...artistFileNames.slice(0, 5).map((fn, i) => ({
          nodeId: String(11 + i),
          fieldName: 'image',
          fieldValue: fn
        }))
      ];
    }

    const { data: queueResult, error: queueError } = await supabase.functions.invoke('runninghub-queue-manager/run-or-queue', {
      body: {
        table: RH_CONFIG.JOB_TABLE,
        jobId,
        webappId,
        creditCost: creditCost || 1,
        job_payload: { nodeInfoList, webappId, flyerSubType }
      }
    });

    if (queueError) throw queueError;
    return new Response(JSON.stringify(queueResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[FlyerMaker] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
