import { describe, test, expect } from "vitest";
import {
  TARIFF_LIMITS,
  TARIFF_MONTHLY_PRICE_SOM,
  TARIFF_BILLING_CUTOFF_MS,
  SIGNUP_GRACE_DAYS,
  normalizeTariffPlan,
  getEffectiveTariffPlan,
  getTariffLimits,
  isUnderLimit,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
  isBillingRequired,
  getPaidUntilMs,
  getGraceExpiresAtMs,
  isTariffPastDue,
  isTariffPurchasable,
} from "./tariffLimits";

describe("normalizeTariffPlan", () => {
  test("noto'g'ri qiymat uchun 'start' qaytaradi", () => {
    expect(normalizeTariffPlan(undefined)).toBe("start");
    expect(normalizeTariffPlan("random")).toBe("start");
  });
  test("haqiqiy qiymatlarni saqlaydi", () => {
    expect(normalizeTariffPlan("pro")).toBe("pro");
    expect(normalizeTariffPlan("biznes")).toBe("biznes");
  });
});

describe("getEffectiveTariffPlan", () => {
  const now = 1_000_000;

  test("sinov yo'q - bazaviy tarif", () => {
    expect(getEffectiveTariffPlan({ tariffPlan: "start" }, now)).toBe("start");
  });

  test("faol sinov - sinov tarifi ustun", () => {
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now + 1000 }, now)
    ).toBe("pro");
  });

  test("muddati tugagan sinov - bazaviy tarifga qaytadi", () => {
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: now - 1000 }, now)
    ).toBe("start");
  });

  // Regressiya: botni QAYTA OCHGANDA (`verifyTelegramAuth` orqali yangi
  // sessiya) `store.tariffTrialExpiresAt` Firestore Timestamp emas, balki
  // `functions/lib/helpers.js`dagi `sanitizeFirestoreData` uni ISO sana
  // satriga aylantirib yuboradi. Bu holat oldin hisobga olinmagan bo'lib,
  // faol sinov "muddati tugagan" deb hisoblanib, effektiv tarif bazaviyga
  // qaytib ketardi (foydalanuvchi xabari: "botni qayta ochganda faqat AI
  // CEO ishlayapti, qolgan Z-Pro funksiyalari ko'rinmaydi ham").
  test("ISO sana satri (Cloud Function orqali kelgan `store`) - faol sinov to'g'ri aniqlanadi", () => {
    const isoExpiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: isoExpiresAt }, now)
    ).toBe("pro");
  });

  test("ISO sana satri - muddati o'tgan bo'lsa bazaviy tarifga qaytadi", () => {
    const isoExpiresAt = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      getEffectiveTariffPlan({ tariffPlan: "start", tariffTrialActive: true, tariffTrialPlan: "pro", tariffTrialExpiresAt: isoExpiresAt }, now)
    ).toBe("start");
  });
});

describe("getTariffLimits", () => {
  test("Z-Start / Z-Pro / Z-Biznes limitlari to'g'ri", () => {
    expect(getTariffLimits({ tariffPlan: "start" })).toEqual(TARIFF_LIMITS.start);
    expect(getTariffLimits({ tariffPlan: "pro" })).toEqual(TARIFF_LIMITS.pro);
    expect(getTariffLimits({ tariffPlan: "biznes" })).toEqual(TARIFF_LIMITS.biznes);
  });
});

describe("isUnderLimit", () => {
  test("cheksiz (null) uchun doim true", () => {
    expect(isUnderLimit(100, null)).toBe(true);
  });
  test("chegara ustida/ostida to'g'ri ishlaydi", () => {
    expect(isUnderLimit(2, 3)).toBe(true);
    expect(isUnderLimit(3, 3)).toBe(false);
  });
});

describe("getNextTrialTier / hasUsedTrial / hasActiveTrial", () => {
  test("keyingi tarifni to'g'ri qaytaradi", () => {
    expect(getNextTrialTier("start")).toBe("pro");
    expect(getNextTrialTier("pro")).toBe("biznes");
    expect(getNextTrialTier("biznes")).toBeNull();
  });

  test("hasUsedTrial ro'yxatni to'g'ri tekshiradi", () => {
    expect(hasUsedTrial({ tariffTrialsUsed: ["pro"] }, "pro")).toBe(true);
    expect(hasUsedTrial({}, "pro")).toBe(false);
  });

  test("hasActiveTrial faqat faol VA tugamagan sinovda true", () => {
    const now = 1_000_000;
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now + 1 }, now)).toBe(true);
    expect(hasActiveTrial({ tariffTrialActive: true, tariffTrialExpiresAt: now - 1 }, now)).toBe(false);
  });
});

