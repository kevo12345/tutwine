export const TIER_LIMITS = {
  free: { profileViews: Infinity, likes: Infinity, boosts: 0, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: false, adFree: false },
  basic: { profileViews: Infinity, likes: Infinity, boosts: 0, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: false, adFree: true },
  plus: { profileViews: Infinity, likes: Infinity, boosts: 1, seeWhoLiked: false, superLike: false, undoSwipe: false, readReceipts: false, videoChat: false, priorityDiscovery: false, advancedFilters: true, adFree: true },
  pro: { profileViews: Infinity, likes: Infinity, boosts: 7, seeWhoLiked: true, superLike: true, undoSwipe: true, readReceipts: true, videoChat: true, priorityDiscovery: true, advancedFilters: true, adFree: true },
} as const;

export type Tier = keyof typeof TIER_LIMITS;

export const TIER_PRICES = {
  basic: { usd: 3, label: "Basic" },
  plus: { usd: 5, label: "Plus" },
  pro: { usd: 10, label: "Pro" },
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
