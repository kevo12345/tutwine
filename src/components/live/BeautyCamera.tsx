import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BeautySettings, beautyFilterCss } from "@/lib/beautyFilter";
import { isNativeApp } from "@/lib/platform";
import { StageVideo } from "./StageVideo";


export type BeautyCameraHandle = {
  /** The browser camera MediaStream. */
  getStream: () => MediaStream | null;
  /** The original camera track, ready to send over WebRTC. */
  getTrack: () => MediaStreamTrack | null;
};

type Props = {
  settings: BeautySettings;
  /** Preferred portrait capture dimensions. */
  width?: number;
  height?: number;
  className?: string;
  /** Called when the camera track is (re)created — swap it into Daily. */
  onProcessedTrack?: (track: MediaStreamTrack | null) => void;
  active?: boolean; // when false, releases camera
  mirror?: boolean;
  /** "user" (front) or "environment" (back) camera. */
  facingMode?: "user" | "environment";
};

/**
 * Opens the device camera and renders its MediaStream directly. The outgoing
 * WebRTC track is the original camera track: no canvas resampling, digital zoom,
 * crop transform, or fixed-size intermediate buffer is introduced.
 */
export const BeautyCamera = forwardRef<BeautyCameraHandle, Props>(function BeautyCamera(
  { settings, width = 1080, height = 1920, className, onProcessedTrack, active = true, mirror = true, facingMode = "user" },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooClose, setTooClose] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const hintTimerRef = useRef<number | null>(null);
  const native = isNativeApp();



  /**
   * When the device exposes no zoom control we can still coach framing: if a
   * detected face covers more than ~40% of the frame (TikTok-like framing keeps
   * the face around 30%), nudge the host back.
   */
  const startFaceDistanceHint = (video: HTMLVideoElement) => {
    const Detector = (window as any).FaceDetector;
    if (!Detector) return;
    let detector: any;
    try {
      detector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      return;
    }
    const tick = async () => {
      try {
        const faces = await detector.detect(video);
        const box = faces?.[0]?.boundingBox;
        if (box && video.videoWidth && video.videoHeight) {
          const coverage = Math.max(
            box.width / video.videoWidth,
            box.height / video.videoHeight,
          );
          setTooClose(coverage > 0.4);
        } else {
          setTooClose(false);
        }
      } catch {
        /* ignore detection errors */
      }
    };
    hintTimerRef.current = window.setInterval(tick, 1500);
  };

  useEffect(
    () => () => {
      if (hintTimerRef.current) window.clearInterval(hintTimerRef.current);
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    getStream: () => rawStreamRef.current,
    getTrack: () => rawStreamRef.current?.getVideoTracks()[0] ?? null,
  }));

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported in this browser");
        }
        // Do not constrain aspectRatio on mobile web. Chrome may satisfy a 9:16
        // or 3:4 request by digitally cropping the sensor before we receive the
        // track, which looks like an unwanted camera zoom. Ask for the front
        // camera's natural stream and let CSS handle the portrait viewport.
        const nativePortraitAttempts: MediaStreamConstraints[] = native
          ? [
              {
                video: {
                  width: { ideal: width },
                  height: { ideal: height },
                  aspectRatio: { ideal: 9 / 16 },
                  frameRate: { ideal: 30, min: 24 },
                  facingMode: { ideal: facingMode },
                },
                audio: false,
              },
            ]
          : [];
        const attempts: MediaStreamConstraints[] = [
          ...nativePortraitAttempts,
          {
            video: {
              width: { ideal: 1080 },
              frameRate: { ideal: 30, min: 24 },
              facingMode: { ideal: facingMode },
            },
            audio: false,
          },
          {
            video: {
              width: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: { ideal: facingMode },
            },
            audio: false,
          },
          {
            video: { facingMode: { ideal: facingMode } },
            audio: false,
          },
          { video: true, audio: false },
        ];


        let stream: MediaStream | null = null;
        let lastErr: any = null;
        for (const c of attempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(c);
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (!stream) throw lastErr ?? new Error("Camera unavailable");
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        rawStreamRef.current = stream;
        setStream(stream);
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve) => {
          if (video.readyState >= HTMLMediaElement.HAVE_METADATA) resolve();
          else video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
        await video.play();

        const track = stream.getVideoTracks()[0] ?? null;

        // Widest available field of view: many phones default to a tight crop on
        // the selfie camera. Ask the hardware for its minimum zoom when exposed.
        try {
          const caps: any = track?.getCapabilities?.() ?? {};
          if (track && caps.zoom && typeof caps.zoom.min === "number") {
            await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] } as any);
          }
        } catch {
          /* zoom unsupported — fall back to the face-distance hint below */
        }

        const trackSettings = track?.getSettings();
        const actualWidth = video.videoWidth || trackSettings?.width || 0;
        const actualHeight = video.videoHeight || trackSettings?.height || 0;
        const actualRatio = actualHeight > 0 ? actualWidth / actualHeight : 9 / 16;
        console.info("Live camera capture", {
          width: actualWidth,
          height: actualHeight,
          aspectRatio: actualRatio,
          facingMode: trackSettings?.facingMode,
        });
        onProcessedTrack?.(track);
        if (!native) startFaceDistanceHint(video);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      onProcessedTrack?.(null);
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
      setStream(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, facingMode]);

  return (
    <div
      className={className ?? "absolute inset-0 h-full w-full overflow-hidden bg-black"}
    >
      <StageVideo
        videoRef={videoRef}
        stream={stream}
        muted
        mirror={mirror}
        filter={beautyFilterCss(settings)}
        className="absolute inset-0 h-full w-full overflow-hidden bg-black"
      />

      {tooClose && !native && !error && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-[3] -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-[11px] text-white/90 backdrop-blur-sm">
          Move your phone slightly farther away
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-white/80 p-4">
          {error}
        </div>
      )}
    </div>
  );
});
