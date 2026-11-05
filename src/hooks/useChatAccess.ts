import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { isChatPassActive } from "@/lib/chat-pass";

export function useChatAccess() {
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [now, setNow] = useState(Date.now());
  const query = useQuery({
    queryKey: ["chat-access", user?.id, tier],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const [{ data: access, error }, { data: pass, error: passError }] = await Promise.all([
        supabase.rpc("has_private_chat_access"),
        supabase.from("chat_passes").select("expires_at").eq("user_id", user.id).maybeSingle(),
      ]);
      if (error || passError) throw error ?? passError;
      return { access: !!access, expiresAt: pass?.expires_at ?? null };
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const passActive = isChatPassActive(query.data?.expiresAt, now);
  return {
    canChat: !!query.data?.access && (tier !== "free" || passActive),
    expiresAt: passActive ? query.data?.expiresAt : null,
    loading: query.isPending,
    error: query.isError,
    refetch: query.refetch,
  };
}