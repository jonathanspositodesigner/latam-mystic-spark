import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface DownloadOptions {
  url: string;
  filename: string;
  mediaType?: 'image' | 'video';
  timeout?: number;
  onSuccess?: () => void;
  onFallback?: () => void;
  locale?: 'pt' | 'es';
}

interface DownloadState {
  isDownloading: boolean;
  progress: number;
}

export const useResilientDownload = () => {
  const [state, setState] = useState<DownloadState>({ isDownloading: false, progress: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchWithProgress = async (url: string, filename: string): Promise<boolean> => {
    abortControllerRef.current = new AbortController();
    const response = await fetch(url, { mode: 'cors', signal: abortControllerRef.current.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength) : 0;
    
    if (!response.body) {
      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      return true;
    }
    
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    
    while (true) {
      if (isCancelledRef.current) throw new Error('Cancelled');
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        setState(s => ({ ...s, progress: Math.round((received / total) * 100) }));
      } else {
        setState(s => ({ ...s, progress: Math.min(s.progress + 5, 95) }));
      }
    }
    
    const blob = new Blob(chunks as BlobPart[]);
    triggerBlobDownload(blob, filename);
    return true;
  };

  const fetchWithCacheBuster = async (url: string, filename: string): Promise<boolean> => {
    const busterUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    abortControllerRef.current = new AbortController();
    const response = await fetch(busterUrl, { mode: 'cors', signal: abortControllerRef.current.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    triggerBlobDownload(blob, filename);
    return true;
  };

  const anchorDownload = (url: string, filename: string): boolean => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  };

  const openInNewTab = (url: string, locale: 'pt' | 'es' = 'es') => {
    window.open(url, '_blank');
    toast.info(
      locale === 'es' 
        ? 'Imagen abierta. Mantén presionado para guardar.'
        : 'Imagem aberta. Segure para salvar.',
      { duration: 5000 }
    );
  };

  const download = useCallback(async (options: DownloadOptions) => {
    const { url, filename, timeout = 15000, onSuccess, onFallback, locale = 'es' } = options;
    
    isCancelledRef.current = false;
    setState({ isDownloading: true, progress: 0 });

    // Method 1: Fetch with progress
    try {
      setState(s => ({ ...s, progress: 15 }));
      await withTimeout(fetchWithProgress(url, filename), timeout);
      setState({ isDownloading: false, progress: 100 });
      onSuccess?.();
      return;
    } catch (err) {
      if (isCancelledRef.current) { setState({ isDownloading: false, progress: 0 }); return; }
    }
    
    // Method 2: Cache buster
    try {
      setState(s => ({ ...s, progress: 35 }));
      await withTimeout(fetchWithCacheBuster(url, filename), timeout);
      setState({ isDownloading: false, progress: 100 });
      onSuccess?.();
      return;
    } catch (err) {
      if (isCancelledRef.current) { setState({ isDownloading: false, progress: 0 }); return; }
    }
    
    // Method 3: Anchor tag
    try {
      setState(s => ({ ...s, progress: 55 }));
      anchorDownload(url, filename);
      await new Promise(r => setTimeout(r, 1500));
      setState({ isDownloading: false, progress: 100 });
      onSuccess?.();
      return;
    } catch (err) {}
    
    // Fallback: Open in new tab
    setState(s => ({ ...s, progress: 100 }));
    openInNewTab(url, locale);
    onFallback?.();
    setState({ isDownloading: false, progress: 0 });
  }, []);

  const cancel = useCallback(() => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setState({ isDownloading: false, progress: 0 });
  }, []);

  return { isDownloading: state.isDownloading, progress: state.progress, download, cancel };
};

export default useResilientDownload;
