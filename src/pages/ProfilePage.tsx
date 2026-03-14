import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, Edit3, BadgeCheck, MapPin, Camera, Loader2, Crown, Zap, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, loading } = useAuth();
  const { tier } = useSubscription();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 31557600000)
    : null;

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="rounded-full p-1 gradient-warm">
              <Avatar className="h-28 w-28 border-4 border-card">
                <AvatarImage src={profile?.photos?.[0] ?? ""} />
                <AvatarFallback>{profile?.display_name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
            </div>
            <button className="absolute bottom-0 right-0 rounded-full gradient-warm p-2 text-primary-foreground shadow-glow">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold">{profile?.display_name}{age ? `, ${age}` : ""}</h2>
            {profile?.verified && <BadgeCheck className="h-5 w-5 text-info" />}
            {tier !== "free" && (
              <Badge className={`gap-1 text-xs ${
                tier === "pro" ? "bg-accent/20 text-accent border-accent/30" :
                tier === "plus" ? "bg-primary/20 text-primary border-primary/30" :
                "bg-info/20 text-info border-info/30"
              }`}>
                {tier === "pro" ? <Star className="h-3 w-3" /> : tier === "plus" ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Badge>
            )}
          </div>
          {(profile?.city || profile?.state) && (
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{[profile?.city, profile?.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/onboarding")}>
            <Edit3 className="h-3.5 w-3.5" /> Edit Profile
          </Button>
        </div>

        {profile?.bio && (
          <Card className="mt-6 border-0 shadow-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">About me</h3>
              <p className="text-sm">{profile.bio}</p>
            </CardContent>
          </Card>
        )}

        {profile?.interests && profile.interests.length > 0 && (
          <Card className="mt-3 border-0 shadow-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {profile?.photos && profile.photos.length > 0 && (
          <Card className="mt-3 border-0 shadow-card">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Photos</h3>
              <div className="grid grid-cols-3 gap-2">
                {profile.photos.map((p, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl">
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-3 border-0 shadow-card gradient-warm text-primary-foreground">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium opacity-90 capitalize">{tier} Plan</p>
              <p className="text-xs opacity-70">{tier === "free" ? "Upgrade for more features" : "You're on a premium plan"}</p>
            </div>
            {tier === "free" && (
              <Button size="sm" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={() => navigate("/pricing")}>
                Upgrade
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
