/**
 * useNavigationGuard — Blocks navigation when AI job is active
 * Works on both React Router navigation and browser close/refresh
 */

import { useEffect, useCallback, useState, useContext, useRef } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';
import { useAIJobContext } from '@/contexts/AIJobContext';

const BLOCKING_STATUSES = ['pending', 'queued', 'starting', 'running'];

export function useNavigationGuard() {
  const { isJobActive, activeToolName, jobStatus } = useAIJobContext();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const { navigator } = useContext(NavigationContext);
  
  const originalMethodsRef = useRef<{
    push: typeof navigator.push;
    replace: typeof navigator.replace;
    go: typeof navigator.go;
  } | null>(null);
  
  const shouldBlock = isJobActive && jobStatus !== null && BLOCKING_STATUSES.includes(jobStatus);
  
  useEffect(() => {
    if (!shouldBlock) {
      if (originalMethodsRef.current) {
        navigator.push = originalMethodsRef.current.push;
        navigator.replace = originalMethodsRef.current.replace;
        navigator.go = originalMethodsRef.current.go;
        originalMethodsRef.current = null;
      }
      return;
    }
    
    if (!originalMethodsRef.current) {
      originalMethodsRef.current = {
        push: navigator.push,
        replace: navigator.replace,
        go: navigator.go,
      };
    }
    
    const originals = originalMethodsRef.current;
    
    navigator.push = (...args: Parameters<typeof navigator.push>) => {
      setShowConfirmModal(true);
      setPendingNavigation(() => () => originals.push.apply(navigator, args));
    };
    
    navigator.replace = (...args: Parameters<typeof navigator.replace>) => {
      setShowConfirmModal(true);
      setPendingNavigation(() => () => originals.replace.apply(navigator, args));
    };
    
    navigator.go = (delta: number) => {
      setShowConfirmModal(true);
      setPendingNavigation(() => () => originals.go.call(navigator, delta));
    };
    
    return () => {
      if (originalMethodsRef.current) {
        navigator.push = originalMethodsRef.current.push;
        navigator.replace = originalMethodsRef.current.replace;
        navigator.go = originalMethodsRef.current.go;
        originalMethodsRef.current = null;
      }
    };
  }, [shouldBlock, navigator]);
  
  const confirmLeave = useCallback(() => {
    setShowConfirmModal(false);
    if (pendingNavigation) { pendingNavigation(); setPendingNavigation(null); }
  }, [pendingNavigation]);
  
  const cancelLeave = useCallback(() => {
    setShowConfirmModal(false);
    setPendingNavigation(null);
  }, []);
  
  useEffect(() => {
    if (!shouldBlock) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Tienes un procesamiento de IA en curso. Si sales, perderás los créditos.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlock]);
  
  return { isBlocking: shouldBlock, showConfirmModal, confirmLeave, cancelLeave, activeToolName };
}
