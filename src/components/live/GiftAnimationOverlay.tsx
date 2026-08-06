import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins } from "lucide-react";

export type GiftEvent = {
  id: string;
  emoji: string;
  label: string;
  amount: number;
  senderName: string;
};

export const giftChannelName = (liveId: string) => `live_gifts_${liveId}`;

/** Local bus so the sender always sees their own gift instantly, even if the
 * broadcast round-trip is slow or drops. */
type LocalGift = Omit<GiftEvent, "id">;
const localListeners = new Map<string, Set<(g: LocalGift) => void>>();

export function emitLocalGift(liveId: string, gift: LocalGift) {
  localListeners.get(liveId)?.forEach((fn) => fn(gift));
}

/**
 * Full-screen celebratory overlay shown whenever a gift is purchased in a live.
 * Listens on a broadcast channel so the sender, the host and every viewer all
 * see the same animation at the same time.
 */
export function GiftAnimationOverlay({ liveId }: { liveId: string }) {
  const [events, setEvents] = useState<GiftEvent[]>([]);

  useEffect(() => {
    if (!liveId) return;

    const push = (p: Partial<GiftEvent>) => {
      const evt: GiftEvent = {
        id: `${Date.now()}-${Math.random()}`,
        emoji: p.emoji ?? "🎁",
        label: p.label ?? "Gift",
        amount: Number(p.amount ?? 0),
        senderName: p.senderName ?? "Someone",
      };
      setEvents((prev) => [...prev.slice(-3), evt]);
      setTimeout(() => setEvents((prev) => prev.filter((e) => e.id !== evt.id)), 3200);
    };

    const ch = supabase.channel(giftChannelName(liveId), {
      config: { broadcast: { self: true } },
    });
    ch.on("broadcast", { event: "gift" }, (payload) => {
      push((payload.payload ?? {}) as Partial<GiftEvent>);
    }).subscribe();

    const set = localListeners.get(liveId) ?? new Set();
    set.add(push);
    localListeners.set(liveId, set);

    return () => {
      supabase.removeChannel(ch);
      set.delete(push);
      if (set.size === 0) localListeners.delete(liveId);
    };
  }, [liveId]);


  if (events.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {events.map((e, i) => (
        <div
          key={e.id}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-gift-pop"
          style={{ marginTop: `${(i - (events.length - 1) / 2) * 96}px` }}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-[84px] leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
              {e.emoji}
            </span>
            <div className="flex items-center gap-2 rounded-full bg-black/65 px-4 py-1.5 backdrop-blur-sm">
              <span className="text-sm font-semibold text-white">
                {e.senderName} sent {e.label}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-bold text-primary-foreground">
                <Coins className="h-3 w-3" />
                {e.amount}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
