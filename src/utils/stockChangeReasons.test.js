import { describe, test, expect } from "vitest";
import { CLIENT_STOCK_CHANGE_REASONS, STOCK_CHANGE_REASON_LABEL_KEYS, getStockChangeReasonLabelKey } from "./stockChangeReasons";

describe("CLIENT_STOCK_CHANGE_REASONS", () => {
  test("'order_sale' mijoz tanlashi mumkin bo'lgan ro'yxatda YO'Q (faqat server yoza oladi)", () => {
    expect(CLIENT_STOCK_CHANGE_REASONS).not.toContain("order_sale");
  });

  test("har bir sababning i18n kaliti mavjud", () => {
    CLIENT_STOCK_CHANGE_REASONS.forEach((reason) => {
      expect(STOCK_CHANGE_REASON_LABEL_KEYS[reason]).toBeTruthy();
    });
  });
});

describe("getStockChangeReasonLabelKey", () => {
  test("tanish sabab uchun to'g'ri kalitni qaytaradi", () => {
    expect(getStockChangeReasonLabelKey("restock")).toBe("stockReasonRestock");
    expect(getStockChangeReasonLabelKey("order_sale")).toBe("stockReasonOrderSale");
  });

  test("noma'lum/soxta sabab uchun 'unspecified' kalitiga qaytadi (hech qachon xato bermaydi)", () => {
    expect(getStockChangeReasonLabelKey("backdoor_hack")).toBe("stockReasonUnspecified");
    expect(getStockChangeReasonLabelKey(undefined)).toBe("stockReasonUnspecified");
  });
});
