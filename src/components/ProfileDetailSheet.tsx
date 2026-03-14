import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, BadgeCheck, MessageCircle, Lock, Circle, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { fetchUserPresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileDetailProps {
  open: boolean;
  onClose: () => void;
  profile: {
    id: string;
    displayName: string;
    age: number;
    bio: string;
    interests: string[];
    photos: string[];
    distance: number | null;
    city: string;
    state: string;
    verified: boolean;
    gender: string;
    likesCount?: number;
  } | null;
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "";
  const diff = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ProfileDetailSheet({ open, onClose, profile }: ProfileDetailProps) {
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const isFree = tier === "free";
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  // Fetch presence when sheet opens
  useEffect(() => {
    if (!open || !profile) return;

    const load = async () => {
      const presence = await fetchUserPresence(profile.id);
      setIsOnline(presence.isOnline);
      setLastSeen(presence.lastSeen);
    };
    load();

    // Subscribe to realtime presence changes
    const channel = supabase
      .channel(`presence-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: any) => {
          const data = payload.new;
          if (data) {
            setIsOnline(data.is_online);
            setLastSeen(data.last_seen_at);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, profile?.id]);

  if (!profile) return null;

  const handleChat = () => {
    if (isFree) {
      toast("Chat is a premium feature", {
        description: "Upgrade to start chatting with your matches.",
        action: { label: "Upgrade", onClick: () => navigate("/pricing") },
      });
      return;
    }
    onClose();
    navigate("/chat");
  };

  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl overflow-y-auto p-0">
        {/* Hero photo */}
        <div className="relative aspect-[4/3] w-full">
          <img
            src={profile.photos[0]}
            alt={profile.displayName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

          {/* Status badge */}
          <div className="absolute top-4 right-4">
            <Badge
              variant="secondary"
              className={`gap-1.5 backdrop-blur-md ${
                isOnline
                  ? "bg-success/20 text-success border-success/30"
                  : "bg-muted/60 text-muted-foreground border-muted"
              }`}
            >
              <Circle className="h-2 w-2 fill-current" />
              {isOnline ? "Online" : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : "Offline"}
            </Badge>
          </div>
        </div>

        <div className="px-5 pb-8 -mt-8 relative">
          {/* Name, age, verified */}
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="flex items-center gap-2 font-display text-2xl">
              {profile.displayName}, {profile.age}
              {profile.verified && <BadgeCheck className="h-5 w-5 text-info" />}
              {(profile.likesCount ?? 0) > 0 && (
                <Badge className="gap-1 text-xs bg-primary/80 text-primary-foreground border-0 ml-1">
                  <Heart className="h-3 w-3 fill-current" />
                  {profile.likesCount}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Location */}
          {(location || profile.distance != null) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <MapPin className="h-4 w-4" />
              <span>
                {profile.distance != null ? `${profile.distance} km away` : ""}
                {profile.distance != null && location ? " · " : ""}
                {location}
              </span>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-foreground/80 mb-5 leading-relaxed">{profile.bio}</p>
          )}

          {/* Interests / Hobbies */}
          {profile.interests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Photo gallery */}
          {profile.photos.length > 1 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Photos
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {profile.photos.slice(1).map((photo, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl">
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat button */}
          <Button
            onClick={handleChat}
            className={`w-full gap-2 ${
              isFree
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : "gradient-warm border-0 text-primary-foreground shadow-glow"
            }`}
            size="lg"
          >
            {isFree ? (
              <>
                <Lock className="h-4 w-4" /> Upgrade to Chat
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" /> Send Message
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
