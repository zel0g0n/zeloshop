const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const {
  TARIFF_BILLING_PERIOD_DAYS, TARIFF_BILLING_CUTOFF_MS,
  computeAiCeoEnabledForPlan, isTariffPastDue, paidUntilMs,
} = require("./lib/tariffs");

/**
 * Z-TARIFLAR - TO'LOV YOZUVLARI (qo'lda tasdiqlash oqimi).
 *
 * Platformada avtomatik to'lov shlyuzi yo'q - pul aylanmasi yo'q. Tarif
 * to'lovi faqat qo'lda: sotuvchi to'lov chekini yuboradi
 * (`submitManualTariffPayment`), admin ko'rib chiqadi
 * (`reviewManualTariffPayment`) va tasdiqlasa shu fayldagi
 * `activateTariffPayment` tarifni faollashtiradi.
 *
 * MUHIM: Firestore kolleksiyasining nomi (`atmosPayments`) mavjud
 * yozuvlar, `firestore.rules` va indekslar shu nomga bog'langanligi
 * uchun o'zgartirilmagan. Nomni almashtirish alohida ma'lumot ko'chirish
 * ishini talab qiladi.
 */
const TARIFF_PAYMENTS_COLLECTION = "atmosPayments";
const REMINDER_WINDOW_DAYS = 3; // Muddat tugashiga shuncha kun qolganda eslatma.

/**
 * `sellers/{id}` hujjatidagi tarif holatini TASDIQLANGAN to'lov asosida
 * yangilaydi. Hozir yagona oqim - qo'lda tasdiqlash
 * (`manualTariffPayments.js`: sotuvchi chek yuboradi, admin tasdiqlaydi).
 * Funksiya IDEMPOTENT: allaqachon "paid" bo'lsa qayta ishlov bermaydi.
 *
 * @returns {Promise<{alreadyProcessed: boolean, plan: string, paidUntilMs: number}>}
 */
async function activateTariffPayment({ paymentDocId, callbackRaw = null }) {
  const paymentRef = db.collection(TARIFF_PAYMENTS_COLLECTION).doc(String(paymentDocId));

  return db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) {
      throw new Error(`${TARIFF_PAYMENTS_COLLECTION}/${paymentDocId} topilmadi.`);
    }
    const payment = paymentSnap.data();

    if (payment.status === "paid") {
      // Allaqachon qayta ishlangan (masalan admin ikki marta bosdi) —
      // IDEMPOTENT: qayta ishlov bermaymiz, faqat joriy holatni qaytaramiz.
      return { alreadyProcessed: true, plan: payment.plan, paidUntilMs: paidUntilMs({ tariffPaidUntil: payment.sellerPaidUntilAtActivation }) };
    }

    const sellerRef = db.collection("sellers").doc(payment.sellerId);
    const sellerSnap = await tx.get(sellerRef);
    if (!sellerSnap.exists) {
      throw new Error(`sellers/${payment.sellerId} topilmadi.`);
    }
    const seller = sellerSnap.data();

    const now = Date.now();
    const currentPaidUntil = paidUntilMs(seller);
    const newPaidUntilMs = Math.max(now, currentPaidUntil) + TARIFF_BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    const sellerUpdate = {
      tariffPlan: payment.plan,
      tariffPaidUntil: admin.firestore.Timestamp.fromMillis(newPaidUntilMs),
      tariffLastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      // Yangi davr boshlandi — keyingi muddat yaqinlashganda YANA
      // eslatma yuborilishi uchun, oldingi belgini tozalaymiz.
      tariffPaymentReminderSentAt: admin.firestore.FieldValue.delete(),
    };

    // AI CEO sinxronizatsiyasi — `startTariffTrial`dagi BIR XIL naqsh:
    // to'langan tarif AI CEO'ni talab qiladi VA hali yoqilmagan bo'lsa
    // — YOQAMIZ, alohida bayroq bilan belgilab (faqat O'ZIMIZ yoqqanini
    // bildiradi, referal/admin qo'lda bergan kirishga tegilmaydi).
    if (computeAiCeoEnabledForPlan(payment.plan) && seller.aiCeoEnabled !== true) {
      sellerUpdate.aiCeoEnabled = true;
      sellerUpdate.aiCeoGrantedViaPaidTariff = true;
    }

    tx.update(sellerRef, sellerUpdate);
    tx.update(paymentRef, {
      status: "paid",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      callbackRaw: callbackRaw || null,
      sellerPaidUntilAtActivation: newPaidUntilMs,
    });

    return { alreadyProcessed: false, plan: payment.plan, paidUntilMs: newPaidUntilMs, sellerId: payment.sellerId };
  });
}

