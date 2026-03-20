import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BadgeCheck, MapPin, Circle, Heart, X, MessageCircle, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { fetchUserPresence } from "@/hooks/usePresence";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

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

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { tier } = useSubscription();
  const isFree = tier === "free";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const [{ data: profileData }, { count }, presence] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("swipes").select("*", { count: "exact", head: true }).eq("target_id", userId).eq("action", "like"),
        fetchUserPresence(userId),
      ]);

      setProfile(profileData);
      setLikesCount(count ?? 0);
      setIsOnline(presence.isOnline);
      setLastSeen(presence.lastSeen);
      setLoading(false);
    };
    load();

    // Realtime presence
    const channel = supabase
      .channel(`presence-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "user_presence", filter: `user_id=eq.${userId}`,
      }, (payload: any) => {
        const data = payload.new;
        if (data) {
          setIsOnline(data.is_online);
          setLastSeen(data.last_seen_at);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
          <p className="text-muted-foreground">Profile not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </AppLayout>
    );
  }

  const photos = (profile.photos?.length ? profile.photos : []) as string[];
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const distance = (myProfile?.latitude && myProfile?.longitude && profile.latitude && profile.longitude)
    ? Math.round(
        6371 * 2 * Math.atan2(
          Math.sqrt(
            Math.sin(((profile.latitude - myProfile.latitude) * Math.PI / 180) / 2) ** 2 +
            Math.cos(myProfile.latitude * Math.PI / 180) * Math.cos(profile.latitude * Math.PI / 180) *
            Math.sin(((profile.longitude - myProfile.longitude) * Math.PI / 180) / 2) ** 2
          ),
          Math.sqrt(1 - (
            Math.sin(((profile.latitude - myProfile.latitude) * Math.PI / 180) / 2) ** 2 +
            Math.cos(myProfile.latitude * Math.PI / 180) * Math.cos(profile.latitude * Math.PI / 180) *
            Math.sin(((profile.longitude - myProfile.longitude) * Math.PI / 180) / 2) ** 2
          ))
        )
      )
    : null;

  const openPhoto = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleChat = async () => {
    if (isFree) {
      toast("Chat is a premium feature", {
        description: "Upgrade to start chatting with your matches.",
        action: { label: "Upgrade", onClick: () => navigate("/pricing") },
      });
      return;
    }
    if (!userId || !user) return;
    // Find existing match between the two users
    const userA = user.id < userId ? user.id : userId;
    const userB = user.id < userId ? userId : user.id;
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    if (match) {
      navigate(`/chat/${match.id}`);
    } else {
      // Create a new match so they can chat
      const { data: newMatch, error } = await supabase
        .from("matches")
        .insert({ user_a: userA, user_b: userB })
        .select("id")
        .single();
      if (error) {
        toast.error("Couldn't start conversation");
        console.error(error);
        return;
      }
      navigate(`/chat/${newMatch.id}`);
    }
  };

  return (
    <AppLayout>
      <div className="pb-24">
        {/* Hero photo */}
        <div className="relative aspect-[4/3] w-full">
          <button className="w-full h-full" onClick={() => photos.length > 0 && openPhoto(0)}>
            <img
              src={photos[0]}
              alt={profile.display_name ?? ""}
              className="h-full w-full object-cover"
            />
          </button>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 z-10 h-9 w-9 flex items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground hover:bg-background/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

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

        <div className="px-5 -mt-8 relative">
          {/* Name, age, verified */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-2xl font-bold">
              {profile.display_name}{age ? `, ${age}` : ""}
            </h1>
            {profile.verified && <BadgeCheck className="h-5 w-5 text-info" />}
            {likesCount > 0 && (
              <Badge className="gap-1 text-xs bg-primary/80 text-primary-foreground border-0 ml-1">
                <Heart className="h-3 w-3 fill-current" />
                {likesCount}
              </Badge>
            )}
          </div>

          {/* Location */}
          {(location || distance != null) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
              <MapPin className="h-4 w-4" />
              <span>
                {distance != null ? `${distance} km away` : ""}
                {distance != null && location ? " · " : ""}
                {location}
              </span>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <Card className="border-0 shadow-card mb-4">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">{profile.bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <Card className="border-0 shadow-card mb-4">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photo gallery */}
          {photos.length > 1 && (
            <Card className="border-0 shadow-card mb-6">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {photos.slice(1).map((photo, i) => (
                    <button
                      key={i}
                      onClick={() => openPhoto(i + 1)}
                      className="aspect-square overflow-hidden rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      <img src={photo} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform duration-200" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Like / Pass / Chat buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-14 w-14 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive shrink-0"
              onClick={async () => {
                if (!userId || !user) return;
                // Delete any existing swipe first, then insert pass
                await supabase.from("swipes").delete().eq("swiper_id", user.id).eq("target_id", userId);
                await supabase.from("swipes").insert({ swiper_id: user.id, target_id: userId, action: "pass" });
                toast("Passed");
                navigate(-1);
              }}
            >
              <X className="h-7 w-7" />
            </Button>

            <Button
              size="icon"
              className="h-16 w-16 rounded-full gradient-warm border-0 text-primary-foreground shadow-glow shrink-0"
              onClick={async () => {
                if (!userId || !user) return;
                // Delete any existing swipe first, then insert like
                await supabase.from("swipes").delete().eq("swiper_id", user.id).eq("target_id", userId);
                const { error } = await supabase.from("swipes").insert({ swiper_id: user.id, target_id: userId, action: "like" });
                if (error) { console.error(error); return; }
                // Check for match
                const { data: match } = await supabase
                  .from("matches")
                  .select("id")
                  .or(`and(user_a.eq.${user.id},user_b.eq.${userId}),and(user_a.eq.${userId},user_b.eq.${user.id})`)
                  .maybeSingle();
                if (match) {
                  toast.success(`It's a match with ${profile?.display_name}! 🎉`);
                  navigate(`/chat/${match.id}`);
                } else {
                  toast.success("Liked! ❤️");
                  navigate(-1);
                }
              }}
            >
              <Heart className="h-8 w-8 fill-current" />
            </Button>

            <Button
              onClick={handleChat}
              className={`flex-1 gap-2 ${
                isFree
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "gradient-warm border-0 text-primary-foreground shadow-glow"
              }`}
              size="lg"
            >
              {isFree ? (
                <>
                  <Lock className="h-4 w-4" /> Upgrade
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" /> Message
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </AppLayout>
  );
}
