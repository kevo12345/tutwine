import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Radio, Ticket, Gift, Clock } from "lucide-react";
import { toast } from "sonner";

type Row = {
  live_id: string;
  source: string;
  host_id: string;
  display_name: string | null;
  emrand_id: string | null;
  title: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  hours_running: number | null;
  viewers_now: number | null;
  tickets_sold: number | null;
  ticket_tokens: number | null;
  gifts_count: number | null;
  gift_tokens: number | null;
  likes: number | null;
  host_earning: number | null;
  platform_earning: number | null;
};

const num = (v: number | null | undefined) => Number(v ?? 0);

function formatHours(h: number) {
  const total = Math.max(0, Math.round(h * 60));
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export default function LiveMonitorPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"live" | "all">("live");
  const [search, setSearch] = useState("");

  const load = async (includeEnded: boolean) => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_live_overview", {
      _include_ended: includeEnded,
    });
    if (error) {
      toast.error(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load(scope === "all");
    const id = setInterval(() => void load(scope === "all"), 20000);
    return () => clearInterval(id);
  }, [scope]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.display_name ?? "").toLowerCase().includes(q) ||
        (r.emrand_id ?? "").includes(q) ||
        (r.title ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const liveNow = rows.filter((r) => r.status === "active" || r.status === "live").length;
    return {
      liveNow,
      tickets: rows.reduce((s, r) => s + num(r.tickets_sold), 0),
      gifts: rows.reduce((s, r) => s + num(r.gifts_count), 0),
      hours: rows.reduce((s, r) => s + num(r.hours_running), 0),
      hostEarnings: rows.reduce((s, r) => s + num(r.host_earning), 0),
      platformEarnings: rows.reduce((s, r) => s + num(r.platform_earning), 0),
    };
  }, [rows]);

  const cards = [
    { label: "Hosts live now", value: totals.liveNow, icon: Radio },
    { label: "Tickets sold", value: totals.tickets, icon: Ticket },
    { label: "Gifts received", value: totals.gifts, icon: Gift },
    { label: "Hours streamed", value: formatHours(totals.hours), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Live monitor</h1>
          <p className="text-sm text-muted-foreground">
            Who is streaming right now, tickets sold, gifts, and time on air.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(scope === "all")}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-semibold tabular-nums">{c.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as "live" | "all")}>
          <TabsList>
            <TabsTrigger value="live">Live now</TabsTrigger>
            <TabsTrigger value="all">All sessions</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search host, EMRAND ID or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <Card className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {scope === "live" ? "Nobody is live right now." : "No live sessions yet."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Time on air</TableHead>
                <TableHead className="text-right">Viewers</TableHead>
                <TableHead className="text-right">Tickets</TableHead>
                <TableHead className="text-right">Ticket coins</TableHead>
                <TableHead className="text-right">Gifts</TableHead>
                <TableHead className="text-right">Gift coins</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Host 60%</TableHead>
                <TableHead className="text-right">Tutwine 40%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const isLive = r.status === "active" || r.status === "live";
                return (
                  <TableRow key={`${r.source}-${r.live_id}`}>
                    <TableCell>
                      <p className="font-medium">{r.display_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.emrand_id ? `EMRAND ${r.emrand_id}` : r.host_id.slice(0, 8)}
                        {r.title ? ` · ${r.title}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isLive
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {isLive ? "Live" : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatHours(num(r.hours_running))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.viewers_now)}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.tickets_sold)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.ticket_tokens).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.gifts_count)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.gift_tokens).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(r.likes)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.host_earning).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.platform_earning).toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
