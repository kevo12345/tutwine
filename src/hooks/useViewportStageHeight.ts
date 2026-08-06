import { useEffect } from "react";

/**
 * Keeps the CSS variables `--live-h` / `--live-w` in sync with the full-screen
 * live stage size.
 *
 * IMPORTANT: we deliberately do NOT pin the stage to `visualViewport.height`.
 * On Android Chrome (and any browser with dynamic toolbars) the visual viewport
 * is shorter than the layout viewport while the URL bar is showing, so a
 * `position: fixed; inset: 0` stage sized from it renders shorter than the
 * screen — which is exactly the black band that appeared at the top/bottom on
 * Android but not iOS.
 *
 * Instead we let CSS `100dvh` / `100vw` drive the stage (correct on every
 * modern browser) and only override with a measured pixel height when the
 * on-screen keyboard is open, so the composer stays reachable.
 */
export function useViewportStageHeight() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const layoutH = window.innerHeight;
      const visualH = Math.round(vv?.height ?? layoutH);
      // A gap larger than ~15% of the screen means the keyboard (not a
      // collapsing toolbar) is covering the viewport.
      const keyboardOpen = layoutH - visualH > Math.max(120, layoutH * 0.15);

      if (keyboardOpen) {
        root.style.setProperty("--live-h", `${visualH}px`);
      } else {
        root.style.removeProperty("--live-h");
      }
      root.style.removeProperty("--live-w");
    };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--live-h");
      root.style.removeProperty("--live-w");
    };
  }, []);
}
