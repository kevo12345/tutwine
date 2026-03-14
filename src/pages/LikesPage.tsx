import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { MatchAnimation } from "@/components/MatchAnimation";
import { Heart, Loader2, MapPin, BadgeCheck, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Profile = Tables<"profiles">;

export default function LikesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [matchName, setMatchName] = useState("");
  const [matchId, setMatchId] = useState("");
  const [likingBack, setLikingBack] = useState<string | null>(null);

  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["who-liked-me", user?.id],
    queryFn: async () => {
      if (!user) return [];

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

      // Exclude users I already passed on
      const { data: mySwipes } = await supabase
        .from("swipes")
        .select("target_id")
        .eq("swiper_id", user.id)
        .eq("action", "pass");

      const passedIds = new Set((mySwipes ?? []).map((s) => s.target_id));

      const likerIds = swipes
        .map((s) => s.swiper_id)
        .filter((id) => !matchedIds.has(id) && !passedIds.has(id));

      if (!likerIds.length) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", likerIds)
        .eq("suspended", false);

      return profiles ?? [];
    },
    enabled: !!user,
  });

  const calcAge = (dob: string | null) =>
    dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;

  const handleLikeBack = async (e: React.MouseEvent, liker: Profile) => {
    e.stopPropagation();
    if (!user || likingBack) return;
    setLikingBack(liker.user_id);

    // Delete any existing swipe (e.g. a previous "pass") so INSERT trigger fires for match
    await supabase.from("swipes").delete().eq("swiper_id", user.id).eq("target_id", liker.user_id);

    const { error } = await supabase.from("swipes").insert({
      swiper_id: user.id,
      target_id: liker.user_id,
      action: "like",
    });

    if (error) {
      toast.error("Failed to like back");
      setLikingBack(null);
      return;
    }

    // The check_mutual_like trigger should have created the match
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .or(`and(user_a.eq.${user.id},user_b.eq.${liker.user_id}),and(user_a.eq.${liker.user_id},user_b.eq.${user.id})`)
      .maybeSingle();

    if (match) {
      setMatchName(liker.display_name ?? "Someone");
      setMatchId(match.id);
      setShowMatch(true);
    } else {
      toast.success("💕 Liked back!");
    }

    queryClient.invalidateQueries({ queryKey: ["who-liked-me"] });
    setLikingBack(null);
  };

  const handlePass = async (e: React.MouseEvent, liker: Profile) => {
    e.stopPropagation();
    if (!user) return;

    await supabase.from("swipes").insert({
      swiper_id: user.id,
      target_id: liker.user_id,
      action: "pass",
    });

    queryClient.invalidateQueries({ queryKey: ["who-liked-me"] });
    toast("Passed");
  };

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
                  <div className="flex gap-1 p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={(e) => handlePass(e, liker)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Pass
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gradient-warm border-0 text-primary-foreground"
                      disabled={likingBack === liker.user_id}
                      onClick={(e) => handleLikeBack(e, liker)}
                    >
                      <Heart className="h-3.5 w-3.5 mr-1 fill-current" />
                      {likingBack === liker.user_id ? "..." : "Like Back"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <MatchAnimation
        show={showMatch}
        matchName={matchName}
        onSendMessage={() => { setShowMatch(false); navigate(`/chat/${matchId}`); }}
        onKeepSwiping={() => setShowMatch(false)}
      />

      <ProfileDetailSheet
        open={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        profile={profileForSheet}
      />
    </AppLayout>
  );
}
