const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const {
  TRIAL_DAYS,
  normalizeTariffPlan,
  getNextTrialTier,
  hasUsedTrial,
  hasActiveTrial,
  computeAiCeoEnabledForPlan,
} = require("./lib/tariffs");

/**
 * Z-TARIFLAR — 5 KUNLIK BEPUL SINOV MEXANIZMI.
 *
 * `sellerReferrals.js`dagi referal-sinov bilan AYNAN BIR XIL,
 * allaqachon ishlab turgan naqsh: `tariffTrialActive` +
 * `tariffTrialPlan` + `tariffTrialExpiresAt` (vaqtinchalik), har
 * kecha ishlaydigan `expireTariffTrials` muddati tugaganlarni
 * avtomatik qaytaradi.
 *
 * FOYDALANUVCHI BILAN TASDIQLANGAN QAROR: "avtomatik tarif
 * tanlanish" - sotuvchi O'ZI 7 kunlik sinovni bir tugma bilan
 * boshlaydi (foydalanishga qarab AVTOMATIK tavsiya qiluvchi
 * "aqlli" tizim EMAS). Sinovdan keyin HAQIQIY (pullik) tarifga
 * o'tish esa hozircha ADMIN BILAN BOG'LANISH orqali (markazlashgan
 * to'lov tizimi hali yo'q, `TariffsPage.jsx`dagi izohga qarang).
 *
 * AI CEO SINXRONIZATSIYASI: `aiCeoEnabled` — allaqachon mavjud,
 * ALOHIDA boshqariladigan bayroq (referal-sinov, yoki admin QO'LDA
 * `setSellerTariffPlan.js` orqali). Bu yerda FAQAT `aiCeoEnabled`
 * HALI `true` EMAS bo'lgan holatda, tarif sinovi/tarifning o'zi
 * buni talab qilsa, YOQAMIZ - va buni ALOHIDA `aiCeoGrantedViaTariff`
 * bayrog'i bilan belgilaymiz, shunda faqat O'ZIMIZ yoqqan holatni
 * O'ZIMIZ (sinov tugaganda) o'chira olamiz - referal-sinov yoki
 * admin QO'LDA bergan haqiqiy kirishga HECH QACHON tegmaymiz.
 */

/**
 * Sotuvchi "Keyingi tarifni sinash" tugmasini bosganda.
 */
async function handleStartTariffTrial(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`startTariffTrial:${sellerId}`, 5, 3600);

  const sellerRef = db.collection("sellers").doc(sellerId);
  const sellerSnap = await sellerRef.get();
  if (!sellerSnap.exists) {
    throw new HttpsError("failed-precondition", "Sotuvchi hujjati topilmadi.");
  }
  const seller = sellerSnap.data();
  const now = Date.now();

  if (hasActiveTrial(seller, now)) {
    throw new HttpsError("failed-precondition", "Sizda hozir faol sinov muddati bor.");
  }

  const basePlan = normalizeTariffPlan(seller.tariffPlan);
  const nextTier = getNextTrialTier(basePlan);
  if (!nextTier) {
    throw new HttpsError("failed-precondition", "Siz allaqachon eng yuqori tarifdasiz - sinash uchun keyingi tarif yo'q.");
  }
  if (hasUsedTrial(seller, nextTier)) {
    throw new HttpsError("failed-precondition", `Siz "${nextTier}" tarifini allaqachon bir marta sinab ko'rgansiz - har bir tarif faqat bir marta sinaladi.`);
  }

  const expiresAtMs = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const update = {
    tariffTrialActive: true,
    tariffTrialPlan: nextTier,
    tariffTrialStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    tariffTrialExpiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    tariffTrialsUsed: admin.firestore.FieldValue.arrayUnion(nextTier),
  };

  // AI CEO sinxronizatsiyasi: sinov tarifi AI CEO'ni talab qiladi
  // (Z-Pro/Z-Biznes) VA hali yoqilmagan bo'lsa - YOQAMIZ, va faqat
  // O'ZIMIZ yoqqanimizni bildiruvchi bayroqni qo'yamiz.
  if (computeAiCeoEnabledForPlan(nextTier) && seller.aiCeoEnabled !== true) {
    update.aiCeoEnabled = true;
    update.aiCeoGrantedViaTariff = true;
  }

  await sellerRef.update(update);

  return { trialPlan: nextTier, expiresAtMs };
}

