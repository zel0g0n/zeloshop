const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { getEffectiveTariffPlan } = require("./lib/tariffs");
const { dateKeyFromMillis } = require("./lib/rollups");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * HAFTALIK BIZNES HISOBOTI (2026-09, "katta bizneslar uchun" ro'yxati,
 * 2-guruh: "Buyruq Markazi hisobotlarini jadval bo'yicha avtomatik
 * yuborish"). Har DUSHANBA ertalab (Toshkent vaqti) FAQAT Z-Biznes
 * (yoki uning faol sinovidagi) sotuvchilarga, so'nggi 7 kunlik asosiy
 * moliyaviy ko'rsatkichlarni Telegram orqali qisqa xabar sifatida
 * yuboradi — sotuvchi ilovani ochmasdan ham "ish qalay ketyapti"ni
 * bilib turadi.
 *
 * QASDAN TOR QAMROV: `BusinessCommandCenterPage.jsx`dagi TO'LIQ
 * ko'rsatkichlar to'plami (AOV, konversiya, CAC/LTV, xarajatlar, eng
 * yaxshi xodim/kampaniya) shu sahifaning O'ZIDA, KLIENT tomonida,
 * sahifa ochilganda hisoblanadi — ularning aksariyati (xarajatlar,
 * kampaniyalar, xodim samaradorligi, tashrif/konversiya) uchun HALI
 * serverda OLDINDAN yig'ilgan ma'lumot YO'Q (bunday aggregatsiyani
 * cron uchun qayta qurish YANGI, ancha katta infratuzilma bo'lardi).
 * Shu sabab bu hisobot ATAYLAB FAQAT `sellers/{id}/orderRollups/{dateKey}`
 * — ALLAQACHON, har bir buyurtma "delivered" bo'lganda ISHONCHLI
 * ravishda serverda yig'iladigan (`orderRollups.js`) — ma'lumotlaridan
 * quriladi: tushum, taxminiy sof foyda (tushum - tannarx), yetkazilgan
 * buyurtmalar soni, o'rtacha chek va yangi mijozlar soni. Kelajakda
 * xarajat/kampaniya aggregatsiyasi qo'shilsa, hisobot ham
 * kengaytirilishi mumkin.
 *
 * STANDART: YOQILGAN (`weeklyReportEnabled !== false`) — bu oddiy
 * INFORMATSION xabar (pul/chegirma bilan bog'liq emas, faqat o'z
 * ma'lumotlarini ko'rsatadi), shuning uchun `cartReminderEnabled`/
 * `favoriteReminderEnabled` bilan BIR XIL "standart yoqilgan, xohlasa
 * o'chiradi" falsafasi qo'llanildi (farqli o'laroq, tug'ilgan kun/
 * sodiqlik dasturi kabi HAQIQIY pul chegirmasi beruvchi funksiyalar
 * standart bo'yicha O'CHIRILGAN).
 */
const TASHKENT_TZ = "Asia/Tashkent";
const REPORT_DAYS = 7;
const MAX_SELLERS_PER_RUN = 2000;

function formatMoney(n) {
  return `${Math.round(n).toLocaleString()} so'm`;
}

/** So'nggi `REPORT_DAYS` kunning "YYYY-MM-DD" kalitlarini (BUGUNGISIZ, to'liq o'tgan kunlar) qaytaradi. */
function buildRecentDateKeys(nowMs) {
  const keys = [];
  for (let i = 1; i <= REPORT_DAYS; i++) {
    keys.push(dateKeyFromMillis(nowMs - i * 24 * 60 * 60 * 1000));
  }
  return keys;
}

/** Bitta sotuvchi uchun so'nggi haftalik yig'indini `orderRollups`dan hisoblaydi. */
async function computeWeeklySummary(sellerId, nowMs) {
  const dateKeys = buildRecentDateKeys(nowMs);
  const snaps = await Promise.all(
    dateKeys.map((key) => db.collection("sellers").doc(sellerId).collection("orderRollups").doc(key).get())
  );
  return snaps.reduce(
    (acc, snap) => {
      if (!snap.exists) return acc;
      const d = snap.data();
      acc.revenue += Number(d.revenue) || 0;
      acc.cogs += Number(d.cogs) || 0;
      acc.deliveredCount += Number(d.deliveredCount) || 0;
      acc.newCustomersCount += Number(d.newCustomersCount) || 0;
      return acc;
    },
    { revenue: 0, cogs: 0, deliveredCount: 0, newCustomersCount: 0 }
  );
}

function buildReportText(seller, summary) {
  const profit = summary.revenue - summary.cogs;
  const aov = summary.deliveredCount > 0 ? summary.revenue / summary.deliveredCount : 0;
  const storeName = seller.storeName || "Do'kon";
  return [
    `📊 ${storeName} — so'nggi 7 kunlik hisobot`,
    "",
    `Tushum: ${formatMoney(summary.revenue)}`,
    `Sof foyda (taxminan): ${formatMoney(profit)}`,
    `Yetkazilgan buyurtmalar: ${summary.deliveredCount} ta`,
    `O'rtacha chek: ${formatMoney(aov)}`,
    `Yangi mijozlar: ${summary.newCustomersCount} ta`,
  ].join("\n");
}

async function processSellerWeeklyReport(sellerDoc, botToken, nowMs) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;
  // XAVFSIZLIK: `runAutomationRules`dagi bilan BIR XIL naqsh — sotuvchi
  // Biznes'dan pasaysa/sinovi tugasa ham, keyingi haftalik yugurishda
  // qayta tekshiriladi.
  if (getEffectiveTariffPlan(seller) !== "biznes") return;
  if (seller.weeklyReportEnabled === false) return;

  const summary = await computeWeeklySummary(sellerId, nowMs);
  if (summary.deliveredCount === 0 && summary.revenue === 0) return; // Bo'sh hafta - ortiqcha xabar yubormaslik.

  const text = buildReportText(seller, summary);
  await sendTelegramMessage(botToken, sellerId, text, {
    inlineKeyboard: [[{ text: "Buyruq Markazi", web_app: { url: buildSellerAppLink("/seller/command-center") } }]],
  });
}

exports.sendWeeklyBusinessReports = onSchedule(
  {
    schedule: "0 9 * * 1", // Har DUSHANBA, soat 9:00 (Toshkent vaqti)
    timeZone: TASHKENT_TZ,
    region: "asia-south1",
    secrets: [BOT_TOKEN, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const botToken = BOT_TOKEN.value();
    const nowMs = Date.now();
    // Haftalik ishga tushirish - `automationRules.js`dagi soatlik
    // crondan farqli o'laroq, bu yerda maxsus "hisoblagich" orqali
    // oldindan filtrlash SHART EMAS (haftada bir marta ishlaydi, harajat
    // toleransi ancha yuqori) - FAQAT faol sotuvchilar o'qiladi, Biznes
    // tekshiruvi har biriga alohida (`getEffectiveTariffPlan`) qilinadi.
    const sellersSnap = await db.collection("sellers").where("status", "==", "active").limit(MAX_SELLERS_PER_RUN).get();
    if (sellersSnap.empty) return;

    const result = await processBatched(sellersSnap.docs, (sellerDoc) => processSellerWeeklyReport(sellerDoc, botToken, nowMs));
    console.log(`sendWeeklyBusinessReports: ${result.successCount}/${result.total} sotuvchi tekshirildi, ${result.failureCount} xato`);
  })
);

exports._testables = {
  buildRecentDateKeys,
  computeWeeklySummary,
  buildReportText,
  processSellerWeeklyReport,
};
