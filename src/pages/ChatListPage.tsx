import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck } from "lucide-react";
import { MOCK_MATCHES } from "@/lib/mock-data";
import { useNavigate } from "react-router-dom";

export default function ChatListPage() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <h1 className="mb-6 font-display text-2xl font-bold">Chat</h1>
        <div className="space-y-1">
          {MOCK_MATCHES.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/chat/${m.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-secondary transition-colors"
            >
              <Avatar className="h-14 w-14">
                <AvatarImage src={m.profile.photos[0]} alt={m.profile.displayName} />
                <AvatarFallback>{m.profile.displayName[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{m.profile.displayName}</span>
                    {m.profile.verified && <BadgeCheck className="h-4 w-4 text-info" />}
                  </div>
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
    </AppLayout>
  );
}
