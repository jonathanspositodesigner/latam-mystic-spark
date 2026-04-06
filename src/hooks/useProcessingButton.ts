import { useState, useCallback, useRef } from 'react';

/**
 * Hook to prevent double-clicks on processing buttons.
 * Uses ref for synchronous IMMEDIATE lock + state for visual update.
 */
export function useProcessingButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const startSubmit = useCallback(() => {
    if (submittingRef.current) return false;
    submittingRef.current = true;
    setIsSubmitting(true);
    return true;
  }, []);

  const endSubmit = useCallback(() => {
    submittingRef.current = false;
    setIsSubmitting(false);
  }, []);

  return { isSubmitting, startSubmit, endSubmit };
}
