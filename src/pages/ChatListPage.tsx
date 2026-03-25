import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Loader2, Lock, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface ChatItem {
  matchId: string;
  profile: Tables<"profiles">;
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
}

export default function ChatListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isFree = tier === "free";

  const loadChats = useCallback(async () => {
    if (!user) return;

    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!matches?.length) {
      setChats([]);
      setLoading(false);
      return;
    }

    const items: ChatItem[] = [];

    for (const m of matches) {
      const otherUserId = m.user_a === user.id ? m.user_b : m.user_a;

      const [{ data: outgoingLike }, { data: incomingLike }, { data: profile }, { data: lastMsg }, { count }] = await Promise.all([
        supabase
          .from("swipes")
          .select("id")
          .eq("swiper_id", user.id)
          .eq("target_id", otherUserId)
          .eq("action", "like")
          .maybeSingle(),
        supabase
          .from("swipes")
          .select("id")
          .eq("swiper_id", otherUserId)
          .eq("target_id", user.id)
          .eq("action", "like")
          .maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", otherUserId).single(),
        supabase
          .from("messages")
          .select("content, created_at")
          .eq("match_id", m.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("match_id", m.id)
          .neq("sender_id", user.id)
          .is("read_at", null),
      ]);

      if (!outgoingLike || !incomingLike || !profile) continue;

      items.push({
        matchId: m.id,
        profile,
        lastMessage: lastMsg?.content,
        lastMessageAt: lastMsg?.created_at ? new Date(lastMsg.created_at).toLocaleDateString() : undefined,
        unread: count ?? 0,
      });
    }

    setChats(items);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const handleRefresh = useCallback(async () => {
    await loadChats();
    toast.success("Chats refreshed!");
  }, [loadChats]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (isFree && chats.length === 0) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <MessageCircle className="h-16 w-16 text-muted-foreground/30" />
          <h2 className="mt-4 font-display text-xl font-bold">No messages yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Visit a profile and send your first message!
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="px-3 pt-3 sm:px-4 sm:pt-4">
          <h1 className="mb-4 sm:mb-6 font-display text-xl sm:text-2xl font-bold">Chat</h1>
          {isFree && chats.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              <span>You can read messages but need to <button onClick={() => navigate("/pricing")} className="font-medium text-primary underline">upgrade</button> to reply.</span>
            </div>
          )}
          {chats.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <MessageCircle className="h-16 w-16 text-muted-foreground/30" />
              <h2 className="mt-4 font-display text-xl font-bold">No conversations</h2>
              <p className="mt-2 text-sm text-muted-foreground">Match with someone to start chatting!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {chats.map((c) => (
                <button
                  key={c.matchId}
                  onClick={() => navigate(`/chat/${c.matchId}`)}
                  className="flex w-full items-center gap-2.5 sm:gap-3 rounded-2xl p-2.5 sm:p-3 hover:bg-secondary transition-colors overflow-hidden"
                >
                  <Avatar className="h-11 w-11 sm:h-14 sm:w-14 shrink-0">
                    <AvatarImage src={c.profile.photos?.[0] ?? ""} alt={c.profile.display_name ?? ""} />
                    <AvatarFallback>{c.profile.display_name?.[0] ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-medium text-sm sm:text-base truncate">{c.profile.display_name}</span>
                        {c.profile.verified && <BadgeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-info shrink-0" />}
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{c.lastMessageAt}</span>
                    </div>
                    <p className={`text-xs sm:text-sm line-clamp-1 ${c.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {c.lastMessage ?? "Say hello! 👋"}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <Badge className="gradient-warm border-0 text-primary-foreground text-[10px] h-5 min-w-5 rounded-full flex items-center justify-center p-0 shrink-0">
                      {c.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
