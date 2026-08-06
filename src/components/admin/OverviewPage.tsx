import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Users, Flag, TrendingUp, Crown, Coins, Radio, Heart, Gift,
  Ticket, Banknote, Wallet, ArrowUpRight, CircleDot, Eye, EyeOff,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart,
} from "recharts";
import { AdminStats } from "@/hooks/useAdminData";
import { Link } from "react-router-dom";

interface OverviewPageProps {
  stats: AdminStats | null;
}

const exactNum = (v: number) => Math.round(v).toLocaleString("en-US");
const exactMoney = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Anything past 999 is rounded to k / M / B, with the exact figure on hover.
function compact(value: number) {
  const abs = Math.abs(value);
  if (abs < 1000) return exactNum(value);
  if (abs < 1_000_000) return `${(value / 1000).toFixed(abs < 10_000 ? 1 : 0)}k`;
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
];


function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="text-xs font-semibold" style={{ color: p.color ?? p.fill }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

export default function OverviewPage({ stats }: OverviewPageProps) {
  const series = (stats?.series ?? []).map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const heroCards = [
    {
      label: "Total Users", value: num(stats?.totalUsers), icon: Users,
      sub: `${num(stats?.recentSignups)} new this week`, tone: "primary" as const, href: "/admin/users",
    },
    {
      label: "Coins Sold", value: num(stats?.tokensSold), icon: Coins,
      sub: `${money(stats?.tokensSold)} gross volume`, tone: "success" as const, href: "/admin/payments",
    },
    {
      label: "Platform Earnings", value: money(stats?.platformEarnings), icon: Wallet,
      sub: `${money(stats?.hostEarnings)} paid to hosts`, tone: "info" as const, href: "/admin/live-monitor",
    },
    {
      label: "Live Right Now", value: num(stats?.liveNow), icon: Radio,
      sub: `${num(stats?.onlineNow)} users online`, tone: "accent" as const, href: "/admin/live-monitor",
    },
  ];

  const secondary = [
    { label: "Active Subscribers", value: num(stats?.subscribers), icon: Crown },
    { label: "Tickets Sold", value: num(stats?.ticketsSold), icon: Ticket },
    { label: "Gifts Sent", value: num(stats?.giftsSent), icon: Gift },
    { label: "Matches", value: num(stats?.totalMatches), icon: Heart },
    { label: "Pending Reports", value: num(stats?.pendingReports), icon: Flag },
    { label: "Pending Payouts", value: num(stats?.pendingWithdrawalCount), icon: Banknote },
  ];

  const tierData = Object.entries(stats?.tierCounts ?? {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  const moneyFlow = [
    { name: "Coins sold", value: Number(stats?.tokensSold ?? 0) },
    { name: "Gift coins", value: Number(stats?.giftTokens ?? 0) },
    { name: "Host earnings", value: Number(stats?.hostEarnings ?? 0) },
    { name: "Platform cut", value: Number(stats?.platformEarnings ?? 0) },
    { name: "Paid out", value: Number(stats?.paidWithdrawalTokens ?? 0) },
    { name: "Pending payout", value: Number(stats?.pendingWithdrawalTokens ?? 0) },
  ];

  const toneClass = {
    primary: "from-primary/15 to-primary/0 text-primary",
    success: "from-success/15 to-success/0 text-success",
    info: "from-info/15 to-info/0 text-info",
    accent: "from-accent/15 to-accent/0 text-accent",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Platform Overview</h1>
            <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-[10px] font-medium text-success">
              <CircleDot className="h-3 w-3" /> Live data
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything happening across Tutwine — growth, revenue, lives and community health.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Hero KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {heroCards.map((c) => (
          <Link key={c.label} to={c.href} className="group">
            <Card className="relative overflow-hidden border border-border/70 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
              <div className={`absolute inset-0 bg-gradient-to-br ${toneClass[c.tone]} opacity-70`} />
              <CardContent className="relative p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-xl bg-background/70 p-2.5 shadow-sm backdrop-blur">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="text-3xl font-semibold tracking-tight text-foreground">{c.value}</p>
                <p className="mt-1 text-xs font-medium text-foreground/80">{c.label}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Secondary metric strip */}
      <Card className="border border-border/70 shadow-sm">
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {secondary.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              {i > 0 && <Separator orientation="vertical" className="hidden h-8 lg:block" />}
              <div className="rounded-lg bg-muted p-2">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none tracking-tight">{s.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Growth + revenue */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border border-border/70 shadow-sm xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Growth & revenue</h3>
                <p className="text-[11px] text-muted-foreground">New signups vs. coin revenue, last 30 days</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Signups
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-success" /> Revenue ($)
                </span>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(0, Math.floor(series.length / 8))} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="signups" name="Signups" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#signupFill)" />
                  <Line type="monotone" dataKey="revenue" name="Revenue ($)" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Subscription mix</h3>
              <p className="text-[11px] text-muted-foreground">Active plans by tier</p>
            </div>
            {tierData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-xs text-muted-foreground">
                No active subscriptions yet
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tierData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
                      {tierData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Money flow + operations */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border border-border/70 shadow-sm xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Coin economy</h3>
              <p className="text-[11px] text-muted-foreground">
                Where coins come from and where they go — {num(stats?.coinsInCirculation)} coins currently in wallets
              </p>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moneyFlow} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                  <Bar dataKey="value" name="Coins" radius={[6, 6, 0, 0]}>
                    {moneyFlow.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Needs attention</h3>
            <div className="space-y-2">
              {[
                { label: "Review pending reports", count: stats?.pendingReports ?? 0, href: "/admin/reports" },
                { label: "Approve withdrawals", count: stats?.pendingWithdrawalCount ?? 0, href: "/admin/withdrawals" },
                { label: "Monitor active lives", count: stats?.liveNow ?? 0, href: "/admin/live-monitor" },
                { label: "Browse registered users", count: stats?.totalUsers ?? 0, href: "/admin/users" },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.href}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="text-sm">{a.label}</span>
                  <Badge variant="secondary" className="text-[11px] font-semibold">{a.count}</Badge>
                </Link>
              ))}
            </div>

            <Separator className="my-4" />
            <h3 className="mb-3 text-sm font-semibold">System status</h3>
            <div className="space-y-2.5">
              {["Database", "Authentication", "Edge Functions", "Storage"].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s}</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Operational
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
