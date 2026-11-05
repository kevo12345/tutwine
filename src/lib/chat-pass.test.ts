import { describe, expect, it } from "vitest";
import { CHAT_PASS_COINS, CHAT_PASS_HOURS, isChatPassActive } from "./chat-pass";
import { COIN_PRESETS, CUSTOM_COIN_MIN, isValidCoinPurchase } from "../../supabase/functions/_shared/coin-packages";
import { tokensToUsd } from "./constants";

describe("chat pass rules", () => {
  it("costs exactly one coin worth $0.25", () => {
    expect(CHAT_PASS_COINS).toBe(1);
    expect(tokensToUsd(CHAT_PASS_COINS)).toBe(0.25);
  });
  it("expires exactly twelve hours after activation", () => {
    expect(CHAT_PASS_HOURS).toBe(12);
    const start = Date.parse("2026-11-05T12:00:00Z");
    const expiry = new Date(start + CHAT_PASS_HOURS * 3600000).toISOString();
    expect(isChatPassActive(expiry, start + 43199999)).toBe(true);
    expect(isChatPassActive(expiry, start + 43200000)).toBe(false);
    expect(isChatPassActive(null, start)).toBe(false);
  });
  it("allows buying 1, 3, 5 and 10 coins", () => {
    expect(COIN_PRESETS).toEqual([1, 3, 5, 10]);
    for (const amount of [1, 3, 5, 10]) expect(isValidCoinPurchase(amount)).toBe(true);
  });
  it("keeps custom purchases at fifteen whole coins or more", () => {
    expect(CUSTOM_COIN_MIN).toBe(15);
    for (const amount of [0, 2, 4, 11, 14, 15.5, Infinity]) expect(isValidCoinPurchase(amount)).toBe(false);
    expect(isValidCoinPurchase(15)).toBe(true);
    expect(isValidCoinPurchase(16)).toBe(true);
  });
});