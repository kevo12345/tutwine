import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIER_LIMITS } from "@/lib/constants";

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const tier = subscription?.tier ?? "free";
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;

  return { subscription, tier, limits };
}
