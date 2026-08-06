import { CSSProperties, RefObject, useEffect } from "react";

type Props = {
  /** Ref to the foreground video element (owned by the caller for playback control). */
  videoRef: RefObject<HTMLVideoElement>;
  /** Stream to render. */
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  filter?: string;
  className?: string;
};

/**
 * TikTok-style full-bleed video stage.
 *
 * The video always fills the stage edge to edge with `object-fit: cover`, on
 * every platform. iOS hands us a portrait track while Android Chrome usually
 * hands us a landscape one; covering in both cases keeps the experience
 * identical (full-screen, no letterbox bars, no blurred side fill).
 */
export function StageVideo({
  videoRef,
  stream,
  muted = false,
  mirror = false,
  filter,
  className,
}: Props) {
  // Attach the stream to the video element.
  useEffect(() => {
    const fg = videoRef.current;
    if (fg && fg.srcObject !== stream) fg.srcObject = stream;
  }, [stream, videoRef]);

  const mirrorStyle: CSSProperties = mirror ? { transform: "scaleX(-1)" } : {};

  return (
    <div className={className ?? "absolute inset-0 h-full w-full overflow-hidden bg-black"}>
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 z-[1] block h-full w-full object-cover object-center"
        style={{ ...mirrorStyle, filter }}
        playsInline
        autoPlay
        muted={muted}
      />
    </div>
  );
}
