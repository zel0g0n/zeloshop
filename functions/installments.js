const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * "BO'LIB TO'LASH" (installment) rejasidagi KEYINGI (ikkinchi,
 * uchinchi, ...) qismning to'lov chekini biriktirish uchun.
 *
 * NEGA ALOHIDA CLOUD FUNCTION KERAK: `firestore.rules`da
 * `orders/{orderId}` xaridor uchun UMUMAN yozib bo'lmaydigan hujjat -
 * faqat sotuvchi/xodim/admin cheklangan maydonlarni (status va h.k.)
 * yangilay oladi (batafsil izoh: `functions/orders.js`). Xaridorning
 * o'zi esa faqat O'ZINING buyurtmasiga, FAQAT navbatdagi to'lov
 * chekini biriktirishi kerak - shuning uchun bu ANIQ, tor maqsadli
 * server funksiyasi orqali amalga oshiriladi (xuddi
 * `getMyLoyaltyBalance`/`getReferralLeaderboard` kabi "tor doiradagi"
 * onCall naqshi, lekin bu yerda O'QISH emas, cheklangan YOZISH
 * uchun).
 *
 * Birinchi qism cheki buyurtma yaratilayotganda
 * (`functions/orders.js`dagi `handleCreateOrder`) allaqachon
 * biriktiriladi - bu funksiya faqat 2-, 3- va hokazo qismlar uchun.
 */
async function handleSubmitInstallmentPayment(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const clientId = request.auth.uid;
  await checkRateLimit(`submitInstallmentPayment:${clientId}`, 10, 60);

  const { orderId, receiptUrl } = request.data || {};
  if (!orderId || !receiptUrl) {
    throw new HttpsError("invalid-argument", "Buyurtma yoki chek ma'lumoti to'liq emas.");
  }

  const orderRef = db.collection("orders").doc(String(orderId));

  return db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new HttpsError("not-found", "Bunday buyurtma topilmadi.");
    }
    const order = orderSnap.data();

    if (order.clientId !== clientId) {
      throw new HttpsError("permission-denied", "Bu buyurtma sizga tegishli emas.");
    }

    const plan = order.installmentPlan;
    if (!plan || !Array.isArray(plan.amounts) || !Number.isInteger(plan.totalParts)) {
      throw new HttpsError("failed-precondition", "Bu buyurtmada bo'lib to'lash rejasi yo'q.");
    }
    if (Number(plan.partsPaid) >= plan.totalParts) {
      throw new HttpsError("failed-precondition", "Barcha qismlar allaqachon to'langan.");
    }

    // `partsPaid` (masalan 1) - 0-based massivda KEYINGI to'lanmagan
    // qismning indeksiga TENG (1-qism - index 0 - buyurtma
    // yaratilganda allaqachon to'langan, shuning uchun `partsPaid=1`
    // bo'lganda KEYINGI - index 1, ya'ni 2-qism).
    const nextIndex = Number(plan.partsPaid);
    const nextAmount = plan.amounts[nextIndex];
    const updatedPayments = [
      ...(Array.isArray(plan.payments) ? plan.payments : []),
      { index: nextIndex, amount: nextAmount, receiptUrl, submittedAtMs: Date.now() },
    ];
    const nextPartsPaid = nextIndex + 1;

    transaction.update(orderRef, {
      installmentPlan: {
        ...plan,
        partsPaid: nextPartsPaid,
        payments: updatedPayments,
      },
    });

    return { partsPaid: nextPartsPaid, totalParts: plan.totalParts, isFullyPaid: nextPartsPaid >= plan.totalParts };
  });
}

exports.submitInstallmentPayment = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleSubmitInstallmentPayment));
exports._testables = { handleSubmitInstallmentPayment };
