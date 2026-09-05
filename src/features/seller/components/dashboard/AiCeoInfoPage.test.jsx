import { describe, test, expect } from "vitest";
import { buildActionPlan, applyAiActionPlanOrder, BIZNES_SUGGESTED_QUESTIONS } from "./AiCeoInfoPage";
import { translations, SUPPORTED_LANGUAGES } from "@/i18n/translations";

// `formatTimeSaved` ("Sellerga vaqt sotamiz") `src/utils/formatTimeSaved.js`ga
// ko'chirilgan (React'dan mustaqil sof funksiya, `react-refresh/only-export-components`
// qoidasiga tegmasligi uchun) - testi ham o'sha yerda:
// `src/utils/formatTimeSaved.test.js`.

/**
 * "BUGUNGI REJALAR" harakat markazi - `buildActionPlan` kunlik
 * hisobotdan (`generateDailyAiCeoReport`) kelgan xom ma'lumotni,
 * ustuvorlik bo'yicha tartiblangan, HAR BIRI bitta tugmali harakatga
 * ega ro'yxatga aylantiradi. Bu — SOF funksiya (React'ga bog'liq
 * emas), shuning uchun to'g'ridan-to'g'ri, komponentni render
 * qilmasdan test qilinadi.
 */

const baseReport = {
  attentionNeeded: { vipCount: 0, churnCount: 0 },
  productRecommendations: { discountCandidates: [], promoteCandidates: [] },
};

describe("buildActionPlan", () => {
  test("hisobot bo'lmasa (hali yuklanmagan), bo'sh ro'yxat qaytaradi", () => {
    expect(buildActionPlan(null)).toEqual([]);
  });

  test("hech qanday harakat kerak bo'lmasa, bo'sh ro'yxat qaytaradi", () => {
    expect(buildActionPlan(baseReport)).toEqual([]);
  });

  test("VIP mijozlar bo'lsa, TO'G'RI havola (audience=vip&autoAi=1) bilan band qo'shadi", () => {
    const plan = buildActionPlan({ ...baseReport, attentionNeeded: { vipCount: 3, churnCount: 0 } });
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("vip");
    expect(plan[0].to).toBe("/seller/crm?audience=vip&autoAi=1");
    expect(plan[0].titleParams).toEqual({ count: 3 });
  });

  test("uxlab qolgan mijozlar bo'lsa, TO'G'RI havola (audience=churn&autoAi=1) bilan band qo'shadi", () => {
    const plan = buildActionPlan({ ...baseReport, attentionNeeded: { vipCount: 0, churnCount: 5 } });
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("churn");
    expect(plan[0].to).toBe("/seller/crm?audience=churn&autoAi=1");
  });

  test("chegirma nomzodi bo'lsa, O'SHA mahsulotning tahrirlash sahifasiga havola qo'shadi (faqat BIRINCHISI)", () => {
    const plan = buildActionPlan({
      ...baseReport,
      productRecommendations: { discountCandidates: [{ id: "p1", name: "Krem" }, { id: "p2", name: "Serum" }], promoteCandidates: [] },
    });
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe("discount");
    expect(plan[0].to).toBe("/seller/products/p1/edit");
  });

  // FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: "post yaratish" bandi
  // ATAYLAB, VAQTINCHA yashirilgan (`PROMOTE_ACTION_ENABLED = false` -
  // funksiyaning o'zi o'chirilmagan, faqat shu "Bugungi rejalar"
  // ro'yxatidagi CTA). Shuning uchun `promoteCandidates` bo'lsa ham,
  // band ro'yxatga QO'SHILMASLIGI kerak.
  test("eng ko'p sotilgan mahsulot bo'lsa ham, 'post yaratish' bandi ATAYLAB qo'shilmaydi (vaqtincha yashirilgan)", () => {
    const plan = buildActionPlan({
      ...baseReport,
      productRecommendations: { discountCandidates: [], promoteCandidates: [{ id: "p9", name: "Parfyum", soldQty: 12 }] },
    });
    expect(plan).toHaveLength(0);
  });

  test("BARCHA turdagi harakatlar bo'lsa, USTUVORLIK bo'yicha tartiblangan holda qaytaradi (VIP > uxlab qolgan > chegirma) - 'aksiya/post' ATAYLAB yashirilgani uchun ro'yxatda yo'q", () => {
    const plan = buildActionPlan({
      attentionNeeded: { vipCount: 2, churnCount: 4 },
      productRecommendations: {
        discountCandidates: [{ id: "p1", name: "Krem" }],
        promoteCandidates: [{ id: "p9", name: "Parfyum", soldQty: 12 }],
      },
    });
    expect(plan.map((item) => item.key)).toEqual(["vip", "churn", "discount"]);
  });
});

