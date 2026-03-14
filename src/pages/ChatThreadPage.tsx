import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, MoreVertical, Shield, Flag, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { ProfileDetailSheet } from "@/components/ProfileDetailSheet";
import { Tables } from "@/integrations/supabase/types";
import VideoCall from "@/components/VideoCall";

type Message = Tables<"messages">;

export default function ChatThreadPage() {
  const navigate = useNavigate();
  const { matchId } = useParams();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [otherProfile, setOtherProfile] = useState<Tables<"profiles"> | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!matchId || !user) return;

    const loadData = async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match) { navigate("/chat"); return; }

      const otherUserId = match.user_a === user.id ? match.user_b : match.user_a;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", otherUserId)
        .single();
      setOtherProfile(profile);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);
    };
    loadData();

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, user, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !matchId) return;
    const content = newMsg.trim();
    setNewMsg("");

    await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: user.id,
      content,
      type: "text",
    });
  };

  const handleBlock = async () => {
    if (!user || !otherProfile) return;
    await supabase.from("blocked_users").insert({
      blocker_id: user.id,
      blocked_id: otherProfile.user_id,
    });
    toast.success("User blocked");
    navigate("/chat");
  };

  const handleReport = async () => {
    if (!user || !otherProfile) return;
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_user_id: otherProfile.user_id,
      reason: "Reported from chat",
    });
    toast.success("Report submitted");
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tier === "free") {
    navigate("/chat");
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background lg:items-center lg:justify-center lg:p-8">
      <div className="flex h-full w-full flex-col lg:h-[calc(100dvh-4rem)] lg:max-w-2xl lg:rounded-2xl lg:border lg:border-border lg:shadow-card lg:overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 shrink-0 sm:px-4 sm:py-3 lg:rounded-t-2xl sticky top-0 z-10">
          <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
              <AvatarImage src={otherProfile?.photos?.[0] ?? ""} />
              <AvatarFallback>{otherProfile?.display_name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-sm sm:text-base truncate">{otherProfile?.display_name ?? "User"}</h2>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active now</p>
            </div>
          </button>
          <VideoCall matchId={matchId!} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBlock} className="text-destructive">
                <Shield className="mr-2 h-4 w-4" /> Block User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleReport} className="text-destructive">
                <Flag className="mr-2 h-4 w-4" /> Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 sm:px-4 sm:py-4 sm:space-y-3 overscroll-contain">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Say hello! 👋</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                  isMe ? "gradient-warm text-primary-foreground rounded-br-md" : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}>
                  <p className="text-sm break-words">{msg.content}</p>
                  <p className={`mt-0.5 text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {isMe && msg.read_at && " ✓✓"}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input - with safe area for mobile */}
        <div className="border-t border-border bg-card px-2 py-2 sm:p-3 shrink-0 lg:rounded-b-2xl" style={{ paddingBottom: `max(0.5rem, env(safe-area-inset-bottom, 0px))` }}>
          <div className="flex gap-1.5 sm:gap-2">
            <Input
              placeholder="Type a message..."
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="rounded-full text-sm h-9 sm:h-10"
            />
            <Button
              size="icon"
              className="shrink-0 rounded-full gradient-warm border-0 text-primary-foreground h-9 w-9 sm:h-10 sm:w-10"
              onClick={sendMessage}
              disabled={!newMsg.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ProfileDetailSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        profile={otherProfile ? {
          id: otherProfile.user_id,
          displayName: otherProfile.display_name ?? "Unknown",
          age: otherProfile.date_of_birth ? Math.floor((Date.now() - new Date(otherProfile.date_of_birth).getTime()) / 31557600000) : 0,
          gender: otherProfile.gender ?? "other",
          bio: otherProfile.bio ?? "",
          interests: otherProfile.interests ?? [],
          photos: (otherProfile.photos?.length ? otherProfile.photos : []) as string[],
          distance: null,
          city: otherProfile.city ?? "",
          state: otherProfile.state ?? "",
          verified: otherProfile.verified ?? false,
        } : null}
      />
    </div>
  );
}