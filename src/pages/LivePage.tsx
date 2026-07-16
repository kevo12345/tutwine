import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Radio, Users, Clock, Loader2, Smartphone, Bitcoin } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useActiveLiveSessions, type ActiveLiveSession } from "@/hooks/useActiveLiveSessions";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LIVE_DURATION_OPTIONS, priceForLiveHours } from "@/lib/constants";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const { sessions, loading } = useActiveLiveSessions();
  const [sheet, setSheet] = useState<{ kind: Kind; session?: ActiveLiveSession } | null>(null);
  const [hours, setHours] = useState<number>(1);
  const [provider, setProvider] = useState<"sellapay" | "nowpayments">("sellapay");
  const [phone, setPhone] = useState("");
  const [payCurrency, setPayCurrency] = useState<"ltc" | "usdttrc20">("ltc");
  const [submitting, setSubmitting] = useState(false);
  const usd = useMemo(() => priceForLiveHours(hours), [hours]);
  const kes = useMemo(() => Math.max(1, Math.round(usd * 130)), [usd]);
  // NOWPayments USDT-TRC20 invoices typically require ~$8+ USD; smaller amounts are rejected by the provider.
  const USDT_MIN_USD = 8;
  const usdtBelowMin = usd < USDT_MIN_USD;

  // Auto-fall back to LTC if the selected duration puts USDT below the provider minimum.
  useEffect(() => {
    if (provider === "nowpayments" && payCurrency === "usdttrc20" && usdtBelowMin) {
      setPayCurrency("ltc");
    }
  }, [provider, payCurrency, usdtBelowMin]);

  // Auto-redirect host if they have an active session
  useEffect(() => {
    if (!user) return;
    const own = sessions.find((s) => s.host_id === user.id);
    if (own && sheet?.kind !== "host") {
      // don't auto-navigate; just surface a CTA
    }
  }, [sessions, user, sheet]);

  const openHost = () => {
    setSheet({ kind: "host" });
    setHours(1);
  };
  const openViewer = (s: ActiveLiveSession) => {
    if (s.host_id === user?.id) {
      navigate(`/live/${s.id}`);
      return;
    }
    setSheet({ kind: "viewer", session: s });
    setHours(1);
  };

  const submit = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (provider === "sellapay" && !/^(?:\+?254|0)\d{9}$/.test(phone.replace(/\s+/g, ""))) {
      toast.error("Enter a valid Kenyan M-Pesa number");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("live-create-payment", {
        body: {
          kind: sheet!.kind,
          session_id: sheet!.session?.id,
          duration_hours: hours,
          provider,
          phone: provider === "sellapay" ? phone : undefined,
          pay_currency: provider === "nowpayments" ? payCurrency : undefined,
          kes_amount: provider === "sellapay" ? kes : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (provider === "sellapay") {
        toast.success("STK push sent — approve on your phone to go live");
      } else {
        toast.success("Send the exact crypto amount to the address shown to activate");
        // Could also open a detail view; for now, just close.
      }
      setSheet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not start payment");
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
              Hosting is free — you keep 60% of gifts sent by viewers.
            </p>
            <Button onClick={openHost} variant="secondary" className="w-full font-semibold">
              Go Live now
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
              $1.50/hr for the first 2 hours, then $0.35/hr. Pay per hour with tokens.
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
              disabled={sessions.length === 0}
              className="w-full font-semibold"
            >
              {sessions.length > 0 ? "Join Live now" : "None live yet"}
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
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                <div className="relative">
                  <Avatar className="h-12 w-12 ring-2 ring-red-500">
                    <AvatarImage src={s.photos?.[0]} alt={s.display_name ?? "Live"} />
                    <AvatarFallback>{(s.display_name ?? "L").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 text-[9px] font-bold uppercase text-white">
                    Live
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.display_name ?? "Anonymous"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.viewer_count}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatRemaining(s.expires_at)}</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => openViewer(s)}>
                  {s.host_id === user?.id ? "Open" : "Join"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment sheet */}
      <Sheet open={!!sheet} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{sheet?.kind === "host" ? "Go Live" : `Join ${sheet?.session?.display_name ?? "live"}`}</SheetTitle>
            <SheetDescription>
              Pick how long you want {sheet?.kind === "host" ? "to broadcast" : "to watch"}.
            </SheetDescription>
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
                ${usd.toFixed(2)} USD {provider === "sellapay" && <>· ≈ KES {kes}</>}
              </p>
            </div>

            <div>
              <Label className="text-xs uppercase text-muted-foreground">Pay with</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProvider("sellapay")}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    provider === "sellapay" ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  <Smartphone className="h-4 w-4" /> M-Pesa
                </button>
                <button
                  onClick={() => setProvider("nowpayments")}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    provider === "nowpayments" ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  <Bitcoin className="h-4 w-4" /> Crypto
                </button>
              </div>
            </div>

            {provider === "sellapay" ? (
              <div>
                <Label htmlFor="phone" className="text-xs uppercase text-muted-foreground">M-Pesa phone</Label>
                <Input id="phone" inputMode="tel" placeholder="07XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
              </div>
            ) : (
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Coin</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["usdttrc20", "ltc"] as const).map((c) => {
                    const disabled = c === "usdttrc20" && usdtBelowMin;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) {
                            toast.error(
                              `USDT (TRC20) needs at least $${USDT_MIN_USD}. Pick a longer duration or pay with Litecoin / M-Pesa.`
                            );
                            return;
                          }
                          setPayCurrency(c);
                        }}
                        className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                          disabled
                            ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground opacity-60"
                            : payCurrency === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border"
                        }`}
                      >
                        {c === "usdttrc20" ? "USDT (TRC20)" : "Litecoin"}
                      </button>
                    );
                  })}
                </div>
                {usdtBelowMin && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    USDT (TRC20) requires at least ${USDT_MIN_USD}. For this duration, pay with Litecoin or switch to M-Pesa.
                  </p>
                )}
              </div>
            )}

            <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${usd.toFixed(2)} & ${sheet?.kind === "host" ? "Go Live" : "Join"}`}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Access expires automatically when your paid time runs out.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
