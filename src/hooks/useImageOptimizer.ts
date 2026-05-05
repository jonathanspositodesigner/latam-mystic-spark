import imageCompression from 'browser-image-compression';

// Maximum dimension (width or height) allowed for AI tools
export const MAX_AI_DIMENSION = 2000;

export interface ImageDimensionValidation {
  valid: boolean;
  width: number;
  height: number;
  error?: string;
}

export interface OptimizationResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
}

export interface OptimizationOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
};

// AI Tools optimization config - safe limit for RunningHub VRAM
const AI_OPTIMIZATION_CONFIG = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1536,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.9,
};

// Upscaler-specific config
const UPSCALER_OPTIMIZATION_CONFIG = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.9,
};

export const optimizeImage = async (
  file: File,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  if (originalSize < 100 * 1024) {
    return { file, originalSize, optimizedSize: originalSize, savings: 0, savingsPercent: 0 };
  }

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: mergedOptions.maxSizeMB!,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight!,
      useWebWorker: mergedOptions.useWebWorker!,
      fileType: 'image/webp',
      initialQuality: 0.85,
    });

    const webpFileName = file.name.replace(/\.[^/.]+$/, '.webp');
    const optimizedFile = new File([compressedFile], webpFileName, { type: 'image/webp' });

    const optimizedSize = optimizedFile.size;
    const savings = originalSize - optimizedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);

    return { file: optimizedFile, originalSize, optimizedSize, savings, savingsPercent };
  } catch (error) {
    console.error('Error optimizing image:', error);
    return { file, originalSize, optimizedSize: originalSize, savings: 0, savingsPercent: 0 };
  }
};

export const optimizeForAI = async (file: File): Promise<OptimizationResult> => {
  const originalSize = file.size;
  try {
    const compressedFile = await imageCompression(file, AI_OPTIMIZATION_CONFIG);
    const jpegFileName = file.name.replace(/\.[^/.]+$/, '.jpg');
    const optimizedFile = new File([compressedFile], jpegFileName, { type: 'image/jpeg' });
    const optimizedSize = optimizedFile.size;
    const savings = originalSize - optimizedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    return { file: optimizedFile, originalSize, optimizedSize, savings, savingsPercent };
  } catch (error) {
    console.error('[AI Optimize] Error:', error);
    return { file, originalSize, optimizedSize: originalSize, savings: 0, savingsPercent: 0 };
  }
};

export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') && !file.type.includes('gif');
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No fue posible cargar la imagen.')); };
    img.src = url;
  });
};

export const compressToMaxDimension = async (
  file: File,
  maxPx: number
): Promise<{ file: File; width: number; height: number }> => {
  const { width, height } = await getImageDimensions(file);
  if (width <= maxPx && height <= maxPx) return { file, width, height };

  try {
    const compressedFile = await imageCompression(file, {
      maxWidthOrHeight: maxPx,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.9,
    });
    const newDimensions = await getImageDimensions(compressedFile as File);
    const webpFileName = file.name.replace(/\.[^/.]+$/, '.webp');
    const optimizedFile = new File([compressedFile], webpFileName, { type: 'image/webp' });
    return { file: optimizedFile, width: newDimensions.width, height: newDimensions.height };
  } catch (error) {
    console.error('[compressToMaxDimension] Error:', error);
    return { file, width, height };
  }
};

export const validateImageDimensions = (file: File): Promise<ImageDimensionValidation> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > MAX_AI_DIMENSION || img.height > MAX_AI_DIMENSION) {
        resolve({
          valid: false,
          width: img.width,
          height: img.height,
          error: `Imagen muy grande (${img.width}x${img.height}). El límite máximo es ${MAX_AI_DIMENSION}x${MAX_AI_DIMENSION} píxeles.`,
        });
      } else {
        resolve({ valid: true, width: img.width, height: img.height });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ valid: false, width: 0, height: 0, error: 'No fue posible cargar la imagen.' }); };
    img.src = url;
  });
};

export const optimizeForUpscaler = async (file: File): Promise<OptimizationResult> => {
  const originalSize = file.size;
  try {
    const compressedFile = await imageCompression(file, UPSCALER_OPTIMIZATION_CONFIG);
    const jpegFileName = file.name.replace(/\.[^/.]+$/, '.jpg');
    const optimizedFile = new File([compressedFile], jpegFileName, { type: 'image/jpeg' });
    const optimizedSize = optimizedFile.size;
    const savings = originalSize - optimizedSize;
    const savingsPercent = Math.round((savings / originalSize) * 100);
    return { file: optimizedFile, originalSize, optimizedSize, savings, savingsPercent };
  } catch (error) {
    console.error('[Upscaler Optimize] Error:', error);
    return { file, originalSize, optimizedSize: originalSize, savings: 0, savingsPercent: 0 };
  }
};

export const useImageOptimizer = () => {
  return {
    optimizeImage,
    optimizeForAI,
    optimizeForUpscaler,
    isImageFile,
    formatBytes,
    validateImageDimensions,
    getImageDimensions,
    compressToMaxDimension,
  };
};