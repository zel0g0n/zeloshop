/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence) — server-side
 * sof tasniflash mantig'i (2026-09 punkt-royxati, 9-band, Z-Biznes
 * tarifi). `src/utils/customerSegments.js`dagi Z-Pro'ning oddiy
 * 4 segmentli (vip/churn/regular/new) tasnifidan FARQLI — bu YANGI,
 * ALOHIDA modul: mavjud Pro-tier CRM'ga TEGILMAYDI (ustiga
 * qurilmaydi, unga QO'SHIMCHA ravishda, Biznes tarifida ishlaydi).
 *
 * Ikki mustaqil tasnif darajasi:
 *   1) `primarySegment` — HAR BIR mijoz uchun FAQAT bitta qiymat
 *      (ustuvorlik zinapoyasi, birinchi mos kelgani g'olib chiqadi):
 *      vip > high_value > sleeping > churn_risk > at_risk > new > returning
 *   2) `tags` — mustaqil, bir nechtasi BIRGALIKDA bo'lishi mumkin
 *      bo'lgan qo'shimcha belgilar: discount_hunter, high_intent.
 *
 * Ustuvorlik zinapoyasining mantig'i: eng qimmatli mijozlar (vip/
 * high_value) — LTV qancha bo'lishidan qat'iy nazar — birinchi
 * navbatda ko'rsatiladi (ular bilan aloqa uzilmasligi eng muhim).
 * Keyin — juda uzoq vaqt (`SLEEPING_DAYS`) yoki nisbatan uzoq vaqt
 * (`CHURN_DAYS`) xarid qilmagan mijozlar. Keyin — o'z shaxsiy xarid
 * ritmidan orqada qolgan (`at_risk`) mijozlar. Qolganlari — yangi
 * (bitta buyurtma) yoki qaytib xarid qiluvchi (returning).
 *
 * MUHIM — HALOLLIK CHEGARASI (loyihaning "MOCK QILMA" qoidasi): bu
 * HAQIQIY sun'iy intellekt/ML modeli EMAS — DETERMINISTIK qoidalar
 * (LTV chegaralari, oxirgi xariddan o'tgan kunlar, mijozning O'Z
 * tarixidagi o'rtacha xarid oralig'i — xuddi `businessInsights.js`
 * (frontend)dagi `computeReorderDueCustomers` bilan bir xil,
 * isbotlangan yondashuv). AI CEO agenti bu tasnifni "tayyor jadval"
 * sifatida o'qiydi va ustiga TABIIY TIL bilan izoh/tavsiya qo'shadi —
 * lekin tasniflashning O'ZI har doim shu deterministik qoidalar
 * asosida, oldindan hisoblanadi.
 */

const MS_IN_DAY = 24 * 60 * 60 * 1000;

// `src/utils/customerSegments.js` (Z-Pro CRM) bilan BIR XIL qiymat —
// ikkala tarifda "VIP" tushunchasi bir xil ma'noni anglatishi kerak.
const VIP_THRESHOLD = 500_000; // so'm
const HIGH_VALUE_THRESHOLD = 200_000; // so'm — VIP'dan past, lekin oddiy mijozdan sezilarli yuqori
// `src/utils/customerSegments.js` bilan BIR XIL qiymat.
const CHURN_DAYS = 30; // kun
const SLEEPING_DAYS = 90; // kun — CHURN_DAYS'dan uzoqroq, "chuqur uyqu" bosqichi

const DISCOUNT_HUNTER_MIN_ORDERS = 2; // kamida 2 buyurtma bo'lmasa, "ulgurji xulosa" chiqarish uchun tarix yetarli emas
const DISCOUNT_HUNTER_MIN_RATIO = 0.5; // buyurtmalarining kamida yarmi promokod bilan bo'lsa

const PRIMARY_SEGMENT_KEYS = ["vip", "high_value", "sleeping", "churn_risk", "at_risk", "new", "returning"];
const TAG_KEYS = ["discount_hunter", "high_intent"];

/**
 * "Qayta xarid vaqti allaqachon o'tgan" (at_risk) belgisini
 * hisoblaydi — frontend `businessInsights.js`dagi
 * `computeReorderDueCustomers`dagi BIR XIL isbotlangan mantiq
 * (mijoz o'z tarixidagi o'rtacha xarid oralig'idan ko'proq
 * kutmoqda). Kamida 2 ta buyurtma bo'lishi shart — bitta
 * buyurtmadan "o'rtacha oraliq" hisoblab bo'lmaydi.
 */
function isReorderOverdue(orderCount, firstOrderAtMs, lastOrderAtMs, now) {
  if (orderCount < 2 || firstOrderAtMs <= 0 || lastOrderAtMs <= 0) return false;
  const averageIntervalDays = (lastOrderAtMs - firstOrderAtMs) / (orderCount - 1) / MS_IN_DAY;
  if (averageIntervalDays <= 0) return false;
  const daysSinceLastOrder = (now - lastOrderAtMs) / MS_IN_DAY;
  return daysSinceLastOrder >= averageIntervalDays;
}

