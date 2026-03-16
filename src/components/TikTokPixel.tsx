import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    TiktokAnalyticsObject?: string;
    ttq?: TikTokPixelQueue;
  }
}

type TikTokMethod =
  | "page"
  | "track"
  | "identify"
  | "instances"
  | "debug"
  | "on"
  | "off"
  | "once"
  | "ready"
  | "alias"
  | "group"
  | "enableCookie"
  | "disableCookie"
  | "holdConsent"
  | "revokeConsent"
  | "grantConsent";

type TikTokQueuedCall = [TikTokMethod, ...unknown[]];
type TikTokDeferredMethod = (...args: unknown[]) => void;

type TikTokPixelInstance = TikTokQueuedCall[] & {
  push: (...items: TikTokQueuedCall[]) => number;
} & Partial<Record<TikTokMethod, TikTokDeferredMethod>> & {
  [key: string]: unknown;
};

type TikTokPixelQueue = TikTokPixelInstance & {
  methods?: TikTokMethod[];
  setAndDefer?: (target: TikTokPixelInstance, method: TikTokMethod) => void;
  instance?: (id: string) => TikTokPixelInstance;
  load?: (id: string, options?: Record<string, unknown>) => void;
  _i?: Record<string, TikTokPixelInstance>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
};

const TIKTOK_PIXEL_ID = "D6RVESJC77UC6S37IFM0";
const TIKTOK_SCRIPT_ID = "tiktok-pixel-script";

function createQueue(): TikTokPixelInstance {
  const queue = [] as unknown as TikTokPixelInstance;
  queue.push = Array.prototype.push as (...items: TikTokQueuedCall[]) => number;
  return queue;
}

function loadTikTokPixel() {
  if (typeof window === "undefined") return;

  (function (w: Window & typeof globalThis, d: Document, t: "ttq") {
    w.TiktokAnalyticsObject = t;

    const ttq = (w[t] as TikTokPixelQueue | undefined) ?? createQueue();
    w[t] = ttq;

    if (!ttq.methods) {
      ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
        "holdConsent",
        "revokeConsent",
        "grantConsent",
      ];
    }

    ttq.setAndDefer = (target: TikTokPixelInstance, method: TikTokMethod) => {
      target[method] = (...args: unknown[]) => {
        target.push([method, ...args]);
      };
    };

    for (const method of ttq.methods) {
      if (typeof ttq[method] !== "function") {
        ttq.setAndDefer(ttq, method);
      }
    }

    ttq.instance = (id: string) => {
      ttq._i = ttq._i || {};
      const instance = ttq._i[id] ?? createQueue();
      ttq._i[id] = instance;

      for (const method of ttq.methods ?? []) {
        if (typeof instance[method] !== "function") {
          ttq.setAndDefer?.(instance, method);
        }
      }

      return instance;
    };

    ttq.load = (id: string, options?: Record<string, unknown>) => {
      const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
      const existingScript = d.getElementById(TIKTOK_SCRIPT_ID) as HTMLScriptElement | null;

      ttq._i = ttq._i || {};
      ttq._i[id] = ttq._i[id] || createQueue();
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};

      if (existingScript) return;

      const script = d.createElement("script");
      script.id = TIKTOK_SCRIPT_ID;
      script.type = "text/javascript";
      script.async = true;
      script.src = `${src}?sdkid=${id}&lib=${t}`;

      const firstScript = d.getElementsByTagName("script")[0];
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        d.head.appendChild(script);
      }
    };

    ttq.load(TIKTOK_PIXEL_ID);
  })(window, document, "ttq");
}

export function TikTokPixel() {
  const location = useLocation();

  useEffect(() => {
    loadTikTokPixel();
    window.ttq?.page?.();
  }, []);

  useEffect(() => {
    window.ttq?.page?.();
  }, [location.pathname, location.search, location.hash]);

  return null;
}
