import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Sparkles, Mic, MicOff, Video, VideoOff, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { BeautyCamera, BeautyCameraHandle } from "@/components/live/BeautyCamera";
import { BeautySettingsPanel } from "@/components/live/BeautySettingsPanel";
import { BeautySettings, loadBeauty } from "@/lib/beautyFilter";
import { toast } from "sonner";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));


type Props = {
  roomUrl: string;
  token?: string;
  /** Ends the live for everyone (server-side), not just this tab. */
  onLeave?: () => void;
};

/**
 * Host-side broadcaster: joins the Daily room in call-object mode so we can
 * feed a canvas-processed (beauty-filtered) video track as the outgoing camera.
 * Viewers keep using the Daily iframe embed — no change on their side.
 */
export function HostBroadcaster({ roomUrl, token, onLeave }: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const camRef = useRef<BeautyCameraHandle>(null);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [beauty, setBeauty] = useState<BeautySettings>(() => loadBeauty());
  const [connecting, setConnecting] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const stageRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  // Join Daily as call-object; do NOT let Daily auto-open camera — we supply
  // the processed track ourselves via setInputDevicesAsync.
  useEffect(() => {
    const call = DailyIframe.createCallObject({
      audioSource: true,
      videoSource: false, // we'll attach the processed track below
      dailyConfig: { useDevicePreferenceCookies: false },
    });
    callRef.current = call;

    (async () => {
      try {
        await call.join(token ? { url: roomUrl, token } : { url: roomUrl });
        setJoined(true);
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to join live");
      } finally {
        setConnecting(false);
      }
    })();

    return () => {
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
    };
  }, [roomUrl, token]);

  // Push the processed track whenever it changes.
  function handleTrack(track: MediaStreamTrack | null) {
    const call = callRef.current;
    if (!call || !track) return;
    call
      .setInputDevicesAsync({ videoSource: track })
      .catch((e) => console.warn("Failed to set video source", e));
  }

  async function toggleMic() {
    const call = callRef.current;
    if (!call) return;
    const next = !micOn;
    setMicOn(next);
    await call.setLocalAudio(next);
  }

  async function toggleCam() {
    const call = callRef.current;
    if (!call) return;
    const next = !camOn;
    setCamOn(next);
    if (next) {
      const track = camRef.current?.getTrack() ?? null;
      if (track) await call.setInputDevicesAsync({ videoSource: track });
      await call.setLocalVideo(true);
    } else {
      await call.setLocalVideo(false);
    }
  }

  // Wheel / trackpad-pinch zoom (native non-passive listener so preventDefault works).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setZoom((z) => clampZoom(z * Math.exp(-dy * 0.0015)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function touchDist(t: React.TouchList | TouchList) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full touch-none bg-black"
      onTouchStart={(e) => {
        if (e.touches.length === 2) pinchRef.current = { dist: touchDist(e.touches), zoom };
      }}
      onTouchMove={(e) => {
        const p = pinchRef.current;
        if (p && e.touches.length === 2) {
          const d = touchDist(e.touches);
          if (p.dist > 0) setZoom(clampZoom(p.zoom * (d / p.dist)));
        }
      }}
      onTouchEnd={() => {
        pinchRef.current = null;
      }}
    >
      {/* Local preview + processed track source */}
      <BeautyCamera
        ref={camRef}
        settings={beauty}
        zoom={zoom}
        active={camOn}
        onProcessedTrack={handleTrack}
        className="absolute inset-0 h-full w-full bg-black"
      />

      {/* Overlays */}
      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Zoom controls */}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-full bg-black/60 px-2 py-3">
          <IconBtn onClick={() => setZoom((z) => clampZoom(z + 0.25))} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </IconBtn>
          <SliderPrimitive.Root
            orientation="vertical"
            className="relative flex h-32 w-5 touch-none select-none flex-col items-center"
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            onValueChange={(v) => setZoom(clampZoom(v[0]))}
            aria-label="Camera zoom"
          >
            <SliderPrimitive.Track className="relative h-full w-1.5 grow overflow-hidden rounded-full bg-white/25">
              <SliderPrimitive.Range className="absolute w-full bg-primary" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background focus-visible:outline-none" />
          </SliderPrimitive.Root>
          <IconBtn onClick={() => setZoom((z) => clampZoom(z - 0.25))} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </IconBtn>
          <span className="text-[10px] font-medium text-white/80">{zoom.toFixed(1)}x</span>
        </div>
      </div>

      {/* Host controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-3">
        <div className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
          {joined ? "LIVE · You are broadcasting" : "Connecting…"}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/60 p-1.5">
          <IconBtn onClick={toggleMic} title={micOn ? "Mute mic" : "Unmute mic"}>
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </IconBtn>
          <IconBtn onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}>
            {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </IconBtn>
          <Button
            size="sm"
            variant={beauty.enabled ? "default" : "secondary"}
            className="h-9 rounded-full gap-1.5"
            onClick={() => setBeautyOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Beauty
          </Button>
          {onLeave && (
            <Button size="sm" variant="destructive" className="h-9 rounded-full" onClick={onLeave}>
              End live
            </Button>
          )}
        </div>
      </div>

      <BeautySettingsPanel
        value={beauty}
        onChange={setBeauty}
        open={beautyOpen}
        onOpenChange={setBeautyOpen}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"
    >
      {children}
    </button>
  );
}
