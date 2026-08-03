import { useEffect } from "react";

/**
 * Keeps the CSS variable `--live-h` in sync with the real visible viewport
 * height (visualViewport when available). `100dvh` is unreliable on iOS Safari
 * while the toolbars collapse/expand, which leaves the live stage slightly
 * short or overflowing. Using a measured pixel value guarantees an exact
 * full-screen fit on every device.
 */
export function useViewportStageHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const vv = window.visualViewport;
      const h = Math.round(vv?.height ?? window.innerHeight);
      const w = Math.round(vv?.width ?? window.innerWidth);
      root.style.setProperty("--live-h", `${h}px`);
      root.style.setProperty("--live-w", `${w}px`);
    };
    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--live-h");
      root.style.removeProperty("--live-w");
    };
  }, []);
}
