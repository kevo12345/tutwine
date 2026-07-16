import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Radio,
  Users,
  Heart,
  ImagePlus,
  Loader2,
  Video,
  Pause,
  Play,
  StopCircle,
  Lock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BeautyCamera } from "@/components/live/BeautyCamera";
import { BeautySettingsPanel } from "@/components/live/BeautySettingsPanel";
import { BeautySettings, loadBeauty } from "@/lib/beautyFilter";


type Live = {
  id: string;
  host_id: string;
  title: string;
  banner_url: string | null;
  status: "live" | "paused" | "ended";
  started_at: string;
  ended_at: string | null;
  viewer_count: number;
  like_count: number;
  share_link: string;
};

export default function LivesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openStart, setOpenStart] = useState(false);

  // Subscription gate
  const { data: canGoLive, isLoading: subLoading } = useQuery({
    queryKey: ["can-go-live", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_active_subscription", {
        _user_id: user.id,
      });
      return !!data;
    },
    enabled: !!user,
  });

  // My currently-live/paused stream (host controls)
  const { data: myLive } = useQuery({
    queryKey: ["my-live", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("lives")
        .select("*")
        .eq("host_id", user.id)
        .in("status", ["live", "paused"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Live | null;
    },
    enabled: !!user,
  });

  // Discovery feed — only live/paused rows
  const { data: liveList = [] } = useQuery({
    queryKey: ["lives-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lives")
        .select("*")
        .in("status", ["live", "paused"])
        .order("started_at", { ascending: false });
      return (data ?? []) as Live[];
    },
  });

  // Realtime: invalidate on any change to `lives`
  useEffect(() => {
    const channel = supabase
      .channel("lives-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives" },
        () => {
          qc.invalidateQueries({ queryKey: ["lives-feed"] });
          qc.invalidateQueries({ queryKey: ["my-live"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return (
    <AppLayout>
      <div className="px-4 pt-4 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Lives</h1>
            <p className="text-xs text-muted-foreground">
              {liveList.length} live now
            </p>
          </div>
          <GoLiveButton
            canGoLive={!!canGoLive}
            loading={subLoading}
            hasActive={!!myLive}
            onClick={() => setOpenStart(true)}
          />
        </div>

        {myLive && <HostControls live={myLive} />}

        {liveList.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Radio className="h-12 w-12 opacity-40" />
            <p className="text-sm">No one is live right now.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {liveList.map((l) => (
              <LiveCard key={l.id} live={l} onJoin={() => navigate(`/lives/${l.share_link}`)} />
            ))}
          </div>
        )}
      </div>

      <StartLiveDialog
        open={openStart}
        onOpenChange={setOpenStart}
        onStarted={() => {
          setOpenStart(false);
          qc.invalidateQueries({ queryKey: ["my-live"] });
          qc.invalidateQueries({ queryKey: ["lives-feed"] });
        }}
      />
    </AppLayout>
  );
}

function GoLiveButton({
  canGoLive,
  loading,
  hasActive,
  onClick,
}: {
  canGoLive: boolean;
  loading: boolean;
  hasActive: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const disabled = loading || !canGoLive || hasActive;
  const label = hasActive ? "You're live" : "Go Live";
  const btn = (
    <Button
      onClick={canGoLive && !hasActive ? onClick : undefined}
      disabled={disabled}
      className="gradient-warm border-0 text-primary-foreground shadow-glow"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : canGoLive ? (
        <>
          <Radio className="mr-1.5 h-4 w-4" /> {label}
        </>
      ) : (
        <>
          <Lock className="mr-1.5 h-4 w-4" /> Go Live
        </>
      )}
    </Button>
  );
  if (canGoLive || loading) return btn;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span onClick={() => navigate("/pricing")}>{btn}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center">
          An active subscription is required to host a live. Tap to view plans.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StartLiveDialog({
  open,
  onOpenChange,
  onStarted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStarted: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [beauty, setBeauty] = useState<BeautySettings>(() => loadBeauty());
  const [beautyOpen, setBeautyOpen] = useState(false);


  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function handleStart() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Give your live a title.");
      return;
    }
    setStarting(true);
    try {
      let bannerUrl: string | null = null;
      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `live-banners/${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
        bannerUrl = pub.publicUrl;
        setUploading(false);
      }

      const { data, error } = await supabase
        .from("lives")
        .insert({
          host_id: user.id,
          title: title.trim(),
          banner_url: bannerUrl,
          status: "live",
        })
        .select()
        .single();
      if (error) throw error;

      // Provision Daily.co room for the new live (host call creates it)
      const { error: fnErr } = await supabase.functions.invoke(
        "live-daily-room",
        { body: { live_id: data.id, role: "host" } },
      );
      if (fnErr) {
        // Roll back so a stream without a room doesn't appear in discovery
        await supabase
          .from("lives")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", data.id);
        throw fnErr;
      }

      toast.success("You're live!");
      setTitle("");
      setFile(null);
      onStarted();
      // Jump host straight into the stream
      navigate(`/lives/${data.share_link}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start live");
    } finally {
      setStarting(false);
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Start a live</DialogTitle>
          <DialogDescription>
            Set your banner and title, then go live.
          </DialogDescription>
        </DialogHeader>

        {/* Payout notice - persistent */}
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <p className="text-foreground">
            Lives must run at least <strong>1 hour</strong> to earn the full{" "}
            <strong>60% host payout</strong>. Lives ending early earn only{" "}
            <strong>10%</strong>.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you streaming?"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="banner">Banner image</Label>
            <label
              htmlFor="banner"
              className="flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 hover:border-primary/40"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Tap to upload</span>
                </div>
              )}
              <input
                id="banner"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="space-y-1">
            <Label>Camera preview</Label>
            <div className="relative overflow-hidden rounded-xl border bg-black aspect-[9/16] max-h-[280px] mx-auto">
              <BeautyCamera settings={beauty} className="absolute inset-0 h-full w-full" />
              <div className="absolute bottom-2 right-2">
                <Button
                  type="button"
                  size="sm"
                  variant={beauty.enabled ? "default" : "secondary"}
                  className="h-8 rounded-full gap-1.5"
                  onClick={() => setBeautyOpen(true)}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Beauty
                </Button>
              </div>
            </div>
          </div>
        </div>


        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={starting}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={starting || !title.trim()}
            className="gradient-warm border-0 text-primary-foreground"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : uploading ? (
              "Uploading..."
            ) : (
              <>
                <Radio className="mr-1.5 h-4 w-4" /> Go Live
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HostControls({ live }: { live: Live }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<null | "pause" | "resume" | "end">(null);

  async function update(patch: Partial<Live>, kind: "pause" | "resume" | "end") {
    setBusy(kind);
    const { error } = await supabase.from("lives").update(patch).eq("id", live.id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-live"] });
    qc.invalidateQueries({ queryKey: ["lives-feed"] });
    if (kind === "end") toast.success("Live ended.");
  }

  return (
    <Card className="mb-4 border-0 shadow-card overflow-hidden">
      {live.banner_url && (
        <div className="relative aspect-[3/1] w-full overflow-hidden">
          <img src={live.banner_url} alt="" className="h-full w-full object-cover" />
          <Badge className="absolute left-2 top-2 bg-destructive text-destructive-foreground gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            {live.status === "paused" ? "PAUSED" : "LIVE"}
          </Badge>
        </div>
      )}
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold line-clamp-1">{live.title}</p>
            <p className="text-[11px] text-muted-foreground">
              Started {new Date(live.started_at).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{live.viewer_count}</span>
            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{live.like_count}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {live.status === "live" ? (
            <Button size="sm" variant="outline" className="flex-1" disabled={!!busy} onClick={() => update({ status: "paused" }, "pause")}>
              {busy === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pause className="mr-1 h-4 w-4" /> Pause</>}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" disabled={!!busy} onClick={() => update({ status: "live" }, "resume")}>
              {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-1 h-4 w-4" /> Resume</>}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            disabled={!!busy}
            onClick={() => update({ status: "ended", ended_at: new Date().toISOString() }, "end")}
          >
            {busy === "end" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><StopCircle className="mr-1 h-4 w-4" /> End Live</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveCard({ live, onJoin }: { live: Live; onJoin: () => void }) {
  return (
    <Card className="border-0 shadow-card overflow-hidden">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {live.banner_url ? (
          <img src={live.banner_url} alt={live.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Video className="h-10 w-10 opacity-40" />
          </div>
        )}
        <Badge className="absolute left-2 top-2 bg-destructive text-destructive-foreground gap-1 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          {live.status === "paused" ? "PAUSED" : "LIVE"}
        </Badge>
        <div className="absolute right-2 top-2 flex flex-col gap-1 items-end">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white flex items-center gap-1">
            <Users className="h-3 w-3" />{live.viewer_count}
          </span>
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white flex items-center gap-1">
            <Heart className="h-3 w-3" />{live.like_count}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
          <p className="text-xs font-semibold text-white line-clamp-2">{live.title}</p>
        </div>
      </div>
      <CardContent className="p-2">
        <Button size="sm" className="w-full gradient-warm border-0 text-primary-foreground" onClick={onJoin}>
          Join Live
        </Button>
      </CardContent>
    </Card>
  );
}