/** Bitta mijozning asosiy segmentini ustuvorlik zinapoyasi bo'yicha aniqlaydi. */
function computePrimarySegment({ ltv, orderCount, daysSinceLastOrder, reorderOverdue }) {
  if (ltv >= VIP_THRESHOLD) return "vip";
  if (ltv >= HIGH_VALUE_THRESHOLD) return "high_value";
  if (daysSinceLastOrder > SLEEPING_DAYS) return "sleeping";
  if (daysSinceLastOrder > CHURN_DAYS) return "churn_risk";
  if (reorderOverdue) return "at_risk";
  if (orderCount === 1) return "new";
  return "returning";
}

/**
 * Mijozlar ro'yxatini (`sellers/{id}/customers` yig'ma yozuvlari)
 * to'liq razvedka tasnifiga aylantiradi. Sof funksiya.
 *
 * @param {Array<{clientId, fullName?, phone?, ltv, orderCount, lastOrderAtMs, firstOrderAtMs, couponOrderCount?}>} customers
 * @param {{now?: number, highIntentClientIds?: Set<string>}} [options]
 *   `highIntentClientIds` — chaqiruvchi tomonidan tayyorlab beriladi
 *   (faol savatcha/sevimlilar ro'yxatidagi `clientId`lar to'plami,
 *   batafsil izoh: `functions/customerIntelligence.js`).
 * @returns {{customers: Array, counts: Object, tagCounts: Object}}
 */
function classifyCustomerIntelligence(customers, options = {}) {
  const now = options.now || Date.now();
  const highIntentClientIds = options.highIntentClientIds instanceof Set ? options.highIntentClientIds : new Set();

  const list = (Array.isArray(customers) ? customers : [])
    .map((c) => {
      const ltv = Number(c.ltv) || 0;
      const orderCount = Number(c.orderCount) || 0;
      const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
      const firstOrderAtMs = Number(c.firstOrderAtMs) || 0;
      const couponOrderCount = Number(c.couponOrderCount) || 0;
      const daysSinceLastOrder = Math.floor((now - lastOrderAtMs) / MS_IN_DAY);
      const reorderOverdue = isReorderOverdue(orderCount, firstOrderAtMs, lastOrderAtMs, now);

      const primarySegment = computePrimarySegment({ ltv, orderCount, daysSinceLastOrder, reorderOverdue });

      const tags = [];
      if (orderCount >= DISCOUNT_HUNTER_MIN_ORDERS && couponOrderCount / orderCount >= DISCOUNT_HUNTER_MIN_RATIO) {
        tags.push("discount_hunter");
      }
      if (highIntentClientIds.has(c.clientId)) {
        tags.push("high_intent");
      }

      return {
        clientId: c.clientId,
        fullName: c.fullName || "Noma'lum",
        phone: c.phone || "",
        ltv,
        orderCount,
        lastOrderAtMs,
        daysSinceLastOrder,
        primarySegment,
        tags,
      };
    })
    .sort((a, b) => b.ltv - a.ltv);

  const counts = { all: list.length };
  PRIMARY_SEGMENT_KEYS.forEach((key) => {
    counts[key] = list.filter((c) => c.primarySegment === key).length;
  });

  const tagCounts = {};
  TAG_KEYS.forEach((key) => {
    tagCounts[key] = list.filter((c) => c.tags.includes(key)).length;
  });

  return { customers: list, counts, tagCounts };
}

/**
 * Tasniflangan mijozlar ro'yxatini AI CEO agenti so'ragan
 * segment/tag bo'yicha filtrlaydi (masalan "uxlab qolayotgan
 * VIP'lar" -> `segment: "sleeping"`, keyin natija ichida
 * `ltv >= VIP_THRESHOLD`ga qarab qo'shimcha filtrlash chaqiruvchi
 * tomonda). `segment` — `PRIMARY_SEGMENT_KEYS`dan biri yoki "all";
 * `tag` — ixtiyoriy, `TAG_KEYS`dan biri (berilsa, FAQAT o'sha
 * belgiga ega mijozlar qoladi — segment filtridan MUSTAQIL, chunki
 * `tags` `primarySegment`dan alohida o'lcham).
 */
function filterClassifiedCustomers(classifiedCustomers, { segment, tag, limit } = {}) {
  let list = Array.isArray(classifiedCustomers) ? classifiedCustomers : [];
  if (segment && segment !== "all") {
    list = list.filter((c) => c.primarySegment === segment);
  }
  if (tag) {
    list = list.filter((c) => c.tags.includes(tag));
  }
  if (Number.isFinite(limit) && limit > 0) {
    list = list.slice(0, limit);
  }
  return list;
}

module.exports = {
  VIP_THRESHOLD,
  HIGH_VALUE_THRESHOLD,
  CHURN_DAYS,
  SLEEPING_DAYS,
  DISCOUNT_HUNTER_MIN_ORDERS,
  DISCOUNT_HUNTER_MIN_RATIO,
  PRIMARY_SEGMENT_KEYS,
  TAG_KEYS,
  classifyCustomerIntelligence,
  filterClassifiedCustomers,
};
