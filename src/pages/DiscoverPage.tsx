import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { ProfileCard } from "@/components/ProfileCard";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { MatchAnimation } from "@/components/MatchAnimation";
import { DiscoverFiltersSheet, type DiscoverFilters } from "@/components/discover/DiscoverFiltersSheet";
import { Button } from "@/components/ui/button";
import { Heart, X, Star, SlidersHorizontal, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

// Row shape returned by the discover_profiles SQL function.
// Sensitive fields (phone, exact coords, date_of_birth, geohash) are intentionally NOT returned.
type DiscoverProfileRow = {
  user_id: string;
  display_name: string | null;
  photos: string[] | null;
  bio: string | null;
  interests: string[] | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  verified: boolean | null;
  age: number | null;
  distance_km: number | string | null;
  active_tier: string | null;
  like_count: number | null;
  hide_distance: boolean | null;
  hide_state: boolean | null;
  created_at: string;
};

const DEFAULT_FILTERS: DiscoverFilters = {
  gender: "any",
  minAge: 18,
  maxAge: null,
  maxDistanceKm: 500,
};

const FALLBACK_PHOTO = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop";
const SWIPE_TRIGGER_PX = 80;
const TAP_CANCEL_PX = 12;
const PAGE_SIZE = 50;

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { limits } = useSubscription();

  const [profiles, setProfiles] = useState<DiscoverProfileRow[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Map<string, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showLikePopup, setShowLikePopup] = useState(false);
  const [likedName, setLikedName] = useState("");
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const pendingSwipeIdsRef = useRef<Set<string>>(new Set());
  const activePointerId = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const suppressTapRef = useRef(false);
  const gestureAxisRef = useRef<"horizontal" | "vertical" | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const args = {
      _my_lat: myProfile?.latitude ?? null,
      _my_lng: myProfile?.longitude ?? null,
      _max_distance_km: filters.maxDistanceKm,
      _min_age: filters.minAge,
      _max_age: filters.maxAge ?? 120,
      _gender: filters.gender === "any" ? null : filters.gender,
      _limit: PAGE_SIZE,
      _offset: 0,
    };

    let { data, error } = await supabase.rpc("discover_profiles", args as any);
    if (error) {
      console.error("discover_profiles error:", error);
    }

    let rows = (data ?? []).filter(
      (p: DiscoverProfileRow) => p.photos && p.photos.length > 0 && p.display_name,
    );

    // Fallback: if no results, widen filters (no gender, no distance cap)
    if (rows.length === 0) {
      const wideArgs = { ...args, _gender: null, _max_distance_km: 99999, _min_age: 18, _max_age: 120 };
      const { data: wide } = await supabase.rpc("discover_profiles", wideArgs as any);
      rows = (wide ?? []).filter(
        (p: DiscoverProfileRow) => p.photos && p.photos.length > 0 && p.display_name,
      );
    }

    setProfiles(rows as DiscoverProfileRow[]);
    setCurrentIndex(0);
    setLoading(false);
  }, [user, myProfile?.latitude, myProfile?.longitude, filters]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Fetch online presence for loaded profiles, refresh every 45s
  useEffect(() => {
    const ids = profiles.map((p) => p.user_id);
    if (ids.length === 0) {
      setOnlineIds(new Set());
      setLastSeenMap(new Map());
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("user_presence")
        .select("user_id, is_online, last_seen_at")
        .in("user_id", ids);
      if (cancelled) return;
      const now = Date.now();
      const nextOnline = new Set<string>();
      const nextLastSeen = new Map<string, string>();
      (data ?? []).forEach((r: any) => {
        const fresh = r.last_seen_at && now - new Date(r.last_seen_at).getTime() < 90_000;
        if (r.is_online && fresh) nextOnline.add(r.user_id);
        if (r.last_seen_at) nextLastSeen.set(r.user_id, r.last_seen_at);
      });
      setOnlineIds(nextOnline);
      setLastSeenMap(nextLastSeen);
    };

    load();
    const iv = setInterval(load, 45_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [profiles]);

  const filteredProfiles = profiles;

  useEffect(() => {
    setCurrentIndex(0);
  }, [filters]);

  useEffect(() => {
    if (filteredProfiles.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= filteredProfiles.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, filteredProfiles.length]);

  useEffect(() => {
    setDragOffsetX(0);
    activePointerId.current = null;
    hasDraggedRef.current = false;
    suppressTapRef.current = false;
    gestureAxisRef.current = null;
  }, [currentIndex, filteredProfiles.length]);

  const effectiveIndex = filteredProfiles.length > 0 ? currentIndex % filteredProfiles.length : 0;
  const currentProfile = filteredProfiles.length > 0 ? filteredProfiles[effectiveIndex] : undefined;
  const nextEffectiveIndex = filteredProfiles.length > 1 ? (effectiveIndex + 1) % filteredProfiles.length : -1;
  const activeFilterCount = [
    filters.gender !== DEFAULT_FILTERS.gender,
    filters.minAge !== DEFAULT_FILTERS.minAge || filters.maxAge !== DEFAULT_FILTERS.maxAge,
    filters.maxDistanceKm !== DEFAULT_FILTERS.maxDistanceKm,
  ].filter(Boolean).length;

  const toCardProfile = (profile: DiscoverProfileRow) => ({
    id: profile.user_id,
    displayName: profile.display_name ?? "Unknown",
    age: profile.age ?? 0,
    gender: profile.gender ?? "other",
    bio: profile.bio ?? "",
    interests: profile.interests ?? [],
    photos: (profile.photos?.length ? profile.photos : [FALLBACK_PHOTO]) as string[],
    distance: profile.distance_km != null ? Math.round(Number(profile.distance_km)) : null,
    city: profile.city ?? "",
    state: profile.state ?? "",
    verified: profile.verified ?? false,
    tier: profile.active_tier ?? "free",
    likesCount: profile.like_count ?? 0,
  });

  const profileForCard = currentProfile ? toCardProfile(currentProfile) : null;
  const noMoreProfiles = filteredProfiles.length === 0;




  const handleSwipe = useCallback(async (action: "like" | "pass") => {
    if (!currentProfile || !user) return;

    const swipedProfile = currentProfile;

    if (pendingSwipeIdsRef.current.has(swipedProfile.user_id)) {
      return;
    }

    // Show like popup animation
    if (action === "like") {
      setLikedName(swipedProfile.display_name ?? "Someone");
      setShowLikePopup(true);
      setTimeout(() => setShowLikePopup(false), 1200);
    }

    pendingSwipeIdsRef.current.add(swipedProfile.user_id);
    activePointerId.current = null;
    hasDraggedRef.current = false;
    suppressTapRef.current = true;
    setDragOffsetX(0);
    // Advance to next profile (looping)
    setCurrentIndex((i) => filteredProfiles.length > 1 ? (i + 1) % filteredProfiles.length : 0);

    try {
      const { error: deleteError } = await supabase
        .from("swipes")
        .delete()
        .eq("swiper_id", user.id)
        .eq("target_id", swipedProfile.user_id);

      if (deleteError) {
        console.error(deleteError);
      }

      const { error: insertError } = await supabase.from("swipes").insert({
        swiper_id: user.id,
        target_id: swipedProfile.user_id,
        action,
      });

      if (insertError) {
        console.error(insertError);
        return;
      }

      if (action !== "like") return;

      const { data: reciprocalSwipe, error: reciprocalError } = await supabase
        .from("swipes")
        .select("id")
        .eq("swiper_id", swipedProfile.user_id)
        .eq("target_id", user.id)
        .eq("action", "like")
        .maybeSingle();

      if (reciprocalError) {
        console.error(reciprocalError);
        return;
      }

      if (!reciprocalSwipe) return;

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id")
        .or(`and(user_a.eq.${user.id},user_b.eq.${swipedProfile.user_id}),and(user_a.eq.${swipedProfile.user_id},user_b.eq.${user.id})`)
        .maybeSingle();

      if (matchError) {
        console.error(matchError);
        return;
      }

      if (match) {
        setMatchName(swipedProfile.display_name ?? "Someone");
        setMatchId(match.id);
        setShowMatch(true);
      }
    } finally {
      pendingSwipeIdsRef.current.delete(swipedProfile.user_id);
      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 50);
    }
  }, [currentProfile, user]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!currentProfile || pendingSwipeIdsRef.current.has(currentProfile.user_id)) return;
    activePointerId.current = event.pointerId;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    hasDraggedRef.current = false;
    suppressTapRef.current = false;
    gestureAxisRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [currentProfile]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;

    // Lock axis on first significant movement
    if (!gestureAxisRef.current && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      gestureAxisRef.current = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    // Ignore vertical gestures entirely
    if (gestureAxisRef.current !== "horizontal") return;

    if (Math.abs(deltaX) > TAP_CANCEL_PX) {
      hasDraggedRef.current = true;
      suppressTapRef.current = true;
    }

    setDragOffsetX(deltaX);
  }, []);

  const navigateNext = useCallback(() => {
    if (filteredProfiles.length <= 1) return;
    setCurrentIndex((i) => (i + 1) % filteredProfiles.length);
    setDragOffsetX(0);
  }, [filteredProfiles.length]);

  const navigatePrev = useCallback(() => {
    if (filteredProfiles.length <= 1) return;
    setCurrentIndex((i) => (i - 1 + filteredProfiles.length) % filteredProfiles.length);
    setDragOffsetX(0);
  }, [filteredProfiles.length]);

  const finishPointerGesture = useCallback((pointerId: number) => {
    if (activePointerId.current !== pointerId) return;
    activePointerId.current = null;
    gestureAxisRef.current = null;

    if (dragOffsetX >= SWIPE_TRIGGER_PX) {
      navigateNext();
      return;
    }

    if (dragOffsetX <= -SWIPE_TRIGGER_PX) {
      navigatePrev();
      return;
    }

    setDragOffsetX(0);
    window.setTimeout(() => {
      suppressTapRef.current = false;
    }, 50);
  }, [dragOffsetX, navigateNext, navigatePrev]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    finishPointerGesture(event.pointerId);
  }, [finishPointerGesture]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    finishPointerGesture(event.pointerId);
  }, [finishPointerGesture]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full flex-col overflow-hidden overscroll-none" style={{ overscrollBehavior: "none", touchAction: "pan-x" }}>
        <div className="shrink-0 px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="font-display text-xl font-bold sm:text-2xl">Discover</h1>
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-full px-3"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 sm:px-4">
          {noMoreProfiles ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Heart className="h-16 w-16 text-muted-foreground/30" />
              <h2 className="mt-4 font-display text-xl font-bold">
                {profiles.length === 0 ? "No profiles yet" : "No matches for these filters"}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {profiles.length === 0
                  ? "Be the first! Invite your friends to join."
                  : "Try widening your age, gender, or location filters to see more people."}
              </p>
              {profiles.length > 0 && (
                <Button variant="outline" className="mt-4" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Reset filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="relative mx-auto flex min-h-0 w-full max-w-sm flex-1 md:max-w-md lg:max-w-lg">
                {nextEffectiveIndex >= 0 && filteredProfiles[nextEffectiveIndex] && (() => {
                  const nextProfile = filteredProfiles[nextEffectiveIndex];
                  return (
                    <div className="absolute inset-0 scale-[0.95] opacity-50">
                      <ProfileCard profile={toCardProfile(nextProfile)} isOnline={onlineIds.has(nextProfile.user_id)} />
                    </div>
                  );
                })()}

                {profileForCard && currentProfile && (
                  <div
                    key={currentProfile.user_id}
                    className="absolute inset-0 select-none"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                  >
                    <div className="relative h-full w-full">
                      <button
                        onClick={navigatePrev}
                        className="absolute left-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/60 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/80"
                        aria-label="Previous profile"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={navigateNext}
                        className="absolute right-1 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/60 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/80"
                        aria-label="Next profile"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                      <div
                        className="h-full w-full"
                        style={{
                          transform: `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 20}deg)`,
                          transition: activePointerId.current == null ? "transform 0.2s ease-out" : "none",
                        }}
                        onClickCapture={(event) => {
                          if (suppressTapRef.current) {
                            event.preventDefault();
                            event.stopPropagation();
                          }
                        }}
                      >
                        <ProfileCard profile={profileForCard} isOnline={onlineIds.has(currentProfile.user_id)} onTap={() => navigate(`/profile/${currentProfile.user_id}`)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center justify-center gap-2 py-2 pb-3 sm:gap-4">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-2 border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10 sm:h-14 sm:w-14" onClick={() => handleSwipe("pass")}>
                  <X className="h-4 w-4 sm:h-7 sm:w-7" />
                </Button>
                {limits.undoSwipe && (
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-full border-2 border-warning/30 text-warning hover:bg-warning/10 sm:h-9 sm:w-9" onClick={() => toast("↩️ Undo last swipe!", { description: "Your last swipe was undone." })}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                  </Button>
                )}
                <Button size="icon" className="gradient-warm h-11 w-11 rounded-full border-0 text-primary-foreground shadow-glow sm:h-16 sm:w-16" onClick={() => handleSwipe("like")}>
                  <Heart className="h-5 w-5 fill-current sm:h-8 sm:w-8" />
                </Button>
                <Button variant="outline" size="icon" className={`h-9 w-9 rounded-full border-2 border-accent/30 text-accent hover:border-accent hover:bg-accent/10 sm:h-14 sm:w-14 ${!limits.superLike ? "opacity-50" : ""}`} onClick={() => {
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

      <DiscoverFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        matchCount={filteredProfiles.length}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <MatchAnimation
        show={showMatch}
        matchName={matchName}
        onSendMessage={() => {
          setShowMatch(false);
          navigate(`/chat/${matchId}`);
        }}
        onKeepSwiping={() => setShowMatch(false)}
      />

      <ProfileDetailSheet
        open={viewProfile}
        onClose={() => setViewProfile(false)}
        profile={profileForCard}
      />

      <AnimatePresence>
        {showLikePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, times: [0, 0.5, 1] }}
                className="gradient-warm rounded-full p-5 shadow-glow"
              >
                <Heart className="h-12 w-12 text-primary-foreground fill-primary-foreground" />
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-bold text-foreground drop-shadow-lg bg-background/80 backdrop-blur-sm px-4 py-1.5 rounded-full"
              >
                💕 You liked {likedName}!
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}