import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { Heart, Lock, Crown, Loader2, MapPin, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function LikesPage() {
  const { user, profile: myProfile } = useAuth();
  const { limits, tier } = useSubscription();
  const navigate = useNavigate();
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["who-liked-me", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get users who liked me
      const { data: swipes } = await supabase
        .from("swipes")
        .select("swiper_id")
        .eq("target_id", user.id)
        .eq("action", "like");

      if (!swipes?.length) return [];

      // Exclude users I already matched with
      const { data: matches } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      const matchedIds = new Set(
        (matches ?? []).map((m) => (m.user_a === user.id ? m.user_b : m.user_a))
      );

      const likerIds = swipes
        .map((s) => s.swiper_id)
        .filter((id) => !matchedIds.has(id));

      if (!likerIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", likerIds)
        .eq("suspended", false);

      return profiles ?? [];
    },
    enabled: !!user && limits.seeWhoLiked,
  });

  const calcAge = (dob: string | null) =>
    dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;

  // Pro-only gate
  if (!limits.seeWhoLiked) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="rounded-full bg-accent/10 p-6 mb-6">
            <Lock className="h-12 w-12 text-accent" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Who Liked You</h1>
          <p className="text-muted-foreground text-sm max-w-xs mb-6">
            See everyone who swiped right on you. This is an exclusive Pro feature.
          </p>
          <Button
            className="gradient-warm border-0 text-primary-foreground shadow-glow gap-2"
            onClick={() => navigate("/pricing")}
          >
            <Crown className="h-4 w-4" /> Upgrade to Pro
          </Button>

          {/* Blurred preview of count */}
          <div className="mt-8 rounded-2xl bg-secondary/50 p-6 w-full max-w-xs">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Heart className="h-5 w-5 text-primary/50" />
              <span className="text-sm font-medium">People have liked your profile</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted/60 blur-lg" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const profileForSheet = selectedProfile
    ? {
        id: selectedProfile.user_id,
        displayName: selectedProfile.display_name ?? "Unknown",
        age: calcAge(selectedProfile.date_of_birth) ?? 0,
        gender: selectedProfile.gender ?? "other",
        bio: selectedProfile.bio ?? "",
        interests: selectedProfile.interests ?? [],
        photos: (selectedProfile.photos?.length
          ? selectedProfile.photos
          : ["https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop"]) as string[],
        distance: null,
        city: selectedProfile.city ?? "",
        state: selectedProfile.state ?? "",
        verified: selectedProfile.verified ?? false,
        tier: "free",
      }
    : null;

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Who Liked You</h1>
          <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10">
            {likers.length} {likers.length === 1 ? "like" : "likes"}
          </Badge>
        </div>

        {likers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Heart className="h-16 w-16 text-muted-foreground/30" />
            <h2 className="mt-4 font-display text-xl font-bold">No likes yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep swiping! You'll see who likes you here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likers.map((liker) => {
              const age = calcAge(liker.date_of_birth);
              return (
                <Card
                  key={liker.user_id}
                  className="border-0 shadow-card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedProfile(liker)}
                >
                  <div className="relative aspect-[3/4]">
                    <img
                      src={liker.photos?.[0] ?? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop"}
                      alt={liker.display_name ?? ""}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-primary-foreground">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold truncate">
                          {liker.display_name}{age ? `, ${age}` : ""}
                        </p>
                        {liker.verified && <BadgeCheck className="h-3.5 w-3.5 text-info shrink-0" />}
                      </div>
                      {(liker.city || liker.state) && (
                        <div className="flex items-center gap-1 text-[10px] opacity-80 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          <span className="truncate">{[liker.city, liker.state].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-2 right-2">
                      <div className="rounded-full bg-primary/90 p-1.5 backdrop-blur-sm">
                        <Heart className="h-3 w-3 text-primary-foreground fill-current" />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ProfileDetailSheet
        open={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        profile={profileForSheet}
      />
    </AppLayout>
  );
}