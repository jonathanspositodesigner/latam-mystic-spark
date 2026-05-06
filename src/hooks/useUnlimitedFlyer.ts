import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePremiumStatus } from "./usePremiumStatus";

export function useUnlimitedFlyer() {
  const { user } = usePremiumStatus();
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user?.id) {
      setIsUnlimited(false);
      setLoading(false);
      return false;
    }
    try {
      const { data, error } = await supabase.rpc("user_has_unlimited_flyer", {
        _user_id: user.id,
      });
      if (error) {
        console.warn("[useUnlimitedFlyer] RPC error:", error.message);
        setIsUnlimited(false);
      } else {
        setIsUnlimited(Boolean(data));
      }
      return Boolean(data);
    } catch (err) {
      console.warn("[useUnlimitedFlyer] error:", err);
      setIsUnlimited(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    check();
  }, [check]);

  return { isUnlimited, loading, refetch: check };
}
