import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Clock, PauseCircle } from "lucide-react";
import { LiveViewer } from "./LiveViewer";
import { HostBroadcaster } from "./HostBroadcaster";
import { LiveChatRail } from "./LiveChatRail";
import { LiveTopBar } from "./LiveTopBar";
import { LiveBottomBar } from "./LiveBottomBar";
import { FloatingHearts, randomHeartColor, type FloatingHeart } from "./FloatingHearts";
import { GiftAnimationOverlay } from "@/components/live/GiftAnimationOverlay";
import { InsufficientTokensDialog } from "@/components/InsufficientTokensDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const TICKET_TOKENS = 1; // 1 coin ($0.25) = 1 hour of access to this live
const PREVIEW_SECONDS = 15; // free look before a viewer has to buy a ticket

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
  const { user, profile, refreshProfile } = useAuth();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [sessionEndsAt, setSessionEndsAt] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(initialHostId ?? null);
  const [hostName, setHostName] = useState<string | null>(initialHostName ?? null);
  const [hostPhoto, setHostPhoto] = useState<string | null>(initialHostPhoto ?? posterUrl ?? null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState("");
  const [viewerCount, setViewerCount] = useState(1);
  const [likeCount, setLikeCount] = useState(0);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [pauseRemaining, setPauseRemaining] = useState("5:00");
  const [coverUrl, setCoverUrl] = useState<string | null>(posterUrl ?? null);
  const heartChanRef = useRef<any>(null);
  const presenceChanRef = useRef<any>(null);
  const renewingRef = useRef(false);
  const [previewEndsAt, setPreviewEndsAt] = useState<number | null>(null);
  const [previewLeft, setPreviewLeft] = useState(PREVIEW_SECONDS);
  const [previewOver, setPreviewOver] = useState(false);
  const [joining, setJoining] = useState(false);
  const previewing = !authorized && previewEndsAt !== null && !previewOver;

  useEffect(() => {
    if (previewEndsAt === null || authorized || previewOver) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((previewEndsAt - Date.now()) / 1000));
      setPreviewLeft(left);
      if (left <= 0) setPreviewOver(true);
    };
    tick();
    const i = setInterval(tick, 250);
    return () => clearInterval(i);
  }, [previewEndsAt, authorized, previewOver]);

  const isHost = !!(user && hostId && user.id === hostId);
  const balance = Number((profile as any)?.token_balance ?? 0);

  // Authorize + fetch room URL
  useEffect(() => {
    if (!active || !sessionId || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Room details and any existing ticket are independent — fetch them together.
      const [roomRes, passRes] = await Promise.all([
        (supabase as any).rpc("get_live_session_room", { _session_id: sessionId }),
        supabase
          .from("live_passes")
          .select("expires_at, status")
          .eq("session_id", sessionId)
          .eq("viewer_id", user.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const { data: rows, error } = roomRes as any;
      const session = Array.isArray(rows) ? rows[0] : rows;
      if (cancelled) return;
      if (error || !session || session.status !== "active" || !session.daily_room_url) {
        toast.error("This live stream is no longer available");
        onExit ? onExit() : navigate("/live", { replace: true });
        return;
      }
      setHostId(session.host_id);
      setSessionEndsAt(session.expires_at);
      if (session.thumbnail_url) {
        setHostPhoto((p) => p ?? session.thumbnail_url);
        setCoverUrl(session.thumbnail_url);
      }
      setIsPaused(!!session.is_paused);

      let myExpiresAt = session.expires_at;
      if (session.host_id !== user.id) {
        let passExpiresAt = (passRes as any)?.data?.expires_at ?? null;
        if (!passExpiresAt) {
          // No ticket yet: show a free 15-second preview, then ask them to join.
          setRoomUrl(session.daily_room_url);
          setPreviewEndsAt(Date.now() + PREVIEW_SECONDS * 1000);
          setPreviewLeft(PREVIEW_SECONDS);
          setPreviewOver(false);
          setLoading(false);
          return;
        }
        myExpiresAt = new Date(
          Math.min(new Date(passExpiresAt).getTime(), new Date(session.expires_at).getTime()),
        ).toISOString();
      }
      setRoomUrl(session.daily_room_url);
      setExpiresAt(myExpiresAt);
      setAuthorized(true);
      // Show the stream right away; the rest is cosmetic and loads behind it.
      setLoading(false);

      void (async () => {
        const [countsRes, profRes] = await Promise.all([
          supabase.from("live_sessions").select("like_count, paused_at").eq("id", sessionId).maybeSingle(),
          !initialHostName || !initialHostPhoto
            ? supabase.rpc("get_profiles_public", { _targets: [session.host_id] })
            : Promise.resolve({ data: null } as any),
        ]);
        if (cancelled) return;
        const counts = (countsRes as any)?.data;
        if (counts) {
          setLikeCount(Number(counts.like_count ?? 0));
          setPausedAt(counts.paused_at ?? null);
        }
        const hp = ((profRes as any)?.data ?? [])[0] as any;
        if (hp) {
          if (hp.display_name) setHostName((n) => n ?? hp.display_name);
          if (hp.photos?.[0]) setHostPhoto((p) => p ?? hp.photos[0]);
        }
      })();
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user, active, navigate, onExit, initialHostName, initialHostPhoto]);


  /** Buy another hour on this live. Returns true when access was extended. */
  const renewTicket = useCallback(async (): Promise<boolean> => {
    const { data, error } = await (supabase as any).rpc("purchase_live_pass", {
      _session_id: sessionId,
      _hours: TICKET_TOKENS,
    });
    if (error) {
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.expires_at) return false;
    const capped = sessionEndsAt
      ? new Date(
          Math.min(new Date(row.expires_at).getTime(), new Date(sessionEndsAt).getTime()),
        ).toISOString()
      : row.expires_at;
    setExpiresAt(capped);
    await refreshProfile();
    return true;
  }, [sessionId, sessionEndsAt, refreshProfile]);

  // Countdown timer + ticket expiry handling
  useEffect(() => {
    if (!expiresAt || !active) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        if (isHost) {
          toast.info("Your live time has ended");
          onExit ? onExit() : navigate("/live", { replace: true });
          return;
        }
        // Viewer ticket expired — auto-renew when they can afford it.
        if (renewingRef.current) return;
        renewingRef.current = true;
        (async () => {
          if (balance >= TICKET_TOKENS) {
            const ok = await renewTicket();
            if (ok) {
              toast.success("Ticket renewed — enjoy another hour");
              renewingRef.current = false;
              return;
            }
          }
          setRenewOpen(true);
          renewingRef.current = false;
        })();
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
  }, [expiresAt, active, navigate, onExit, isHost, balance, renewTicket]);

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
      setLikeCount((c) => c + 1);
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

  // Safety net: react to the session row changing (status / like count)
  useEffect(() => {
    if (!active || !sessionId) return;
    const ch = supabase
      .channel(`live_status_${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as any;
          if (typeof next?.like_count === "number") {
            setLikeCount((c) => {
              const server = Number(next.like_count);
              // Someone liked and we didn't get the broadcast — animate the delta.
              const delta = Math.min(Math.max(server - c, 0), 5);
              if (delta > 0) {
                setHearts((prev) => [
                  ...prev,
                  ...Array.from({ length: delta }, (_, i) => ({
                    id: `db-${server}-${i}-${Math.random()}`,
                    color: randomHeartColor(),
                    startX: Math.random(),
                  })),
                ]);
              }
              return Math.max(c, server);
            });
          }

          if (typeof next?.is_paused === "boolean") {
            setIsPaused(next.is_paused);
            setPausedAt(next.is_paused ? (next.paused_at ?? new Date().toISOString()) : null);
          }
          if (next?.thumbnail_url) setCoverUrl(next.thumbnail_url);
          if (next?.status === "ended" && !isHost) {
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

  /** Unlimited likes: local heart + broadcast + persisted counter. */
  const sendHeart = () => {
    const color = randomHeartColor();
    setHearts((prev) => [
      ...prev,
      { id: `local-${Date.now()}-${Math.random()}`, color, startX: Math.random() },
    ]);
    setLikeCount((c) => c + 1);
    heartChanRef.current?.send({ type: "broadcast", event: "heart", payload: { color } });
    void (supabase as any).rpc("like_live_session", { _session_id: sessionId });
  };

  const dropHeart = (id: string) => setHearts((prev) => prev.filter((h) => h.id !== id));

  const shareLive = async () => {
    // Carry the sharer's unique code so we can attribute the invite and route
    // brand-new users into this exact live after they create an account.
    const inviteCode = (profile as any)?.emrand_id ?? null;
    const url = `${window.location.origin}/live/${sessionId}${inviteCode ? `?ref=${inviteCode}` : ""}`;
    const title = `${hostName ?? "Someone"} is live on Tutwine`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Live link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

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

    // Show the host the real duration and the share that was applied.
    try {
      const { data } = await (supabase as any)
        .from("live_sessions")
        .select("started_at, ended_at, created_at, gross_tokens, host_earning")
        .eq("id", sessionId)
        .maybeSingle();
      if (data) {
        const start = new Date(data.started_at ?? data.created_at).getTime();
        const end = new Date(data.ended_at ?? Date.now()).getTime();
        const secs = Math.max(0, Math.floor((end - start) / 1000));
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const label = h > 0 ? `${h}h ${m}m` : `${m}m ${secs % 60}s`;
        const full = secs >= 3600;
        toast.success(`Live ended — duration ${label}`, {
          description: full
            ? `You reached 1 hour, so you keep 60% (${Number(data.host_earning ?? 0)} coins of ${Number(data.gross_tokens ?? 0)}).`
            : `Under 60 minutes, so your share is 10% (${Number(data.host_earning ?? 0)} coins of ${Number(data.gross_tokens ?? 0)}). Stream 1 hour or more to keep 60%.`,
          duration: 8000,
        });
      } else {
        toast.success("Your live has ended");
      }
    } catch {
      toast.success("Your live has ended");
    }
    closeLive();
  };


  /** Host-only: pause / resume the broadcast. Viewers see the cover image. */
  const togglePause = async () => {
    const next = !isPaused;
    const { error } = await (supabase as any).rpc("set_live_paused", {
      _session_id: sessionId,
      _paused: next,
    });
    if (error) {
      toast.error(error.message ?? "Couldn't update your live");
      return;
    }
    setIsPaused(next);
    setPausedAt(next ? new Date().toISOString() : null);
    toast.success(
      next
        ? "Live paused — viewers see your cover. It ends automatically after 5 minutes."
        : "You're back live",
    );
  };

  // Auto-end the live if the host stays paused for more than 5 minutes.
  useEffect(() => {
    if (!active || !isHost || !isPaused || !pausedAt) {
      setPauseRemaining("5:00");
      return;
    }
    let ended = false;
    const tick = () => {
      const left = 5 * 60 * 1000 - (Date.now() - new Date(pausedAt).getTime());
      if (left <= 0) {
        if (ended) return;
        ended = true;
        setPauseRemaining("0:00");
        toast.info("Paused for 5 minutes — your live has ended");
        void endLive();
        return;
      }
      const total = Math.floor(left / 1000);
      setPauseRemaining(`${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [active, isHost, isPaused, pausedAt]);

  const abortFailedLive = async () => {
    await (supabase as any).rpc("end_live_session", { _session_id: sessionId });
    closeLive();
  };



  return (
    <div className="absolute inset-0 h-full min-h-full w-full overflow-hidden bg-black">

      {/* Poster fallback / background */}
      {hostPhoto && (
        <img
          src={hostPhoto}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
        />
      )}

      {/* Video stage — full-bleed portrait on phones, centered 9:16 stage on wider screens */}
      {active && authorized && roomUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-full w-full overflow-hidden bg-black">
            {isHost ? (
              <HostBroadcaster
                roomUrl={roomUrl}
                token=""
                onLeave={endLive}
                onJoinFailed={abortFailedLive}
                paused={isPaused}
                onTogglePause={togglePause}
              />
            ) : (
              <LiveViewer
                roomUrl={roomUrl}
                active={active}
                userName={profile?.display_name ?? "Guest"}
                posterUrl={coverUrl ?? hostPhoto}
              />

            )}
          </div>
        </div>
      )}

      {/* Paused — viewers see the host's cover with a be-right-back note */}
      {authorized && !isHost && isPaused && (
        <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center bg-black/70">
          {(coverUrl ?? hostPhoto) && (
            <img
              src={(coverUrl ?? hostPhoto) as string}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">
            <PauseCircle className="h-12 w-12 text-white/90" />
            <p className="text-lg font-bold text-white">Live paused</p>
            <p className="text-sm text-white/80">
              {hostName ?? "The host"} stepped away for a moment and will be right back. Stay tuned —
              your ticket keeps running.
            </p>
          </div>
        </div>
      )}

      {/* Paused — host sees the auto-end countdown */}
      {authorized && isHost && isPaused && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[16] flex justify-center px-4">
          <div className="pointer-events-none flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-center text-xs font-semibold text-white backdrop-blur">
            <PauseCircle className="h-4 w-4 shrink-0" />
            <span>
              Paused — resume within 5 minutes or your live ends automatically ({pauseRemaining})
            </span>
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

          <GiftAnimationOverlay liveId={sessionId} />

          <LiveTopBar
            hostId={hostId}
            hostName={hostName}
            hostPhoto={hostPhoto}
            isHost={isHost}
            viewerCount={viewerCount}
            likeCount={likeCount}
            remaining={remaining}
            onClose={closeLive}
            onEndLive={endLive}
            onShare={shareLive}
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
            />
          )}
        </>
      )}

      {/* Ticket expired — renew or leave */}
      <Dialog open={renewOpen} onOpenChange={(v) => !v && setRenewOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Your ticket has ended
            </DialogTitle>
            <DialogDescription>
              Tickets last 1 hour on this live. Buy another hour to keep watching — your balance is{" "}
              {balance} coin{balance === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {balance >= TICKET_TOKENS ? (
              <Button
                className="w-full"
                size="lg"
                onClick={async () => {
                  const ok = await renewTicket();
                  if (ok) {
                    setRenewOpen(false);
                    toast.success("Ticket renewed — enjoy another hour");
                  } else {
                    toast.error("Couldn't renew your ticket");
                  }
                }}
              >
                Renew · {TICKET_TOKENS} coin
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  setRenewOpen(false);
                  setTopUpOpen(true);
                }}
              >
                Top up coins
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setRenewOpen(false);
                closeLive();
              }}
            >
              Exit live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InsufficientTokensDialog
        open={topUpOpen}
        onOpenChange={(v) => {
          setTopUpOpen(v);
          if (!v) closeLive();
        }}
        needed={TICKET_TOKENS}
        balance={balance}
        action="watch this live"
        joinSessionId={sessionId}
        joinHours={TICKET_TOKENS}
      />
    </div>
  );
}
