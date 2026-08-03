import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users, Clock, Loader2, Smartphone } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useActiveLiveSessions, type ActiveLiveSession } from "@/hooks/useActiveLiveSessions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LIVE_DURATION_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import { requestAvPermissions } from "@/lib/media-permissions";
import { useIsPhone } from "@/hooks/useIsPhone";
import { useSubscription } from "@/hooks/useSubscription";

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
  const [hours, setHours] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const balance = Number(profile?.token_balance ?? 0);
  const canHost = tier !== "free";

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
    setHours(1);
  };

  /** Viewers pay with tokens (1 token per hour) to get a live pass. */
  const submit = async () => {
    if (!user || !sheet?.session) return;
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
        toast.error("Not enough tokens — top up to join");
        navigate("/buy-tokens");
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
          <h1 className="text-2xl font-bold tracking-tight">Live</h1>
          <p className="text-sm text-muted-foreground">Go live or join a live stream</p>
          {desktopBlocked && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Live streaming is mobile-only. Open tutwine.com on your phone to host or join a live.
              </span>
            </div>
          )}
        </div>
        {/* Hero CTAs: Go Live (host) + Join Live (viewer) */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {/* Go Live (host) */}
          <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-accent p-4 text-primary-foreground shadow-lg">
            <div className="mb-2 flex items-center gap-2">
              <Radio className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Go Live</span>
            </div>
            <h2 className="mb-1 text-xl font-bold">Start your own live stream</h2>
            <p className="mb-3 text-sm opacity-90">
              Subscribers only — you keep 60% of gifts sent by viewers.
            </p>
            <Button
              onClick={openHost}
              variant="secondary"
              disabled={desktopBlocked}
              className="w-full font-semibold"
            >
              {desktopBlocked ? "Mobile only" : canHost ? "Go Live now" : "Subscribe to go live"}
            </Button>
          </div>

          {/* Join Live (viewer) */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">Join a Live</span>
            </div>
            <h2 className="mb-1 text-xl font-bold text-foreground">
              {sessions.length > 0
                ? `${sessions.length} host${sessions.length === 1 ? "" : "s"} live now`
                : "No streams live right now"}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              $1/hr · 1 token per hour. If you don't have tokens, we'll help you top up.
            </p>
            <Button
              onClick={() => {
                if (sessions.length === 0) {
                  toast.info("No one is live yet — check back soon.");
                  return;
                }
                const first = sessions.find((s) => s.host_id !== user?.id) ?? sessions[0];
                openViewer(first);
              }}
              disabled={sessions.length === 0 || desktopBlocked}
              className="w-full font-semibold"
            >
              {desktopBlocked ? "Mobile only" : sessions.length > 0 ? "Join Live now" : "None live yet"}
            </Button>
          </div>
        </div>


        {/* Active sessions feed */}
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-foreground">Live now</h3>
          <span className="text-xs text-muted-foreground">{sessions.length} streaming</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
            <Radio className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No one is live right now. Be the first — go live and people will see you here in real time.
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
            <SheetDescription>1 token per hour — pick how long you want to watch.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Duration</Label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {LIVE_DURATION_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                      hours === h ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Costs {hours} token{hours === 1 ? "" : "s"} · your balance: {balance} token
                {balance === 1 ? "" : "s"}
              </p>
            </div>

            {balance < hours ? (
              <Button onClick={() => navigate("/buy-tokens")} className="w-full" size="lg">
                Buy tokens to join
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Spend ${hours} token${hours === 1 ? "" : "s"} & Join`
                )}
              </Button>
            )}
            <p className="text-center text-[11px] text-muted-foreground">
              Access expires automatically when your time runs out. Tokens can't be withdrawn as cash.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

