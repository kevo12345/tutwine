import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIER_LIMITS } from "@/lib/constants";
import { toast } from "sonner";

const TIER_LABELS: Record<string, string> = {
  simp: "Simp",
  basic: "Basic",
  plus: "Plus",
  pro: "Pro",
};

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previousTierRef = useRef<string | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const tier = subscription?.tier ?? "free";

  // Show toast when tier upgrades via realtime
  useEffect(() => {
    const prev = previousTierRef.current;
    if (prev !== null && prev !== tier && tier !== "free") {
      const label = TIER_LABELS[tier] || tier;
      toast.success(`🎉 You've been upgraded to ${label}!`, {
        description: `Your ${label} plan is now active. Enjoy your new features!`,
        duration: 6000,
      });
    }
    previousTierRef.current = tier;
  }, [tier]);

  // Listen for realtime changes to auto-refresh after payment
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`subscription-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["subscription", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] ?? TIER_LIMITS.free;

  return { subscription, tier, limits };
}
