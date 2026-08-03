import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Gift, Ticket } from "lucide-react";
import { toast } from "sonner";

export type DetailTarget = {
  liveId: string;
  source: string;
  hostName: string | null;
  emrandId: string | null;
  title: string | null;
};

type DetailRow = {
  kind: "ticket" | "gift";
  event_id: string;
  user_id: string;
  display_name: string | null;
  emrand_id: string | null;
  label: string | null;
  coins: number | null;
  host_share: number | null;
  platform_share: number | null;
  created_at: string;
  expires_at: string | null;
};

const num = (v: number | null | undefined) => Number(v ?? 0);

export function LiveSessionDetailSheet({
  target,
  onClose,
}: {
  target: DetailTarget | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "ticket" | "gift">("all");

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setTab("all");
    setLoading(true);
    void (async () => {
      const { data, error } = await (supabase as any).rpc("admin_live_session_detail", {
        _live_id: target.liveId,
        _source: target.source,
      });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as DetailRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [target?.liveId, target?.source]);

  const totals = useMemo(() => {
    const tickets = rows.filter((r) => r.kind === "ticket");
    const gifts = rows.filter((r) => r.kind === "gift");
    return {
      tickets: tickets.length,
      ticketCoins: tickets.reduce((s, r) => s + num(r.coins), 0),
      gifts: gifts.length,
      giftCoins: gifts.reduce((s, r) => s + num(r.coins), 0),
      hostShare: rows.reduce((s, r) => s + num(r.host_share), 0),
      platformShare: rows.reduce((s, r) => s + num(r.platform_share), 0),
    };
  }, [rows]);

  const visible = tab === "all" ? rows : rows.filter((r) => r.kind === tab);

  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{target?.hostName ?? "Host"} · session breakdown</SheetTitle>
          <SheetDescription>
            {target?.emrandId ? `EMRAND ${target.emrandId}` : "No EMRAND ID"}
            {target?.title ? ` · ${target.title}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Ticket className="h-3.5 w-3.5" /> Tickets sold
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {totals.tickets}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {totals.ticketCoins.toFixed(2)} coins
              </span>
            </p>
          </Card>
          <Card className="p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gift className="h-3.5 w-3.5" /> Gifts received
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {totals.gifts}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {totals.giftCoins.toFixed(2)} coins
              </span>
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Host 60%</p>
            <p className="text-lg font-semibold tabular-nums">{totals.hostShare.toFixed(2)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Tutwine 40%</p>
            <p className="text-lg font-semibold tabular-nums">{totals.platformShare.toFixed(2)}</p>
          </Card>
        </div>

        <div className="mt-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="ticket">Tickets</TabsTrigger>
              <TabsTrigger value="gift">Gifts</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Card className="mt-3 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No {tab === "all" ? "activity" : tab === "ticket" ? "ticket sales" : "gifts"} for this
              session yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Coins</TableHead>
                  <TableHead className="text-right">Host</TableHead>
                  <TableHead className="text-right">Tutwine</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={`${r.kind}-${r.event_id}`}>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.kind}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{r.display_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.emrand_id ? `EMRAND ${r.emrand_id}` : r.user_id.slice(0, 8)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{r.label ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.coins).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.host_share).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.platform_share).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </SheetContent>
    </Sheet>
  );
}
