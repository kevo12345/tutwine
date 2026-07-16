import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Radio, Image as ImageIcon, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LIVE_DURATION_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";

export default function GoLiveSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hours, setHours] = useState<number>(1);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const expiresPreview = useMemo(() => {
    const end = new Date(Date.now() + hours * 60 * 60 * 1000);
    return end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [hours]);

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
    if (hours < 1) {
      toast.error("Live session must be at least 1 hour");
      return;
    }
    setStarting(true);
    try {
      let thumbnail_url: string | null = null;
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

      const { data, error } = await supabase.functions.invoke("live-start-free", {
        body: { duration_hours: hours, thumbnail_url },
      });
      if (error) throw error;
      const d = data as { session_id?: string; error?: string };
      if (d?.error || !d?.session_id) throw new Error(d?.error ?? "Could not start live");
      toast.success("You're live!");
      navigate(`/live/${d.session_id}`, { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Could not start live");
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 pb-8 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Set up your live</h1>
            <p className="text-sm text-muted-foreground">Hosting is free — you keep 60% of gifts.</p>
          </div>
        </div>

        {/* Thumbnail */}
        <section className="mb-5">
          <Label className="mb-2 block text-xs uppercase text-muted-foreground">Thumbnail</Label>
          {thumbPreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <img src={thumbPreview} alt="Live thumbnail preview" className="h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => onPickThumb(null)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                aria-label="Remove thumbnail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="thumb"
              className="flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:bg-muted/50"
            >
              <ImageIcon className="h-8 w-8 opacity-60" />
              <span className="text-sm font-medium">Tap to upload a thumbnail</span>
              <span className="text-[11px] opacity-80">JPG or PNG · up to 5 MB · optional</span>
            </label>
          )}
          <input
            id="thumb"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickThumb(e.target.files?.[0] ?? null)}
          />
        </section>

        {/* Duration */}
        <section className="mb-5">
          <Label className="mb-2 block text-xs uppercase text-muted-foreground">
            Duration <span className="normal-case text-[10px] opacity-70">· minimum 1 hour</span>
          </Label>
          <div className="grid grid-cols-5 gap-2">
            {LIVE_DURATION_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={`rounded-xl border px-2 py-3 text-sm font-semibold transition ${
                  hours === h
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Your live will end automatically around <span className="font-medium text-foreground">{expiresPreview}</span>.
          </p>
        </section>

        <Button
          onClick={start}
          disabled={starting}
          size="lg"
          className="w-full gradient-warm border-0 text-primary-foreground shadow-glow"
        >
          {starting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Radio className="mr-2 h-5 w-5" /> Start live now
            </>
          )}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Viewers pay $1/hr (1 token) to join.
        </p>
      </div>
    </AppLayout>
  );
}
