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

  return (
    <div className="relative h-full w-full bg-black">
      {/* Local preview + processed track source */}
      <BeautyCamera
        ref={camRef}
        settings={beauty}
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
              End
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
