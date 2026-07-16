import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Users, Heart, Radio } from "lucide-react";
import { toast } from "sonner";

type Live = {
  id: string;
  host_id: string;
  title: string;
  status: "live" | "paused" | "ended";
  viewer_count: number;
  like_count: number;
  banner_url: string | null;
};

export default function LiveViewPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [live, setLive] = useState<Live | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareLink || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: row, error: fErr } = await supabase
        .from("lives")
        .select("id, host_id, title, status, viewer_count, like_count, banner_url")
        .eq("share_link", shareLink)
        .maybeSingle();
      if (cancelled) return;
      if (fErr || !row) {
        setError("Live not found");
        setLoading(false);
        return;
      }
      setLive(row as Live);
      if (row.status === "ended") {
        setError("This live has ended.");
        setLoading(false);
        return;
      }

      const role = row.host_id === user.id ? "host" : "viewer";
      const { data, error: fnErr } = await supabase.functions.invoke(
        "live-daily-room",
        { body: { live_id: row.id, role } },
      );
      if (cancelled) return;
      if (fnErr || (data as any)?.error) {
        setError((data as any)?.error || fnErr?.message || "Could not join");
        setLoading(false);
        return;
      }
      setRoomUrl((data as any).roomUrl);
      setToken((data as any).token);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [shareLink, user]);

  // Realtime updates for viewer/like counts + auto-exit on end
  useEffect(() => {
    if (!live?.id) return;
    const channel = supabase
      .channel(`live-${live.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lives", filter: `id=eq.${live.id}` },
        (payload) => {
          const next = payload.new as Live;
          setLive((prev) => (prev ? { ...prev, ...next } : next));
          if (next.status === "ended") {
            toast.info("The host ended this live.");
            navigate("/lives", { replace: true });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [live?.id, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 text-white">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => navigate("/lives")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center min-w-0 flex-1 px-2">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-destructive text-destructive-foreground gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {live?.status === "paused" ? "PAUSED" : "LIVE"}
            </Badge>
            <span className="text-xs font-semibold line-clamp-1">{live?.title}</span>
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{live?.viewer_count ?? 0}</span>
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{live?.like_count ?? 0}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/80 px-6 text-center">
          <Radio className="h-10 w-10 opacity-50" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" onClick={() => navigate("/lives")}>Back to Lives</Button>
        </div>
      ) : roomUrl && token ? (
        <iframe
          className="flex-1 w-full"
          src={`${roomUrl}?t=${token}`}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
        />
      ) : null}
    </div>
  );
}
