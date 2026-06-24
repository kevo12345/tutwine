import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function LiveRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !user) return;
    (async () => {
      const { data: rows, error } = await (supabase as any).rpc("get_live_session_room", {
        _session_id: sessionId,
      });
      const session = Array.isArray(rows) ? rows[0] : rows;

      if (error || !session || session.status !== "active" || !session.daily_room_url) {
        toast.error("This live stream is no longer available");
        navigate("/live", { replace: true });
        return;
      }

      let myExpiresAt = session.expires_at;
      if (session.host_id !== user.id) {
        const { data: pass } = await supabase
          .from("live_passes")
          .select("expires_at, status")
          .eq("session_id", sessionId)
          .eq("viewer_id", user.id)
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!pass) {
          toast.error("You need an active pass to join this live");
          navigate("/live", { replace: true });
          return;
        }
        myExpiresAt = new Date(Math.min(new Date(pass.expires_at).getTime(), new Date(session.expires_at).getTime())).toISOString();
      }

      setRoomUrl(session.daily_room_url);
      setExpiresAt(myExpiresAt);
      setLoading(false);
    })();

  }, [sessionId, user, navigate]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        toast.info("Your live time has ended");
        navigate("/live", { replace: true });
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiresAt, navigate]);

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-black/90 px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          LIVE
        </span>
        <span className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" /> {remaining}
        </span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => navigate("/live")}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      {roomUrl && (
        <iframe
          className="flex-1 w-full"
          src={roomUrl}
          allow="camera; microphone; autoplay; display-capture; fullscreen"
          style={{ border: 0 }}
        />
      )}
    </div>
  );
}
