/**
 * EVOLINK API CLIENT - MÓDULO CENTRALIZADO
 */

export interface EvolinkGenerateParams {
  model: string;
  prompt: string;
  duration?: number;
  quality?: string;
  aspectRatio?: string;
  generateAudio?: boolean;
  generationType?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  audioUrls?: string[];
}

export interface EvolinkGenerateResult {
  success: true;
  taskId: string;
}

export interface EvolinkErrorResult {
  success: false;
  error: string;
}

export type EvolinkResult = EvolinkGenerateResult | EvolinkErrorResult;

export interface EvolinkPollResult {
  status: 'completed' | 'failed' | 'processing' | 'pending' | string;
  progress: number;
  outputUrl?: string;
  error?: string;
  rawData?: Record<string, unknown>;
}

const RETRYABLE_STATUSES = [429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525];
const RETRY_DELAYS = [3000, 6000, 12000, 20000];

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string,
  maxRetries = 4
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);

      if (RETRYABLE_STATUSES.includes(response.status) && attempt < maxRetries - 1) {
        await response.text();
        const delay = RETRY_DELAYS[attempt] + Math.random() * 2000;
        console.warn(`[EvolinkClient] ${label}: HTTP ${response.status}, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (error: any) {
      if (attempt < maxRetries - 1) {
        const delay = RETRY_DELAYS[attempt] + Math.random() * 2000;
        console.warn(`[EvolinkClient] ${label}: ${error.message}, retry ${attempt + 1}/${maxRetries}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`${label}: All retries exhausted`);
}

const EVOLINK_BASE_URL = 'https://api.evolink.ai/v1';

export async function evolinkGenerate(
  apiKey: string,
  params: EvolinkGenerateParams
): Promise<EvolinkResult> {
  if (!apiKey) {
    return { success: false, error: 'EVOLINK_API_KEY not configured' };
  }

  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    duration: params.duration ?? 8,
    quality: params.quality ?? '1080p',
    aspect_ratio: params.aspectRatio ?? '16:9',
    generate_audio: params.generateAudio ?? false,
  };

  const isSeedance = params.model.toLowerCase().includes('seedance');
  if (params.generationType && !isSeedance) {
    payload.generation_type = params.generationType;
  }

  if (params.imageUrls && params.imageUrls.length > 0) payload.image_urls = params.imageUrls;
  if (params.videoUrls && params.videoUrls.length > 0) payload.video_urls = params.videoUrls;
  if (params.audioUrls && params.audioUrls.length > 0) payload.audio_urls = params.audioUrls;

  const MAX_BUSY_RETRIES = 3;
  const BUSY_DELAYS = [5000, 10000, 20000];

  for (let busyAttempt = 0; busyAttempt <= MAX_BUSY_RETRIES; busyAttempt++) {
    try {
      const response = await fetchWithRetry(
        `${EVOLINK_BASE_URL}/videos/generations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
        'Evolink Generate'
      );

      const data = await response.json();
      if (!response.ok || !data.id) {
        const errMsg = data.error?.message || data.error?.code || data.error || `Evolink API error: ${response.status}`;
        const errStr = typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg);
        const isBusy = errStr.toLowerCase().includes('service busy') || errStr.toLowerCase().includes('allocating resources') || response.status === 503;
        
        if (isBusy && busyAttempt < MAX_BUSY_RETRIES) {
          const delay = BUSY_DELAYS[busyAttempt] + Math.random() * 3000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return { success: false, error: errStr };
      }
      return { success: true, taskId: data.id };
    } catch (error: any) {
      if (busyAttempt < MAX_BUSY_RETRIES) {
        await new Promise(r => setTimeout(r, BUSY_DELAYS[busyAttempt]));
        continue;
      }
      return { success: false, error: error.message || 'Evolink API call failed' };
    }
  }
  return { success: false, error: 'Evolink API: all busy retries exhausted' };
}

export async function evolinkPoll(
  apiKey: string,
  taskId: string
): Promise<EvolinkPollResult> {
  if (!apiKey) return { status: 'failed', progress: 0, error: 'EVOLINK_API_KEY not configured' };
  try {
    const response = await fetchWithRetry(
      `${EVOLINK_BASE_URL}/tasks/${taskId}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}` } },
      `Evolink Poll ${taskId}`,
      3
    );
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) return { status: 'failed', progress: 0, error: `Evolink API error: HTTP ${response.status}` };
      return { status: 'failed', progress: 0, error: `Evolink API server error: HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.status === 'completed') return { status: 'completed', progress: 100, outputUrl: data.results?.[0] || null, rawData: data };
    if (data.status === 'failed') {
      const errMsg = data.error?.message || data.error || 'Generation failed';
      return { status: 'failed', progress: 0, error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), rawData: data };
    }
    return { status: data.status || 'processing', progress: data.progress || 0, rawData: data };
  } catch (error: any) {
    return { status: 'failed', progress: 0, error: `Evolink poll failed: ${error.message}` };
  }
}
