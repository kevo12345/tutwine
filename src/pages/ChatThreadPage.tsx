import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, MoreVertical, Shield, Flag } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MOCK_MATCHES, MOCK_MESSAGES } from "@/lib/mock-data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function ChatThreadPage() {
  const navigate = useNavigate();
  const { matchId } = useParams();
  const match = MOCK_MATCHES.find((m) => m.id === matchId) ?? MOCK_MATCHES[0];
  const messages = MOCK_MESSAGES[match.id] ?? [];
  const [newMsg, setNewMsg] = useState("");
  const [localMessages, setLocalMessages] = useState(messages);

  const sendMessage = () => {
    if (!newMsg.trim()) return;
    setLocalMessages((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, senderId: "me", content: newMsg, type: "text" as const, createdAt: "Now", read: false },
    ]);
    setNewMsg("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar className="h-10 w-10">
          <AvatarImage src={match.profile.photos[0]} />
          <AvatarFallback>{match.profile.displayName[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-medium">{match.profile.displayName}</h2>
          <p className="text-xs text-muted-foreground">Active now</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast.info("Profile view coming soon")}>View Profile</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("User blocked")} className="text-destructive">
              <Shield className="mr-2 h-4 w-4" /> Block User
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Report submitted")} className="text-destructive">
              <Flag className="mr-2 h-4 w-4" /> Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {localMessages.map((msg) => {
          const isMe = msg.senderId === "me";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                isMe ? "gradient-warm text-primary-foreground rounded-br-md" : "bg-secondary text-secondary-foreground rounded-bl-md"
              }`}>
                <p className="text-sm">{msg.content}</p>
                <p className={`mt-1 text-[10px] ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.createdAt} {isMe && msg.read && "✓✓"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-3 safe-bottom">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="rounded-full"
          />
          <Button
            size="icon"
            className="shrink-0 rounded-full gradient-warm border-0 text-primary-foreground"
            onClick={sendMessage}
            disabled={!newMsg.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
