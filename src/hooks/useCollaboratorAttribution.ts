import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

interface LibraryMeta {
  promptId?: string;
  promptType?: 'admin' | 'partner';
}

export function useCollaboratorAttribution() {
  const location = useLocation();

  const [referencePromptId, setReferencePromptId] = useState<string | null>(() => {
    const state = location.state as { prefillPromptId?: string; prefillPromptType?: string } | null;
    if (state?.prefillPromptType === 'partner' && state?.prefillPromptId) {
      return state.prefillPromptId;
    }
    return null;
  });

  const setFromLibrary = useCallback((meta?: LibraryMeta | null) => {
    if (meta?.promptType === 'partner' && meta?.promptId) {
      setReferencePromptId(meta.promptId);
    } else {
      setReferencePromptId(null);
    }
  }, []);

  const clear = useCallback(() => {
    setReferencePromptId(null);
  }, []);

  return { referencePromptId, setFromLibrary, clear };
}
