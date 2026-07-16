import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveLiveSessions } from "@/hooks/useActiveLiveSessions";
import { LivePanel } from "@/components/live/LivePanel";
import { Button } from "@/components/ui/button";

/**
 * Full-screen TikTok-style vertical pager of live sessions the current user
 * can watch (their hosted session + any with an active pass). Starts at the
 * session in the URL.
 */
export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions } = useActiveLiveSessions();
  const [accessibleIds, setAccessibleIds] = useState<Set<string> | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Determine which sessions the user can watch
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: passes } = await supabase
        .from("live_passes")
        .select("session_id")
        .eq("viewer_id", user.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());
      if (cancelled) return;
      const ids = new Set<string>((passes ?? []).map((p: any) => p.session_id));
      // Hosted sessions
      sessions.forEach((s) => {
        if (s.host_id === user.id) ids.add(s.id);
      });
      // Always allow the deep-linked one (LivePanel will re-check)
      if (sessionId) ids.add(sessionId);
      setAccessibleIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, sessions, sessionId]);

  // Feed ordering: start with the linked session, then the rest of accessible ones
  const feed = useMemo(() => {
    if (!accessibleIds) return [];
    const all = sessions.filter((s) => accessibleIds.has(s.id));
    if (!sessionId) return all;
    const first = all.find((s) => s.id === sessionId);
    if (!first) {
      // Deep-linked session may not be in the active list yet (just started).
      // Include a synthetic entry with only the id; LivePanel will hydrate it.
      return [
        { id: sessionId, host_id: "", display_name: null, photos: null, thumbnail_url: null } as any,
        ...all,
      ];
    }
    return [first, ...all.filter((s) => s.id !== sessionId)];
  }, [sessions, accessibleIds, sessionId]);

  // Scroll-driven active panel detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.idx ?? "0");
            setActiveIdx(idx);
          }
        });
      },
      { root: el, threshold: [0.6] },
    );
    panelRefs.current.forEach((n) => n && io.observe(n));
    return () => io.disconnect();
  }, [feed.length]);

  if (!sessionId) {
    navigate("/live", { replace: true });
    return null;
  }

  if (accessibleIds === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
        <Radio className="h-10 w-10 opacity-60" />
        <p className="text-sm opacity-80">No live streams available for you right now.</p>
        <Button variant="secondary" onClick={() => navigate("/live")}>
          Back to Live
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="no-scrollbar fixed inset-0 z-50 h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll overscroll-none bg-black"
    >
      {feed.map((s, idx) => (
        <div
          key={s.id}
          ref={(n) => (panelRefs.current[idx] = n)}
          data-idx={idx}
          className="relative h-[100dvh] w-full snap-start snap-always"
        >
          <LivePanel
            sessionId={s.id}
            active={idx === activeIdx}
            posterUrl={s.thumbnail_url ?? s.photos?.[0] ?? null}
            hostId={s.host_id || undefined}
            hostName={s.display_name ?? null}
            hostPhoto={s.photos?.[0] ?? null}
            onExit={() => navigate("/live")}
          />
        </div>
      ))}
    </div>
  );
}
