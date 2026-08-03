import { CSSProperties, RefObject, useEffect, useRef, useState } from "react";

type Props = {
  /** Ref to the foreground video element (owned by the caller for playback control). */
  videoRef: RefObject<HTMLVideoElement>;
  /** Stream to render. Also mirrored into the blurred backdrop layer. */
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  filter?: string;
  className?: string;
};

/**
 * TikTok-style full-bleed video stage.
 *
 * The stage always fills its (viewport-sized) container edge to edge. The video
 * uses `object-fit: cover` so there are never black bars, but when the source
 * track is much wider than the portrait viewport (e.g. a 16:9 webcam track on a
 * 9:16 phone) covering would crop away most of the frame and look like an
 * extreme zoom. In that case we fall back to `contain` for the subject and fill
 * the remaining area with a blurred, scaled copy of the same stream — so the
 * screen is still edge-to-edge with no letterboxing, and the subject keeps its
 * natural framing.
 */
const MAX_COVER_CROP = 1.35; // allow at most ~35% linear up-scale before switching

export function StageVideo({
  videoRef,
  stream,
  muted = false,
  mirror = false,
  filter,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const [fitContain, setFitContain] = useState(false);

  // Attach the stream to both layers.
  useEffect(() => {
    const fg = videoRef.current;
    const bg = bgRef.current;
    if (fg && fg.srcObject !== stream) fg.srcObject = stream;
    if (bg && bg.srcObject !== stream) {
      bg.srcObject = stream;
      bg.play().catch(() => {});
    }
  }, [stream, videoRef]);

  // Decide cover vs blurred-contain from the real track ratio and stage ratio.
  useEffect(() => {
    const evaluate = () => {
      const video = videoRef.current;
      const el = containerRef.current;
      if (!video || !el) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!vw || !vh || !cw || !ch) return;
      const coverScale = Math.max(cw / vw, ch / vh) / Math.min(cw / vw, ch / vh);
      setFitContain(coverScale > MAX_COVER_CROP);
    };

    const video = videoRef.current;
    video?.addEventListener("loadedmetadata", evaluate);
    video?.addEventListener("resize", evaluate);
    const ro = new ResizeObserver(evaluate);
    if (containerRef.current) ro.observe(containerRef.current);
    const t = window.setInterval(evaluate, 1000);
    evaluate();
    return () => {
      video?.removeEventListener("loadedmetadata", evaluate);
      video?.removeEventListener("resize", evaluate);
      ro.disconnect();
      window.clearInterval(t);
    };
  }, [stream, videoRef]);

  const mirrorStyle: CSSProperties = mirror ? { transform: "scaleX(-1)" } : {};

  return (
    <div
      ref={containerRef}
      className={className ?? "absolute inset-0 h-full w-full overflow-hidden bg-black"}
    >
      {/* Blurred fill so the stage is edge-to-edge without letterbox bars */}
      {fitContain && (
        <video
          ref={bgRef}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-125 object-cover object-center blur-2xl"
          style={mirrorStyle}
          playsInline
          autoPlay
          muted
        />
      )}

      <video
        ref={videoRef}
        className={`pointer-events-none absolute inset-0 z-[1] block h-full w-full object-center ${
          fitContain ? "object-contain" : "object-cover"
        }`}
        style={{ ...mirrorStyle, filter }}
        playsInline
        autoPlay
        muted={muted}
      />
    </div>
  );
}
