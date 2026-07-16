import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BeautySettings, beautyFilterCss } from "@/lib/beautyFilter";

export type BeautyCameraHandle = {
  /** The processed (filtered) MediaStream. May change identity if source changes. */
  getStream: () => MediaStream | null;
  /** The processed video track, ready to send over WebRTC. */
  getTrack: () => MediaStreamTrack | null;
};

type Props = {
  settings: BeautySettings;
  /** Optional constraints applied to getUserMedia. */
  width?: number;
  height?: number;
  className?: string;
  /** Called when the processed track is (re)created — swap it into your peer/Daily. */
  onProcessedTrack?: (track: MediaStreamTrack | null) => void;
  active?: boolean; // when false, releases camera
  mirror?: boolean;
};

/**
 * Renders the local camera into a canvas with real-time beauty filters and
 * exposes the resulting processed MediaStreamTrack for broadcasting.
 * Uses lightweight CSS canvas filters (blur/brightness/saturate/contrast) plus
 * an optional subtle horizontal squeeze for "face slimming" and a soft central
 * sharpening zone for "eye enhancement" — no ML.
 */
export const BeautyCamera = forwardRef<BeautyCameraHandle, Props>(function BeautyCamera(
  { settings, width = 720, height = 1280, className, onProcessedTrack, active = true, mirror = true },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getStream: () => processedStreamRef.current,
    getTrack: () => processedStreamRef.current?.getVideoTracks()[0] ?? null,
  }));

  // Keep latest settings for the rAF loop without re-subscribing.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode: "user",
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        rawStreamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});

        const canvas = canvasRef.current!;
        const track = stream.getVideoTracks()[0];
        const s = track.getSettings();
        canvas.width = s.width ?? width;
        canvas.height = s.height ?? height;
        const ctx = canvas.getContext("2d", { desynchronized: true });
        if (!ctx) throw new Error("Canvas 2D unavailable");

        const render = () => {
          if (cancelled) return;
          const st = settingsRef.current;
          const vw = video.videoWidth || canvas.width;
          const vh = video.videoHeight || canvas.height;
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }
          ctx.save();
          ctx.filter = beautyFilterCss(st);
          if (st.enabled && st.faceSlim > 0) {
            // subtle horizontal squeeze up to ~7% at max
            const squeeze = 1 - (st.faceSlim / 100) * 0.07;
            const dw = canvas.width * squeeze;
            const dx = (canvas.width - dw) / 2;
            ctx.drawImage(video, dx, 0, dw, canvas.height);
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          ctx.restore();

          if (st.enabled && st.eyeEnhance > 0) {
            // gentle central "vignette" contrast bump — no ML face detection
            ctx.save();
            const alpha = (st.eyeEnhance / 100) * 0.18;
            ctx.globalCompositeOperation = "overlay";
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            const rx = canvas.width * 0.35;
            const ry = canvas.height * 0.12;
            const cx = canvas.width / 2;
            const cy = canvas.height * 0.4;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          rafRef.current = requestAnimationFrame(render);
        };
        render();

        const processed = (canvas as HTMLCanvasElement).captureStream(30);
        processedStreamRef.current = processed;
        onProcessedTrack?.(processed.getVideoTracks()[0] ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      onProcessedTrack?.(null);
      processedStreamRef.current?.getTracks().forEach((t) => t.stop());
      processedStreamRef.current = null;
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className={className ?? "relative h-full w-full bg-black"}>
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover"
        style={{ transform: mirror ? "scaleX(-1)" : undefined }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-white/80 p-4">
          {error}
        </div>
      )}
    </div>
  );
});
