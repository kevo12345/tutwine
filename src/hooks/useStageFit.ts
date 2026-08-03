import { useEffect, useRef, useState } from "react";

/**
 * Automatic aspect-ratio matching for a video stage.
 *
 * Measures the stage element and compares its ratio with the camera/remote
 * track's real ratio:
 *
 * - Portrait source (e.g. full-sensor 3:4) on a tall stage → `cover`. The whole
 *   vertical field of view is kept and only the sides are trimmed, so framing
 *   stays natural (no face zoom) while filling the screen edge-to-edge.
 * - Landscape source (what some browsers hand back) → `contain`, because
 *   cropping it into a 9:16 stage would blow the subject up massively.
 */
export function useStageFit(trackRatio: number | null) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageRatio, setStageRatio] = useState<number | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setStageRatio(width / height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  let objectFit: "cover" | "contain" = "cover";
  if (trackRatio !== null) {
    const stageIsPortrait = stageRatio === null || stageRatio < 1;
    objectFit = trackRatio > 1 && stageIsPortrait ? "contain" : "cover";
  }

  return { stageRef, stageRatio, objectFit };
}

