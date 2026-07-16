import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader2, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OverlayMsg {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
}

const OVERLAY_TTL_MS = 45_000; // each overlay fades out after 45s

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [overlays, setOverlays] = useState<OverlayMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isHost, setIsHost] = useState(false);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const nameCache = useRef<Map<string, string | null>>(new Map());


  // Authorize + fetch room URL
  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      const { data: rows, error } = await (supabase as any).rpc("get_live_session_room", {
        _session_id: sessionId,
      });
      const session = Array.isArray(rows) ? rows[0] : rows;

      if (error || !session || session.status !== "active" || !session.daily_room_url) {
        toast.error("This live stream is no longer available");
        navigate("/live", { replace: true });
        return;
      }

      let myExpiresAt = session.expires_at;
      if (session.host_id !== user.id) {
        const { data: pass } = await supabase
          .from("live_passes")
          .select("expires_at, status, started_at, created_at")
          .eq("session_id", sessionId)
          .eq("viewer_id", user.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pass) {
          toast.error("You need an active pass to join this live");
          navigate("/live", { replace: true });
          return;
        }
        myExpiresAt = new Date(
          Math.min(new Date(pass.expires_at).getTime(), new Date(session.expires_at).getTime()),
        ).toISOString();
        setJoinedAt(pass.started_at ?? pass.created_at);
      } else {
        setIsHost(true);
      }

      setRoomUrl(session.daily_room_url);
      setExpiresAt(myExpiresAt);
      setLoading(false);
    })();
  }, [sessionId, user, navigate]);


  // Session countdown — show H:MM:SS while ≥1h, else M:SS
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        toast.info("Your live time has ended");
        navigate("/live", { replace: true });
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setRemaining(
        h > 0
          ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
          : `${m}:${s.toString().padStart(2, "0")}`
      );
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiresAt, navigate]);

  // Tick "now" so overlays expire visually
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Load + subscribe to overlay messages
  useEffect(() => {
    if (!sessionId || loading) return;

    const hydrateNames = async (rows: OverlayMsg[]) => {
      const missing = Array.from(
        new Set(rows.map((r) => r.author_id).filter((id) => !nameCache.current.has(id))),
      );
      if (missing.length > 0) {
        const { data: profs } = await supabase.rpc("get_profiles_public", { _targets: missing });
        (profs ?? []).forEach((p: any) =>
          nameCache.current.set(p.user_id, p.display_name ?? null),
        );
        missing.forEach((id) => {
          if (!nameCache.current.has(id)) nameCache.current.set(id, null);
        });
      }
      return rows.map((r) => ({ ...r, author_name: nameCache.current.get(r.author_id) ?? null }));
    };

    (async () => {
      const sinceIso = new Date(Date.now() - OVERLAY_TTL_MS).toISOString();
      const { data } = await (supabase as any)
        .from("live_overlay_messages")
        .select("id, author_id, content, created_at")
        .eq("session_id", sessionId)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: true });
      const hydrated = await hydrateNames((data ?? []) as OverlayMsg[]);
      setOverlays(hydrated);
    })();


    const channel = supabase
      .channel(`live_overlay_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_overlay_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const row = payload.new as OverlayMsg;
          const [hydrated] = await hydrateNames([row]);
          setOverlays((prev) => [...prev, hydrated]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, loading]);

  // Drop expired overlays from state
  useEffect(() => {
    setOverlays((prev) => prev.filter((o) => now - new Date(o.created_at).getTime() < OVERLAY_TTL_MS));
  }, [now]);

  const sendOverlay = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !sessionId || !user || sending) return;
    if (trimmed.length > 200) {
      toast.error("Keep it under 200 characters");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any)
      .from("live_overlay_messages")
      .insert({ session_id: sessionId, author_id: user.id, content: trimmed });

    setSending(false);
    if (error) {
      toast.error("Could not post — try again");
      return;
    }
    setDraft("");
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Rate info for viewers (host is free). Flat $1/hr = 1 token/hour.
  let rateLabel: string | null = null;
  let rateHint: string | null = null;
  if (!isHost && joinedAt) {
    rateLabel = "$1/hr";
    rateHint = "1 token per hour";
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex flex-col gap-1 bg-black/90 px-4 py-2 text-white">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            LIVE
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3 w-3" />
            <span className="opacity-70">Ends in</span>
            <span className="font-semibold tabular-nums">{remaining}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => navigate("/live")}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        {rateLabel && (
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span>
              Rate: <span className="font-semibold text-white">{rateLabel}</span>
            </span>
            {rateHint && <span className="tabular-nums">{rateHint}</span>}
          </div>
        )}
      </div>


      {/* Video + overlays */}
      <div className="relative flex-1">
        {roomUrl && (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={roomUrl}
            allow="camera; microphone; autoplay; display-capture; fullscreen"
            style={{ border: 0 }}
          />
        )}

        {/* Overlay stack — pinned bottom-left over the video */}
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex max-h-[55%] flex-col-reverse gap-1.5 overflow-hidden px-3 pb-2">
          {[...overlays].reverse().map((o) => {
            const age = now - new Date(o.created_at).getTime();
            const fade = age > OVERLAY_TTL_MS - 8000 ? Math.max(0, 1 - (age - (OVERLAY_TTL_MS - 8000)) / 8000) : 1;
            return (
              <div
                key={o.id}
                className="max-w-[85%] self-start rounded-2xl bg-black/70 px-3 py-1.5 text-white shadow-lg backdrop-blur-sm"
                style={{ opacity: fade }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/70">
                  {o.author_name ?? "Guest"}
                </div>
                <div className="break-words text-sm font-medium leading-snug">{o.content}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendOverlay();
        }}
        className="flex items-center gap-2 bg-black/95 px-3 py-2"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder={`Type your number or a message, ${profile?.display_name ?? "you"}…`}
          className="border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:ring-primary"
          inputMode="text"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || sending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
