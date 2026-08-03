import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic, MicOff, Video, VideoOff, Loader2 } from "lucide-react";
import { BeautyCamera, BeautyCameraHandle } from "@/components/live/BeautyCamera";
import { BeautySettingsPanel } from "@/components/live/BeautySettingsPanel";
import { BeautySettings, loadBeauty } from "@/lib/beautyFilter";
import { toast } from "sonner";

type Props = {
  roomUrl: string;
  token?: string;
  /** Ends the live for everyone (server-side), not just this tab. */
  onLeave?: () => void;
};

/**
 * Host-side broadcaster: joins the Daily room in call-object mode so we can
 * feed the browser's native camera track as the outgoing camera.
 * Viewers keep using the Daily iframe embed — no change on their side.
 */
export function HostBroadcaster({ roomUrl, token, onLeave }: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const camRef = useRef<BeautyCameraHandle>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const [beauty, setBeauty] = useState<BeautySettings>(() => loadBeauty());
  const [connecting, setConnecting] = useState(true);

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
        // Publish at high quality so the live looks sharp on phones.
        await call
          .updateSendSettings({
            video: {
              maxQuality: "high",
              encodings: {
                low: { maxBitrate: 300_000, scaleResolutionDownBy: 4, maxFramerate: 15 },
                medium: { maxBitrate: 900_000, scaleResolutionDownBy: 2, maxFramerate: 30 },
                high: { maxBitrate: 2_500_000, scaleResolutionDownBy: 1, maxFramerate: 30 },
              },

            },
          })
          .catch(() => {});
        const cameraTrack = cameraTrackRef.current;
        if (cameraTrack?.readyState === "live") {
          await call.setInputDevicesAsync({ videoSource: cameraTrack });
          await call.setLocalVideo(true);
        }
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

  // Push the native camera track whenever it changes.
  function handleTrack(track: MediaStreamTrack | null) {
    cameraTrackRef.current = track;
    const call = callRef.current;
    if (!call || !track) return;
    call
      .setInputDevicesAsync({ videoSource: track })
      .then(() => call.setLocalVideo(true))
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

  return (
    <div
      className="relative h-full w-full touch-none overflow-hidden bg-black"
    >
      {/* Direct local preview + native outgoing camera track */}
      <BeautyCamera
        ref={camRef}
        settings={beauty}
        active={camOn}
        onProcessedTrack={handleTrack}
        className="absolute inset-0 h-full w-full bg-black"
      />

      {/* Overlays */}
      {connecting && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Host controls */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-2 sm:p-3">
        <div className="pointer-events-auto rounded-full bg-black/60 px-3 py-1 text-[11px] text-white">
          {joined ? "LIVE · You are broadcasting" : "Connecting…"}
        </div>
      </div>

      <div className="safe-bottom pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:p-3">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full bg-black/60 p-1.5 sm:gap-2">
          <IconBtn onClick={toggleMic} title={micOn ? "Mute mic" : "Unmute mic"}>
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </IconBtn>
          <IconBtn onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}>
            {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </IconBtn>
          <Button
            size="sm"
            variant={beauty.enabled ? "default" : "secondary"}
            className="h-9 shrink-0 gap-1.5 rounded-full px-3"
            onClick={() => setBeautyOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Beauty
          </Button>
          {onLeave && (
            <Button size="sm" variant="destructive" className="h-9 shrink-0 rounded-full px-3" onClick={onLeave}>
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
