import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const OFFLINE_THRESHOLD = 60_000; // Consider offline after 60s

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const updatePresence = async () => {
      await supabase
        .from("user_presence")
        .upsert(
          { user_id: user.id, last_seen_at: new Date().toISOString(), is_online: true },
          { onConflict: "user_id" }
        );
    };

    const setOffline = async () => {
      await supabase
        .from("user_presence")
        .upsert(
          { user_id: user.id, last_seen_at: new Date().toISOString(), is_online: false },
          { onConflict: "user_id" }
        );
    };

    // Initial presence
    updatePresence();

    // Heartbeat
    intervalRef.current = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Set offline on tab close / navigation away
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        updatePresence();
      }
    };

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline signal
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`;
      const body = JSON.stringify({ is_online: false, last_seen_at: new Date().toISOString() });
      navigator.sendBeacon?.(url); // Best effort
      setOffline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOffline();
    };
  }, [user]);
}

/** Check if a specific user is online */
export async function fetchUserPresence(userId: string): Promise<{ isOnline: boolean; lastSeen: string | null }> {
  const { data } = await supabase
    .from("user_presence")
    .select("is_online, last_seen_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { isOnline: false, lastSeen: null };

  // Double-check: if last_seen_at is older than threshold, treat as offline
  const lastSeen = new Date(data.last_seen_at).getTime();
  const isRecent = Date.now() - lastSeen < 90_000; // 90s grace

  return {
    isOnline: data.is_online && isRecent,
    lastSeen: data.last_seen_at,
  };
}
