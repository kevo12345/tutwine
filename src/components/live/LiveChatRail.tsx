import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OverlayMsg {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string | null;
  author_photo?: string | null;
}

const KEEP_LAST = 40;

type Props = {
  sessionId: string;
  active: boolean;
};

/**
 * TikTok-style right/bottom scrolling comment rail.
 * Subscribes to live_overlay_messages inserts for the session.
 */
export function LiveChatRail({ sessionId, active }: Props) {
  const [messages, setMessages] = useState<OverlayMsg[]>([]);
  const nameCache = useRef<Map<string, { name: string | null; photo: string | null }>>(new Map());

  useEffect(() => {
    if (!active || !sessionId) return;

    const hydrate = async (rows: OverlayMsg[]) => {
      const missing = Array.from(
        new Set(rows.map((r) => r.author_id).filter((id) => !nameCache.current.has(id))),
      );
      if (missing.length) {
        const { data: profs } = await supabase.rpc("get_profiles_public", { _targets: missing });
        (profs ?? []).forEach((p: any) =>
          nameCache.current.set(p.user_id, {
            name: p.display_name ?? null,
            photo: p.photos?.[0] ?? null,
          }),
        );
        missing.forEach((id) => {
          if (!nameCache.current.has(id)) nameCache.current.set(id, { name: null, photo: null });
        });
      }
      return rows.map((r) => {
        const c = nameCache.current.get(r.author_id);
        return { ...r, author_name: c?.name ?? null, author_photo: c?.photo ?? null };
      });
    };

    (async () => {
      const { data } = await (supabase as any)
        .from("live_overlay_messages")
        .select("id, author_id, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(KEEP_LAST);
      const rows = ((data ?? []) as OverlayMsg[]).slice().reverse();
      setMessages(await hydrate(rows));
    })();

    const ch = supabase
      .channel(`chatrail_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_overlay_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const [row] = await hydrate([payload.new as OverlayMsg]);
          setMessages((prev) => [...prev.slice(-KEEP_LAST + 1), row]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId, active]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 flex max-h-[45%] flex-col justify-end gap-1.5 overflow-hidden px-3">
      {messages.slice(-12).map((m) => (
        <div
          key={m.id}
          className="flex max-w-[80%] items-start gap-2 rounded-2xl bg-black/55 px-2.5 py-1.5 text-white backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2"
        >
          {m.author_photo ? (
            <img src={m.author_photo} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              {(m.author_name ?? "?").slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              {m.author_name ?? "Guest"}
            </div>
            <div className="break-words text-sm leading-snug">{m.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
