import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const RUNNINGHUB_API_KEYS = [
  Deno.env.get('RUNNINGHUB_API_KEY'),
  Deno.env.get('RUNNINGHUB_APIKEY'),
  Deno.env.get('RUNNINGHUB_API_KEY_SECONDARY'),
].map(k => (k || '').trim()).filter(Boolean);

export const RH_CONFIG = {
  WEBAPP_IDS: {
    EVENTO: '2025656642724962305',
    AGENDA: '2044904569490120705',
    CONTRATE: '2045273255975591938',
    OUTRO: '2046326522990043138',
    MOTION_STANDARD: '2050034000953135105',
  },
  DEFAULT_WEBAPP: '2025656642724962305',
  JOB_TABLE: 'flyer_maker_jobs'
};

export async function logStep(table: string, jobId: string, step: string, details?: Record<string, any>) {
  try {
    const { data: job } = await supabase.from(table).select('step_history').eq('id', jobId).maybeSingle();
    const currentHistory = (job?.step_history as any[]) || [];
    await supabase.from(table).update({ 
      current_step: step, 
      step_history: [...currentHistory, { step, timestamp: new Date().toISOString(), ...details }] 
    }).eq('id', jobId);
  } catch (e) {
    console.error(`[RH-Shared] logStep error for ${jobId}:`, e);
  }
}

export async function uploadToRH(blob: Blob, name: string, label: string, jobId: string, table: string): Promise<string> {
  let lastErr = '';
  for (const key of RUNNINGHUB_API_KEYS) {
    try {
      const fd = new FormData();
      fd.append('apiKey', key);
      fd.append('fileType', 'image');
      fd.append('file', blob, name);
      
      const uploadUrl = `https://www.runninghub.ai/task/openapi/upload?apiKey=${key}`;
      
      console.log(`[RH-Shared] Uploading ${label} with key ${key.slice(0, 4)}...${key.slice(-4)}`);
      const response = await fetch(uploadUrl, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${key}` },
        body: fd 
      });
      
      const data = await response.json();
      if (data.code === 0 || data.taskId || data.data?.fileName) {
        return data.data?.fileName || data.fileName || data.taskId;
      }
      lastErr = data.msg || data.error || JSON.stringify(data);
    } catch (e: any) {
      lastErr = e.message;
    }
    console.error(`[RH-Shared] Key ${key.slice(-4)} failed for ${label}:`, lastErr);
  }
  throw new Error(`${label} upload failed: ${lastErr}`);
}
