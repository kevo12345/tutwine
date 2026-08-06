import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Users, Flag, TrendingUp, Crown, Coins, Radio, Heart, Gift,
  Ticket, Banknote, Wallet, ArrowUpRight, ArrowDownRight, CircleDot, Eye, EyeOff, Activity,
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
  const [showExact, setShowExact] = useState(false);

  const num = (v?: number | null) =>
    v === undefined || v === null ? "—" : showExact ? exactNum(Number(v)) : compact(Number(v));
  const money = (v?: number | null) =>
    v === undefined || v === null ? "—" : showExact ? exactMoney(Number(v)) : `$${compact(Number(v))}`;
  const titleNum = (v?: number | null) => (v === undefined || v === null ? undefined : exactNum(Number(v)));
  const titleMoney = (v?: number | null) => (v === undefined || v === null ? undefined : exactMoney(Number(v)));

  const series = (stats?.series ?? []).map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const growthUp = Number(stats?.signupGrowthPct ?? 0) >= 0;
  const sessionActivity = (stats?.sessionActivity ?? []).map((s) => ({
    ...s,
    when: new Date(s.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const heroCards = [
    {
      label: "Total Users", value: num(stats?.totalUsers), exact: titleNum(stats?.totalUsers), icon: Users,
      sub: `${num(stats?.recentSignups)} new this week`, tone: "primary" as const, href: "/admin/users",
    },
    {
      label: "Coins Sold", value: num(stats?.tokensSold), exact: titleNum(stats?.tokensSold), icon: Coins,
      sub: `${money(stats?.tokensSold)} gross volume`, tone: "success" as const, href: "/admin/payments",
    },
    {
      label: "Platform Earnings", value: money(stats?.platformEarnings), exact: titleMoney(stats?.platformEarnings), icon: Wallet,
      sub: `${money(stats?.hostEarnings)} paid to hosts`, tone: "info" as const, href: "/admin/live-monitor",
    },
    {
      label: "Live Right Now", value: num(stats?.liveNow), exact: titleNum(stats?.liveNow), icon: Radio,
      sub: `${num(stats?.onlineNow)} users online`, tone: "accent" as const, href: "/admin/live-monitor",
    },
  ];

  const secondary = [
    { label: "Active Subscribers", value: num(stats?.subscribers), exact: titleNum(stats?.subscribers), icon: Crown },
    { label: "Tickets Sold", value: num(stats?.ticketsSold), exact: titleNum(stats?.ticketsSold), icon: Ticket },
    { label: "Gifts Sent", value: num(stats?.giftsSent), exact: titleNum(stats?.giftsSent), icon: Gift },
    { label: "Matches", value: num(stats?.totalMatches), exact: titleNum(stats?.totalMatches), icon: Heart },
    { label: "Pending Reports", value: num(stats?.pendingReports), exact: titleNum(stats?.pendingReports), icon: Flag },
    { label: "Pending Payouts", value: num(stats?.pendingWithdrawalCount), exact: titleNum(stats?.pendingWithdrawalCount), icon: Banknote },
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
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowExact((v) => !v)} className="shrink-0 gap-2">
            {showExact ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showExact ? "Rounded" : "Exact amounts"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

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
                <p className="text-3xl font-semibold tracking-tight text-foreground" title={c.exact}>{c.value}</p>
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
                <p className="text-lg font-semibold leading-none tracking-tight" title={s.exact}>{s.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Signups & audience */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border border-border/70 shadow-sm xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Daily signups & growth</h3>
                <p className="text-[11px] text-muted-foreground">New accounts per day with cumulative user growth, last 30 days</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-2xl font-semibold leading-none tracking-tight" title={titleNum(stats?.signupsToday)}>
                    {num(stats?.signupsToday)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Signups today</p>
                </div>
                <Badge
                  variant="outline"
                  className={`gap-1 text-[10px] ${growthUp ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
                >
                  {growthUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(Number(stats?.signupGrowthPct ?? 0))}% vs prev 7d
                </Badge>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={series} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(0, Math.floor(series.length / 8))} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} />
                  <Area yAxisId="right" type="monotone" dataKey="cumulativeUsers" name="Total users" stroke="hsl(var(--info))" strokeWidth={2} fill="url(#cumulativeFill)" />
                  <Bar yAxisId="left" dataKey="signups" name="New signups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Active audience</h3>
              <p className="text-[11px] text-muted-foreground">Users seen in the last 24h / 7d / 30d</p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Online right now", value: stats?.onlineNow, icon: CircleDot, tone: "text-success" },
                { label: "Active today (DAU)", value: stats?.dau, icon: Activity, tone: "text-primary" },
                { label: "Active this week (WAU)", value: stats?.wau, icon: Activity, tone: "text-info" },
                { label: "Active this month (MAU)", value: stats?.mau, icon: Activity, tone: "text-accent" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <r.icon className={`h-3.5 w-3.5 ${r.tone}`} /> {r.label}
                  </span>
                  <span className="text-base font-semibold tracking-tight" title={titleNum(r.value)}>{num(r.value)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] text-muted-foreground">Avg viewers per live session</p>
              <p className="text-lg font-semibold tracking-tight">{stats?.avgViewersPerSession ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active users per live session */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border border-border/70 shadow-sm xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Active users per live session</h3>
              <p className="text-[11px] text-muted-foreground">
                Viewers who bought into each of the last {sessionActivity.length || 0} sessions, and how many are still active
              </p>
            </div>
            {sessionActivity.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
                No live sessions in the last 30 days
              </div>
            ) : (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionActivity} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="when" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="viewers" name="Total viewers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="activeViewers" name="Still active" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Live now</h3>
                <p className="text-[11px] text-muted-foreground">Active sessions and their viewers</p>
              </div>
              <Link to="/admin/live-monitor" className="text-[11px] font-medium text-primary hover:underline">
                Monitor
              </Link>
            </div>
            {(stats?.activeSessions ?? []).length === 0 ? (
              <div className="flex h-[200px] items-center justify-center text-xs text-muted-foreground">
                Nobody is live right now
              </div>
            ) : (
              <div className="space-y-2">
                {(stats?.activeSessions ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-medium">Session {s.id.slice(0, 6)}</p>
                      <p className="text-[11px] text-muted-foreground">{s.minutes} min running</p>
                    </div>
                    <Badge variant="secondary" className="gap-1 text-[11px] font-semibold">
                      <Users className="h-3 w-3" /> {s.activeViewers}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth + revenue */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border border-border/70 shadow-sm xl:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Coin revenue</h3>
                <p className="text-[11px] text-muted-foreground">Completed coin purchases per day, last 30 days</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(0, Math.floor(series.length / 8))} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#signupFill)" />
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
                  <Badge variant="secondary" className="text-[11px] font-semibold" title={exactNum(a.count)}>{num(a.count)}</Badge>
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
