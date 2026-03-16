import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq?: MetaPixelFn & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => number;
    };
    _fbq?: Window["fbq"];
  }
}

type MetaPixelFn = (...args: unknown[]) => void;

const META_PIXEL_ID = "1629305128017190";
const META_SCRIPT_ID = "meta-pixel-script";

function loadMetaPixel() {
  if (typeof window === "undefined" || window.fbq) return;

  ((f: Window & typeof globalThis, b: Document, e: "script", v: string) => {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue = fbq.queue || [];
        fbq.queue.push(args);
      }
    } as Window["fbq"];

    if (f._fbq) return;

    fbq.push = (...args: unknown[]) => {
      fbq.queue = fbq.queue || [];
      return fbq.queue.push(args);
    };
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];

    f.fbq = fbq;
    f._fbq = fbq;

    if (b.getElementById(META_SCRIPT_ID)) return;

    const script = b.createElement(e);
    script.id = META_SCRIPT_ID;
    script.async = true;
    script.src = v;

    const firstScript = b.getElementsByTagName(e)[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      b.head.appendChild(script);
    }
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq?.("init", META_PIXEL_ID);
}

export function MetaPixel() {
  const location = useLocation();

  useEffect(() => {
    loadMetaPixel();
    window.fbq?.("track", "PageView");
  }, []);

  useEffect(() => {
    window.fbq?.("track", "PageView");
  }, [location.pathname, location.search, location.hash]);

  return null;
}
