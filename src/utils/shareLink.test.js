import { describe, test, expect } from "vitest";
import { buildShopLink, buildReferralLink, buildDeepLink, buildSellerInviteLink } from "./shareLink";

describe("buildShopLink", () => {
  test("sellerId asosida to'g'ri havola yasaydi", () => {
    expect(buildShopLink("seller123")).toBe("https://t.me/zeloshop_bot/shop?startapp=seller123");
  });

  test("sellerId bo'lmasa bo'sh qator qaytaradi", () => {
    expect(buildShopLink(null)).toBe("");
    expect(buildShopLink(undefined)).toBe("");
  });
});

describe("buildReferralLink", () => {
  test("sellerId va clientId'ni '_r' bilan birlashtiradi", () => {
    expect(buildReferralLink("seller123", "client456")).toBe("https://t.me/zeloshop_bot/shop?startapp=seller123_rclient456");
  });

  test("sellerId yoki clientId bo'lmasa bo'sh qator qaytaradi", () => {
    expect(buildReferralLink(null, "client456")).toBe("");
    expect(buildReferralLink("seller123", null)).toBe("");
  });
});

describe("buildDeepLink", () => {
  test("sellerId va yo'lni base64url kodlab '_p' bilan birlashtiradi", () => {
    const link = buildDeepLink("seller123", "/product/abc");
    expect(link).toMatch(/^https:\/\/t\.me\/zeloshop_bot\/shop\?startapp=seller123_p/);
  });

  test("sellerId yoki yo'l bo'lmasa bo'sh qator qaytaradi", () => {
    expect(buildDeepLink(null, "/product/1")).toBe("");
    expect(buildDeepLink("seller123", null)).toBe("");
  });
});

describe("buildSellerInviteLink", () => {
  test("sellerId'ni '_i' bilan birlashtiradi (sotuvchini taklif qilish formati)", () => {
    expect(buildSellerInviteLink("seller123")).toBe("https://t.me/zeloshop_bot/shop?startapp=seller123_i");
  });

  test("sellerId bo'lmasa bo'sh qator qaytaradi", () => {
    expect(buildSellerInviteLink(null)).toBe("");
    expect(buildSellerInviteLink(undefined)).toBe("");
  });

  test("boshqa formatlar (_r, _p) bilan hech qachon TO'QNASHMAYDI", () => {
    const link = buildSellerInviteLink("seller123");
    const startParam = link.split("startapp=")[1];
    expect(startParam).not.toContain("_r");
    expect(startParam).not.toContain("_p");
    expect(startParam.endsWith("_i")).toBe(true);
  });
});
