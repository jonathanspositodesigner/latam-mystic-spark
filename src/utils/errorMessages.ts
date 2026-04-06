/**
 * Traduce errores técnicos de RunningHub/ComfyUI en mensajes amigables para el usuario.
 */
export function getAIErrorMessage(errorMessage: string | null): {
  message: string;
  solution: string;
} {
  const error = errorMessage?.toLowerCase() || '';
  
  if (error.includes('video generation failed') || error.includes('generate_video')) {
    return { message: 'La IA no pudo generar el video', solution: 'Intenta con un prompt diferente o usa otra imagen. Tus créditos fueron reembolsados.' };
  }

  if (errorMessage?.includes('上游负载已饱和') || error.includes('upstream') || error.includes('负载')) {
    return { message: 'Servidor de generación temporalmente sobrecargado', solution: 'La capacidad del servidor está agotada. Tus créditos fueron reembolsados. Intenta en unos minutos.' };
  }

  if (errorMessage?.includes('工作流运行失败') || error.includes('workflow')) {
    return { message: 'Servidor temporalmente no disponible', solution: 'Espera 5 minutos e intenta de nuevo. Si persiste, usa una imagen diferente.' };
  }

  if (error.includes('content safety') || error.includes('content policy') || error.includes('image generation blocked') || error.includes('safety filter') || error.includes('nsfw')) {
    return { message: 'Imagen bloqueada por el filtro de seguridad', solution: 'La IA consideró el contenido inapropiado. Tus créditos fueron reembolsados. Intenta con otra imagen.' };
  }

  if (error.includes('sslerror') || error.includes('unexpected_eof_while_reading') || error.includes('nanobanana') || error.includes('nano_banana')) {
    return { message: 'Servidor temporalmente no disponible', solution: 'El servidor de IA tiene inestabilidad temporal. Tus créditos fueron reembolsados. Intenta en unos minutos.' };
  }

  if (error.includes('stale file handle') || error.includes('errno 116') || error.includes('errno 5') || error.includes('oserror') || error.includes('filenotfounderror') || error.includes('input/output error')) {
    return { message: 'Error temporal en el servidor de IA', solution: 'Hubo una falla temporal en la infraestructura. Tus créditos fueron reembolsados. Intenta de nuevo.' };
  }

  if (error.includes('workflow validation') || error.includes('工作流校验失败') || error.includes('433')) {
    return { message: 'Error de configuración del workflow', solution: 'Hubo un problema interno. Tus créditos fueron reembolsados. Intenta de nuevo o contacta soporte.' };
  }

  if (error.includes('image_transfer') || error.includes('frame upload') || error.includes('upload failed')) {
    return { message: 'Error al enviar imagen al servidor', solution: 'Intenta con una imagen más pequeña (máx 5MB) o en formato JPG/PNG.' };
  }

  if (error.includes('unidentifiedimageerror') || error.includes('cannot identify image') || error.includes('pil') || error.includes('keep_this_dic')) {
    return { message: 'Formato de imagen incompatible', solution: 'Intenta guardar la imagen como JPEG antes de enviar, o usa otra imagen.' };
  }
  
  if (error.includes('timeout') || error.includes('timed out') || error.includes('cancelled automatically')) {
    return { message: 'El procesamiento tardó demasiado', solution: 'Intenta de nuevo con una imagen más pequeña o espera unos minutos.' };
  }
  
  if (error.includes('vram') || error.includes('memory') || error.includes('oom') || error.includes('out of memory')) {
    return { message: 'Imagen muy compleja', solution: 'Usa una imagen más pequeña o reduce la resolución de salida.' };
  }
  
  if (error.includes('no output') || error.includes('no result') || error.includes('empty result') || error.includes('generation error')) {
    return { message: 'El procesamiento no devolvió resultado', solution: 'Tus créditos fueron reembolsados. Intenta de nuevo con otra imagen.' };
  }

  if (error.includes('queue limit') || error.includes('queue full') || error.includes('too many requests') || error.includes('rate limit') || error.includes('429') || error.includes('421')) {
    return { message: 'Servidor ocupado en este momento', solution: 'La cola de procesamiento está llena. Espera 2-3 minutos e intenta de nuevo.' };
  }
  
  if (error.includes('network') || error.includes('connection') || error.includes('fetch')) {
    return { message: 'Error de conexión con el servidor', solution: 'Verifica tu conexión e intenta de nuevo.' };
  }
  
  if (error.includes('row-level security') || error.includes('security policy') || error.includes('rls')) {
    return { message: 'Tu sesión expiró', solution: 'Inicia sesión nuevamente para continuar usando la herramienta.' };
  }
  
  if (error.includes('unauthorized') || error.includes('forbidden') || error.includes('401') || error.includes('403') || error.includes('sessão expirou')) {
    return { message: 'Tu sesión expiró', solution: 'Actualiza la página e inicia sesión nuevamente.' };
  }
  
  return { message: errorMessage || 'Error en el procesamiento', solution: 'Intenta de nuevo o usa una imagen diferente.' };
}
