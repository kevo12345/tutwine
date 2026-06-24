export const TIER_LIMITS = {
  free: { profileViews: Infinity, likes: Infinity, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: false, adFree: false },
  simp: { profileViews: Infinity, likes: Infinity, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: false, adFree: true },
  basic: { profileViews: Infinity, likes: Infinity, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: false, adFree: true },
  plus: { profileViews: Infinity, likes: Infinity, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: true, adFree: true },
  pro: { profileViews: Infinity, likes: Infinity, seeWhoLiked: true, superLike: true, undoSwipe: true, readReceipts: true, videoChat: true, priorityDiscovery: true, advancedFilters: true, adFree: true },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

export const TIER_PRICES = {
  simp: { usd: 1.5, label: "Simp" },
  basic: { usd: 3, label: "Basic" },
  plus: { usd: 5, label: "Plus" },
  pro: { usd: 12, label: "Pro" },
} as const;

export const GENDER_OPTIONS = ["Man", "Woman", "Non-binary", "Other"] as const;
export const INTEREST_TAGS = [
  "Travel", "Music", "Fitness", "Gaming", "Cooking",
  "Art", "Reading", "Movies", "Hiking", "Photography",
  "Dancing", "Yoga", "Tech", "Fashion", "Pets",
  "Coffee", "Wine", "Sports", "Nature", "Meditation",
] as const;

export const DISTANCE_OPTIONS = [5, 10, 20, 50, 100] as const;
export const AGE_RANGE = { min: 18, max: 80 } as const;

// ===== Go Live pricing =====
// Hours 1–2 cost $1.50 each. Hours 3+ cost $0.35 each.
export const LIVE_DURATION_OPTIONS = [1, 2, 3, 5, 10] as const;
export type LiveDurationHours = (typeof LIVE_DURATION_OPTIONS)[number];

export function priceForLiveHours(hours: number): number {
  const h = Math.max(1, Math.floor(hours));
  const base = Math.min(h, 2) * 1.5;
  const extra = Math.max(0, h - 2) * 0.35;
  return Math.round((base + extra) * 100) / 100;
}
