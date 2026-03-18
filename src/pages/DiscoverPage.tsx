import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const DEFAULT_FILTERS: DiscoverFilters = {
  gender: "any",
  minAge: 18,
  maxAge: null,
  maxDistanceKm: 500,
};

const FALLBACK_PHOTO = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop";
const SWIPE_TRIGGER_PX = 80;
const TAP_CANCEL_PX = 12;

const getAge = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return 0;
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / 31557600000);
};

const calcDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { limits } = useSubscription();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileTiers, setProfileTiers] = useState<Record<string, string>>({});
  const [profileLikes, setProfileLikes] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewProfile, setViewProfile] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

    const { data: swipedIds } = await supabase
      .from("swipes")
      .select("target_id")
      .eq("swiper_id", user.id);

    const excludeIds = [user.id, ...(swipedIds?.map((s) => s.target_id) ?? [])];

    let { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("onboarding_complete", true)
      .eq("suspended", false)
      .not("user_id", "in", `(${excludeIds.join(",")})`)
      .not("display_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    let validProfiles = (data ?? []).filter((p) => p.photos && p.photos.length > 0 && p.display_name);

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

      validProfiles = (allData ?? []).filter((p) => p.photos && p.photos.length > 0 && p.display_name);
    }

    setProfiles(validProfiles);
    setCurrentIndex(0);

    if (validProfiles.length > 0) {
      const userIds = validProfiles.map((p) => p.user_id);
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, tier")
        .in("user_id", userIds)
        .eq("status", "active");
      const tierMap: Record<string, string> = {};
      subs?.forEach((s) => {
        tierMap[s.user_id] = s.tier;
      });
      setProfileTiers(tierMap);

      const { data: likeCounts } = await supabase
        .from("swipes")
        .select("target_id")
        .in("target_id", userIds)
        .eq("action", "like");
      const likeMap: Record<string, number> = {};
      likeCounts?.forEach((s) => {
        likeMap[s.target_id] = (likeMap[s.target_id] ?? 0) + 1;
      });
      setProfileLikes(likeMap);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);


  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const age = getAge(profile.date_of_birth);
      const matchesGender = filters.gender === "any" || profile.gender === filters.gender;
      const matchesAge = age >= filters.minAge && (filters.maxAge == null || age <= filters.maxAge);

      if (!matchesGender || !matchesAge) return false;

      const hasCoordinates =
        myProfile?.latitude != null &&
        myProfile?.longitude != null &&
        profile.latitude != null &&
        profile.longitude != null;

      if (!hasCoordinates) return true;

      const distance = calcDistanceKm(myProfile.latitude!, myProfile.longitude!, profile.latitude!, profile.longitude!);
      return distance <= filters.maxDistanceKm;
    });
  }, [filters, myProfile, profiles]);

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

  const toCardProfile = (profile: Profile) => ({
    id: profile.user_id,
    displayName: profile.display_name ?? "Unknown",
    age: getAge(profile.date_of_birth),
    gender: profile.gender ?? "other",
    bio: profile.bio ?? "",
    interests: profile.interests ?? [],
    photos: (profile.photos?.length ? profile.photos : [FALLBACK_PHOTO]) as string[],
    distance:
      myProfile?.latitude != null &&
      myProfile?.longitude != null &&
      profile.latitude != null &&
      profile.longitude != null
        ? calcDistanceKm(myProfile.latitude, myProfile.longitude, profile.latitude, profile.longitude)
        : null,
    city: profile.city ?? "",
    state: profile.state ?? "",
    verified: profile.verified ?? false,
    tier: profileTiers[profile.user_id] ?? "free",
    likesCount: profileLikes[profile.user_id] ?? 0,
  });

  const profileForCard = currentProfile ? toCardProfile(currentProfile) : null;
  const noMoreProfiles = filteredProfiles.length === 0;

  const handleSwipe = useCallback(async (action: "like" | "pass") => {
    if (!currentProfile || !user) return;

    const swipedProfile = currentProfile;

    if (pendingSwipeIdsRef.current.has(swipedProfile.user_id)) {
      return;
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
                      <ProfileCard profile={toCardProfile(nextProfile)} />
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
                        <ProfileCard profile={profileForCard} onTap={() => navigate(`/profile/${profileForCard.id}`)} />
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
    </AppLayout>
  );
}