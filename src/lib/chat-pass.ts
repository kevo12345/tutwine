export const CHAT_PASS_COINS = 1;
export const CHAT_PASS_HOURS = 12;
export function isChatPassActive(expiresAt: string | null | undefined, now = Date.now()): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() > now;
}