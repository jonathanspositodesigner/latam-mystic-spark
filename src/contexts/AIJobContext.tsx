/**
 * AI Job Context — Global monitoring for active AI jobs
 * Handles: notification sounds, navigation blocking state
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import type { JobStatus } from '@/ai/JobManager';

interface AIJobContextType {
  isJobActive: boolean;
  activeJobId: string | null;
  activeToolName: string | null;
  jobStatus: JobStatus | null;
  registerJob: (jobId: string, toolName: string, status: JobStatus) => void;
  updateJobStatus: (status: JobStatus) => void;
  clearJob: () => void;
}

const AIJobContext = createContext<AIJobContextType | undefined>(undefined);

export const useAIJobContext = () => {
  const context = useContext(AIJobContext);
  if (context === undefined) {
    throw new Error('useAIJobContext must be used within an AIJobProvider');
  }
  return context;
};

const ACTIVE_STATUSES: JobStatus[] = ['pending', 'queued', 'starting', 'running'];
const TERMINAL_STATUSES: JobStatus[] = ['completed', 'failed', 'cancelled'];

export const AIJobProvider = ({ children }: { children: ReactNode }) => {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  
  const isJobActive = jobStatus !== null && ACTIVE_STATUSES.includes(jobStatus);
  
  const registerJob = useCallback((jobId: string, toolName: string, status: JobStatus) => {
    setActiveJobId(jobId);
    setActiveToolName(toolName);
    setJobStatus(status);
  }, []);
  
  const updateJobStatus = useCallback((status: JobStatus) => {
    setJobStatus(status);
  }, []);
  
  const clearJob = useCallback(() => {
    setActiveJobId(null);
    setActiveToolName(null);
    setJobStatus(null);
  }, []);
  
  return (
    <AIJobContext.Provider value={{ isJobActive, activeJobId, activeToolName, jobStatus, registerJob, updateJobStatus, clearJob }}>
      {children}
    </AIJobContext.Provider>
  );
};
