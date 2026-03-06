import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, BadgeCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables } from "@/integrations/supabase/types";

interface MatchWithProfile {
  matchId: string;
  matchedAt: string;
  profile: Tables<"profiles">;
  lastMessage?: string;
  unread: number;
}

export default function MatchesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: matchRows } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!matchRows) { setLoading(false); return; }

      const result: MatchWithProfile[] = [];
      for (const m of matchRows) {
        const otherUserId = m.user_a === user.id ? m.user_b : m.user_a;
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", otherUserId).single();
        if (!profile) continue;

        // Get last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at, sender_id, read_at")
          .eq("match_id", m.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("match_id", m.id)
          .neq("sender_id", user.id)
          .is("read_at", null);

        result.push({
          matchId: m.id,
          matchedAt: new Date(m.created_at).toLocaleDateString(),
          profile,
          lastMessage: lastMsg?.content,
          unread: count ?? 0,
        });
      }
      setMatches(result);
      setLoading(false);
    };
    load();
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

  return (
    <AppLayout>
      <div className="px-4 pt-4">
        <h1 className="mb-6 font-display text-2xl font-bold">Matches</h1>

        {matches.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Heart className="h-16 w-16 text-muted-foreground/30" />
            <h2 className="mt-4 font-display text-xl font-bold">No matches yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Keep swiping to find your match!</p>
          </div>
        ) : (
          <>
            {/* New matches row */}
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">New Matches</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {matches.map((m) => (
                  <button key={m.matchId} onClick={() => navigate(`/chat/${m.matchId}`)} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <div className="rounded-full p-0.5 gradient-warm">
                        <Avatar className="h-16 w-16 border-2 border-card">
                          <AvatarImage src={m.profile.photos?.[0] ?? ""} alt={m.profile.display_name ?? ""} />
                          <AvatarFallback>{m.profile.display_name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                      </div>
                      {m.unread > 0 && (
                        <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center gradient-warm border-0 text-primary-foreground text-[10px]">
                          {m.unread}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-medium">{m.profile.display_name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message list */}
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Messages</h2>
              <div className="space-y-1">
                {matches.map((m) => (
                  <button key={m.matchId} onClick={() => navigate(`/chat/${m.matchId}`)} className="flex w-full items-center gap-3 rounded-2xl p-3 hover:bg-secondary transition-colors">
                    <div className="relative">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={m.profile.photos?.[0] ?? ""} />
                        <AvatarFallback>{m.profile.display_name?.[0] ?? "?"}</AvatarFallback>
                      </Avatar>
                      {m.profile.verified && <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 text-info bg-card rounded-full" />}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.profile.display_name}</span>
                        <span className="text-xs text-muted-foreground">{m.matchedAt}</span>
                      </div>
                      <p className={`text-sm line-clamp-1 ${m.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {m.lastMessage ?? "Say hello! 👋"}
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
          </>
        )}

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
