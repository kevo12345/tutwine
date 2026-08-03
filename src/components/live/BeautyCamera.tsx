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
  /** "user" (front) or "environment" (back) camera. */
  facingMode?: "user" | "environment";
  /** Digital zoom for the subject layer. 1 = full 9:16 cover fit. */
  /** Values below 1 shrink the subject inside a full-bleed background. */
  zoom?: number;

};


/**
 * Renders the local camera into a canvas with real-time beauty filters and
 * exposes the resulting processed MediaStreamTrack for broadcasting.
 * Uses lightweight CSS canvas filters (blur/brightness/saturate/contrast) plus
 * an optional subtle horizontal squeeze for "face slimming" and a soft central
 * sharpening zone for "eye enhancement" — no ML.
 */
export const BeautyCamera = forwardRef<BeautyCameraHandle, Props>(function BeautyCamera(
  { settings, width = 1080, height = 1920, className, onProcessedTrack, active = true, mirror = true, facingMode = "user", zoom = 1 },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const zoomRef = useRef(zoom);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getStream: () => processedStreamRef.current,
    getTrack: () => processedStreamRef.current?.getVideoTracks()[0] ?? null,
  }));

  // Keep latest settings for the rAF loop without re-subscribing.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Live-updatable zoom (read by the rAF loop without restarting the camera).
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported in this browser");
        }
        // Try an ideal portrait frame first, then progressively relax so a
        // camera that can't honour the hints still opens.
        const attempts: MediaStreamConstraints[] = [
          {
            video: {
              width: { ideal: width },
              height: { ideal: height },
              facingMode,
            },
            audio: false,
          },
          { video: { facingMode }, audio: false },
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
        const video = videoRef.current!;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play().catch(() => {});

        const canvas = canvasRef.current!;
        const TARGET_ASPECT = width / height; // 9:16
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { desynchronized: true });
        if (!ctx) throw new Error("Canvas 2D unavailable");


        const render = () => {
          if (cancelled) return;
          const st = settingsRef.current;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) {
            rafRef.current = requestAnimationFrame(render);
            return;
          }

          // Fixed 9:16 output (1080x1920), TikTok-style: the camera frame is
          // *cover* fitted so it always fills the frame edge-to-edge.
          const outW = width;
          const outH = height;
          if (canvas.width !== outW || canvas.height !== outH) {
            canvas.width = outW;
            canvas.height = outH;
          }

          const z = Math.max(0.3, Math.min(3, zoomRef.current || 1));
          const fit = Math.max(outW / vw, outH / vh);

          // Full-bleed background layer keeps the frame filled edge-to-edge
          // even when the subject layer is scaled below 1x.
          if (z < 1) {
            const bgW = vw * fit * 1.08;
            const bgH = vh * fit * 1.08;
            ctx.save();
            ctx.filter = "blur(24px) brightness(0.75) saturate(1.1)";
            ctx.drawImage(video, (outW - bgW) / 2, (outH - bgH) / 2, bgW, bgH);
            ctx.restore();
          }

          const scale = fit * z;
          let dw = vw * scale;
          const dh = vh * scale;
          if (st.enabled && st.faceSlim > 0) {
            // subtle horizontal squeeze up to ~7% at max
            dw *= 1 - (st.faceSlim / 100) * 0.07;
          }
          const dx = (outW - dw) / 2;
          const dy = (outH - dh) / 2;


          ctx.save();
          if (z < 1) {
            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 48;
          }
          ctx.filter = beautyFilterCss(st);
          ctx.drawImage(video, dx, dy, dw, dh);
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
  }, [active, facingMode]);

  return (
    <div className={className ?? "absolute inset-0 h-full w-full bg-black"}>
      <video
        ref={videoRef}
        className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          transform: mirror ? "scaleX(-1)" : undefined,
        }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-white/80 p-4">
          {error}
        </div>
      )}
    </div>
  );
});
