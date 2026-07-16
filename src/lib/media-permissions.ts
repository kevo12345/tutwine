import { toast } from "sonner";

/**
 * Prompt the browser for camera + microphone permissions from within a user gesture.
 * Immediately releases the tracks — Daily.co will re-acquire them inside the iframe,
 * but the permission grant persists for the origin so the room can connect reliably.
 *
 * MUST be called synchronously inside a click/tap handler (no awaits before it),
 * otherwise Safari/iOS will silently reject the request.
 */
export async function requestAvPermissions(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    toast.error("Your browser doesn't support camera access");
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err: any) {
    const name = err?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      toast.error("Camera & mic blocked — allow access in your browser settings");
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      toast.error("No camera or microphone found on this device");
    } else if (name === "NotReadableError") {
      toast.error("Camera is in use by another app — close it and try again");
    } else {
      toast.error("Could not access camera & mic");
    }
    return false;
  }
}
