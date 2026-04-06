import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ToolSetting {
  tool_name: string;
  credit_cost: number;
  has_api_cost: boolean;
  api_cost: number;
  updated_at: string;
}

export const useAIToolSettings = () => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-tool-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tool_settings" as any)
        .select("*");

      if (error) {
        console.error("[useAIToolSettings] Error fetching settings:", error);
        return [] as ToolSetting[];
      }

      return (data || []) as unknown as ToolSetting[];
    },
    staleTime: 30_000,
  });

  const settingsMap = (settings || []).reduce<Record<string, ToolSetting>>(
    (acc, s) => { acc[s.tool_name] = s; return acc; },
    {}
  );

  const getCreditCost = (toolName: string, fallback: number = 60): number => {
    return settingsMap[toolName]?.credit_cost ?? fallback;
  };

  const getApiCost = (toolName: string) => {
    const s = settingsMap[toolName];
    return { hasApiCost: s?.has_api_cost ?? false, apiCost: s?.api_cost ?? 0 };
  };

  return { settings: settings || [], settingsMap, isLoading, getCreditCost, getApiCost };
};
