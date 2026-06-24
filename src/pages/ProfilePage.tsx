import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Settings, Edit3, BadgeCheck, MapPin, Camera, Loader2, Crown, Zap, Star, Check, Heart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TIER_FEATURES: Record<string, string[]> = {
  basic: ["100 profile views/day", "50 likes/day", "Ad-free experience"],
  plus: ["Unlimited profile views", "200 likes/day", "Advanced filters", "Ad-free experience"],
  pro: ["Unlimited everything", "See who liked you", "Priority in discovery", "Read receipts", "Undo last swipe", "Video chat", "Super Like"],
};

const TIER_ICONS: Record<string, React.ElementType> = { basic: Zap, plus: Crown, pro: Star };
const TIER_COLORS: Record<string, string> = {
  basic: "bg-info/10 text-info border-info/30",
  plus: "bg-primary/10 text-primary border-primary/30",
  pro: "bg-accent/10 text-accent border-accent/30",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { tier, subscription } = useSubscription();
  const [likesCount, setLikesCount] = useState(0);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "delete_own_account" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase.auth.signOut();
      window.location.href = "https://tutwine.com";
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchLikes = async () => {
      const { count } = await supabase
        .from("swipes")
        .select("*", { count: "exact", head: true })
        .eq("target_id", user.id)
        .eq("action", "like");
      setLikesCount(count ?? 0);
    };
    fetchLikes();

    const channel = supabase
      .channel(`my-likes-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "swipes", filter: `target_id=eq.${user.id}` }, (payload: any) => {
        if (payload.new?.action === "like") setLikesCount(c => c + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

  const TierIcon = tier !== "free" ? TIER_ICONS[tier] : null;
  const endsAt = subscription?.ends_at ? new Date(subscription.ends_at) : null;

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-6">
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
            {tier !== "free" && TierIcon && (
              <Badge className={`gap-1 text-xs ${TIER_COLORS[tier]}`}>
                <TierIcon className="h-3 w-3" />
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
          {likesCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-primary font-medium">
              <Heart className="h-4 w-4 fill-current" />
              <span>{likesCount} {likesCount === 1 ? "like" : "likes"} received</span>
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

        {/* Subscription Status Card */}
        <Card className={`mt-3 border-0 shadow-card overflow-hidden ${tier === "free" ? "gradient-warm text-primary-foreground" : ""}`}>
          <CardContent className="p-4">
            {tier === "free" ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">Free Plan</p>
                  <p className="text-xs opacity-70">Upgrade for more features</p>
                </div>
                <Button size="sm" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" onClick={() => navigate("/pricing")}>
                  Upgrade
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {TierIcon && <TierIcon className="h-5 w-5 text-primary" />}
                    <div>
                      <p className="text-sm font-semibold">{tier.charAt(0).toUpperCase() + tier.slice(1)} Plan</p>
                      <p className="text-xs text-muted-foreground">
                        {subscription?.status === "active" ? "Active" : subscription?.status ?? "Active"}
                        {endsAt && ` · Renews ${endsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/10">
                    {subscription?.status === "active" ? "Active" : subscription?.status ?? "Active"}
                  </Badge>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Your features</p>
                  <ul className="space-y-1.5">
                    {TIER_FEATURES[tier]?.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3 w-3 text-success shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate("/pricing")}>
                  Manage Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}