import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProfileCard } from "@/components/ProfileCard";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { MatchAnimation } from "@/components/MatchAnimation";
import { Button } from "@/components/ui/button";
import { Heart, X, Star, SlidersHorizontal, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useDailyUsage } from "@/hooks/useDailyUsage";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { limits } = useSubscription();
  const { usage, increment } = useDailyUsage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileTiers, setProfileTiers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState(false);
  const effectiveIndex = profiles.length > 0 ? currentIndex % profiles.length : 0;
  const currentProfile = profiles.length > 0 ? profiles[effectiveIndex] : undefined;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const likesUsed = usage?.likes_count ?? 0;
  const viewsUsed = usage?.profile_views ?? 0;
  const likesLeft = limits.likes === Infinity ? "∞" : Math.max(0, limits.likes - likesUsed);
  const viewsLeft = limits.profileViews === Infinity ? "∞" : Math.max(0, limits.profileViews - viewsUsed);

  useEffect(() => {
    if (!user) return;
    const fetchProfiles = async () => {
      // Get profiles excluding self and already swiped
      const { data: swipedIds } = await supabase
        .from("swipes")
        .select("target_id")
        .eq("swiper_id", user.id);

      const excludeIds = [user.id, ...(swipedIds?.map(s => s.target_id) ?? [])];

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("onboarding_complete", true)
        .eq("suspended", false)
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .not("display_name", "is", null)
        .limit(50);

      // Filter out profiles with no photos
      const validProfiles = (data ?? []).filter(
        (p) => p.photos && p.photos.length > 0 && p.display_name
      );
      setProfiles(validProfiles);
      setLoading(false);
    };
    fetchProfiles();
  }, [user]);

  const handleSwipe = useCallback(async (action: "like" | "pass") => {
    if (!currentProfile || !user) return;

    if (action === "like") {
      if (typeof likesLeft === "number" && likesLeft <= 0) {
        toast.error("Daily like limit reached!", { description: "Upgrade for more likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
        return;
      }
    }

    // Record swipe
    const { error } = await supabase.from("swipes").insert({
      swiper_id: user.id,
      target_id: currentProfile.user_id,
      action: action,
    });

    if (error) { console.error(error); }

    // Increment usage
    if (action === "like") {
      increment.mutate("likes_count");
    }
    increment.mutate("profile_views");

    // Check if match was created (mutual like)
    if (action === "like") {
      const { data: match } = await supabase
        .from("matches")
        .select("id")
        .or(`and(user_a.eq.${user.id},user_b.eq.${currentProfile.user_id}),and(user_a.eq.${currentProfile.user_id},user_b.eq.${user.id})`)
        .maybeSingle();

      if (match) {
        setMatchName(currentProfile.display_name ?? "Someone");
        setMatchId(match.id);
        setShowMatch(true);
      }
    }

    setDirection(action === "like" ? "right" : "left");
    setTimeout(() => {
      setDirection(null);
      setCurrentIndex((i) => i + 1);
    }, 300);
  }, [currentProfile, user, likesLeft, navigate, increment]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Haversine distance calculation
  const calcDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  

  const profileForCard = currentProfile ? {
    id: currentProfile.user_id,
    displayName: currentProfile.display_name ?? "Unknown",
    age: currentProfile.date_of_birth
      ? Math.floor((Date.now() - new Date(currentProfile.date_of_birth).getTime()) / 31557600000)
      : 0,
    gender: currentProfile.gender ?? "other",
    bio: currentProfile.bio ?? "",
    interests: currentProfile.interests ?? [],
    photos: (currentProfile.photos?.length ? currentProfile.photos : ["https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop"]) as string[],
    distance: (myProfile?.latitude && myProfile?.longitude && currentProfile.latitude && currentProfile.longitude)
      ? calcDistanceKm(myProfile.latitude, myProfile.longitude, currentProfile.latitude, currentProfile.longitude)
      : null,
    city: currentProfile.city ?? "",
    state: currentProfile.state ?? "",
    verified: currentProfile.verified ?? false,
  } : null;

  const noMoreProfiles = profiles.length === 0;

  // Use effectiveIndex for next profile preview too
  const nextEffectiveIndex = profiles.length > 1 ? (effectiveIndex + 1) % profiles.length : -1;

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Discover</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{viewsLeft} views · {likesLeft} likes left</span>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {noMoreProfiles ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="h-16 w-16 text-muted-foreground/30" />
            <h2 className="mt-4 font-display text-xl font-bold">No profiles yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Be the first! Invite your friends to join.</p>
          </div>
        ) : (
          <>
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
              {nextEffectiveIndex >= 0 && profiles[nextEffectiveIndex] && (
                <div className="absolute inset-0 scale-[0.95] opacity-50">
                  <ProfileCard profile={{
                    ...profileForCard!,
                    id: profiles[nextEffectiveIndex].user_id,
                    displayName: profiles[nextEffectiveIndex].display_name ?? "",
                  }} />
                </div>
              )}

              <AnimatePresence mode="wait">
                {profileForCard && (
                  <motion.div
                    key={currentProfile.user_id}
                    style={{ x, rotate }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.7}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 100) handleSwipe("like");
                      else if (info.offset.x < -100) handleSwipe("pass");
                    }}
                    animate={direction === "right" ? { x: 500, rotate: 20, opacity: 0 } : direction === "left" ? { x: -500, rotate: -20, opacity: 0 } : {}}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  >
                    <div onClick={() => setViewProfile(true)}>
                      <ProfileCard profile={profileForCard} />
                    </div>
                    <motion.div style={{ opacity: likeOpacity }} className="absolute left-4 top-6 rounded-lg border-4 border-success px-4 py-1 text-2xl font-bold text-success -rotate-12">
                      LIKE
                    </motion.div>
                    <motion.div style={{ opacity: passOpacity }} className="absolute right-4 top-6 rounded-lg border-4 border-destructive px-4 py-1 text-2xl font-bold text-destructive rotate-12">
                      NOPE
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive" onClick={() => handleSwipe("pass")}>
                <X className="h-7 w-7" />
              </Button>
              <Button size="icon" className="h-16 w-16 rounded-full gradient-warm border-0 text-primary-foreground shadow-glow" onClick={() => handleSwipe("like")}>
                <Heart className="h-8 w-8 fill-current" />
              </Button>
              <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border-2 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent" onClick={() => toast("⭐ Super Like! (Pro feature)", { description: "Upgrade to send Super Likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } })}>
                <Star className="h-7 w-7" />
              </Button>
            </div>
          </>
        )}

        <div className="mt-6 rounded-2xl bg-secondary p-4 text-center">
          <p className="text-sm text-muted-foreground">
            🔒 {likesLeft} likes & {viewsLeft} views remaining today
          </p>
          <Button variant="link" className="text-primary text-sm" onClick={() => navigate("/pricing")}>
            Upgrade for unlimited access →
          </Button>
        </div>
      </div>

      <MatchAnimation
        show={showMatch}
        matchName={matchName}
        onSendMessage={() => { setShowMatch(false); navigate(`/chat/${matchId}`); }}
        onKeepSwiping={() => setShowMatch(false)}
      />

      <ProfileDetailSheet
        open={viewProfile}
        onClose={() => setViewProfile(false)}
        profile={profileForCard}
      />
    </AppLayout>
  );
}
