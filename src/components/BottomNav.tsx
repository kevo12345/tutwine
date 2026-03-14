import { Heart, MessageCircle, Search, Sparkles, Eye, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Heart, label: "Matches", path: "/matches" },
  { icon: Eye, label: "Likes", path: "/likes" },
  { icon: MessageCircle, label: "Chat", path: "/chat" },
  { icon: Sparkles, label: "Boost", path: "/pricing" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const profilePhoto = profile?.photos?.[0];
  const profileActive = location.pathname === "/profile";

  return (
    <nav className="border-t border-border bg-card/95 backdrop-blur-lg shrink-0" style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5 sm:px-2 sm:py-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 transition-all min-w-0",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/20")} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[9px] sm:text-[10px] font-medium truncate">{label}</span>
            </button>
          );
        })}
        {/* Profile tab */}
        <button
          onClick={() => navigate("/profile")}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 transition-all min-w-0",
            profileActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {profilePhoto ? (
            <Avatar className={cn("h-5 w-5", profileActive && "ring-2 ring-primary")}>
              <AvatarImage src={profilePhoto} alt="Profile" />
              <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
            </Avatar>
          ) : (
            <User className={cn("h-5 w-5", profileActive && "fill-primary/20")} strokeWidth={profileActive ? 2.5 : 2} />
          )}
          <span className="text-[9px] sm:text-[10px] font-medium truncate">Profile</span>
        </button>
      </div>
    </nav>
  );
}