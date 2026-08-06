import { useEffect, useState } from "react";
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
import { InsufficientTokensDialog } from "@/components/InsufficientTokensDialog";
import { giftChannelName } from "@/components/live/GiftAnimationOverlay";


type CatalogGift = {
  id: string;
  key: string;
  label: string;
  emoji: string;
  token_price: number;
};

type Props = {
  liveId: string;
  hostIsSelf: boolean;
  onSent?: () => void;
};

// Cached across mounts so the sheet opens instantly after the first load.
let catalogCache: CatalogGift[] | null = null;

async function fetchCatalog(attempt = 0): Promise<CatalogGift[]> {
  const { data, error } = await supabase
    .from("gift_catalog")
    .select("id, key, label, emoji, token_price")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchCatalog(attempt + 1);
    }
    throw error;
  }
  return (data as CatalogGift[]) ?? [];
}

export function GiftSheet({ liveId, hostIsSelf, onSent }: Props) {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [gifts, setGifts] = useState<CatalogGift[]>(catalogCache ?? []);
  const [loading, setLoading] = useState(false);
  const [shortfall, setShortfall] = useState<number | null>(null);
  const balance = Number((profile as any)?.token_balance ?? 0);

  // Preload the catalog as soon as the live UI mounts, with retries.
  useEffect(() => {
    if (hostIsSelf || catalogCache) return;
    let cancelled = false;
    setLoading(true);
    fetchCatalog()
      .then((list) => {
        catalogCache = list;
        if (!cancelled) setGifts(list);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hostIsSelf]);

  // Retry on open if the preload failed.
  useEffect(() => {
    if (!open || gifts.length || loading) return;
    setLoading(true);
    fetchCatalog()
      .then((list) => {
        catalogCache = list;
        setGifts(list);
      })
      .catch(() => toast.error("Couldn't load gifts — check your connection"))
      .finally(() => setLoading(false));
  }, [open, gifts.length, loading]);


  async function send(gift: CatalogGift) {
    if (hostIsSelf) return;
    if (balance < gift.token_price) {
      setOpen(false);
      setShortfall(gift.token_price);
      return;
    }
    setSending(gift.key);
    const { error } = await supabase.rpc("send_gift", {
      _live_id: liveId,
      _gift_key: gift.key,
      _token_amount: gift.token_price,
    });
    setSending(null);
    if (error) {
      if (error.message?.includes("insufficient")) {
        setOpen(false);
        setShortfall(gift.token_price);
        return;
      }
      toast.error(error.message ?? "Could not send gift");
      return;
    }
    setOpen(false);
    // Broadcast so the sender, host and all viewers see the same animation.
    const ch = supabase.channel(giftChannelName(liveId), { config: { broadcast: { self: true } } });
    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      ch.send({
        type: "broadcast",
        event: "gift",
        payload: {
          emoji: gift.emoji,
          label: gift.label,
          amount: gift.token_price,
          senderName: profile?.display_name ?? "Someone",
        },
      }).then(() => setTimeout(() => supabase.removeChannel(ch), 500));
    });
    await refreshProfile();
    onSent?.();
  }


  return (
    <>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex h-11 items-center gap-1 rounded-full bg-black/60 px-3 text-white disabled:opacity-50"
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
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : gifts.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-8">No gifts available.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 pb-4">
            {gifts.map((g) => {
              const disabled = sending !== null;
              const tooPoor = balance < g.token_price;
              return (
                <button
                  key={g.key}
                  onClick={() => send(g)}
                  disabled={disabled}
                  className={`flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-card p-3 transition active:scale-95 disabled:opacity-50 ${tooPoor ? "opacity-60" : ""}`}
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="text-xs font-medium">{g.label}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Coins className="h-3 w-3" />
                    {g.token_price}
                    {sending === g.key && <Loader2 className="h-3 w-3 animate-spin" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => { setOpen(false); navigate("/buy-tokens"); }}>
          Buy more tokens
        </Button>
      </SheetContent>
    </Sheet>
    <InsufficientTokensDialog
      open={shortfall !== null}
      onOpenChange={(o) => !o && setShortfall(null)}
      needed={shortfall ?? 0}
      balance={balance}
      action="send this gift"
    />
    </>
  );
}
