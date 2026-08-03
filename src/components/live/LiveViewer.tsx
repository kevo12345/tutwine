import { useEffect, useRef, useState } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Loader2 } from "lucide-react";
import { useStageFit } from "@/hooks/useStageFit";


/** Must match BeautyCamera so viewers see the same framing as the host preview. */
const SUBJECT_ZOOM = 1;

type Props = {
  roomUrl: string;
  active: boolean; // only join when true
  userName?: string;
};

/**
 * Viewer joins the Daily room in call-object mode (no iframe, no Daily chrome).
 * Renders the host's remote video/audio into our own <video> element so we can
 * lay overlays on top TikTok-style.
 */
export function LiveViewer({ roomUrl, active, userName }: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  /** Aspect ratio (w/h) of the host's incoming track. */
  const [trackRatio, setTrackRatio] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(true);
  const { stageRef, objectFit } = useStageFit(trackRatio);


  useEffect(() => {
    if (!active || !roomUrl) return;

    let cancelled = false;
    const call = DailyIframe.createCallObject({
      audioSource: false,
      videoSource: false,
      subscribeToTracksAutomatically: true,
      dailyConfig: { useDevicePreferenceCookies: false },
    });
    callRef.current = call;

    const attachTracks = () => {
      const participants = call.participants();
      let vTrack: MediaStreamTrack | null = null;
      let aTrack: MediaStreamTrack | null = null;
      for (const id in participants) {
        const p = participants[id];
        if (p.local) continue;
        if (p.owner || p.tracks.video?.state === "playable") {
          const vs = p.tracks.video?.persistentTrack;
          if (vs) vTrack = vs;
        }
        const as = p.tracks.audio?.persistentTrack;
        if (as) aTrack = as;
        if (vTrack && aTrack) break;
      }
      if (videoRef.current) {
        if (vTrack) {
          const video = videoRef.current;
          const stream = new MediaStream([vTrack]);
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            const settings = vTrack.getSettings();
            const width = video.videoWidth || settings.width || 0;
            const height = video.videoHeight || settings.height || 0;
            const ratio = height > 0 ? width / height : 9 / 16;
            console.info("Live viewer track", { width, height, aspectRatio: ratio });
            if (ratio > 0) setTrackRatio(ratio);
          };
          video.play().catch(() => {});
          setHasVideo(true);
        } else {
          setHasVideo(false);
        }
      }
      if (audioRef.current && aTrack) {
        audioRef.current.srcObject = new MediaStream([aTrack]);
        audioRef.current.play().catch(() => {});
      }
    };

    call.on("track-started", attachTracks);
    call.on("track-stopped", attachTracks);
    call.on("participant-joined", attachTracks);
    call.on("participant-updated", attachTracks);
    call.on("participant-left", attachTracks);

    (async () => {
      try {
        await call.join({ url: roomUrl, userName: userName ?? "Viewer" });
        if (cancelled) return;
        attachTracks();
      } catch (e) {
        console.warn("viewer join failed", e);
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      call.leave().catch(() => {});
      call.destroy().catch(() => {});
      callRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [roomUrl, active, userName]);

  return (
    <div ref={stageRef} className="absolute inset-0 overflow-hidden bg-black">
      {/* Stage ratio is measured and matched against the incoming track ratio:
          matching ratios fill edge-to-edge, mismatched ones are fitted. */}
      <video
        ref={videoRef}
        className="absolute inset-0 z-[1] block h-full w-full object-center"
        style={{
          objectFit,
          transform: `scale(${SUBJECT_ZOOM})`,
          transformOrigin: "center center",
        }}
        playsInline
        autoPlay
        muted={false}
      />


      <audio ref={audioRef} autoPlay />
      {(connecting || !hasVideo) && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-black/40 text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-xs opacity-80">
            {connecting ? "Connecting to live…" : "Waiting for host video…"}
          </p>
        </div>
      )}
    </div>
  );
}
