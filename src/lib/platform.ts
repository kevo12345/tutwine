/**
 * Runtime platform helpers.
 *
 * The live experience needs a true portrait camera track to fill a 9:16 stage
 * without cropping the subject. Mobile browsers cannot guarantee that: they
 * hand back a landscape/4:3 sensor track and `object-fit: cover` then has to
 * crop hard. Inside the native shell (Capacitor on iOS/Android) the WebView is
 * locked to portrait and the camera delivers a real portrait track, so we can
 * safely fill edge-to-edge.
 */

export function isNativeApp(): boolean {
  try {
    const cap = (globalThis as any).Capacitor;
    return Boolean(cap?.isNativePlatform?.() ?? cap?.isNative);
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  try {
    const p = (globalThis as any).Capacitor?.getPlatform?.();
    return p === "ios" || p === "android" ? p : "web";
  } catch {
    return "web";
  }
}
