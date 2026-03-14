import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLikesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hasNewLike, setHasNewLike] = useState(false);

  const clearNewLike = useCallback(() => setHasNewLike(false), []);

  const { data: count = 0 } = useQuery({
    queryKey: ["likes-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get likes targeting me
      const { data: swipes } = await supabase
        .from("swipes")
        .select("swiper_id")
        .eq("target_id", user.id)
        .eq("action", "like");

      if (!swipes?.length) return 0;

      // Exclude already matched users
      const { data: matches } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      const matchedIds = new Set(
        (matches ?? []).map((m) => (m.user_a === user.id ? m.user_b : m.user_a))
      );

      return swipes.filter((s) => !matchedIds.has(s.swiper_id)).length;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("likes-count-badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "swipes",
          filter: `target_id=eq.${user.id}`,
        },
        (payload) => {
          const swipe = payload.new as { action: string };
          if (swipe.action === "like") {
            setHasNewLike(true);
            // Auto-clear pulse after 3 seconds
            setTimeout(() => setHasNewLike(false), 3000);
          }
          queryClient.invalidateQueries({ queryKey: ["likes-count", user.id] });
          queryClient.invalidateQueries({ queryKey: ["who-liked-me"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { count, hasNewLike, clearNewLike };
}
