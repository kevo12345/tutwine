import { useEffect, useMemo, useState } from "react";
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

const SPARK_EMOJIS = ["✨", "🎉", "💫", "🌟", "🎊", "💖"];

/**
 * Full-screen ceremonial overlay shown whenever a gift is sent in a live.
 * Everyone on the channel — the sender, the host and every other viewer —
 * sees the same gift fly in, burst and float away at the same time.
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
      setEvents((prev) => [...prev.slice(-2), evt]);
      setTimeout(() => setEvents((prev) => prev.filter((e) => e.id !== evt.id)), 4000);
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
        <GiftCeremony key={e.id} event={e} index={i} total={events.length} />
      ))}
    </div>
  );
}

function GiftCeremony({ event, index, total }: { event: GiftEvent; index: number; total: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 110 + Math.random() * 120;
        return {
          id: i,
          emoji: SPARK_EMOJIS[i % SPARK_EMOJIS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          scale: 0.7 + Math.random() * 0.9,
          rotate: (Math.random() - 0.5) * 540,
          delay: 140 + Math.random() * 320,
          size: 16 + Math.random() * 16,
        };
      }),
    [],
  );

  const offset = (index - (total - 1) / 2) * 120;

  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ marginTop: `${offset}px` }}
    >
      <div className="relative flex flex-col items-center">
        {/* Radiant halo */}
        <div className="absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-gift-glow rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.55),transparent_70%)] blur-xl" />

        {/* Expanding ceremony rings */}
        {[0, 260, 520].map((d) => (
          <div
            key={d}
            className="absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-gift-ring rounded-full border-2 border-primary/60"
            style={{ ["--ring-delay" as any]: `${d}ms` }}
          />
        ))}

        {/* Sparkle burst */}
        {sparks.map((s) => (
          <span
            key={s.id}
            className="absolute left-1/2 top-8 animate-gift-spark leading-none"
            style={
              {
                fontSize: `${s.size}px`,
                ["--sx" as any]: `${s.x}px`,
                ["--sy" as any]: `${s.y}px`,
                ["--se" as any]: s.scale,
                ["--sr" as any]: `${s.rotate}deg`,
                ["--spark-delay" as any]: `${s.delay}ms`,
              } as React.CSSProperties
            }
          >
            {s.emoji}
          </span>
        ))}

        {/* The gift itself, flying in */}
        <div className="animate-gift-fly-in">
          <span className="block text-[92px] leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
            {event.emoji}
          </span>
        </div>

        {/* Ceremonial ribbon banner */}
        <div className="relative mt-3 animate-gift-banner overflow-hidden rounded-full bg-black/70 px-4 py-2 backdrop-blur-md ring-1 ring-primary/50">
          <span
            className="absolute inset-y-0 -left-1/3 w-1/3 animate-gift-shimmer bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            aria-hidden
          />
          <span className="relative flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm font-semibold text-white">
              {event.senderName} sent {event.label}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              <Coins className="h-3 w-3" />
              {event.amount}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
