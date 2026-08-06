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

// ===== Coin value =====
// 1 coin (token) = $0.25 — so $1 buys 4 coins.
export const TOKEN_USD = 0.25;
export const TOKENS_PER_USD = 1 / TOKEN_USD; // 4

/** USD cost of a given number of coins. */
export function tokensToUsd(tokens: number): number {
  return Math.round(Math.max(0, tokens) * TOKEN_USD * 100) / 100;
}

/** Formatted USD cost of a given number of coins, e.g. "$0.25". */
export function formatTokensUsd(tokens: number): string {
  return `$${tokensToUsd(tokens).toFixed(2)}`;
}

// ===== Go Live pricing =====
// Joining a live costs 1 coin per hour ($0.25/hr). Hosting is free.
export const LIVE_DURATION_OPTIONS = [1, 2, 3, 5, 10] as const;
export type LiveDurationHours = (typeof LIVE_DURATION_OPTIONS)[number];

/** Coins charged for a given number of hours of live access. */
export function priceForLiveHours(hours: number): number {
  const h = Math.max(1, Math.floor(hours));
  return h * 1;
}
