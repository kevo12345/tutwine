import { registerSW } from "virtual:pwa-register";

// Forces every client onto the newest published build.
// - New service worker takes control immediately (skipWaiting + clientsClaim)
// - We reload once the new worker is active so users never sit on stale assets
export function setupForcedUpdates() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Activate the new worker right away, then reload.
      void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      const check = () => {
        if (document.visibilityState === "visible" && navigator.onLine) {
          registration.update().catch(() => {});
        }
      };

      // Check on load, on focus/visibility, and every 60s.
      check();
      document.addEventListener("visibilitychange", check);
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
      setInterval(check, 60_000);
    },
  });

  // When the new worker takes control, reload to pick up fresh assets.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadOnce();
  });
}
