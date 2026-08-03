import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { LiveViewer } from "./LiveViewer";
import { HostBroadcaster } from "./HostBroadcaster";
import { LiveChatRail } from "./LiveChatRail";
import { LiveTopBar } from "./LiveTopBar";
import { LiveBottomBar } from "./LiveBottomBar";
import { FloatingHearts, randomHeartColor, type FloatingHeart } from "./FloatingHearts";

type Props = {
  sessionId: string;
  /** When false, the video is not mounted (feed uses this to only run the visible panel). */
  active: boolean;
  /** Poster to show while inactive or connecting. */
  posterUrl?: string | null;
  hostId?: string;
  hostName?: string | null;
  hostPhoto?: string | null;
  onExit?: () => void;
};

/** One full-screen live panel. Handles host vs viewer, overlays, hearts, chat. */
export function LivePanel({
  sessionId,
  active,
  posterUrl,
  hostId: initialHostId,
  hostName: initialHostName,
  hostPhoto: initialHostPhoto,
  onExit,
}: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(initialHostId ?? null);
  const [hostName, setHostName] = useState<string | null>(initialHostName ?? null);
  const [hostPhoto, setHostPhoto] = useState<string | null>(initialHostPhoto ?? posterUrl ?? null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const heartChanRef = useRef<any>(null);
  const presenceChanRef = useRef<any>(null);

  const isHost = !!(user && hostId && user.id === hostId);

  // Authorize + fetch room URL
  useEffect(() => {
    if (!active || !sessionId || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await (supabase as any).rpc("get_live_session_room", {
        _session_id: sessionId,
      });
      const session = Array.isArray(rows) ? rows[0] : rows;
      if (cancelled) return;
      if (error || !session || session.status !== "active" || !session.daily_room_url) {
        toast.error("This live stream is no longer available");
        onExit ? onExit() : navigate("/live", { replace: true });
        return;
      }
      setHostId(session.host_id);
      if (session.thumbnail_url) setHostPhoto((p) => p ?? session.thumbnail_url);

      let myExpiresAt = session.expires_at;
      if (session.host_id !== user.id) {
        const { data: pass } = await supabase
          .from("live_passes")
          .select("expires_at, status")
          .eq("session_id", sessionId)
          .eq("viewer_id", user.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pass) {
          toast.error("You need an active pass to join this live");
          onExit ? onExit() : navigate("/live", { replace: true });
          return;
        }
        myExpiresAt = new Date(
          Math.min(new Date(pass.expires_at).getTime(), new Date(session.expires_at).getTime()),
        ).toISOString();
      }
      setRoomUrl(session.daily_room_url);
      setExpiresAt(myExpiresAt);
      setAuthorized(true);

      // Host profile info
      if (!initialHostName || !initialHostPhoto) {
        const { data: profs } = await supabase.rpc("get_profiles_public", { _targets: [session.host_id] });
        const hp = (profs ?? [])[0] as any;
        if (!cancelled && hp) {
          if (hp.display_name) setHostName((n) => n ?? hp.display_name);
          if (hp.photos?.[0]) setHostPhoto((p) => p ?? hp.photos[0]);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user, active, navigate, onExit, initialHostName, initialHostPhoto]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || !active) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        toast.info("Your live time has ended");
        onExit ? onExit() : navigate("/live", { replace: true });
        return;
      }
      const total = Math.floor(diff / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setRemaining(
        h > 0
          ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
          : `${m}:${s.toString().padStart(2, "0")}`,
      );
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiresAt, active, navigate, onExit]);

  // Hearts + "live ended" broadcast channel
  useEffect(() => {
    if (!active || !sessionId) return;
    const ch = supabase.channel(`live_reactions_${sessionId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "heart" }, (payload) => {
      const color = (payload.payload as any)?.color ?? randomHeartColor();
      setHearts((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, color, startX: Math.random() },
      ]);
    })
      .on("broadcast", { event: "live_ended" }, () => {
        if (isHost) return;
        toast.info("The host ended this live");
        onExit ? onExit() : navigate("/live", { replace: true });
      })
      .subscribe();
    heartChanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      heartChanRef.current = null;
    };
  }, [sessionId, active, isHost, navigate, onExit]);

  // Safety net: react to the session row flipping to 'ended' (missed broadcast, late joiner)
  useEffect(() => {
    if (!active || !sessionId || isHost) return;
    const ch = supabase
      .channel(`live_status_${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if ((payload.new as any)?.status === "ended") {
            toast.info("The host ended this live");
            onExit ? onExit() : navigate("/live", { replace: true });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, active, isHost, navigate, onExit]);

  // Presence for viewer count
  useEffect(() => {
    if (!active || !sessionId || !user) return;
    const ch = supabase.channel(`live_presence_${sessionId}`, {
      config: { presence: { key: user.id } },
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setViewerCount(Object.keys(state).length || 1);
    })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ joined_at: Date.now() });
        }
      });
    presenceChanRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      presenceChanRef.current = null;
    };
  }, [sessionId, user, active]);

  const sendHeart = () => {
    const color = randomHeartColor();
    setHearts((prev) => [
      ...prev,
      { id: `local-${Date.now()}-${Math.random()}`, color, startX: Math.random() },
    ]);
    heartChanRef.current?.send({ type: "broadcast", event: "heart", payload: { color } });
  };

  const dropHeart = (id: string) => setHearts((prev) => prev.filter((h) => h.id !== id));

  const closeLive = () => (onExit ? onExit() : navigate("/live"));

  /** Host-only: end the live now (server-side), regardless of remaining scheduled time. */
  const endLive = async () => {
    const { error } = await (supabase as any).rpc("end_live_session", { _session_id: sessionId });
    if (error) {
      toast.error(error.message ?? "Couldn't end the live");
      return;
    }
    // Tell every connected viewer immediately.
    heartChanRef.current?.send({ type: "broadcast", event: "live_ended", payload: {} });
    toast.success("Your live has ended");
    closeLive();
  };


  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Poster fallback / background */}
      {hostPhoto && (
        <img
          src={hostPhoto}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
        />
      )}

      {/* Video stage — portrait 9:16 stage, filled edge-to-edge (TikTok/IG Live) */}
      {active && authorized && roomUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-[9/16] h-full max-h-full w-auto max-w-full overflow-hidden bg-black">
            {isHost ? (
              <HostBroadcaster roomUrl={roomUrl} token="" onLeave={endLive} />
            ) : (
              <LiveViewer roomUrl={roomUrl} active={active} userName={profile?.display_name ?? "Guest"} />
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {active && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Overlays only when authorized */}
      {authorized && hostId && (
        <>
          <FloatingHearts hearts={hearts} onExpire={dropHeart} />

          <LiveTopBar
            hostId={hostId}
            hostName={hostName}
            hostPhoto={hostPhoto}
            isHost={isHost}
            viewerCount={viewerCount}
            remaining={remaining}
            onClose={closeLive}
            onEndLive={endLive}

            currentUserId={user?.id}
          />

          <LiveChatRail sessionId={sessionId} active={active} />

          {/* Tap area to double-tap heart (viewers only) */}
          {!isHost && (
            <button
              type="button"
              onDoubleClick={sendHeart}
              className="absolute inset-x-0 bottom-24 top-16 z-10 bg-transparent"
              aria-label="Double-tap to send a heart"
            />
          )}

          {user && !isHost && (
            <LiveBottomBar
              sessionId={sessionId}
              userId={user.id}
              placeholder={`Say hi to ${hostName ?? "the host"}…`}
              onHeart={sendHeart}
              onGift={sendHeart}
            />
          )}
        </>
      )}
    </div>
  );
}
