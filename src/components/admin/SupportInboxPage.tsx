import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Send, Loader2, ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Conversation {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
  sender_id: string;
}

export default function SupportInboxPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    const fetchConversations = async () => {
      const { data: convos } = await supabase
        .from("support_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (convos && convos.length > 0) {
        const userIds = [...new Set(convos.map((c) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

        // Get last message for each conversation
        const enriched = await Promise.all(
          convos.map(async (c) => {
            const { data: lastMsg } = await supabase
              .from("support_messages")
              .select("content, is_admin")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1);
            return {
              ...c,
              user_name: profileMap.get(c.user_id) ?? "Unknown User",
              last_message: lastMsg?.[0]?.content ?? "No messages yet",
            };
          })
        );
        setConversations(enriched);
      }
      setLoading(false);
    };
    fetchConversations();
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;
    const fetchMessages = async () => {
      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selectedConvo.id)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
    };
    fetchMessages();
  }, [selectedConvo]);

  // Realtime for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;
    const channel = supabase
      .channel(`admin-support-${selectedConvo.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${selectedConvo.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedConvo || !user) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: selectedConvo.id,
      sender_id: user.id,
      is_admin: true,
      content: newMsg.trim(),
    });
    if (error) toast.error("Failed to send: " + error.message);
    else {
      setNewMsg("");
      await supabase
        .from("support_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedConvo.id);
    }
    setSending(false);
  };

  const handleCloseConvo = async () => {
    if (!selectedConvo) return;
    await supabase
      .from("support_conversations")
      .update({ status: "closed" })
      .eq("id", selectedConvo.id);
    setConversations((prev) =>
      prev.map((c) => c.id === selectedConvo.id ? { ...c, status: "closed" } : c)
    );
    setSelectedConvo({ ...selectedConvo, status: "closed" });
    toast.success("Conversation closed");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Support Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and respond to user support messages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversation list */}
        <Card className="border border-border shadow-sm overflow-hidden lg:col-span-1">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Conversations ({conversations.length})
            </CardTitle>
          </CardHeader>
          <div className="overflow-y-auto h-full">
            {conversations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No support conversations yet</p>
            ) : (
              conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={`w-full text-left p-4 border-b border-border hover:bg-muted/50 transition-colors ${
                    selectedConvo?.id === convo.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {convo.user_name?.[0]?.toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{convo.user_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{convo.last_message}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        convo.status === "open"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {convo.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(convo.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Chat area */}
        <Card className="border border-border shadow-sm overflow-hidden lg:col-span-2 flex flex-col">
          {selectedConvo ? (
            <>
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={() => setSelectedConvo(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {selectedConvo.user_name?.[0]?.toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{selectedConvo.user_name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Started {new Date(selectedConvo.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {selectedConvo.status === "open" && (
                    <Button variant="outline" size="sm" onClick={handleCloseConvo} className="text-xs h-7">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Close
                    </Button>
                  )}
                </div>
              </CardHeader>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.is_admin
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}>
                      {!msg.is_admin && <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{selectedConvo.user_name}</p>}
                      {msg.is_admin && <p className="text-[10px] font-semibold text-primary-foreground/70 mb-0.5">You (Admin)</p>}
                      <p>{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.is_admin ? "text-primary-foreground/60" : "text-muted-foreground/60"}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedConvo.status === "open" ? (
                <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2">
                  <Input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 h-9"
                    disabled={sending}
                  />
                  <Button type="submit" size="icon" className="h-9 w-9" disabled={sending || !newMsg.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              ) : (
                <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
                  This conversation has been closed.
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
