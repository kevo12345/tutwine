import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bitcoin, CheckCircle2, Loader2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface IpnRow {
  id: string;
  received_at: string;
  signature_valid: boolean;
  signature_present: boolean;
  payment_id: string | null;
  order_id: string | null;
  payment_status: string | null;
  pay_currency: string | null;
  pay_amount: number | null;
  price_amount: number | null;
  price_currency: string | null;
  matched_subscription_id: string | null;
  activation_result: string;
  error: string | null;
  raw_payload: any;
}

const activationVariant: Record<string, { label: string; cls: string }> = {
  activated: { label: "Activated", cls: "bg-success/15 text-success border-success/30" },
  already_active: { label: "Already active", cls: "bg-muted text-muted-foreground border-border" },
  canceled: { label: "Canceled", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  noop: { label: "No-op", cls: "bg-muted text-muted-foreground border-border" },
  not_found: { label: "No match", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  rejected_signature: { label: "Bad signature", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  error: { label: "Error", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function NowPaymentsIpnPage() {
  const [rows, setRows] = useState<IpnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IpnRow | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("nowpayments_ipn_log")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) console.error("Fetch IPN log error:", error);
    setRows((data as IpnRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totals = {
    total: rows.length,
    sigOk: rows.filter((r) => r.signature_valid).length,
    sigBad: rows.filter((r) => r.signature_present && !r.signature_valid).length,
    activated: rows.filter((r) => r.activation_result === "activated").length,
    failed: rows.filter((r) =>
      ["rejected_signature", "not_found", "error", "canceled"].includes(r.activation_result),
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bitcoin className="h-6 w-6 text-amber-600" />
            NOWPayments IPN Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every callback NOWPayments sends to our webhook — signature check, payment status, and what we did with it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total IPNs" value={totals.total} />
        <StatCard label="Signature OK" value={totals.sigOk} accent="success" />
        <StatCard label="Bad signature" value={totals.sigBad} accent="destructive" />
        <StatCard label="Activated subs" value={totals.activated} accent="success" />
        <StatCard label="Failed / rejected" value={totals.failed} accent="destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No NOWPayments IPN deliveries yet.</p>
              <p className="text-xs mt-1">Run a test crypto payment to see entries here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Received</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activation</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="whitespace-nowrap">Payment ID</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const a = activationVariant[r.activation_result] ?? activationVariant.noop;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(r.received_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {!r.signature_present ? (
                            <Badge variant="outline" className="text-xs">missing</Badge>
                          ) : r.signature_valid ? (
                            <Badge className="bg-success/15 text-success border-success/30 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" /> valid
                            </Badge>
                          ) : (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs gap-1">
                              <XCircle className="h-3 w-3" /> invalid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.payment_status ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${a.cls}`}>
                            {a.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.pay_amount != null
                            ? `${r.pay_amount} ${r.pay_currency?.toUpperCase() ?? ""}`
                            : "—"}
                          {r.price_amount != null && (
                            <div className="text-[10px] text-muted-foreground">
                              ≈ {r.price_amount} {r.price_currency?.toUpperCase() ?? ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono truncate max-w-[140px]">
                          {r.payment_id ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>IPN delivery details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Row label="Received at" value={new Date(selected.received_at).toLocaleString()} />
              <Row
                label="Signature"
                value={
                  !selected.signature_present
                    ? "Missing"
                    : selected.signature_valid
                    ? "Valid (HMAC-SHA512 OK)"
                    : "INVALID — rejected"
                }
              />
              <Row label="Payment status" value={selected.payment_status ?? "—"} />
              <Row label="Activation result" value={selected.activation_result} />
              <Row label="Payment ID" value={selected.payment_id ?? "—"} mono />
              <Row label="Order / Subscription ID" value={selected.order_id ?? "—"} mono />
              <Row
                label="Matched subscription"
                value={selected.matched_subscription_id ?? "Not matched"}
                mono
              />
              {selected.error && (
                <Row label="Error" value={selected.error} accent="destructive" />
              )}
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Raw payload</div>
                <pre className="rounded-lg bg-muted/50 p-3 text-[11px] font-mono overflow-x-auto max-h-72">
                  {JSON.stringify(selected.raw_payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "destructive";
}) {
  const accentCls =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${accentCls}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: "destructive";
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-right break-all ${mono ? "font-mono text-xs" : ""} ${
          accent === "destructive" ? "text-destructive" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
