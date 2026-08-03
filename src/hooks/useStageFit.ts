import { useEffect, useRef, useState } from "react";

/**
 * Automatic aspect-ratio matching for a video stage.
 *
 * Measures the stage element and compares its ratio with the camera/remote
 * track's real ratio. When the two are close (within `tolerance`), `cover`
 * fills the screen without any visible crop or zoom. When they diverge —
 * e.g. a landscape or 3:4 track on a tall 9:16 phone — `contain` is used so
 * the subject keeps its true framing instead of being blown up and cropped.
 */
export function useStageFit(trackRatio: number | null, tolerance = 0.12) {
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
  if (trackRatio !== null && stageRatio !== null) {
    const diff = Math.abs(trackRatio - stageRatio) / stageRatio;
    objectFit = diff <= tolerance ? "cover" : "contain";
  }

  return { stageRef, stageRatio, objectFit };
}
