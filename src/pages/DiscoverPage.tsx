import { useState, useCallback, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";

import { ProfileCard } from "@/components/ProfileCard";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { MatchAnimation } from "@/components/MatchAnimation";
import { Button } from "@/components/ui/button";
import { Heart, X, Star, SlidersHorizontal, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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


  const handleSwipe = useCallback(async (action: "like" | "pass") => {
    if (!currentProfile || !user || isSwiping.current) return;

    isSwiping.current = true;
    const swipedProfile = currentProfile;

    setDirection(action === "like" ? "right" : "left");
    setCurrentIndex((i) => i + 1);

    // Unlock swiping quickly for rapid taps
    setTimeout(() => {
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
  }, [currentProfile, user, navigate, x]);

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
      <div className="relative flex-1 h-full" style={{ minHeight: 0 }}>
      <div className="absolute inset-0 flex flex-col overflow-hidden overscroll-none" style={{ overscrollBehavior: 'none', touchAction: 'pan-x' }}>
        <div className="px-3 pt-3 sm:px-4 sm:pt-4 shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-display text-xl sm:text-2xl font-bold">Discover</h1>
            <div className="flex items-center gap-2">
              
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 px-3 sm:px-4 flex flex-col">
          {noMoreProfiles ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <Heart className="h-16 w-16 text-muted-foreground/30" />
              <h2 className="mt-4 font-display text-xl font-bold">No profiles yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Be the first! Invite your friends to join.</p>
            </div>
          ) : (
            <>
              <div className="relative mx-auto w-full max-w-sm md:max-w-md lg:max-w-lg flex-1 min-h-0">
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

                <AnimatePresence initial={false} mode="popLayout">
                  {profileForCard && (
                    <motion.div
                      key={currentProfile.user_id}
                      initial={{ x: direction === "right" ? 300 : direction === "left" ? -300 : 0, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: direction === "right" ? -300 : 300, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      className="absolute inset-0 touch-none select-none"
                    >
                      <div className="h-full w-full relative">
                        {/* Arrow overlays */}
                        <button
                          onClick={() => handleSwipe("pass")}
                          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground/70 hover:bg-background/80 transition-colors"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          onClick={() => handleSwipe("like")}
                          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-background/60 backdrop-blur-sm text-foreground/70 hover:bg-background/80 transition-colors"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                        <ProfileCard profile={profileForCard} onTap={() => navigate(`/profile/${profileForCard!.id}`)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="shrink-0 py-2 pb-3 flex items-center justify-center gap-2 sm:gap-4">
                <Button variant="outline" size="icon" className="h-9 w-9 sm:h-14 sm:w-14 rounded-full border-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive" onClick={() => handleSwipe("pass")}>
                  <X className="h-4 w-4 sm:h-7 sm:w-7" />
                </Button>
                {limits.undoSwipe && (
                  <Button variant="outline" size="icon" className="h-7 w-7 sm:h-9 sm:w-9 rounded-full border-2 border-warning/30 text-warning hover:bg-warning/10" onClick={() => toast("↩️ Undo last swipe!", { description: "Your last swipe was undone." })}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                  </Button>
                )}
                <Button size="icon" className="h-11 w-11 sm:h-16 sm:w-16 rounded-full gradient-warm border-0 text-primary-foreground shadow-glow" onClick={() => handleSwipe("like")}>
                  <Heart className="h-5 w-5 sm:h-8 sm:w-8 fill-current" />
                </Button>
                <Button variant="outline" size="icon" className={`h-9 w-9 sm:h-14 sm:w-14 rounded-full border-2 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent ${!limits.superLike ? "opacity-50" : ""}`} onClick={() => {
                  if (!limits.superLike) {
                    toast("⭐ Super Like is a Pro feature", { description: "Upgrade to Pro to send Super Likes.", action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
                  } else {
                    toast.success("⭐ Super Like sent!");
                    handleSwipe("like");
                  }
                }}>
                  <Star className="h-4 w-4 sm:h-7 sm:w-7" />
                </Button>
              </div>
            </>
          )}
        </div>
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
