import { Heart, MessageCircle, Search, Sparkles, HelpCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Heart, label: "Matches", path: "/matches" },
  { icon: Sparkles, label: "Boost", path: "/pricing" },
  { icon: MessageCircle, label: "Chat", path: "/chat" },
  { icon: HelpCircle, label: "Support", path: "/support" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const profilePhoto = profile?.photos?.[0];
  const profileActive = location.pathname === "/profile";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/20")} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
        {/* Profile tab with user photo */}
        <button
          onClick={() => navigate("/profile")}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all",
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
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
}
