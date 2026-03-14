import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function useLikeNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("like-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "swipes",
          filter: `target_id=eq.${user.id}`,
        },
        async (payload) => {
          const swipe = payload.new as { swiper_id: string; action: string };
          if (swipe.action !== "like") return;

          // Fetch the liker's profile for their name
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, photos")
            .eq("user_id", swipe.swiper_id)
            .single();

          // Silently refresh — no disruptive toast while swiping

          // Refresh the likes query
          queryClient.invalidateQueries({ queryKey: ["who-liked-me"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
