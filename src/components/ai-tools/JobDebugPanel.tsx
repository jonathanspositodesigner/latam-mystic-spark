import React from 'react';

interface JobDebugPanelProps {
  jobId: string | null;
  tableName: string;
  currentStep?: string | null;
  failedAtStep?: string | null;
  errorMessage?: string | null;
  position?: number | null;
  status?: string;
}

/**
 * JobDebugPanel - Debug panel stub (only renders when debug mode is active)
 * In this project, debug mode is not implemented, so this is a no-op.
 */
const JobDebugPanel: React.FC<JobDebugPanelProps> = () => {
  // Debug mode not available in this project
  return null;
};

export default JobDebugPanel;
