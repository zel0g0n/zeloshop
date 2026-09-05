import { describe, test, expect } from "vitest";
import { computeAutopilotStatus } from "./aiAutopilotStatus";

describe("computeAutopilotStatus", () => {
  test("seller null/undefined bo'lsa - xato tashlamaydi, hammasi standart holatda", () => {
    expect(() => computeAutopilotStatus(null)).not.toThrow();
    expect(() => computeAutopilotStatus(undefined)).not.toThrow();
  });

  test("hech qanday maydon YOZILMAGAN (yangi sotuvchi) - asosiy (basic) tier HAMMASI YOQILGAN (default ON)", () => {
    const { basicTier } = computeAutopilotStatus({});
    expect(basicTier.every((a) => a.active)).toBe(true);
  });

  test("hech qanday maydon YOZILMAGAN - AI tier HAMMASI O'CHIRILGAN (default OFF, opt-in)", () => {
    const { aiTier } = computeAutopilotStatus({});
    expect(aiTier.every((a) => !a.active)).toBe(true);
  });

  test("basicTier maydoni ANIQ `false` qilib o'chirilgan bo'lsa - active:false", () => {
    const { basicTier } = computeAutopilotStatus({ cartReminderEnabled: false });
    expect(basicTier.find((a) => a.key === "cartReminder").active).toBe(false);
    // Qolganlari ta'sirlanmaydi.
    expect(basicTier.find((a) => a.key === "favoriteReminder").active).toBe(true);
  });

  test("aiCeoEnabled=false bo'lsa - AI tier HAMMASI 'locked' (hatto ichki bayroqlar true bo'lsa ham)", () => {
    const { aiTier } = computeAutopilotStatus({ aiCeoEnabled: false, aiCeoAutoFavoriteEnabled: true, aiCeoAutoWinBackEnabled: true });
    expect(aiTier.every((a) => a.locked)).toBe(true);
    expect(aiTier.every((a) => !a.active)).toBe(true); // locked bo'lsa, active HAM false bo'lishi kerak
  });

  test("aiCeoEnabled=true VA tegishli bayroq true bo'lsa - active:true, locked:false", () => {
    const { aiTier } = computeAutopilotStatus({ aiCeoEnabled: true, aiCeoAutoFavoriteEnabled: true });
    const badge = aiTier.find((a) => a.key === "aiFavoriteText");
    expect(badge).toMatchObject({ active: true, locked: false });
  });

  test("aiAutoDiscount - FAQAT aiCeoAutoWinBackEnabled HAM true bo'lsa active (bog'liqlik)", () => {
    const withoutWinBack = computeAutopilotStatus({ aiCeoEnabled: true, aiCeoAutoDiscountEnabled: true }); // winBack yo'q
    expect(withoutWinBack.aiTier.find((a) => a.key === "aiAutoDiscount").active).toBe(false);

    const withWinBack = computeAutopilotStatus({ aiCeoEnabled: true, aiCeoAutoWinBackEnabled: true, aiCeoAutoDiscountEnabled: true });
    expect(withWinBack.aiTier.find((a) => a.key === "aiAutoDiscount").active).toBe(true);
  });

  test("activeCount/totalCount to'g'ri hisoblanadi", () => {
    const result = computeAutopilotStatus({}); // faqat 4 ta basic tier yoqilgan
    expect(result.activeCount).toBe(4);
    expect(result.totalCount).toBe(8);
  });

  test("hammasi yoqilgan holatda activeCount = totalCount", () => {
    const result = computeAutopilotStatus({
      aiCeoEnabled: true,
      aiCeoAutoFavoriteEnabled: true,
      aiCeoAutoWinBackEnabled: true,
      aiCeoAutoDiscountEnabled: true,
      aiCeoTelegramApprovalEnabled: true,
    });
    expect(result.activeCount).toBe(result.totalCount);
  });
});
