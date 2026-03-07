import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Mail, FileText, Send, MessageCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
  sender_id: string;
}

function LiveChat() {
  const { user, profile } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load or create conversation
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data: convos } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (convos && convos.length > 0) {
        convId = convos[0].id;
      } else {
        const { data: newConvo, error } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id, subject: "Support Request" })
          .select("id")
          .single();
        if (error || !newConvo) { toast.error("Could not start chat"); setLoading(false); return; }
        convId = newConvo.id;
      }
      setConversationId(convId);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);
    };
    init();
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`support-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !conversationId || !user) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      is_admin: false,
      content: newMsg.trim(),
    });
    if (error) toast.error("Failed to send message");
    else setNewMsg("");
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-card flex flex-col h-[60vh] max-h-[500px]">
      <CardHeader className="pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">Live Chat</CardTitle>
            <p className="text-xs text-muted-foreground">Chat with our support team</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success" /> Online
          </span>
        </div>
      </CardHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Send a message to start the conversation. Our team will respond shortly.
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.is_admin ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.is_admin
                ? "bg-muted text-foreground rounded-bl-md"
                : "bg-primary text-primary-foreground rounded-br-md"
            }`}>
              {msg.is_admin && <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Support Team</p>}
              <p>{msg.content}</p>
              <p className={`text-[10px] mt-1 ${msg.is_admin ? "text-muted-foreground/60" : "text-primary-foreground/60"}`}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2">
        <Input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 h-9"
          disabled={sending}
        />
        <Button type="submit" size="icon" className="h-9 w-9" disabled={sending || !newMsg.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}

export default function SupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 pb-24">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl font-bold">Support</h1>
        </div>

        <p className="mb-6 text-muted-foreground">
          Need help? We're here for you. Choose how you'd like to reach us.
        </p>

        {showChat && user ? (
          <>
            <Button variant="ghost" size="sm" className="mb-3" onClick={() => setShowChat(false)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to options
            </Button>
            <LiveChat />
          </>
        ) : (
          <div className="space-y-4">
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display text-lg">Live Chat</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">Chat with our support team in real-time</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (!user) { toast.error("Please log in to start a chat"); navigate("/login"); return; }
                    setShowChat(true);
                  }}
                >
                  Start Chat
                </Button>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display text-lg">Email Us</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">Send us an email at support@tutwine.com</p>
                <Button variant="outline" size="sm" className="w-full">Send Email</Button>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display text-lg">FAQs</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">Browse frequently asked questions</p>
                <Button variant="outline" size="sm" className="w-full">View FAQs</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