describe("isBillingRequired", () => {
  test("cutoff'dan OLDIN ro'yxatdan o'tgan - false (grandfathered)", () => {
    const before = new Date(TARIFF_BILLING_CUTOFF_MS - 24 * 60 * 60 * 1000).toISOString();
    expect(isBillingRequired({ createdAt: before })).toBe(false);
  });

  test("cutoff'dan KEYIN ro'yxatdan o'tgan - true", () => {
    const after = new Date(TARIFF_BILLING_CUTOFF_MS + 24 * 60 * 60 * 1000).toISOString();
    expect(isBillingRequired({ createdAt: after })).toBe(true);
  });

  test("aynan cutoff vaqtida - true (inklyuziv)", () => {
    expect(isBillingRequired({ createdAt: TARIFF_BILLING_CUTOFF_MS })).toBe(true);
  });

  test("createdAt yo'q - false", () => {
    expect(isBillingRequired({})).toBe(false);
  });

  test("Firestore Timestamp obyekti (toMillis) - to'g'ri ishlaydi", () => {
    const fakeTimestamp = { toMillis: () => TARIFF_BILLING_CUTOFF_MS + 1000 };
    expect(isBillingRequired({ createdAt: fakeTimestamp })).toBe(true);
  });
});

describe("getPaidUntilMs / getGraceExpiresAtMs", () => {
  test("getPaidUntilMs - tariffPaidUntil yo'q bo'lsa 0", () => {
    expect(getPaidUntilMs({})).toBe(0);
  });

  test("getPaidUntilMs - ISO satrni to'g'ri o'qiydi", () => {
    const iso = new Date(2026, 9, 1).toISOString();
    expect(getPaidUntilMs({ tariffPaidUntil: iso })).toBe(Date.parse(iso));
  });

  test("getGraceExpiresAtMs - createdAt + SIGNUP_GRACE_DAYS kun", () => {
    const createdAtMs = TARIFF_BILLING_CUTOFF_MS;
    const expected = createdAtMs + SIGNUP_GRACE_DAYS * 24 * 60 * 60 * 1000;
    expect(getGraceExpiresAtMs({ createdAt: createdAtMs })).toBe(expected);
  });

  test("getGraceExpiresAtMs - createdAt yo'q bo'lsa 0", () => {
    expect(getGraceExpiresAtMs({})).toBe(0);
  });
});

describe("isTariffPastDue", () => {
  const now = TARIFF_BILLING_CUTOFF_MS + 100 * 24 * 60 * 60 * 1000; // cutoff'dan 100 kun keyin

  test("grandfathered sotuvchi (billing talab qilinmaydi) - doim false", () => {
    const oldSeller = { createdAt: TARIFF_BILLING_CUTOFF_MS - 1000 };
    expect(isTariffPastDue(oldSeller, now)).toBe(false);
  });

  test("yangi sotuvchi, hali 7 kunlik grace ichida - false", () => {
    const createdAtMs = now - 3 * 24 * 60 * 60 * 1000; // 3 kun oldin ro'yxatdan o'tgan
    expect(isTariffPastDue({ createdAt: createdAtMs }, now)).toBe(false);
  });

  test("yangi sotuvchi, grace muddati o'tgan VA to'lov qilinmagan - true", () => {
    const createdAtMs = now - 10 * 24 * 60 * 60 * 1000; // 10 kun oldin
    expect(isTariffPastDue({ createdAt: createdAtMs }, now)).toBe(true);
  });

  test("faol sinov muddati bor sotuvchi - false (sinov ustun)", () => {
    const createdAtMs = now - 10 * 24 * 60 * 60 * 1000;
    expect(
      isTariffPastDue(
        { createdAt: createdAtMs, tariffTrialActive: true, tariffTrialExpiresAt: now + 1000 },
        now
      )
    ).toBe(false);
  });

  test("to'lov qilingan VA muddati hali tugamagan - false", () => {
    const createdAtMs = now - 10 * 24 * 60 * 60 * 1000;
    expect(
      isTariffPastDue({ createdAt: createdAtMs, tariffPaidUntil: now + 5 * 24 * 60 * 60 * 1000 }, now)
    ).toBe(false);
  });

  test("to'lov qilingan LEKIN muddati tugagan - true", () => {
    const createdAtMs = now - 40 * 24 * 60 * 60 * 1000;
    expect(
      isTariffPastDue({ createdAt: createdAtMs, tariffPaidUntil: now - 1000 }, now)
    ).toBe(true);
  });
});

describe("isTariffPurchasable", () => {
  test("start va pro - sotib olish mumkin", () => {
    expect(isTariffPurchasable("start")).toBe(true);
    expect(isTariffPurchasable("pro")).toBe(true);
  });

  test("biznes - hali sotib olib bo'lmaydi (faqat so'rov)", () => {
    expect(isTariffPurchasable("biznes")).toBe(false);
  });

  test("noto'g'ri qiymat - false", () => {
    expect(isTariffPurchasable("random")).toBe(false);
    expect(isTariffPurchasable(undefined)).toBe(false);
  });

  test("narxlar to'g'ri belgilangan", () => {
    expect(TARIFF_MONTHLY_PRICE_SOM.start).toBe(49000);
    expect(TARIFF_MONTHLY_PRICE_SOM.pro).toBe(199000);
  });
});
