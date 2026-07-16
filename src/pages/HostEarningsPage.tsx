import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, Eye, Gift, Heart, Clock, Loader2, Wallet } from "lucide-react";

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
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.rpc("host_earnings_stats", { _host_id: null });
      if (!error) {
        const row = Array.isArray(data) ? data[0] : (data as any);
        setStats(row ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur border-b px-4 py-3">
        <Link to="/profile">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-lg font-semibold">Host Earnings</h1>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
          Hosts receive <strong>60%</strong> of all Live Ticket and Gift earnings when a live
          runs 60+ minutes (<strong>10%</strong> if it ends early). Tutwine retains the
          remainder as commission.
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Wallet className="h-3.5 w-3.5" />}
                label="Available Earnings"
                value={`${Number(stats.available_earnings).toFixed(2)}`}
                sub="tokens ($1 each)"
              />
              <StatCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Pending Withdrawals"
                value={`${Number(stats.pending_withdrawals).toFixed(2)}`}
              />
              <StatCard
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Paid Withdrawals"
                value={`${Number(stats.paid_withdrawals).toFixed(2)}`}
              />
              <StatCard
                icon={<Coins className="h-3.5 w-3.5" />}
                label="Total Lifetime Earnings"
                value={`${Number(stats.total_lifetime_earnings).toFixed(2)}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Eye className="h-3.5 w-3.5" />} label="Total Live Views" value={stats.total_live_views ?? 0} />
              <StatCard
                icon={<Gift className="h-3.5 w-3.5" />}
                label="Total Gifts Received"
                value={stats.total_gifts_received ?? 0}
                sub={`${Number(stats.total_gift_tokens ?? 0).toFixed(0)} tokens`}
              />
              <StatCard icon={<Heart className="h-3.5 w-3.5" />} label="Total Likes Received" value={stats.total_likes_received ?? 0} />
              <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Total Watch Time" value={fmtDuration(stats.total_watch_seconds ?? 0)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
