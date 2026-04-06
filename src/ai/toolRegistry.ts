/**
 * TOOL REGISTRY — Central configuration for all AI tools
 * 
 * To add a new AI tool:
 * 1. Add an entry here
 * 2. Create the job table in Supabase
 * 3. Create the edge function
 * 4. Create the tool page using useAIJob(toolId)
 * Everything else (credits, queue, retry, realtime, cancel, refund) works automatically.
 */

export const TOOL_REGISTRY = {
  upscaler: {
    id: 'upscaler' as const,
    nameEs: 'Upscaler Arcano',
    table: 'upscaler_jobs',
    edgeFunction: 'runninghub-upscaler/run',
    uploadFunction: 'runninghub-upscaler/upload',
    creditCost: 1,
    maxFileSizeMB: 10,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    timeoutMs: 600_000, // 10 min
    toolUrl: '/upscaler-arcano-tool',
    emoji: '✨',
  },
} as const;

export type ToolId = keyof typeof TOOL_REGISTRY;
export type ToolConfig = typeof TOOL_REGISTRY[ToolId];

export function getToolConfig(toolId: ToolId): ToolConfig {
  return TOOL_REGISTRY[toolId];
}

export function getToolTable(toolId: ToolId): string {
  return TOOL_REGISTRY[toolId].table;
}

export function getToolEdgeFunction(toolId: ToolId): string {
  return TOOL_REGISTRY[toolId].edgeFunction;
}

// All job tables for cross-tool queries
export const ALL_JOB_TABLES = Object.values(TOOL_REGISTRY).map(t => t.table);
