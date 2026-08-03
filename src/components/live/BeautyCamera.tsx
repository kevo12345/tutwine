import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BeautySettings, beautyFilterCss } from "@/lib/beautyFilter";

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
  { settings, width = 720, height = 1280, className, onProcessedTrack, active = true, mirror = true, facingMode = "user" },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portraitStream, setPortraitStream] = useState(true);

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
        // Prefer a native portrait track. `aspectRatio` is important: width and
        // height alone are treated as loose hints by Safari and Chrome.
        const attempts: MediaStreamConstraints[] = [
          {
            video: {
              width: { ideal: width, min: 720 },
              height: { ideal: height, min: 1280 },
              aspectRatio: { ideal: 9 / 16 },
              frameRate: { ideal: 30, min: 24 },
              facingMode: { ideal: facingMode },
            },
            audio: false,
          },
          {
            video: {
              width: { ideal: 720 },
              height: { ideal: 1280 },
              aspectRatio: { ideal: 9 / 16 },
              frameRate: { ideal: 30 },
              facingMode: { ideal: facingMode },
            },
            audio: false,
          },
          {
            video: {
              aspectRatio: { ideal: 9 / 16 },
              facingMode: { ideal: facingMode },
            },
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
        const trackSettings = track?.getSettings();
        const actualWidth = video.videoWidth || trackSettings?.width || 0;
        const actualHeight = video.videoHeight || trackSettings?.height || 0;
        const actualRatio = actualHeight > 0 ? actualWidth / actualHeight : 9 / 16;
        // Only use cover when the browser really supplied a portrait stream.
        // A landscape fallback with cover is what creates the giant face crop.
        setPortraitStream(actualRatio <= 0.75);
        console.info("Live camera capture", {
          width: actualWidth,
          height: actualHeight,
          aspectRatio: actualRatio,
          facingMode: trackSettings?.facingMode,
        });
        onProcessedTrack?.(track);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      onProcessedTrack?.(null);
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, facingMode]);

  return (
    <div className={className ?? "absolute inset-0 h-full w-full bg-black"}>
      <video
        ref={videoRef}
        className={`pointer-events-none absolute inset-0 block h-full w-full ${portraitStream ? "object-cover" : "object-contain"}`}
        style={{
          filter: beautyFilterCss(settings),
          transform: mirror ? "scaleX(-1)" : undefined,
        }}
        playsInline
        muted
        autoPlay
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-white/80 p-4">
          {error}
        </div>
      )}
    </div>
  );
});