/**
 * AI CEO — "O'ZI REJA TUZADI" (5-bosqich): agar backend Gemini orqali
 * o'z tartibini yaratgan bo'lsa (`report.aiActionPlan`), qattiq
 * kodlangan (rule-based) tartib o'rniga O'SHA qo'llanilishi kerak -
 * lekin HECH QACHON band yo'qotmasdan yoki yangi, noma'lum band
 * qo'shmasdan.
 */
describe("applyAiActionPlanOrder", () => {
  const items = [
    { key: "vip" }, { key: "churn" }, { key: "discount" }, { key: "promote" },
  ];

  test("aiActionPlan yo'q bo'lsa (null), asl (qattiq kodlangan) tartibni O'ZGARTIRMASDAN qaytaradi", () => {
    expect(applyAiActionPlanOrder(items, null)).toEqual(items);
    expect(applyAiActionPlanOrder(items, undefined)).toEqual(items);
  });

  test("AI tartibi berilgan bo'lsa, O'SHA tartibda qaytaradi", () => {
    const result = applyAiActionPlanOrder(items, { order: ["discount", "vip", "promote", "churn"], reasoning: "sabab" });
    expect(result.map((i) => i.key)).toEqual(["discount", "vip", "promote", "churn"]);
  });

  test("AI tartibida MAVJUD BO'LMAGAN band bo'lsa (masalan formatlash xatosi), qolgan bandlarni oxiriga qo'shadi - hech biri YO'QOLMAYDI", () => {
    const result = applyAiActionPlanOrder(items, { order: ["vip"], reasoning: null });
    expect(result.map((i) => i.key)).toEqual(["vip", "churn", "discount", "promote"]);
    expect(result).toHaveLength(4);
  });

  test("aiActionPlan.order bo'sh massiv bo'lsa, asl tartibni qaytaradi", () => {
    expect(applyAiActionPlanOrder(items, { order: [], reasoning: null })).toEqual(items);
  });
});

/**
 * "AI Business Manager" (Z-Biznes, 2026-09 punkt-royxati, 4-band) -
 * "AI CEO'dan so'rang" ostidagi tavsiya etilgan savol tugmalari FAQAT
 * Z-Biznes tarifiga ko'rsatiladi (batafsil izoh: `AiCeoInfoPage.jsx`dagi
 * `isBiznes` gatelashi). Bu yerda to'liq komponent render qilinmaydi
 * (loyihada bu naqsh ishlatilmaydi - React-ga bog'liq bo'lmagan SOF
 * ma'lumot/funksiyalar alohida test qilinadi) - o'rniga statik
 * ro'yxatning to'g'riligi VA har bir tarjima kalitining UCHALA tilda
 * ham (uz/ru/en) MAVJUDLIGI tekshiriladi - bu tarjima matnini
 * o'chirib/nomini xato yozib qo'yishning oldini oladi (aks holda
 * ekranda xom kalit ko'rsatilib qolar edi).
 */
describe("BIZNES_SUGGESTED_QUESTIONS (AI Business Manager)", () => {
  test("aynan 3 ta, HAR BIRI o'ziga xos `key`ga ega bo'lgan savol beradi", () => {
    expect(BIZNES_SUGGESTED_QUESTIONS).toHaveLength(3);
    const keys = BIZNES_SUGGESTED_QUESTIONS.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("har bir savolning `textKey`si UCHALA tilda ham (uz/ru/en) HAQIQIY, bo'sh bo'lmagan matnga ega", () => {
    BIZNES_SUGGESTED_QUESTIONS.forEach(({ textKey }) => {
      expect(textKey.startsWith("aiCeo.")).toBe(true);
      const bareKey = textKey.replace("aiCeo.", "");
      SUPPORTED_LANGUAGES.forEach((lang) => {
        expect(typeof translations[lang]?.aiCeo?.[bareKey]).toBe("string");
        expect(translations[lang].aiCeo[bareKey].length).toBeGreaterThan(0);
      });
    });
  });

  test("upsell (Z-Pro uchun) va guruh sarlavhasi tarjima kalitlari HAM barcha tillarda mavjud", () => {
    SUPPORTED_LANGUAGES.forEach((lang) => {
      expect(typeof translations[lang]?.aiCeo?.suggestedQuestionsBiznesLabel).toBe("string");
      expect(typeof translations[lang]?.aiCeo?.suggestedQuestionsBiznesUpsell).toBe("string");
    });
  });
});
