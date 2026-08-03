import { useEffect, useState } from "react";

/**
 * True only on phone-class devices (mobile/tablet UA + touch input, or a narrow
 * touch viewport). Used to gate the live streaming experience, which is
 * portrait/camera-first and not supported on desktop.
 */
export function useIsPhone(): boolean | null {
  const [isPhone, setIsPhone] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || "";
      const mobileUa = /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);
      // iPadOS 13+ reports as Mac but exposes touch points
      const iPadOS = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = Math.min(window.innerWidth, window.innerHeight) <= 900;
      setIsPhone((mobileUa || iPadOS || (coarse && narrow)) && narrow);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isPhone;
}
