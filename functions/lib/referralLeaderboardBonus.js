/**
 * MIJOZLAR REFERAL REYTINGI UCHUN "HAFTALIK G'OLIB" MUKOFOTI - sof
 * funksiyalar.
 *
 * MUHIM ARXITEKTURA QARORI: mavjud, DOIMIY (all-time) `referralCounts`
 * hisoblagichidan FARQLI o'laroq, bu yerdagi mukofot HAR HAFTA
 * "shu hafta ichida ENG KO'P do'st taklif qilgan" mijozlarga beriladi
 * (`functions/referralLeaderboardBonus.js`dagi haftalik cron) - bu,
 * doimiy reyting bilan bir xil kishi HAR SAFAR g'olib chiqib
 * qolishining oldini oladi va mijozlarni HAR HAFTA qayta faol
 * bo'lishga undaydi (gamifikatsiya printsipi).
 */

// Haftaning 1-, 2-, 3-o'rinlariga mos chegirma foizlari.
const RANK_BONUS_PERCENTS = { 1: 25, 2: 15, 3: 10 };
const TOP_N = Object.keys(RANK_BONUS_PERCENTS).length;
const BONUS_COUPON_VALID_DAYS = 14;

/**
 * Berilgan vaqt uchun ISO-8601 hafta kalitini ("2026-W36" kabi)
 * qaytaradi - kalendar chegaralari (Dushanba-Yakshanba) bo'yicha,
 * yil oxiri/boshidagi chegara holatlariga (haftaning bir qismi
 * o'tgan/keyingi yilga tegishli bo'lishi mumkinligi) ham to'g'ri
 * mos keladi.
 */
function computeIsoWeekKey(nowMs = Date.now()) {
  const date = new Date(nowMs);
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7; // Dushanba=1 ... Yakshanba=7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum); // shu haftaning Payshanbasi
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * `{referrerId: count}` shaklidagi haftalik hisoblardan, ENG YUQORI
 * `TOP_N` ta ishtirokchini (rank/count bilan) qaytaradi. Count=0
 * bo'lgan yozuvlar (bo'lishi mumkin emas, lekin xavfsizlik uchun)
 * chiqarib tashlanadi.
 *
 * @param {Object<string, number>} counts
 * @returns {Array<{referrerId: string, count: number, rank: number, bonusPercent: number}>}
 */
function pickTopReferrers(counts) {
  if (!counts || typeof counts !== "object") return [];
  return Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, TOP_N)
    .map(([referrerId, count], index) => {
      const rank = index + 1;
      return { referrerId, count: Number(count), rank, bonusPercent: RANK_BONUS_PERCENTS[rank] };
    });
}

function generateLeaderboardBonusCouponCode() {
  return `TOPREF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

module.exports = {
  RANK_BONUS_PERCENTS,
  TOP_N,
  BONUS_COUPON_VALID_DAYS,
  computeIsoWeekKey,
  pickTopReferrers,
  generateLeaderboardBonusCouponCode,
};