/**
 * Sotuvchi o'z to'lovining holatini so'raydi (qo'lda tasdiqlash oqimi,
 * `manualTariffPayments.js`): "paid" | "pending_review" | "rejected".
 * Frontend kontrakti eski nomicha qoldirilgan: `transactionId` -
 * Firestore hujjat ID'si.
 */
async function handleGetTariffPaymentStatus(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const transactionId = String(request.data?.transactionId || "");
  if (!transactionId) {
    throw new HttpsError("invalid-argument", "transactionId talab qilinadi.");
  }

  const paymentSnap = await db.collection(TARIFF_PAYMENTS_COLLECTION).doc(transactionId).get();
  if (!paymentSnap.exists) {
    throw new HttpsError("not-found", "To'lov topilmadi.");
  }
  const payment = paymentSnap.data();
  if (payment.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Bu to'lov sizga tegishli emas.");
  }

  if (payment.status === "paid") {
    return { status: "paid", plan: payment.plan, paidUntilMs: payment.sellerPaidUntilAtActivation || null };
  }
  if (payment.status === "rejected") {
    return { status: "rejected", plan: payment.plan, amountSom: payment.amountSom, rejectReason: payment.rejectReason || null };
  }
  return { status: "pending_review", plan: payment.plan, amountSom: payment.amountSom };
}

exports.getTariffPaymentStatus = onCall(
  { region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleGetTariffPaymentStatus)
);

/**
 * Har kuni ishlaydi: to'lov muddati yaqinlashayotgan (yoki bepul 7
 * kunlik davr tugagan, hali bir marta ham to'lamagan) YANGI (billing
 * talab qilinadigan) sotuvchilarga Telegram orqali eslatma yuboradi.
 *
 * QAMROV ATAYLAB TOR: faqat `createdAt >= TARIFF_BILLING_CUTOFF_MS`
 * (billing rejimidagi) sotuvchilar tekshiriladi — bu to'plam BUGUNDAN
 * boshlab noldan o'sadi, shuning uchun to'liq skanerlash (murakkab
 * composite-index so'rovlar o'rniga) hozircha xavfsiz va oddiy.
 */
async function handleSendTariffPaymentReminders() {
  const MAX_PER_RUN = 500;
  const now = Date.now();

  const cutoffSnap = await db.collection("sellers")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(TARIFF_BILLING_CUTOFF_MS))
    .limit(MAX_PER_RUN)
    .get();

  const candidates = cutoffSnap.docs.filter((doc) => {
    const seller = doc.data();
    if (seller.tariffPaymentReminderSentAt) return false; // shu davr uchun allaqachon yuborilgan.
    const pastDue = isTariffPastDue(seller, now);
    if (pastDue) return true;
    const paidUntil = paidUntilMs(seller);
    if (paidUntil > 0 && paidUntil - now <= REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000) return true;
    return false;
  });

  const result = await processBatched(candidates, async (doc) => {
    const seller = doc.data();
    const pastDue = isTariffPastDue(seller, now);
    const text = pastDue
      ? [
          "⏳ *Bepul davr tugadi*",
          "",
          `Z-Start uchun 7 kunlik bepul davringiz yakunlandi. Do'koningizni to'liq boshqarishda davom etish uchun "Tariflar" sahifasidan to'lovni amalga oshiring.`,
        ].join("\n")
      : [
          "🔔 *Tarif muddati yaqinlashmoqda*",
          "",
          `Joriy tarif to'lovingiz muddati ${REMINDER_WINDOW_DAYS} kun ichida tugaydi. Uzluksiz ishlash uchun "Tariflar" sahifasidan oldindan to'lovni amalga oshirishingiz mumkin.`,
        ].join("\n");

    await sendTelegramMessage(BOT_TOKEN.value(), doc.id, text, {
      buttonText: "To'lov qilish",
      buttonUrl: buildSellerAppLink("/seller/tariffs"),
    }).catch(() => {});

    await doc.ref.update({ tariffPaymentReminderSentAt: admin.firestore.FieldValue.serverTimestamp() });
  });

  console.log(`sendTariffPaymentReminders: ${result.successCount}/${result.total} muvaffaqiyatli, ${result.failureCount} xato`);
}

exports.sendTariffPaymentReminders = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN], timeoutSeconds: 300 },
  withSentry(handleSendTariffPaymentReminders)
);

// `manualTariffPayments.js` admin tasdiqlagan to'lovni AYNAN SHU funksiya
// orqali faollashtiradi (`couriers.js`dagi `applyCourierOrderAction` bilan
// bir xil "qo'shni modul funksiyasini to'g'ridan-to'g'ri eksport qilish"
// konvensiyasi).
exports.activateTariffPayment = activateTariffPayment;
exports.TARIFF_PAYMENTS_COLLECTION = TARIFF_PAYMENTS_COLLECTION;

exports._testables = {
  handleGetTariffPaymentStatus,
  handleSendTariffPaymentReminders,
  activateTariffPayment,
};
