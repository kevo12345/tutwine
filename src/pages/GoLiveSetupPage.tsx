import { useState, useMemo, useEffect } from "react";
import { useViewportStageHeight } from "@/hooks/useViewportStageHeight";
import { useNavigate } from "react-router-dom";
import {
  X,
  Loader2,
  Radio,
  Image as ImageIcon,
  RefreshCw,
  SwitchCamera,
  Sparkles,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { LIVE_DURATION_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import { requestAvPermissions } from "@/lib/media-permissions";
import { BeautyCamera } from "@/components/live/BeautyCamera";
import { BeautySettingsPanel } from "@/components/live/BeautySettingsPanel";
import { BeautySettings, loadBeauty } from "@/lib/beautyFilter";

const THUMB_KEY = "tutwine:live-thumbnail";

/**
 * TikTok-style full-screen "Go LIVE" setup: live camera preview behind
 * translucent overlay controls (flip, beauty, duration, thumbnail) with a
 * single primary Go LIVE action pinned to the bottom.
 */
export default function GoLiveSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier } = useSubscription();
  useViewportStageHeight();
  const [hours, setHours] = useState<number>(1);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [savedThumbUrl, setSavedThumbUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [beauty, setBeauty] = useState<BeautySettings>(() => loadBeauty());
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [camReady, setCamReady] = useState(false);

  // Ask for camera access up-front so the preview can render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await requestAvPermissions();
      if (!cancelled) setCamReady(granted);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Remember the banner between lives: local cache first, then last session.
  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem(`${THUMB_KEY}:${user.id}`);
    if (cached) setSavedThumbUrl(cached);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("thumbnail_url")
        .eq("host_id", user.id)
        .not("thumbnail_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data?.thumbnail_url) return;
      setSavedThumbUrl(data.thumbnail_url);
      localStorage.setItem(`${THUMB_KEY}:${user.id}`, data.thumbnail_url);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const expiresPreview = useMemo(() => {
    const end = new Date(Date.now() + hours * 60 * 60 * 1000);
    return end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [hours]);

  const shownThumb = thumbPreview ?? savedThumbUrl;

  const onPickThumb = (f: File | null) => {
    if (!f) {
      setThumbFile(null);
      setThumbPreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setThumbFile(f);
    setThumbPreview(URL.createObjectURL(f));
  };

  const start = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (tier === "free") {
      toast.error("An active subscription is required to go live");
      navigate("/pricing");
      return;
    }
    if (hours < 1) {
      toast.error("Live session must be at least 1 hour");
      return;
    }
    // The preview already owns a live camera track and the initial permission
    // request included the microphone. Re-requesting video here can fail with
    // NotReadableError on Android because the preview is using the camera.
    if (!camReady) {
      const granted = await requestAvPermissions();
      if (!granted) return;
    }
    setStarting(true);
    try {
      let thumbnail_url: string | null = savedThumbUrl;
      if (thumbFile) {
        const ext = thumbFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/live-thumbnails/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("photos").upload(path, thumbFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: thumbFile.type,
        });
        if (up.error) throw up.error;
        const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
        thumbnail_url = pub.publicUrl;
      }
      if (thumbnail_url) localStorage.setItem(`${THUMB_KEY}:${user.id}`, thumbnail_url);

      const { data, error } = await supabase.functions.invoke("live-start-free", {
        body: { duration_hours: hours, thumbnail_url },
      });
      if (error) throw error;
      const d = data as { session_id?: string; error?: string };
      if (d?.error || !d?.session_id) throw new Error(d?.error ?? "Could not start live");
      navigate(`/live/${d.session_id}`, { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Could not start live");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-background"
      style={{ height: "var(--live-h, 100dvh)", width: "var(--live-w, 100vw)" }}
    >
      {/* Full-bleed camera preview */}
      {camReady ? (
        <BeautyCamera
          settings={beauty}
          active
          mirror={facing === "user"}
          facingMode={facing}
          className="absolute inset-0 h-full w-full bg-background"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background px-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Allow camera & mic access to preview your live.</p>
        </div>
      )}

      {/* Scrim for legible overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-background/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[46%] bg-gradient-to-t from-background via-background/80 to-transparent" />

      {/* Top bar */}
      <div className="safe-top absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="rounded-full bg-foreground/10 p-2 text-foreground backdrop-blur-sm"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="rounded-full bg-foreground/10 px-3 py-1.5 text-[11px] font-semibold text-foreground backdrop-blur-sm">
          Hosting is free · you keep 60% of gifts
        </span>
        <div className="w-9" />
      </div>

      {/* Bottom control stack */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 space-y-4 p-4 pb-6">
        {/* Tool row */}
        <div className="flex items-start justify-around">
          <ToolButton
            icon={<SwitchCamera className="h-6 w-6" />}
            label="Flip"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          />
          <ToolButton
            icon={<Sparkles className="h-6 w-6" />}
            label="Beautify"
            active={beauty.enabled}
            onClick={() => setBeautyOpen(true)}
          />
          <label htmlFor="thumb" className="cursor-pointer">
            <ToolButton
              icon={shownThumb ? <RefreshCw className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
              label={shownThumb ? "Cover" : "Add cover"}
              active={!!shownThumb}
              asDiv
            />
          </label>
        </div>

        {/* Cover + duration card */}
        <div className="flex items-center gap-3 rounded-2xl bg-foreground/10 p-3 backdrop-blur-md">
          <label htmlFor="thumb" className="shrink-0 cursor-pointer">
            {shownThumb ? (
              <img
                src={shownThumb}
                alt="Live cover preview"
                className="h-12 w-12 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-foreground/30 text-foreground/70">
                <ImageIcon className="h-5 w-5" />
              </span>
            )}
          </label>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {shownThumb ? "Cover ready" : "Add a cover image"}
            </p>
            <p className="flex items-center gap-1 truncate text-[11px] text-foreground/70">
              <Clock className="h-3 w-3" /> {hours}h live · ends around {expiresPreview}
            </p>
          </div>
        </div>

        {/* Duration chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LIVE_DURATION_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-md transition ${
                hours === h
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/10 text-foreground/80"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>

        <Button
          onClick={start}
          disabled={starting}
          size="lg"
          className="h-14 w-full rounded-full gradient-warm border-0 text-base font-bold text-primary-foreground shadow-glow"
        >
          {starting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Radio className="mr-2 h-5 w-5" /> Go LIVE
            </>
          )}
        </Button>
        <p className="text-center text-[11px] text-foreground/70">
          Subscribers only. Viewers pay 1 token per hour to join.
        </p>
      </div>

      <input
        id="thumb"
        type="file"
        accept="image/*"
        className="hidden"
        onClick={(e) => ((e.target as HTMLInputElement).value = "")}
        onChange={(e) => onPickThumb(e.target.files?.[0] ?? null)}
      />

      <BeautySettingsPanel
        value={beauty}
        onChange={setBeauty}
        open={beautyOpen}
        onOpenChange={setBeautyOpen}
      />
    </div>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
  active,
  asDiv,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  asDiv?: boolean;
}) {
  const content = (
    <>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ${
          active ? "bg-primary/90 text-primary-foreground" : "bg-foreground/10 text-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium text-foreground/80">{label}</span>
    </>
  );
  if (asDiv) {
    return <div className="flex flex-col items-center gap-1.5">{content}</div>;
  }
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      {content}
    </button>
  );
}
