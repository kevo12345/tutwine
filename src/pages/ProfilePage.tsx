import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Settings, Edit3, BadgeCheck, MapPin, Camera, Loader2, Crown, Zap, Star, Check, Heart, Trash2, Coins } from "lucide-react";
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

  const statusLabel = subscription?.status === "active" ? "Active" : subscription?.status ?? "Active";

  return (
    <AppLayout>
      <div className="px-6 pt-4 pb-8">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight">Profile</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Identity */}
        <div className="flex flex-col items-center pt-6 pb-6 animate-fade-in">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-secondary shadow-card">
              <AvatarImage src={profile?.photos?.[0] ?? ""} />
              <AvatarFallback className="text-2xl">{profile?.display_name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => navigate("/onboarding")}
              className="absolute bottom-1 right-1 rounded-full border-2 border-background bg-primary p-2 text-primary-foreground shadow-sm transition-transform active:scale-90"
              aria-label="Change photo"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <h2 className="mt-4 flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <span>
              {profile?.display_name}
              {age ? <span className="ml-1 font-normal text-muted-foreground">{age}</span> : null}
            </span>
            {profile?.verified && <BadgeCheck className="h-5 w-5 text-info" />}
          </h2>

          {(profile as any)?.emrand_id && (
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                EMRAND ID
              </span>
              <span className="font-mono text-[11px] font-bold text-foreground">
                {(profile as any).emrand_id}
              </span>
            </div>
          )}
        </div>

        {/* Wallet / earnings */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/buy-tokens")}
            className="flex-1 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-transform active:scale-95"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Coin balance
              </span>
              <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                Top up
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xl font-bold text-foreground">
              <Coins className="h-4 w-4 text-warning" />
              {Number((profile as any)?.token_balance ?? 0).toLocaleString()}
            </div>
          </button>

          <button
            onClick={() => navigate("/host/earnings")}
            className="flex-1 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-transform active:scale-95"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Earnings
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-success shadow-glow" />
            </div>
            <div className="text-xl font-bold text-foreground">
              ${(Number((profile as any)?.available_earnings ?? 0) * 0.25).toFixed(2)}
            </div>
          </button>
        </div>

        {/* Location, likes, edit */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            {(profile?.city || profile?.state) && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{[profile?.city, profile?.state].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {likesCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Heart className="h-4 w-4 fill-current text-primary" />
                <span>{likesCount.toLocaleString()} likes</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-full bg-foreground px-5 text-xs font-bold text-background hover:bg-foreground/90"
            onClick={() => navigate("/onboarding")}
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit Profile
          </Button>
        </div>

        {/* About */}
        {profile?.bio && (
          <section className="mt-8">
            <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              About me
            </h3>
            <p className="text-sm font-medium leading-relaxed text-foreground/80">{profile.bio}</p>
          </section>
        )}

        {/* Interests */}
        {profile?.interests && profile.interests.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Interests
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((tag) => (
                <span
                  key={tag}
                  className="rounded-xl border border-border bg-card px-4 py-1.5 text-[11px] font-bold text-foreground shadow-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Gallery */}
        {profile?.photos && profile.photos.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Gallery
              </h3>
              <button
                onClick={() => navigate("/onboarding")}
                className="border-b border-primary text-[10px] font-bold text-primary"
              >
                Manage
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {profile.photos.map((p, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-[20px] bg-secondary shadow-sm">
                  <img src={p} alt={`${profile?.display_name ?? "Profile"} photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Membership card */}
        <section className="mt-8">
          <div className="relative overflow-hidden rounded-[32px] gradient-warm p-6 text-primary-foreground shadow-glow">
            <div className="relative z-10">
              <div className="mb-1 flex items-center gap-2 opacity-90">
                {TierIcon ? <TierIcon className="h-5 w-5" /> : <Star className="h-5 w-5" />}
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  Membership status
                </span>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xl font-extrabold">
                    {tier === "free" ? "Free Plan" : `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium opacity-75">
                    {tier === "free"
                      ? "Upgrade to host lives and unlock more"
                      : `${statusLabel}${endsAt ? ` · Renews ${endsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => navigate("/pricing")}
                  className="shrink-0 rounded-full border border-primary-foreground/30 bg-primary-foreground/20 px-4 py-1.5 text-[10px] font-bold backdrop-blur-md transition-transform active:scale-95"
                >
                  {tier === "free" ? "Upgrade" : "Manage"}
                </button>
              </div>

              {tier !== "free" && TIER_FEATURES[tier] && (
                <ul className="mt-4 grid gap-1.5 border-t border-primary-foreground/20 pt-4">
                  {TIER_FEATURES[tier].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[11px] font-medium opacity-90">
                      <Check className="h-3 w-3 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-primary-foreground/10 blur-xl" />
            <div className="absolute right-4 top-2 h-16 w-16 rounded-full bg-primary-foreground/5" />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
