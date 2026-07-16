export type BeautySettings = {
  enabled: boolean;
  smoothing: number;   // 0..100  (blur px = smoothing/25)
  brightness: number;  // 0..200  (%)
  skinTone: number;    // 0..200  (saturation %)
  sharpness: number;   // 0..200  (contrast %)
  faceSlim: number;    // 0..100  (horizontal squeeze %)
  eyeEnhance: number;  // 0..100  (central sharpening intensity)
};

export const DEFAULT_BEAUTY: BeautySettings = {
  enabled: false,
  smoothing: 30,
  brightness: 105,
  skinTone: 105,
  sharpness: 105,
  faceSlim: 0,
  eyeEnhance: 0,
};

const STORAGE_KEY = "tutwine.beauty.v1";

export function loadBeauty(): BeautySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BEAUTY };
    return { ...DEFAULT_BEAUTY, ...(JSON.parse(raw) as Partial<BeautySettings>) };
  } catch {
    return { ...DEFAULT_BEAUTY };
  }
}

export function saveBeauty(s: BeautySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Build the CSS `filter` string applied to the drawn frame. */
export function beautyFilterCss(s: BeautySettings): string {
  if (!s.enabled) return "none";
  const blur = (s.smoothing / 25).toFixed(2); // 0..4 px
  return `blur(${blur}px) brightness(${s.brightness}%) saturate(${s.skinTone}%) contrast(${s.sharpness}%)`;
}
