import { describe, it, expect } from "vitest";
import { SELLER_NAV_TARGETS, findNavTarget, filterNavTargets } from "./sellerNavTargets";

describe("findNavTarget", () => {
  it("aniq va ichki yo'llarni topadi", () => {
    expect(findNavTarget("/seller").path).toBe("/seller");
    expect(findNavTarget("/seller/products/12/edit").path).toBe("/seller/products");
    expect(findNavTarget("/seller/orders/").path).toBe("/seller/orders");
  });
  it("noma'lum yo'lda null", () => {
    expect(findNavTarget("/seller/zzz")).toBeNull();
  });
});

describe("filterNavTargets", () => {
  const labels = Object.fromEntries(SELLER_NAV_TARGETS.map((x) => [x.path, x.labelKey]));
  it("bo'sh so'rov hammasini qaytaradi", () => {
    expect(filterNavTargets(SELLER_NAV_TARGETS, "", labels)).toHaveLength(SELLER_NAV_TARGETS.length);
  });
  it("kalit so'z bo'yicha topadi", () => {
    expect(filterNavTargets(SELLER_NAV_TARGETS, "kupon", labels).map((x) => x.path)).toContain("/seller/marketing");
  });
  it("Z-Start'da pro bo'limlar yashiriladi", () => {
    const r = filterNavTargets(SELLER_NAV_TARGETS, "", labels, true).map((x) => x.path);
    expect(r).not.toContain("/seller/crm");
    expect(r).toContain("/seller/orders");
  });
});
