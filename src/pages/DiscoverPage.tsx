import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PullToRefresh } from "@/components/PullToRefresh";
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
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { limits } = useSubscription();
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileTiers, setProfileTiers] = useState<Record<string, string>>({});
  const [profileLikes, setProfileLikes] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState(false);
  const effectiveIndex = profiles.length > 0 ? currentIndex % profiles.length : 0;
  const currentProfile = profiles.length > 0 ? profiles[effectiveIndex] : undefined;
  const isSwiping = useRef(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);


  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    const { data: swipedIds } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", user.id);

    const excludeIds = [user.id, ...(swipedIds?.map(s => s.target_id) ?? [])];

    let { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("onboarding_complete", true)
      .eq("suspended", false)
      .not("user_id", "in", `(${excludeIds.join(",")})`)
      .not("display_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    let validProfiles = (data ?? []).filter(
      (p) => p.photos && p.photos.length > 0 && p.display_name
    );

    if (validProfiles.length === 0) {
      const { data: allData } = await supabase
        .from("profiles")
        .select("*")
        .eq("onboarding_complete", true)
        .eq("suspended", false)
        .neq("user_id", user.id)
        .not("display_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      validProfiles = (allData ?? []).filter(
        (p) => p.photos && p.photos.length > 0 && p.display_name
      );
    }

    setProfiles(validProfiles);
    setCurrentIndex(0);

    if (validProfiles.length > 0) {
      const userIds = validProfiles.map(p => p.user_id);
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, tier")
        .in("user_id", userIds)
        .eq("status", "active");
      const tierMap: Record<string, string> = {};
      subs?.forEach(s => { tierMap[s.user_id] = s.tier; });
      setProfileTiers(tierMap);

      // Fetch like counts for each profile
      const { data: likeCounts } = await supabase
        .from("swipes")
        .select("target_id")
        .in("target_id", userIds)
        .eq("action", "like");
      const likeMap: Record<string, number> = {};
      likeCounts?.forEach(s => { likeMap[s.target_id] = (likeMap[s.target_id] ?? 0) + 1; });
      setProfileLikes(likeMap);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleRefresh = useCallback(async () => {
    await fetchProfiles();
    toast.success("Profiles refreshed!");
  }, [fetchProfiles]);

  const handleSwipe = useCallback(async (action: "like" | "pass") => {
    if (!currentProfile || !user || isSwiping.current) return;


    isSwiping.current = true;

    // Advance UI immediately — don't wait for DB
    setDirection(action === "like" ? "right" : "left");
    
    const swipedProfile = currentProfile;

    setTimeout(() => {
      setDirection(null);
      x.set(0);
      setCurrentIndex((i) => i + 1);
      isSwiping.current = false;
    }, 250);

    // Fire DB calls in the background (non-blocking)
    supabase.from("swipes").insert({
      swiper_id: user.id,
      target_id: swipedProfile.user_id,
      action: action,
    }).then(({ error }) => {
      if (error) console.error(error);
    });

    if (action === "like") {
      increment.mutate("likes_count");
    }
    increment.mutate("profile_views");

    if (action === "like") {
      supabase
        .from("matches")
        .select("id")
        .or(`and(user_a.eq.${user.id},user_b.eq.${swipedProfile.user_id}),and(user_a.eq.${swipedProfile.user_id},user_b.eq.${user.id})`)
        .maybeSingle()
        .then(({ data: match }) => {
          if (match) {
            setMatchName(swipedProfile.display_name ?? "Someone");
            setMatchId(match.id);
            setShowMatch(true);
          }
        });
    }
  }, [currentProfile, user, likesLeft, navigate, increment, x]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

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
    tier: profileTiers[currentProfile.user_id] ?? "free",
    likesCount: profileLikes[currentProfile.user_id] ?? 0,
  } : null;

  const noMoreProfiles = profiles.length === 0;
  const nextEffectiveIndex = profiles.length > 1 ? (effectiveIndex + 1) % profiles.length : -1;

  return (
    <AppLayout>
      <PullToRefresh onRefresh={handleRefresh} className="h-full">
        <div className="px-3 pt-3 pb-4 sm:px-4 sm:pt-4">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-xl sm:text-2xl font-bold">Discover</h1>
            <div className="flex items-center gap-2">
              
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
                {nextEffectiveIndex >= 0 && profiles[nextEffectiveIndex] && (() => {
                  const nextP = profiles[nextEffectiveIndex];
                  return (
                    <div className="absolute inset-0 scale-[0.95] opacity-50">
                      <ProfileCard profile={{
                        id: nextP.user_id,
                        displayName: nextP.display_name ?? "",
                        age: nextP.date_of_birth
                          ? Math.floor((Date.now() - new Date(nextP.date_of_birth).getTime()) / 31557600000)
                          : 0,
                        gender: nextP.gender ?? "other",
                        bio: nextP.bio ?? "",
                        interests: nextP.interests ?? [],
                        photos: (nextP.photos?.length ? nextP.photos : ["https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop"]) as string[],
                        distance: null,
                        city: nextP.city ?? "",
                        state: nextP.state ?? "",
                        verified: nextP.verified ?? false,
                        tier: profileTiers[nextP.user_id] ?? "free",
                        likesCount: profileLikes[nextP.user_id] ?? 0,
                      }} />
                    </div>
                  );
                })()}

                <AnimatePresence mode="wait">
                  {profileForCard && (
                    <motion.div
                      key={currentProfile.user_id}
                      style={{ x, rotate }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.9}
                      dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
                      onDragEnd={(_, info) => {
                        if (info.offset.x > 60 || info.velocity.x > 300) handleSwipe("like");
                        else if (info.offset.x < -60 || info.velocity.x < -300) handleSwipe("pass");
                        else x.set(0);
                      }}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={direction === "right" ? { x: 500, rotate: 20, opacity: 0 } : direction === "left" ? { x: -500, rotate: -20, opacity: 0 } : { scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y will-change-transform"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div onClick={() => setViewProfile(true)} className="h-full w-full">
                        <ProfileCard profile={profileForCard} />
                      </div>
                      <motion.div style={{ opacity: likeOpacity }} className="absolute left-4 top-6 rounded-lg border-4 border-success bg-success/10 px-4 py-1 text-2xl font-bold text-success -rotate-12 backdrop-blur-sm">
                        LIKE
                      </motion.div>
                      <motion.div style={{ opacity: passOpacity }} className="absolute right-4 top-6 rounded-lg border-4 border-destructive bg-destructive/10 px-4 py-1 text-2xl font-bold text-destructive rotate-12 backdrop-blur-sm">
                        NOPE
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4 sm:mt-6 flex items-center justify-center gap-3 sm:gap-4">
                <Button variant="outline" size="icon" className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive" onClick={() => handleSwipe("pass")}>
                  <X className="h-6 w-6 sm:h-7 sm:w-7" />
                </Button>
                {limits.undoSwipe && (
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-2 border-warning/30 text-warning hover:bg-warning/10" onClick={() => toast("↩️ Undo last swipe!", { description: "Your last swipe was undone." })}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                  </Button>
                )}
                <Button size="icon" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full gradient-warm border-0 text-primary-foreground shadow-glow" onClick={() => handleSwipe("like")}>
                  <Heart className="h-7 w-7 sm:h-8 sm:w-8 fill-current" />
                </Button>
                <Button variant="outline" size="icon" className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent ${!limits.superLike ? "opacity-50" : ""}`} onClick={() => {
                  if (!limits.superLike) {
                    toast("⭐ Super Like is a Pro feature", { description: "Upgrade to Pro to send Super Likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
                  } else {
                    toast.success("⭐ Super Like sent!");
                    handleSwipe("like");
                  }
                }}>
                  <Star className="h-6 w-6 sm:h-7 sm:w-7" />
                </Button>
              </div>
            </>
          )}

        </div>
      </PullToRefresh>

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