exports.startTariffTrial = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleStartTariffTrial));

/**
 * Har kecha ishlaydi: muddati tugagan tarif sinovlarini bazaviy
 * tarifga avtomatik qaytaradi.
 */
async function handleExpireTariffTrials() {
  const now = admin.firestore.Timestamp.now();
  // Xavfsizlik chegarasi - `expireSellerReferralTrials` bilan bir xil
  // g'oya (batafsil izoh: `functions/lib/batchProcess.js`).
  const MAX_PER_RUN = 200;

  const expiredSnap = await db.collection("sellers")
    .where("tariffTrialActive", "==", true)
    .where("tariffTrialExpiresAt", "<=", now)
    .limit(MAX_PER_RUN)
    .get();

  const result = await processBatched(expiredSnap.docs, async (doc) => {
    try {
      const seller = doc.data();
      const update = {
        tariffTrialActive: false,
        tariffTrialPlan: admin.firestore.FieldValue.delete(),
        tariffTrialExpiresAt: admin.firestore.FieldValue.delete(),
      };
      // FAQAT sinov TUFAYLI yoqilgan AI CEO'ni o'chiramiz (referal-
      // sinov yoki admin QO'LDA bergan haqiqiy kirishga TEGMAYMIZ -
      // ular uchun bu bayroq umuman yozilmagan bo'ladi).
      if (seller.aiCeoGrantedViaTariff === true) {
        update.aiCeoEnabled = false;
        update.aiCeoGrantedViaTariff = false;
      }
      await doc.ref.update(update);
      await sendTelegramMessage(
        BOT_TOKEN.value(),
        doc.id,
        [
          "⏳ *Tarif sinov muddati tugadi*",
          "",
          `${TRIAL_DAYS} kunlik bepul sinov muddatingiz yakunlandi. Davom etish uchun "Tariflar" sahifasidan admin bilan bog'lanishingiz mumkin.`,
        ].join("\n")
      ).catch(() => {});
    } catch (err) {
      console.error(`Tarif sinovini tugatishda xatolik (${doc.id}):`, err);
      throw err;
    }
  });
  console.log(`expireTariffTrials: ${result.successCount}/${result.total} hisob muvaffaqiyatli, ${result.failureCount} xato`);
}

exports.expireTariffTrials = onSchedule(
  { schedule: "0 4 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN], timeoutSeconds: 300 },
  withSentry(handleExpireTariffTrials)
);

/**
 * BIR MARTALIK MIGRATSIYA (`backfillSellerRollups` bilan BIR XIL
 * naqsh): tarif-limit hisoblagichlari (`activeDiscountCount`,
 * `couponCount`) qurilishidan OLDIN yaratilgan mahsulot/promokod
 * yozuvlarini bir martalik "orqaga hisoblab" to'ldiradi - aks holda
 * bu hisoblagichlar 0'dan boshlanib, ESKI (allaqachon mavjud)
 * aksiya/promokodlar hisobga olinmay qolardi (firestore.rules'dagi
 * limit tekshiruvi noto'g'ri - kam - sondan boshlanardi).
 *
 * IDEMPOTENT: `tariffCountersBackfilledAt` bayrog'i orqali sotuvchi
 * boshiga bir marta ishlaydi.
 */
async function handleBackfillTariffCounters(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { sellerId } = request.data || {};
  if (request.auth.uid !== String(sellerId)) {
    throw new HttpsError("permission-denied", "Faqat o'z do'koningiz uchun ishga tushirishingiz mumkin.");
  }
  await checkRateLimit(`backfillTariffCounters:${sellerId}`, 3, 3600);

  const [discountCountSnap, couponCountSnap] = await Promise.all([
    db.collection("products").where("sellerId", "==", sellerId).where("discountPrice", ">", 0).count().get(),
    db.collection("sellers").doc(sellerId).collection("coupons").count().get(),
  ]);

  const activeDiscountCount = discountCountSnap.data().count;
  const couponCount = couponCountSnap.data().count;

  await db.collection("sellers").doc(sellerId).set(
    {
      activeDiscountCount,
      couponCount,
      tariffCountersBackfilledAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { activeDiscountCount, couponCount };
}

exports.backfillTariffCounters = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleBackfillTariffCounters));

exports._testables = { handleStartTariffTrial, handleExpireTariffTrials, handleBackfillTariffCounters };
