import { useState, useCallback } from "react";
import { Video, VideoOff, X, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface VideoCallProps {
  matchId: string;
}

export default function VideoCall({ matchId }: VideoCallProps) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [inCall, setInCall] = useState(false);
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const isPro = tier === "pro";

  const startCall = useCallback(async () => {
    if (!isPro) {
      toast.error("Video chat is a Pro feature", {
        action: { label: "Upgrade", onClick: () => navigate("/pricing") },
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-daily-room", {
        body: { matchId },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Pro subscription")) {
          toast.error("Video chat requires a Pro subscription", {
            action: { label: "Upgrade", onClick: () => navigate("/pricing") },
          });
          return;
        }
        throw new Error(data.error);
      }

      setRoomUrl(data.roomUrl);
      setToken(data.token);
      setInCall(true);
    } catch (err: any) {
      console.error("Video call error:", err);
      toast.error("Could not start video call. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [matchId, isPro, navigate]);

  const endCall = useCallback(() => {
    setInCall(false);
    setRoomUrl(null);
    setToken(null);
  }, []);

  if (inCall && roomUrl && token) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-foreground/95">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-primary-foreground">Video Call</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-destructive/80"
            onClick={endCall}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <iframe
          className="flex-1 w-full"
          src={`${roomUrl}?t=${token}`}
          allow="camera; microphone; autoplay; display-capture"
          style={{ border: 0 }}
        />
      </div>
    );
  }

  if (!isPro) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 relative"
        onClick={() =>
          toast("Video chat is a Pro feature", {
            action: { label: "Upgrade", onClick: () => navigate("/pricing") },
          })
        }
      >
        <Video className="h-4 w-4 text-muted-foreground" />
        <Crown className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-accent" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={startCall}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Video className="h-4 w-4 text-primary" />
      )}
    </Button>
  );
}
