import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users, Clock, Loader2, Smartphone, ArrowUpRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useActiveLiveSessions, type ActiveLiveSession } from "@/hooks/useActiveLiveSessions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requestAvPermissions } from "@/lib/media-permissions";
import { useIsPhone } from "@/hooks/useIsPhone";
import { useSubscription } from "@/hooks/useSubscription";
import { InsufficientTokensDialog } from "@/components/InsufficientTokensDialog";

type Kind = "host" | "viewer";

function formatRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "ending…";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m left`;
}

export default function LivePage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { tier } = useSubscription();
  const { sessions, loading } = useActiveLiveSessions();
  const isPhone = useIsPhone();
  const desktopBlocked = isPhone === false;
  const [sheet, setSheet] = useState<{ kind: Kind; session?: ActiveLiveSession } | null>(null);
  const hours = 1;
  const [submitting, setSubmitting] = useState(false);
  const [shortfall, setShortfall] = useState<{ hours: number; sessionId: string } | null>(null);
  const balance = Number(profile?.token_balance ?? 0);
  const canHost = true; // Hosting a live is free for everyone

  const openHost = () => {
    if (desktopBlocked) {
      toast.info("Live only works on mobile — open tutwine.com on your phone.");
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    if (!canHost) {
      toast.error("An active subscription is required to go live");
      navigate("/pricing");
      return;
    }
    navigate("/live/start");
  };
  const openViewer = (s: ActiveLiveSession) => {
    if (desktopBlocked) {
      toast.info("Live only works on mobile — open tutwine.com on your phone.");
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    if (s.host_id === user.id) {
      navigate(`/live/${s.id}`);
      return;
    }
    setSheet({ kind: "viewer", session: s });
    
  };

  /** Viewers pay with tokens (1 token per hour) to get a live pass. */
  const submit = async () => {
    if (!user || !sheet?.session) return;
    if (balance < hours) {
      setSheet(null);
      setShortfall({ hours, sessionId: sheet.session.id });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("purchase_live_pass", {
        _session_id: sheet.session.id,
        _hours: hours,
      });
      if (error) throw error;
      await refreshProfile();
      const target = sheet.session.id;
      setSheet(null);
      const ok = await requestAvPermissions();
      navigate(`/live/${target}`);
      if (!ok) toast.info("Enable camera/mic access to chat on the live");
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message ?? "");
      if (msg.includes("insufficient tokens")) {
        setSheet(null);
        setShortfall({ hours, sessionId: sheet.session.id });
      } else {
        toast.error(msg || "Could not join the live");
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <AppLayout>
      <div className="px-3 pb-6 pt-3">
        <div className="mb-3 px-1">
          <h1 className="text-3xl font-bold tracking-tight">Live</h1>
          <p className="text-sm text-muted-foreground">
            See who's here right now, or open the floor yourself.
          </p>
          {desktopBlocked && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Live streaming is mobile-only. Open tutwine.com on your phone to host or join a live.
              </span>
            </div>
          )}
        </div>

        {/* Hero: host + viewer */}
        <div className="mb-6 space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Radio className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">Open your room</h2>
                <p className="text-sm text-muted-foreground">Free to host. Keep 60% of tickets and gifts.</p>
              </div>
            </div>
          </div>

          <Button
            onClick={openHost}
            disabled={desktopBlocked}
            size="lg"
            className="w-full rounded-xl font-semibold"
          >
            {desktopBlocked ? "Mobile only" : canHost ? "Go live" : "Subscribe to go live"}
          </Button>

          <button
            onClick={() => {
              if (sessions.length === 0) {
                toast.info("No one is live yet — check back soon.");
                return;
              }
              const first = sessions.find((s) => s.host_id !== user?.id) ?? sessions[0];
              openViewer(first);
            }}
            className="w-full rounded-2xl border border-border bg-card p-4 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/25 text-accent-foreground">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">Drop into a room</h2>
                <p className="text-sm text-muted-foreground">
                  1 coin per hour ($0.25). Short on coins? Top up in a tap.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Active sessions feed */}
        <div className="mb-3 flex items-end justify-between px-1">
          <h3 className="text-xl font-bold text-foreground">Live now</h3>
          <span className="text-xs text-muted-foreground">{sessions.length} streaming</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border">
              <span className="h-5 w-5 rounded-full bg-primary" />
            </span>
            <p className="font-semibold text-foreground">No one's live yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first tonight — the room fills up fast once someone opens it.
            </p>
            <Button
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => navigate("/live/how-it-works")}
            >
              How it works <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sessions.map((s) => {
              const thumb = s.thumbnail_url ?? s.photos?.[0] ?? null;
              return (
                <button
                  key={s.id}
                  onClick={() => openViewer(s)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition active:scale-[0.98]"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={s.display_name ?? "Live thumbnail"}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Radio className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      Live
                    </span>
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                      <Users className="h-3 w-3" />
                      {s.viewer_count}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 ring-1 ring-white/70">
                          <AvatarImage src={s.photos?.[0]} alt="" />
                          <AvatarFallback>{(s.display_name ?? "L").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                          {s.display_name ?? "Anonymous"}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-white/85">
                        <Clock className="h-3 w-3" />
                        {formatRemaining(s.expires_at)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Token join sheet */}
      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Join {sheet?.session?.display_name ?? "live"}</SheetTitle>
            <SheetDescription>1 coin ($0.25) will be deducted for this live.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">1 coin will be deducted</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your ticket is valid for 1 hour on this live only. Your balance: {balance} coin
                {balance === 1 ? "" : "s"}.
              </p>
            </div>

            {balance < 1 ? (
              <Button
                onClick={() => {
                  const sid = sheet?.session?.id;
                  setSheet(null);
                  if (sid) setShortfall({ hours: 1, sessionId: sid });
                }}
                className="w-full"
                size="lg"
              >
                Buy coins to join
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Spend 1 coin & Join"}
              </Button>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Access expires automatically when your time runs out. Tokens can't be withdrawn as cash.
            </p>
          </div>
        </SheetContent>
      </Sheet>

      <InsufficientTokensDialog
        open={shortfall !== null}
        onOpenChange={(o) => !o && setShortfall(null)}
        needed={shortfall?.hours ?? 0}
        balance={balance}
        action="join this live"
        joinSessionId={shortfall?.sessionId}
        joinHours={shortfall?.hours}
      />
    </AppLayout>
  );
}

