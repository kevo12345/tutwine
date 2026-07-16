import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Coins, Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const GIFT_CATALOG = [
  { key: "rose", label: "Rose", emoji: "🌹", tokens: 1 },
  { key: "heart", label: "Heart", emoji: "❤️", tokens: 5 },
  { key: "star", label: "Star", emoji: "⭐", tokens: 10 },
  { key: "crown", label: "Crown", emoji: "👑", tokens: 25 },
  { key: "diamond", label: "Diamond", emoji: "💎", tokens: 50 },
  { key: "rocket", label: "Rocket", emoji: "🚀", tokens: 100 },
];

type Props = {
  liveId: string;
  hostIsSelf: boolean;
  onSent?: () => void;
};

export function GiftSheet({ liveId, hostIsSelf, onSent }: Props) {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const balance = Number((profile as any)?.token_balance ?? 0);

  async function send(gift: (typeof GIFT_CATALOG)[number]) {
    if (hostIsSelf) return;
    if (balance < gift.tokens) {
      toast.warning(`Need ${gift.tokens} tokens — top up.`);
      setOpen(false);
      navigate("/buy-tokens");
      return;
    }
    setSending(gift.key);
    const { error } = await supabase.rpc("send_gift", {
      _live_id: liveId,
      _gift_key: gift.key,
      _token_amount: gift.tokens,
    });
    setSending(null);
    if (error) {
      if (error.message?.includes("insufficient")) {
        toast.warning("Not enough tokens.");
        setOpen(false);
        navigate("/buy-tokens");
        return;
      }
      toast.error(error.message ?? "Could not send gift");
      return;
    }
    await refreshProfile();
    toast.success(`Sent ${gift.emoji} ${gift.label}!`);
    onSent?.();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex h-11 items-center gap-1 rounded-full bg-black/60 px-3 text-white"
          aria-label="Send gift"
          disabled={hostIsSelf}
        >
          <Gift className="h-4 w-4" /> <span className="text-xs">Gift</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[70vh]">
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center justify-between">
            <span>Send a gift</span>
            <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Coins className="h-4 w-4" /> {balance}
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 pb-4">
          {GIFT_CATALOG.map((g) => {
            const disabled = sending !== null || balance < g.tokens;
            return (
              <button
                key={g.key}
                onClick={() => send(g)}
                disabled={disabled}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card p-3 transition active:scale-95 disabled:opacity-50"
              >
                <span className="text-3xl">{g.emoji}</span>
                <span className="text-xs font-medium">{g.label}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Coins className="h-3 w-3" />
                  {g.tokens}
                  {sending === g.key && <Loader2 className="h-3 w-3 animate-spin" />}
                </span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" className="w-full" onClick={() => { setOpen(false); navigate("/buy-tokens"); }}>
          Buy more tokens
        </Button>
      </SheetContent>
    </Sheet>
  );
}
