import { Badge } from "@/components/ui/badge";
import { MapPin, BadgeCheck, Crown, Zap, Star, Heart, Circle } from "lucide-react";
import type { MockProfile } from "@/lib/mock-data";

interface ProfileCardProps {
  profile: MockProfile;
  style?: React.CSSProperties;
  className?: string;
  onTap?: () => void;
  isOnline?: boolean;
}

const tierConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
  basic: { icon: Zap, label: "Basic", className: "bg-info/20 text-info border-info/30" },
  plus: { icon: Crown, label: "Plus", className: "bg-primary/20 text-primary border-primary/30" },
  pro: { icon: Star, label: "Pro", className: "bg-accent/20 text-accent border-accent/30" },
};

export function ProfileCard({ profile, style, className, onTap, isOnline }: ProfileCardProps) {
  const tier = profile.tier && profile.tier !== "free" ? tierConfig[profile.tier] : null;
  const photoUrl = profile.photos[0] || "";

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl bg-card shadow-card cursor-pointer ${className ?? ""}`}
      style={style}
      onClick={onTap}
    >
      <img
        src={photoUrl}
        alt={profile.displayName}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        style={{ imageRendering: "auto" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent" />

      {isOnline && (
        <Badge className="absolute top-3 left-3 gap-1 text-xs backdrop-blur-sm bg-success/25 text-success border-success/40">
          <Circle className="h-2 w-2 fill-current" />
          Online
        </Badge>
      )}

      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
        {tier && (
          <Badge className={`${tier.className} gap-1 text-xs backdrop-blur-sm`}>
            <tier.icon className="h-3 w-3" />
            {tier.label}
          </Badge>
        )}
        {profile.likesCount != null && profile.likesCount > 0 && (
          <Badge className="gap-1 text-xs backdrop-blur-sm bg-primary/80 text-primary-foreground border-0">
            <Heart className="h-3 w-3 fill-current" />
            {profile.likesCount}
          </Badge>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 text-primary-foreground">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold">
            {profile.displayName}, {profile.age}
          </h2>
          {profile.verified && (
            <BadgeCheck className="h-5 w-5 text-info" />
          )}
        </div>
        <div className="mt-1 flex items-center gap-1 text-sm opacity-90">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            {profile.distance != null ? `${profile.distance} km away` : profile.city || profile.state || "Nearby"}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm opacity-80">{profile.bio}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.interests.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="bg-primary-foreground/20 text-primary-foreground border-0 text-xs backdrop-blur-sm"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
