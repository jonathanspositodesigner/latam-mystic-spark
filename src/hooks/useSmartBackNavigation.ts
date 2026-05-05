import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

interface UseSmartBackNavigationOptions {
  fallback: string;
}

export const useSmartBackNavigation = ({ fallback }: UseSmartBackNavigationOptions) => {
  const navigate = useNavigate();

  const goBack = useCallback(() => {
    const historyIndex = typeof window !== 'undefined' 
      ? (window.history.state?.idx ?? 0) 
      : 0;

    if (historyIndex > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  }, [navigate, fallback]);

  const canGoBack = typeof window !== 'undefined' 
    ? (window.history.state?.idx ?? 0) > 0 
    : false;

  return { goBack, canGoBack };
};
