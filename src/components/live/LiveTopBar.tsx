import { useEffect, useState } from "react";
import { X, Users, UserPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  hostId: string;
  hostName: string | null;
  hostPhoto: string | null;
  isHost: boolean;
  viewerCount: number;
  remaining: string;
  onClose: () => void;
  currentUserId?: string;
  /** Host only: ends the live for everyone. */
  onEndLive?: () => void | Promise<void>;
};

export function LiveTopBar({
  hostId,
  hostName,
  hostPhoto,
  isHost,
  viewerCount,
  remaining,
  onClose,
  currentUserId,
  onEndLive,
}: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const [following, setFollowing] = useState<boolean | null>(null);

  useEffect(() => {
    if (isHost || !currentUserId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("swipes")
        .select("id")
        .eq("swiper_id", currentUserId)
        .eq("target_id", hostId)
        .eq("action", "like")
        .maybeSingle();
      if (!cancelled) setFollowing(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [hostId, currentUserId, isHost]);

  const toggleFollow = async () => {
    if (!currentUserId) return;
    if (following) return; // one-way like (no unlike here)
    const { error } = await supabase
      .from("swipes")
      .insert({ swiper_id: currentUserId, target_id: hostId, action: "like" });
    if (error) {
      toast.error("Couldn't follow");
      return;
    }
    setFollowing(true);
    toast.success(`Following ${hostName ?? "host"}`);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
      {/* Host card */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 text-white backdrop-blur-sm">
        {hostPhoto ? (
          <img src={hostPhoto} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-red-500" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold ring-2 ring-red-500">
            {(hostName ?? "L").slice(0, 1)}
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span className="max-w-[120px] truncate text-xs font-semibold">{hostName ?? "Host"}</span>
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-red-400">
            <span className="h-1 w-1 animate-pulse rounded-full bg-red-500" /> Live · {remaining}
          </span>
        </div>
        {!isHost && (
          <Button
            size="sm"
            variant={following ? "secondary" : "default"}
            onClick={toggleFollow}
            disabled={following === null || following}
            className="ml-1 h-7 rounded-full px-3 text-xs"
          >
            {following ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            <span className="ml-1">{following ? "Following" : "Follow"}</span>
          </Button>
        )}
      </div>

      {/* Right cluster */}
      <div className="pointer-events-auto flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <Users className="h-3.5 w-3.5" />
          <span className="tabular-nums">{viewerCount}</span>
        </div>
        {!isHost && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
            aria-label="Close live"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>


      <AlertDialog open={confirmEnd} onOpenChange={(o) => !ending && setConfirmEnd(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this live?</AlertDialogTitle>
            <AlertDialogDescription>
              Your stream will end now and disappear from the Live page, even though your scheduled
              time isn't finished. The timer only shows how long you've been live — it doesn't keep
              the stream open once you end it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>Keep streaming</AlertDialogCancel>
            <AlertDialogAction
              disabled={ending}
              onClick={async (e) => {
                e.preventDefault();
                setEnding(true);
                try {
                  await onEndLive?.();
                } finally {
                  setEnding(false);
                  setConfirmEnd(false);
                }
              }}
            >
              {ending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              End live
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>

  );
}
