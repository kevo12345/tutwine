import { useEffect, useState } from "react";
import { Heart, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GiftSheet } from "@/components/live/GiftSheet";

type Props = {
  sessionId: string;
  userId: string;
  placeholder?: string;
  onHeart: () => void; // fires local + broadcast heart
  onGift?: () => void; // called after a gift is successfully sent
};

export function LiveBottomBar({ sessionId, userId, placeholder, onHeart, onGift }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // On-screen keyboards shrink the visual viewport but not our fixed 100dvh
  // stage, which leaves a blank strip under the input. Track it and lift the bar.
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset > 40 ? inset : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);


  const send = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 200) {
      toast.error("Keep it under 200 characters");
      return;
    }
    setSending(true);
    const { error } = await (supabase as any)
      .from("live_overlay_messages")
      .insert({ session_id: sessionId, author_id: userId, content: trimmed });
    setSending(false);
    if (error) {
      toast.error("Could not send");
      return;
    }
    setDraft("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      style={{ transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined }}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-2 pt-6 transition-transform duration-150 sm:px-3 ${keyboardInset ? "pb-2" : "pb-3 safe-bottom"}`}
    >

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={200}
        placeholder={placeholder ?? "Say something…"}
        className="h-10 min-w-0 flex-1 rounded-full border-white/20 bg-white/10 text-white placeholder:text-white/60 focus-visible:ring-primary"
      />
      {draft.trim() ? (
        <button
          type="submit"
          disabled={sending}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95"
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      ) : (
        <>
          <GiftSheet
            liveId={sessionId}
            hostIsSelf={false}
            source="session"
            onSent={onGift}
            triggerClassName="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm active:scale-95"
          />
          <button
            type="button"
            onClick={onHeart}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/90 text-white shadow-lg active:scale-95"
            aria-label="Heart"
          >
            <Heart className="h-5 w-5 fill-current" />
          </button>
        </>
      )}
    </form>
  );
}
