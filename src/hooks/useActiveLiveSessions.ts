import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveLiveSession {
  id: string;
  host_id: string;
  display_name: string | null;
  photos: string[] | null;
  duration_hours: number;
  started_at: string;
  expires_at: string;
  viewer_count: number;
}


export function useActiveLiveSessions() {
  const [sessions, setSessions] = useState<ActiveLiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_active_live_sessions");
    if (!error && data) setSessions(data as ActiveLiveSession[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("live_sessions_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "live_passes" }, () => refresh())
      .subscribe();
    const tick = setInterval(refresh, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [refresh]);

  return { sessions, loading, refresh };
}
