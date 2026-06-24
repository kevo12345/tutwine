import { Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useActiveLiveSessions } from "@/hooks/useActiveLiveSessions";

export function LiveSuggestionBanner() {
  const { sessions } = useActiveLiveSessions();
  const navigate = useNavigate();
  if (sessions.length === 0) return null;
  const names = sessions.slice(0, 2).map((s) => s.display_name || "Someone").join(", ");
  const more = sessions.length > 2 ? ` +${sessions.length - 2} more` : "";
  return (
    <button
      onClick={() => navigate("/live")}
      className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 px-3 py-2 text-left text-sm shadow-sm transition active:scale-[0.98]"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <Radio className="h-4 w-4 text-primary shrink-0" />
      <span className="flex-1 truncate">
        <span className="font-semibold">{names}</span>
        {more} {sessions.length === 1 ? "is" : "are"} live now
      </span>
      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Join</span>
    </button>
  );
}
