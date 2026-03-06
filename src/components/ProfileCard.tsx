import { Badge } from "@/components/ui/badge";
import { MapPin, BadgeCheck } from "lucide-react";
import type { MockProfile } from "@/lib/mock-data";

interface ProfileCardProps {
  profile: MockProfile;
  style?: React.CSSProperties;
  className?: string;
}

export function ProfileCard({ profile, style, className }: ProfileCardProps) {
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-card shadow-card ${className ?? ""}`}
      style={style}
    >
      <img
        src={profile.photos[0]}
        alt={profile.displayName}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent" />
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
