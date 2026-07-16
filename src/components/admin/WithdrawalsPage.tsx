import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Status = "pending" | "paid" | "rejected";

type Row = {
  id: string;
  user_id: string;
  amount: number;
  wallet_address: string;
  status: Status;
  requested_at: string;
  cooldown_until: string;
  processed_at: string | null;
  admin_note: string | null;
  profile?: { display_name: string | null; emrand_id: string | null } | null;
};

function statusBadge(s: Status) {
  const map: Record<Status, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    paid: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={map[s]}>{s}</Badge>;
}

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");
  const [target, setTarget] = useState<Row | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawals" as any)
      .select("*")
      .order("requested_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as any as Row[];
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, emrand_id")
        .in("user_id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      list.forEach((r) => (r.profile = byId.get(r.user_id) ?? null));
    }
    setRows(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    paid: rows.filter((r) => r.status === "paid").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  async function submit() {
    if (!target || !action) return;
    setSubmitting(true);
    const rpc = action === "approve" ? "approve_withdrawal" : "reject_withdrawal";
    const { error } = await supabase.rpc(rpc as any, {
      _withdrawal_id: target.id,
      _note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${action === "approve" ? "approved" : "rejected"}`);
    setTarget(null);
    setAction(null);
    setNote("");
    await load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Review host withdrawal requests. Approving marks it paid and clears the pending balance.
          Rejecting refunds the amount to available earnings; the 72h cooldown still applies from
          the original request.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No {tab} withdrawals.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Cooldown until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {r.profile?.display_name ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.profile?.emrand_id ?? r.user_id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {Number(r.amount).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 max-w-[240px]">
                      <code className="text-[11px] truncate">{r.wallet_address}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copy(r.wallet_address)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <a
                        href={`https://blockchair.com/litecoin/address/${r.wallet_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.requested_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.cooldown_until).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTarget(r);
                            setAction("approve");
                          }}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            setTarget(r);
                            setAction("reject");
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        {statusBadge(r.status)}
                        {r.admin_note && (
                          <span className="text-[11px] text-muted-foreground max-w-[240px] truncate">
                            {r.admin_note}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog
        open={!!target && !!action}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            setAction(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve withdrawal" : "Reject withdrawal"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve" ? (
                <>
                  Confirm that <strong>{Number(target?.amount ?? 0).toFixed(2)}</strong> has been
                  paid to <code className="text-xs">{target?.wallet_address}</code>. This clears
                  the pending withdrawal.
                </>
              ) : (
                <>
                  Rejecting will return{" "}
                  <strong>{Number(target?.amount ?? 0).toFixed(2)}</strong> to the host's
                  available earnings. The 72-hour cooldown still applies from the original request.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="Optional note (e.g. tx hash, reason)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTarget(null);
                setAction(null);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              variant={action === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {action === "approve" ? "Mark as paid" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
