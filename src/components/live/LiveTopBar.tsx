import { useEffect, useState } from "react";
import { X, Users, UserPlus, Check, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  hostId: string;
  hostName: string | null;
  hostPhoto: string | null;
  isHost: boolean;
  viewerCount: number;
  likeCount?: number;
  remaining: string;
  onClose: () => void;
  /** Share this live with anyone (host and viewers). */
  onShare?: () => void | Promise<void>;
  currentUserId?: string;
  /** Host only: ends the live for everyone (handled by the broadcaster controls). */
  onEndLive?: () => void | Promise<void>;
};

export function LiveTopBar({
  hostId,
  hostName,
  hostPhoto,
  isHost,
  viewerCount,
  likeCount = 0,
  remaining,
  onClose,
  onShare,
  currentUserId,
}: Props) {
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
    <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3">
      {/* Host card */}
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-2 text-white backdrop-blur-sm sm:flex-none sm:pr-3">
        {hostPhoto ? (
          <img src={hostPhoto} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-red-500" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold ring-2 ring-red-500">
            {(hostName ?? "L").slice(0, 1)}
          </div>
        )}
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="max-w-[90px] truncate sm:max-w-[140px] text-xs font-semibold">{hostName ?? "Host"}</span>
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
            className="ml-1 h-7 shrink-0 rounded-full px-2 text-xs sm:px-3"
          >
            {following ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">{following ? "Following" : "Follow"}</span>
          </Button>
        )}
      </div>

      {/* Right cluster */}
      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <Users className="h-3.5 w-3.5" />
          <span className="tabular-nums">{viewerCount}</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
          <span className="tabular-nums">{likeCount}</span>
        </div>
        {onShare && (
          <button
            onClick={() => void onShare()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
            aria-label="Share live"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
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


    </div>
  );
}

