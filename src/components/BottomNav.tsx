import { Heart, MessageCircle, Search, Radio, Eye, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLikesCount } from "@/hooks/useLikesCount";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useActiveLiveSessions } from "@/hooks/useActiveLiveSessions";

const navItems = [
  { icon: Search, label: "Discover", path: "/discover" },
  { icon: Heart, label: "Matches", path: "/matches" },
  { icon: Eye, label: "Likes", path: "/likes", badge: "likes" },
  { icon: MessageCircle, label: "Chat", path: "/chat", badge: "chat" },
  { icon: Radio, label: "Live", path: "/live", badge: "live" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { count: likesCount, hasNewLike } = useLikesCount();
  const { count: unreadCount } = useUnreadMessages();
  const { sessions } = useActiveLiveSessions();
  const profilePhoto = profile?.photos?.[0];
  const profileActive = location.pathname === "/profile";
  const liveCount = sessions.length;

  return (
    <nav className="border-t border-border bg-card/95 backdrop-blur-lg shrink-0" style={{ paddingBottom: `env(safe-area-inset-bottom, 0px)` }}>
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5 sm:px-2 sm:py-2">
        {navItems.map(({ icon: Icon, label, path, badge }) => {
          const active = location.pathname.startsWith(path);
          const showLikesBadge = badge === "likes" && likesCount > 0;
          const showChatBadge = badge === "chat" && unreadCount > 0;
          const showLiveBadge = badge === "live" && liveCount > 0;
          const badgeCount = badge === "likes" ? likesCount : badge === "chat" ? unreadCount : badge === "live" ? liveCount : 0;
          const showBadge = showLikesBadge || showChatBadge || showLiveBadge;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 transition-all min-w-0",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} strokeWidth={active ? 2.5 : 2} />
                {showBadge && (
                  <span className={cn(
                    "absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-primary-foreground transition-transform",
                    showLiveBadge ? "bg-red-500 animate-pulse" : "bg-primary",
                    showLikesBadge && hasNewLike && "animate-[pulse_0.6s_cubic-bezier(0.4,0,0.6,1)_3] scale-110"
                  )}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] sm:text-[10px] font-medium truncate">{label}</span>
            </button>
          );
        })}
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
