import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, DollarSign, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

export default function PaymentsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (subs && subs.length > 0) {
        const userIds = subs.map((s) => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);

        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

        setSubscriptions(
          subs.map((s) => ({ ...s, display_name: profileMap.get(s.user_id) ?? "Unknown" }))
        );
      }
      setLoading(false);
    };
    fetchPayments();
  }, []);

  const activeCount = subscriptions.filter((s) => s.status === "active" && s.tier !== "free").length;
  const totalRevenue = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Payments & Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor revenue and subscription activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border border-border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-11 w-11 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">${totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Monthly Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
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
            <div className="h-11 w-11 rounded-lg bg-accent/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{subscriptions.length}</p>
              <p className="text-xs text-muted-foreground">Total Records</p>
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
                      {s.price != null ? `$${Number(s.price).toFixed(2)}` : "—"} {s.currency?.toUpperCase() ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.ends_at ? new Date(s.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
