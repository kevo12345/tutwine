import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreditCard, DollarSign, TrendingUp, Eye, EyeOff, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", KES: "KSh", KSH: "KSh" };

function symbolFor(code: string) {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code.toUpperCase()} `;
}

function exactAmount(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compactAmount(value: number) {
  const abs = Math.abs(value);
  if (abs < 1000) return exactAmount(value);
  if (abs < 1_000_000) return `${(value / 1000).toFixed(abs < 10_000 ? 1 : 0)}k`;
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

// Token purchases are priced at 1 token = $1. Litecoin buyers settle in USD,
// M-Pesa buyers settle in KES — so they are reported as separate currencies.
function currencyForMethod(method: string | null) {
  return (method ?? "").toLowerCase() === "mpesa" ? "KES" : "USD";
}

interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  price: number | null;
  currency: string | null;
  started_at: string;
  ends_at: string | null;
  provider: string | null;
  display_name?: string;
}

interface TokenTx {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  payment_method: string | null;
  payment_ref: string | null;
  status: string;
  created_at: string;
  display_name?: string;
}

export default function PaymentsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tokenTxs, setTokenTxs] = useState<TokenTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExact, setShowExact] = useState(false);

  useEffect(() => {
    const fetchPayments = async () => {
      const [{ data: subs }, { data: txs }] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(100),
        supabase
          .from("token_transactions")
          .select("*")
          .eq("type", "purchase")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const userIds = Array.from(
        new Set([...(subs ?? []).map((s) => s.user_id), ...(txs ?? []).map((t) => t.user_id)])
      );

      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.rpc("get_profiles_public", { _targets: userIds });
        profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      }

      setSubscriptions((subs ?? []).map((s) => ({ ...s, display_name: profileMap.get(s.user_id) ?? "Unknown" })));
      setTokenTxs((txs ?? []).map((t) => ({ ...t, display_name: profileMap.get(t.user_id) ?? "Unknown" })));
      setLoading(false);
    };
    fetchPayments();
  }, []);

  const fmt = (v: number) => (showExact ? exactAmount(v) : compactAmount(v));

  const activeCount = subscriptions.filter((s) => s.status === "active" && s.tier !== "free").length;

  // Subscription revenue is grouped per currency — USD and KES are never summed together.
  const subRevenue = subscriptions
    .filter((s) => s.status === "active")
    .reduce<Record<string, { total: number; count: number }>>((acc, s) => {
      const code = (s.currency ?? "USD").toUpperCase();
      const key = code === "KSH" ? "KES" : code;
      acc[key] = acc[key] ?? { total: 0, count: 0 };
      acc[key].total += Number(s.price ?? 0);
      acc[key].count += 1;
      return acc;
    }, {});
  const subCurrencies = Object.keys(subRevenue).sort();

  const completedTxs = tokenTxs.filter((t) => t.status === "completed");
  const tokenRevenue = completedTxs.reduce<Record<string, { total: number; count: number }>>((acc, t) => {
    const key = currencyForMethod(t.payment_method);
    acc[key] = acc[key] ?? { total: 0, count: 0 };
    acc[key].total += Number(t.amount ?? 0);
    acc[key].count += 1;
    return acc;
  }, {});
  const tokenCurrencies = Object.keys(tokenRevenue).sort();
  const tokensSold = completedTxs.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const revenueCard = (code: string, total: number, count: number, label: string) => (
    <Card key={`${label}-${code}`} className="border border-border shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="h-11 w-11 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <DollarSign className="h-5 w-5 text-success" />
        </div>
        <div className="min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-2xl font-semibold truncate cursor-help">
                {symbolFor(code)}{fmt(total)}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              {symbolFor(code)}{exactAmount(total)}
            </TooltipContent>
          </Tooltip>
          <p className="text-xs text-muted-foreground">
            {label} in {code} · {count} {count === 1 ? "payment" : "payments"}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const emptyCard = (text: string) => (
    <Card className="border border-border shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );

  const dateFmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <TooltipProvider delayDuration={150}>
      <div>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Subscriptions and coin purchases, reported separately per currency.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowExact((v) => !v)} className="shrink-0 gap-2">
            {showExact ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showExact ? "Rounded" : "Exact amounts"}
          </Button>
        </div>

        <Tabs defaultValue="subscriptions">
          <TabsList className="mb-6">
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="tokens">Coin purchases</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {subCurrencies.length === 0
                ? emptyCard("No subscription revenue yet")
                : subCurrencies.map((code) =>
                    revenueCard(code, subRevenue[code].total, subRevenue[code].count, "Subscriptions")
                  )}
              <Card className="border border-border shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">Active Subscriptions</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="h-11 w-11 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{subscriptions.length}</p>
                    <p className="text-xs text-muted-foreground">Subscription Records</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Plan</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Amount</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Started</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Loading...</TableCell>
                      </TableRow>
                    ) : subscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No subscriptions yet</TableCell>
                      </TableRow>
                    ) : (
                      subscriptions.map((s) => (
                        <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="text-sm font-medium">{s.display_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] capitalize font-normal">{s.tier}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-normal ${
                                s.status === "active" ? "bg-success/10 text-success border-success/20" :
                                s.status === "canceled" ? "bg-warning/10 text-warning border-warning/20" :
                                "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.price != null ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">
                                    {symbolFor(s.currency ?? "USD")}{fmt(Number(s.price))}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {symbolFor(s.currency ?? "USD")}{exactAmount(Number(s.price))}
                                </TooltipContent>
                              </Tooltip>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{dateFmt(s.started_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.ends_at ? dateFmt(s.ends_at) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tokens" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {tokenCurrencies.length === 0
                ? emptyCard("No coin purchases yet")
                : tokenCurrencies.map((code) =>
                    revenueCard(code, tokenRevenue[code].total, tokenRevenue[code].count, "Coin sales")
                  )}
              <Card className="border border-border shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-2xl font-semibold truncate cursor-help">{fmt(tokensSold)}</p>
                      </TooltipTrigger>
                      <TooltipContent>{exactAmount(tokensSold)} coins</TooltipContent>
                    </Tooltip>
                    <p className="text-xs text-muted-foreground">Coins sold</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-border shadow-sm">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="h-11 w-11 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{tokenTxs.length}</p>
                    <p className="text-xs text-muted-foreground">Purchase Records</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              1 coin = $1. M-Pesa purchases are settled in KES, Litecoin purchases in USD — the two are never summed together.
            </p>

            <Card className="border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Coins</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Method</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Currency</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Loading...</TableCell>
                      </TableRow>
                    ) : tokenTxs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No coin purchases yet</TableCell>
                      </TableRow>
                    ) : (
                      tokenTxs.map((t) => (
                        <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="text-sm font-medium">{t.display_name}</TableCell>
                          <TableCell className="text-sm">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{fmt(Number(t.amount))}</span>
                              </TooltipTrigger>
                              <TooltipContent>{exactAmount(Number(t.amount))} coins</TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[11px] capitalize font-normal">
                              {t.payment_method ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {currencyForMethod(t.payment_method)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-normal ${
                                t.status === "completed" ? "bg-success/10 text-success border-success/20" :
                                t.status === "pending" ? "bg-warning/10 text-warning border-warning/20" :
                                "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{dateFmt(t.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
