import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Loader2,
  Users,
  Heart,
  Radio,
  Coins,
  Send,
  Share2,
  Lock,
  Shield,
  MessageSquareOff,
  Clock,
} from "lucide-react";

import { toast } from "sonner";
import { GiftSheet } from "@/components/live/GiftSheet";
import { HostBroadcaster } from "@/components/live/HostBroadcaster";


const TICKET_PRICE_TOKENS = 1;
const RENEWAL_LEAD_MS = 2 * 60 * 1000; // start attempting 2 min before expiry

type Live = {
  id: string;
  host_id: string;
  title: string;
  status: "live" | "paused" | "ended";
  viewer_count: number;
  like_count: number;
  banner_url: string | null;
  share_link: string;
};

type Ticket = { id: string; expires_at: string };

export default function LiveViewPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [live, setLive] = useState<Live | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    "loading" | "signup" | "ended" | "notfound" | "confirm" | "buying" | "insufficient" | "expired" | "ready"
  >("loading");
  const [joinedAt, setJoinedAt] = useState<number | null>(null);

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [chatOpen, setChatOpen] = useState(false);

  const balance = Number((profile as any)?.token_balance ?? 0);
  const isHost = !!(user && live && live.host_id === user.id);
  const hasActiveSub = useHasActiveSubscription(user?.id);

  // Load live
  useEffect(() => {
    if (!shareLink) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("lives")
        .select("id, host_id, title, status, viewer_count, like_count, banner_url, share_link")
        .eq("share_link", shareLink)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setPhase("notfound");
        return;
      }
      setLive(data as Live);

      if (data.status === "ended") {
        setPhase("ended");
        return;
      }
      if (authLoading) return; // wait for auth
      if (!user) {
        setPhase("signup");
        return;
      }
    })();
    return () => { cancelled = true; };
  }, [shareLink, user, authLoading]);

  // Once we have live+user, secure a ticket then join room
  useEffect(() => {
    if (!live || !user || live.status === "ended" || phase === "ended" || phase === "notfound") return;
    if (phase === "signup" || phase === "ready" || phase === "confirm" || phase === "buying" || phase === "insufficient" || phase === "expired") return;
    void ensureTicketAndJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.id, user?.id]);

  async function ensureTicketAndJoin() {
    if (!live || !user) return;

    // Host bypass — no ticket needed for room, but log participant for mute UI
    if (live.host_id === user.id) {
      await joinRoom("host");
      return;
    }

    // Existing valid ticket?
    const { data: existing } = await supabase
      .from("live_tickets")
      .select("id, expires_at")
      .eq("live_id", live.id)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setTicket(existing as Ticket);
      if (!joinedAt) setJoinedAt(Date.now());
      await joinRoom("viewer");
      return;
    }

    // No ticket — ask the viewer to confirm the purchase (pricing modal)
    setPhase("confirm");
  }

  async function confirmAndBuy() {
    if (balance < TICKET_PRICE_TOKENS) {
      setPhase("insufficient");
      return;
    }
    setPhase("buying");
    const purchased = await buyTicket();
    if (!purchased) return;
    if (!joinedAt) setJoinedAt(Date.now());
    await joinRoom("viewer");
  }


  async function buyTicket(): Promise<boolean> {
    if (!live) return false;
    const { data, error } = await supabase.rpc("purchase_live_ticket", { _live_id: live.id });
    if (error) {
      if (error.message?.includes("insufficient_tokens") || error.hint === "insufficient_tokens") {
        setPhase("insufficient");
        return false;
      }
      toast.error(error.message ?? "Could not buy ticket");
      setPhase("insufficient");
      return false;
    }
    const row = Array.isArray(data) ? data[0] : (data as any);
    if (!row) {
      setPhase("insufficient");
      return false;
    }
    setTicket({ id: row.ticket_id, expires_at: row.expires_at });
    await refreshProfile();
    return true;
  }

  async function joinRoom(role: "host" | "viewer") {
    if (!live) return;
    const { data, error } = await supabase.functions.invoke("live-daily-room", {
      body: { live_id: live.id, role },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Could not join stream");
      setPhase("ended");
      return;
    }
    setRoomUrl((data as any).roomUrl);
    setToken((data as any).token);
    // Register participant
    await supabase
      .from("live_participants")
      .upsert(
        { live_id: live.id, user_id: user!.id, is_muted: false },
        { onConflict: "live_id,user_id", ignoreDuplicates: true },
      );
    setPhase("ready");
  }

  // Ticker for expiry checks & renewals
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-renew logic
  const renewingRef = useRef(false);
  useEffect(() => {
    if (isHost || !ticket || !live || phase !== "ready") return;
    const expiresMs = new Date(ticket.expires_at).getTime();
    const msLeft = expiresMs - nowTick;

    if (msLeft <= 0) {
      setPhase("expired");
      setRoomUrl(null);
      setToken(null);
      return;
    }
    if (msLeft <= RENEWAL_LEAD_MS && !renewingRef.current) {
      renewingRef.current = true;
      (async () => {
        if (balance >= TICKET_PRICE_TOKENS) {
          const ok = await buyTicket();
          if (ok) toast.success("Ticket renewed — keep watching!");
        } else {
          toast.warning("Buy more tokens to keep watching after your ticket expires.");
        }
        renewingRef.current = false;
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, ticket?.expires_at, phase, isHost, balance]);

  // Realtime: live status + counts
  useEffect(() => {
    if (!live?.id) return;
    const channel = supabase
      .channel(`live-${live.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${live.id}` },
        (payload) => {
          const next = payload.new as Live;
          setLive((prev) => (prev ? { ...prev, ...next } : next));
          if (next.status === "ended") setPhase("ended");
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live?.id]);

  const secsLeft = ticket && phase === "ready"
    ? Math.max(0, Math.floor((new Date(ticket.expires_at).getTime() - nowTick) / 1000))
    : 0;

  async function handleShare() {
    if (!live) return;
    const url = `${window.location.origin}/lives/${live.share_link}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: live.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch { /* user cancelled */ }
  }

  async function handleLike() {
    if (!live) return;
    const { error } = await supabase.rpc("like_live", { _live_id: live.id });
    if (error) toast.error("Couldn't like");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate("/lives")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center min-w-0 flex-1 px-2">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-destructive text-destructive-foreground gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {live?.status === "paused" ? "PAUSED" : "LIVE"}
            </Badge>
            <span className="text-xs font-semibold line-clamp-1">{live?.title ?? ""}</span>
          </div>
          {ticket && phase === "ready" && !isHost && (
            <TicketRemainingPill secsLeft={secsLeft} joinedAt={joinedAt} />
          )}

        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs"><Users className="h-3.5 w-3.5" />{live?.viewer_count ?? 0}</span>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
          {isHost && live && <HostMuteSheet liveId={live.id} />}
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1">
        {phase === "loading" && <Center><Loader2 className="h-8 w-8 animate-spin text-white" /></Center>}
        {phase === "notfound" && <ErrorState icon={<Radio className="h-10 w-10" />} msg="Live not found." />}
        {phase === "ended" && <ErrorState icon={<Radio className="h-10 w-10" />} msg="This live has ended." />}
        {phase === "signup" && (
          <ErrorState
            icon={<Lock className="h-10 w-10" />}
            msg="Sign up to join this live."
            action={
              <Link to={`/signup?redirect=/lives/${shareLink}`}>
                <Button className="gradient-warm border-0 text-primary-foreground">Sign up</Button>
              </Link>
            }
          />
        )}
        {phase === "buying" && <Center><Loader2 className="h-8 w-8 animate-spin text-white" /></Center>}
        {phase === "insufficient" && (
          <ErrorState
            icon={<Coins className="h-10 w-10" />}
            msg={`You need ${TICKET_PRICE_TOKENS} token to join. Your balance: ${balance}.`}
            action={
              <Button className="gradient-warm border-0 text-primary-foreground" onClick={() => navigate("/buy-tokens")}>
                Buy tokens
              </Button>
            }
          />
        )}
        {phase === "expired" && (
          <ErrorState
            icon={<Coins className="h-10 w-10" />}
            msg="Your ticket expired. Buy more tokens to keep watching."
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/buy-tokens")}>Buy tokens</Button>
                <Button className="gradient-warm border-0 text-primary-foreground" onClick={() => { setPhase("loading"); void ensureTicketAndJoin(); }}>
                  Try again
                </Button>
              </div>
            }
          />
        )}
        {phase === "ready" && roomUrl && token && (
          isHost ? (
            <HostBroadcaster roomUrl={roomUrl} token={token} />
          ) : (
            <iframe
              className="h-full w-full"
              src={`${roomUrl}?t=${token}`}
              allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
            />
          )
        )}


        {/* Floating actions */}
        {phase === "ready" && live && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div />
            <div className="pointer-events-auto flex flex-col gap-2 items-end">
              <button
                onClick={handleLike}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white active:scale-95 transition"
                aria-label="Like"
              >
                <Heart className="h-5 w-5" />
              </button>
              <div className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{live.like_count}</div>
              <Sheet open={chatOpen} onOpenChange={setChatOpen}>
                <SheetTrigger asChild>
                  <button className="flex h-11 items-center gap-1 rounded-full bg-black/60 px-3 text-white" aria-label="Open chat">
                    <Send className="h-4 w-4" /> <span className="text-xs">Chat</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
                  <SheetHeader className="p-4 pb-2"><SheetTitle>Live chat</SheetTitle></SheetHeader>
                  <LiveChat liveId={live.id} canPost={hasActiveSub} />
                </SheetContent>
              </Sheet>
              <GiftSheet liveId={live.id} hostIsSelf={isHost} />
            </div>
          </div>
        )}
      </div>

      <JoinLivePayDialog
        open={phase === "confirm"}
        balance={balance}
        onCancel={() => navigate("/lives")}
        onConfirm={() => void confirmAndBuy()}
        onBuyTokens={() => navigate("/buy-tokens")}
      />
    </div>
  );
}

function TicketRemainingPill({ secsLeft, joinedAt }: { secsLeft: number; joinedAt: number | null }) {
  const elapsedMs = joinedAt ? Date.now() - joinedAt : 0;
  const inIntro = elapsedMs < 2 * 60 * 60 * 1000;
  const rate = inIntro ? "$1.50/hr" : "$0.35/hr";
  return (
    <span className="mt-0.5 flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90">
      <Clock className="h-3 w-3" />
      <span className="tabular-nums">{formatSecs(secsLeft)}</span>
      <span className="opacity-70">left · {rate}</span>
    </span>
  );
}

function JoinLivePayDialog({
  open,
  balance,
  onCancel,
  onConfirm,
  onBuyTokens,
}: {
  open: boolean;
  balance: number;
  onCancel: () => void;
  onConfirm: () => void;
  onBuyTokens: () => void;
}) {
  const canAfford = balance >= TICKET_PRICE_TOKENS;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Join this live</DialogTitle>
          <DialogDescription>
            Tickets cover 1 hour of watch time. You can leave and rejoin anytime while your ticket is active.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">First 2 hours</span>
            <span className="font-semibold">$1.50/hr</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">After 2 hours</span>
            <span className="font-semibold text-primary">$0.35/hr</span>
          </div>
          <p className="pt-1 text-[11px] text-muted-foreground">
            Pay once per hour with <span className="font-medium text-foreground">{TICKET_PRICE_TOKENS} token</span>.
            The reduced rate kicks in automatically once you've watched for 2 hours.
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Your balance</span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Coins className="h-3.5 w-3.5 text-primary" /> {balance} token{balance === 1 ? "" : "s"}
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          {canAfford ? (
            <Button
              onClick={onConfirm}
              className="gradient-warm border-0 text-primary-foreground"
            >
              Pay {TICKET_PRICE_TOKENS} token · Join
            </Button>
          ) : (
            <Button
              onClick={onBuyTokens}
              className="gradient-warm border-0 text-primary-foreground"
            >
              Buy tokens
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function LiveChat({ liveId, canPost }: { liveId: string; canPost: boolean }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ id: string; user_id: string; content: string; created_at: string }>>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("id, user_id, content, created_at")
        .eq("live_id", liveId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(data ?? []);
    })();

    const channel = supabase
      .channel(`live-chat-${liveId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_id=eq.${liveId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as any]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 30);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [liveId]);

  async function send() {
    if (!user || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("live_chat_messages")
      .insert({ live_id: liveId, user_id: user.id, content: draft.trim() });
    setSending(false);
    if (error) {
      toast.error("Message blocked. Subscribe or unmute to chat.");
      return;
    }
    setDraft("");
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-2 text-sm">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-lg bg-muted/40 px-3 py-1.5">
              <p className="text-[10px] text-muted-foreground">{m.user_id.slice(0, 8)}</p>
              <p>{m.content}</p>
            </div>
          ))
        )}
      </div>
      <div className="border-t p-3">
        {canPost ? (
          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex gap-2"
          >
            <Input
              placeholder="Say something..."
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" disabled={!draft.trim() || sending} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <div className="flex items-center gap-2 text-foreground">
              <MessageSquareOff className="h-4 w-4 text-warning" />
              <span>Subscribe to chat in lives.</span>
            </div>
            <Link to="/pricing">
              <Button size="sm" variant="outline">Subscribe</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Host mute controls
// ---------------------------------------------------------------------------

function HostMuteSheet({ liveId }: { liveId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; user_id: string; is_muted: boolean; display_name?: string | null; photo?: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: parts } = await supabase
        .from("live_participants")
        .select("id, user_id, is_muted")
        .eq("live_id", liveId);
      const ids = (parts ?? []).map((p) => p.user_id);
      let profileMap = new Map<string, { display_name: string | null; photos: string[] | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_profiles_public", { _targets: ids });
        (profs ?? []).forEach((p: any) => profileMap.set(p.user_id, { display_name: p.display_name, photos: p.photos }));
      }
      if (cancelled) return;
      setRows(
        (parts ?? []).map((p) => ({
          id: p.id,
          user_id: p.user_id,
          is_muted: p.is_muted,
          display_name: profileMap.get(p.user_id)?.display_name ?? null,
          photo: profileMap.get(p.user_id)?.photos?.[0] ?? null,
        })),
      );
    })();

    const channel = supabase
      .channel(`live-parts-${liveId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_participants", filter: `live_id=eq.${liveId}` },
        () => { /* refetch on change */ },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [liveId]);

  async function toggleMute(row: { id: string; is_muted: boolean }) {
    const next = !row.is_muted;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_muted: next } : x)));
    const { error } = await supabase
      .from("live_participants")
      .update({ is_muted: next })
      .eq("id", row.id);
    if (error) {
      toast.error("Couldn't update mute state.");
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, is_muted: !next } : x)));
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label="Moderation">
          <Shield className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px]">
        <SheetHeader><SheetTitle>Moderation</SheetTitle></SheetHeader>
        <p className="mt-1 text-xs text-muted-foreground">Mute viewers to block their chat. Viewers cannot be removed.</p>
        <ScrollArea className="mt-4 h-[70vh] pr-2">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No viewers yet.</p>}
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={r.photo ?? undefined} />
                  <AvatarFallback>{(r.display_name ?? "?")[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{r.display_name ?? r.user_id.slice(0, 8)}</p>
                  <p className="text-[10px] text-muted-foreground">{r.is_muted ? "Muted" : "Can chat"}</p>
                </div>
                <Switch checked={r.is_muted} onCheckedChange={() => toggleMute(r)} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useHasActiveSubscription(userId?: string) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!userId) { setOk(false); return; }
    supabase.rpc("has_active_subscription", { _user_id: userId }).then(({ data }) => setOk(!!data));
  }, [userId]);
  return ok;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center">{children}</div>;
}
function ErrorState({ icon, msg, action }: { icon: React.ReactNode; msg: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-white/85 text-center px-6">
      <div className="opacity-60">{icon}</div>
      <p className="text-sm">{msg}</p>
      {action}
    </div>
  );
}
function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
