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

type TikTokPixelQueue = {
  methods?: TikTokMethod[];
  setAndDefer?: (target: TikTokPixelQueue, method: TikTokMethod) => void;
  instance?: (id: string) => TikTokPixelQueue;
  load?: (id: string, options?: Record<string, unknown>) => void;
  page?: () => void;
  push: (...items: unknown[]) => number;
  _i?: Record<string, TikTokPixelQueue>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

const TIKTOK_PIXEL_ID = "D6RVESJC77UC6S37IFM0";

function loadTikTokPixel() {
  if (typeof window === "undefined" || window.ttq?.instance) {
    return;
  }

  (function (w: Window & typeof globalThis, d: Document, t: "ttq") {
    w.TiktokAnalyticsObject = t;
    const ttq = (w[t] = w[t] || []) as TikTokPixelQueue;
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

    ttq.setAndDefer = function (target: TikTokPixelQueue, method: TikTokMethod) {
      target[method] = function (...args: unknown[]) {
        target.push([method, ...args]);
      };
    };

    for (let i = 0; i < ttq.methods.length; i += 1) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }

    ttq.instance = function (id: string) {
      const instance = ((ttq._i && ttq._i[id]) || ([] as TikTokPixelQueue)) as TikTokPixelQueue;
      for (let i = 0; i < (ttq.methods?.length || 0); i += 1) {
        ttq.setAndDefer?.(instance, ttq.methods![i]);
      }
      return instance;
    };

    ttq.load = function (id: string, options?: Record<string, unknown>) {
      const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
      const firstScript = d.getElementsByTagName("script")[0];
      const script = d.createElement("script");

      ttq._i = ttq._i || {};
      ttq._i[id] = [] as TikTokPixelQueue;
      ttq._i[id]._u = src;
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = options || {};

      script.type = "text/javascript";
      script.async = true;
      script.src = `${src}?sdkid=${id}&lib=${t}`;
      firstScript?.parentNode?.insertBefore(script, firstScript);
    };

    ttq.load(TIKTOK_PIXEL_ID);
  })(window, document, "ttq");
}

export function TikTokPixel() {
  const location = useLocation();

  useEffect(() => {
    loadTikTokPixel();
  }, []);

  useEffect(() => {
    window.ttq?.page?.();
  }, [location.pathname, location.search, location.hash]);

  return null;
}
