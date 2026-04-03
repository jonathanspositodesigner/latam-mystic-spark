import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const usePremiumArtesStatus = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [packSlugs, setPackSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchAccess = async () => {
      try {
        // Check premium_artes_users
        const { data: premiumData } = await supabase
          .from("premium_artes_users")
          .select("pack_slug")
          .eq("user_id", user.id)
          .eq("is_active", true);

        // Check user_pack_purchases
        const { data: purchaseData } = await supabase
          .from("user_pack_purchases")
          .select("pack_slug")
          .eq("user_id", user.id)
          .eq("payment_status", "active");

        const slugs = new Set<string>();
        premiumData?.forEach((r) => r.pack_slug && slugs.add(r.pack_slug));
        purchaseData?.forEach((r) => r.pack_slug && slugs.add(r.pack_slug));
        setPackSlugs(Array.from(slugs));
      } catch (err) {
        console.error("Error fetching premium artes status:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccess();
  }, [user]);

  const hasAccessToPack = (slug: string) => packSlugs.includes(slug);

  return { user, isLoading, hasAccessToPack, packSlugs };
};
