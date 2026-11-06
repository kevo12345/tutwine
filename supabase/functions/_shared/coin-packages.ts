export const COIN_PRESETS = [3, 5, 10, 20];
export const CUSTOM_COIN_MIN = 15;
export function isValidCoinPurchase(amount: number): boolean {
  return Number.isSafeInteger(amount) && (COIN_PRESETS.includes(amount) || amount >= CUSTOM_COIN_MIN);
}