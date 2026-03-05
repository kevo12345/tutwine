import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, BadgeCheck } from "lucide-react";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";

export default function MatchesPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <h1 className="mb-6 font-display text-2xl font-bold">Matches</h1>

        {/* New matches */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">New Matches</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {MOCK_MATCHES.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/chat/${m.id}`)}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <div className="rounded-full p-0.5 gradient-warm">
                    <Avatar className="h-16 w-16 border-2 border-card">
                      <AvatarImage src={m.profile.photos[0]} alt={m.profile.displayName} />
                      <AvatarFallback>{m.profile.displayName[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                  {m.unread > 0 && (
                    <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center gradient-warm border-0 text-primary-foreground text-[10px]">
                      {m.unread}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium">{m.profile.displayName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Messages</h2>
          <div className="space-y-1">
            {MOCK_MATCHES.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate(`/chat/${m.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-secondary transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={m.profile.photos[0]} alt={m.profile.displayName} />
                    <AvatarFallback>{m.profile.displayName[0]}</AvatarFallback>
                  </Avatar>
                  {m.profile.verified && (
                    <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 text-info bg-card rounded-full" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.profile.displayName}, {m.profile.age}</span>
                    <span className="text-xs text-muted-foreground">{m.matchedAt}</span>
                  </div>
                  <p className={`text-sm line-clamp-1 ${m.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {m.lastMessage}
                  </p>
                </div>
                {m.unread > 0 && (
                  <Badge className="gradient-warm border-0 text-primary-foreground text-[10px] h-5 min-w-5 rounded-full flex items-center justify-center p-0">
                    {m.unread}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state upgrade prompt */}
        <div className="mt-8 rounded-2xl bg-secondary p-6 text-center">
          <Heart className="mx-auto h-10 w-10 text-primary/40" />
          <h3 className="mt-3 font-display text-lg font-bold">Want more matches?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Upgrade to see who liked you and get more visibility.</p>
          <button onClick={() => navigate("/pricing")} className="mt-3 text-sm font-medium text-primary hover:underline">
            View Plans →
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
