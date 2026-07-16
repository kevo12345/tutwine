import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

export function useWithdrawalNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("withdrawal-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          if (n.type !== "withdrawal_approved" && n.type !== "withdrawal_rejected") return;

          const approved = n.type === "withdrawal_approved";
          toast(approved ? `✅ ${n.title}` : `⚠️ ${n.title}`, {
            description: n.body ?? undefined,
            duration: 7000,
          });

          queryClient.invalidateQueries({ queryKey: ["host-earnings"] });
          queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
