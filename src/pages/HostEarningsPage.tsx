import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Coins,
  Eye,
  Gift,
  Heart,
  Clock,
  Loader2,
  Wallet,
  ArrowRightLeft,
  RefreshCcw,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { TOKEN_USD, formatTokensUsd } from "@/lib/constants";

type Stats = {
  available_earnings: number;
  pending_withdrawals: number;
  paid_withdrawals: number;
  total_lifetime_earnings: number;
  total_live_views: number;
  total_gifts_received: number;
  total_gift_tokens: number;
  total_likes_received: number;
  total_watch_seconds: number;
};

type Withdrawal = {
  id: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  requested_at: string;
  cooldown_until: string;
  wallet_address: string;
};

/** A single gift the host received, with sender + catalog details resolved. */
type ReceivedGift = {
  id: string;
  gift_key: string;
  token_amount: number;
  created_at: string;
  senderName: string;
  emoji: string;
  label: string;
};

const HOST_GIFT_SHARE = 0.6;


const MIN_WITHDRAWAL = 100;

function fmtDuration(s: number) {
  if (!s) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export default function HostEarningsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestWithdrawal, setLatestWithdrawal] = useState<Withdrawal | null>(null);
  const [gifts, setGifts] = useState<ReceivedGift[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(true);

  const [convertOpen, setConvertOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [walletAddr, setWalletAddr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Recent gifts received, enriched with the sender name and catalog emoji. */
  const loadGifts = async (uid: string) => {
    setGiftsLoading(true);
    const [giftRes, catalogRes] = await Promise.all([
      supabase
        .from("gifts" as any)
        .select("id, gift_key, token_amount, created_at, sender_id")
        .eq("host_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("gift_catalog" as any).select("key, label, emoji"),
    ]);
    const rows = ((giftRes as any)?.data ?? []) as any[];
    const catalog = new Map<string, { label: string; emoji: string }>(
      (((catalogRes as any)?.data ?? []) as any[]).map((c) => [c.key, c]),
    );
    const senderIds = Array.from(new Set(rows.map((r) => r.sender_id).filter(Boolean)));
    let names = new Map<string, string>();
    if (senderIds.length) {
      const { data: profs } = await supabase.rpc("get_profiles_public", { _targets: senderIds });
      names = new Map(
        (((profs as any) ?? []) as any[]).map((p) => [p.user_id, p.display_name ?? "Someone"]),
      );
    }
    setGifts(
      rows.map((r) => ({
        id: r.id,
        gift_key: r.gift_key,
        token_amount: Number(r.token_amount ?? 0),
        created_at: r.created_at,
        senderName: names.get(r.sender_id) ?? "Someone",
        emoji: catalog.get(r.gift_key)?.emoji ?? "🎁",
        label: catalog.get(r.gift_key)?.label ?? r.gift_key,
      })),
    );
    setGiftsLoading(false);
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.rpc("host_earnings_stats", { _host_id: null }),
      supabase
        .from("withdrawals" as any)
        .select("id, amount, status, requested_at, cooldown_until, wallet_address")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(1),
      loadGifts(user.id),
    ]);
    const row = Array.isArray(s) ? s[0] : (s as any);
    setStats(row ?? null);
    setLatestWithdrawal(((w as any)?.[0] as Withdrawal) ?? null);
    setLoading(false);
  };


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setWalletAddr(profile?.litecoin_wallet_address ?? "");
  }, [profile]);

  const cooldownActive =
    latestWithdrawal && new Date(latestWithdrawal.cooldown_until).getTime() > Date.now();
  const available = Number(stats?.available_earnings ?? 0);
  const withdrawDisabled = available < MIN_WITHDRAWAL || cooldownActive;

  async function handleConvert() {
    const amt = Number(convertAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > available) return toast.error("Insufficient earnings");
    setSubmitting(true);
    const { error } = await supabase.rpc("convert_earnings_to_tokens" as any, { _amount: amt });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Converted ${amt} coins (${formatTokensUsd(amt)}) to your balance`);
    setConvertOpen(false);
    setConvertAmount("");
    await Promise.all([load(), refreshProfile()]);
  }

  async function handleRenew() {
    setSubmitting(true);
    const { error } = await supabase.rpc("renew_subscription_with_earnings" as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Subscription renewed for 30 days");
    setRenewOpen(false);
    await Promise.all([load(), refreshProfile()]);
  }

  async function handleWithdraw() {
    const amt = Number(withdrawAmount);
    if (!amt || amt < MIN_WITHDRAWAL) return toast.error(`Minimum is ${MIN_WITHDRAWAL}`);
    if (amt > available) return toast.error("Insufficient earnings");
    if (!walletAddr || walletAddr.trim().length < 10)
      return toast.error("Enter a valid USDT (BEP20) address");

    setSubmitting(true);
    const { error } = await supabase.rpc("request_withdrawal" as any, {
      _amount: amt,
      _wallet_address: walletAddr.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    setWithdrawOpen(false);
    setWithdrawAmount("");
    await Promise.all([load(), refreshProfile()]);
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur border-b px-4 py-3">
        <Link to="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Host Earnings</h1>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
          Hosts receive <strong>60%</strong> of all Live Ticket and Gift earnings when a live runs
          60+ minutes (<strong>10%</strong> if it ends early). Tutwine retains the remainder as
          commission.
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Wallet className="h-3.5 w-3.5" />}
                label="Available Earnings"
                value={formatTokensUsd(available)}
                sub={`${available.toFixed(2)} coins · 1 coin = $${TOKEN_USD.toFixed(2)}`}
              />
              <StatCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Pending Withdrawals"
                value={formatTokensUsd(Number(stats.pending_withdrawals))}
                sub={`${Number(stats.pending_withdrawals).toFixed(2)} coins`}
              />
              <StatCard
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Paid Withdrawals"
                value={formatTokensUsd(Number(stats.paid_withdrawals))}
                sub={`${Number(stats.paid_withdrawals).toFixed(2)} coins`}
              />
              <StatCard
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Total Lifetime Earnings"
                value={formatTokensUsd(Number(stats.total_lifetime_earnings))}
                sub={`${Number(stats.total_lifetime_earnings).toFixed(2)} coins`}
              />
            </div>

            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold">Use your earnings</h2>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => setConvertOpen(true)}
                  disabled={available <= 0}
                >
                  <ArrowRightLeft className="h-4 w-4" /> Convert to Coins (1:1)
                </Button>
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => setRenewOpen(true)}
                >
                  <RefreshCcw className="h-4 w-4" /> Renew Subscription with Earnings
                </Button>
                <Button
                  className="justify-start gap-2"
                  onClick={() => {
                    setWithdrawAmount(String(Math.floor(available)));
                    setWithdrawOpen(true);
                  }}
                  disabled={!!withdrawDisabled}
                >
                  <Banknote className="h-4 w-4" /> Withdraw to USDT (BEP20)
                </Button>
                {available < MIN_WITHDRAWAL && (
                  <p className="text-[11px] text-muted-foreground">
                    Minimum withdrawal is {MIN_WITHDRAWAL} coins ({formatTokensUsd(MIN_WITHDRAWAL)}
                    ). You have {available.toFixed(2)} coins ({formatTokensUsd(available)}).
                  </p>
                )}
                {cooldownActive && latestWithdrawal && (
                  <p className="text-[11px] text-muted-foreground">
                    Next withdrawal available{" "}
                    {new Date(latestWithdrawal.cooldown_until).toLocaleString()} (72h cooldown).
                  </p>
                )}
                {!profile?.litecoin_wallet_address && (
                  <p className="text-[11px] text-muted-foreground">
                    Tip: set a default USDT (BEP20) address in{" "}
                    <Link to="/settings" className="underline">
                      Settings
                    </Link>
                    .
                  </p>
                )}

              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Eye className="h-3.5 w-3.5" />}
                label="Total Live Views"
                value={stats.total_live_views ?? 0}
              />
              <StatCard
                icon={<Gift className="h-3.5 w-3.5" />}
                label="Total Gifts Received"
                value={stats.total_gifts_received ?? 0}
                sub={`${Number(stats.total_gift_tokens ?? 0).toFixed(0)} coins · ${formatTokensUsd(
                  Number(stats.total_gift_tokens ?? 0),
                )} gifted · your share ${formatTokensUsd(
                  Number(stats.total_gift_tokens ?? 0) * HOST_GIFT_SHARE,
                )}`}
              />
              <StatCard
                icon={<Heart className="h-3.5 w-3.5" />}
                label="Total Likes Received"
                value={stats.total_likes_received ?? 0}
              />
              <StatCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Total Watch Time"
                value={fmtDuration(stats.total_watch_seconds ?? 0)}
              />
            </div>

            {/* Gifts received — detail list with a shortcut to convert earnings */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Gift className="h-4 w-4" /> Gifts Received
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    You keep {Math.round(HOST_GIFT_SHARE * 100)}% of every gift as earnings. 1 coin
                    = ${TOKEN_USD.toFixed(2)}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    setConvertAmount(String(Math.floor(available)));
                    setConvertOpen(true);
                  }}
                  disabled={available <= 0}
                >
                  <ArrowRightLeft className="h-4 w-4" /> Convert to coins
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                {giftsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : gifts.length === 0 ? (
                  <p className="py-3 text-xs text-muted-foreground">
                    No gifts yet. Go live and your viewers can send you gifts.
                  </p>
                ) : (
                  gifts.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5"
                    >
                      <span className="text-xl">{g.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{g.label}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          from {g.senderName} · {new Date(g.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          +{formatTokensUsd(g.token_amount * HOST_GIFT_SHARE)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(g.token_amount * HOST_GIFT_SHARE).toFixed(2)} of {g.token_amount} coins
                          ({formatTokensUsd(g.token_amount)} gift)
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </>
        )}
      </div>

      {/* Convert dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Earnings to Tokens</DialogTitle>
            <DialogDescription>
              Move earnings to your coin balance at a 1:1 coin rate. Available:{" "}
              {available.toFixed(2)} coins ({formatTokensUsd(available)}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              max={available}
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              placeholder="e.g. 25"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Subscription with Earnings</DialogTitle>
            <DialogDescription>
              Your current subscription price will be deducted from Available Earnings and your
              subscription extended by 30 days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenew} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Renew
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to USDT (BEP20)</DialogTitle>
            <DialogDescription>
              Minimum {MIN_WITHDRAWAL}. A 72-hour cooldown applies to each request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min={MIN_WITHDRAWAL}
                max={available}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>USDT (BEP20) address</Label>
              <Input
                value={walletAddr}
                onChange={(e) => setWalletAddr(e.target.value)}
                placeholder="0x... BEP20 (BNB Smart Chain) address"
              />
              <p className="text-[11px] text-muted-foreground">
                This will be saved as your default address. Please confirm it is correct — USDT sent
                to a wrong address or a different network cannot be recovered. You can edit it any
                time in{" "}
                <Link to="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWithdraw} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
