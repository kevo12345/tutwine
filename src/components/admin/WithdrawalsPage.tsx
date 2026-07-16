import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Check,
  X,
  Copy,
  ExternalLink,
  Download,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
  return (
    <Badge variant="outline" className={map[s]}>
      {s}
    </Badge>
  );
}

export default function WithdrawalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<Row | null>(null);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [rowAction, setRowAction] = useState<"approve" | "reject" | null>(null);
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

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    paid: rows.filter((r) => r.status === "paid").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function runSingle() {
    if (!target || !rowAction) return;
    setSubmitting(true);
    const rpc = rowAction === "approve" ? "approve_withdrawal" : "reject_withdrawal";
    const { error } = await supabase.rpc(rpc as any, {
      _withdrawal_id: target.id,
      _note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Withdrawal ${rowAction === "approve" ? "approved" : "rejected"}`);
    setTarget(null);
    setRowAction(null);
    setNote("");
    await load();
  }

  async function runBulk() {
    if (!bulkAction || selected.size === 0) return;
    setSubmitting(true);
    const rpc = bulkAction === "approve" ? "approve_withdrawal" : "reject_withdrawal";
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map((id) =>
        supabase.rpc(rpc as any, { _withdrawal_id: id, _note: note.trim() || null })
      )
    );
    setSubmitting(false);
    const failed = results.filter((r) => r.error);
    if (failed.length) {
      toast.error(`${failed.length} of ${ids.length} failed`);
    } else {
      toast.success(
        `${ids.length} withdrawal${ids.length === 1 ? "" : "s"} ${
          bulkAction === "approve" ? "approved" : "rejected"
        }`
      );
    }
    setBulkAction(null);
    setNote("");
    setSelected(new Set());
    await load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  function exportRows(fmt: "csv" | "xlsx") {
    const src = selected.size ? filtered.filter((r) => selected.has(r.id)) : filtered;
    if (!src.length) return toast.error("Nothing to export");
    const data = src.map((r) => ({
      "EMRAND ID": r.profile?.emrand_id ?? "",
      "Display Name": r.profile?.display_name ?? "",
      "User ID": r.user_id,
      Amount: Number(r.amount),
      "Wallet Address": r.wallet_address,
      Status: r.status,
      "Requested At": new Date(r.requested_at).toISOString(),
      "Cooldown Until": new Date(r.cooldown_until).toISOString(),
      "Processed At": r.processed_at ? new Date(r.processed_at).toISOString() : "",
      "Admin Note": r.admin_note ?? "",
    }));
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const base = `withdrawals_${tab}_${ts}`;
    if (fmt === "csv") {
      const sheet = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, `${base}.csv`);
    } else {
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, sheet, "Withdrawals");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, `${base}.xlsx`);
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Withdrawals</h1>
        <p className="text-sm text-muted-foreground">
          Review host withdrawal requests. Approving marks paid and clears the pending balance.
          Rejecting refunds the amount to available earnings; the 72h cooldown still applies from
          the original request.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({counts.paid})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {tab === "pending" && someSelected && (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setBulkAction("approve")}>
                <Check className="h-3.5 w-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => setBulkAction("reject")}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="h-3.5 w-3.5 mr-1" /> Export
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportRows("csv")}>
                {selected.size ? `Selected (${selected.size})` : "All visible"} · CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportRows("xlsx")}>
                {selected.size ? `Selected (${selected.size})` : "All visible"} · XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
                {tab === "pending" && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>Host</TableHead>
                <TableHead>EMRAND ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Cooldown until</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  {tab === "pending" && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="text-sm font-medium">
                      {r.profile?.display_name ?? "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {r.user_id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.profile?.emrand_id ? (
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-semibold">{r.profile.emrand_id}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copy(r.profile!.emrand_id!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
                            setRowAction("approve");
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
                            setRowAction("reject");
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

      {/* Single-row action dialog */}
      <Dialog
        open={!!target && !!rowAction}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            setRowAction(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rowAction === "approve" ? "Approve withdrawal" : "Reject withdrawal"}
            </DialogTitle>
            <DialogDescription>
              {rowAction === "approve" ? (
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
          <Input
            placeholder="Optional note (e.g. tx hash, reason)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setTarget(null);
                setRowAction(null);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={runSingle}
              disabled={submitting}
              variant={rowAction === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {rowAction === "approve" ? "Mark as paid" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk action dialog */}
      <Dialog
        open={!!bulkAction}
        onOpenChange={(o) => {
          if (!o) {
            setBulkAction(null);
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "approve"
                ? `Approve ${selected.size} withdrawals?`
                : `Reject ${selected.size} withdrawals?`}
            </DialogTitle>
            <DialogDescription>
              {bulkAction === "approve"
                ? "Each selected withdrawal will be marked paid and cleared from pending balances."
                : "Each rejected amount is returned to the host's available earnings. Their original 72h cooldown still applies."}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Optional note applied to all"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setBulkAction(null);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={runBulk}
              disabled={submitting}
              variant={bulkAction === "reject" ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
