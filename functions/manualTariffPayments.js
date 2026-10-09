const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { activateTariffPayment, TARIFF_PAYMENTS_COLLECTION } = require("./tariffPayments");
const { TARIFF_MONTHLY_PRICE_SOM, isTariffPurchasable } = require("./lib/tariffs");

/**
 * Z-TARIFLAR — QO'LDA TASDIQLASH OQIMI (2026-09-25).
 *
 * SABAB: platformada avtomatik to'lov shlyuzi yo'q - tarif to'lovi
 * FAQAT shu qo'lda tasdiqlash orqali. Foydalanuvchi (2026-09-25) aniq so'roviga ko'ra — XARIDOR checkout'idagi "Karta
 * orqali to'lash" (`functions/orders.js`dagi `paymentMethod: "card"`,
 * qarang: `Checkout.jsx`) bilan BIR XIL naqsh sotuvchi->platforma
 * to'lovi uchun ham qo'shildi:
 *
 *   1. ZeloShop O'ZINING karta raqami/egasi F.I.SH.ini sotuvchiga
 *      ko'rsatadi — `settings/manualTariffPayment` hujjatidan, TO'G'RIDAN-
 *      TO'G'RI Firestore SDK orqali o'qiladi (Cloud Function shart emas —
 *      bu bitta GLOBAL, PII bo'lmagan hujjat, `firestore.rules`dagi
 *      `allow read: if isSignedIn()` yetarli; solishtiring:
 *      `paymentCardInfo.js`dagi `getSellerPaymentCardInfo` Cloud Function
 *      qilib qilingan, chunki u SOTUVCHIGA XOS, ko'p hujjatli ma'lumot —
 *      ommaviy yig'ish xavfi bor edi, bu yerda esa yo'q). Admin
 *      `setManualTariffPaymentInfo` orqali BIR MARTA kiritadi.
 *   2. Sotuvchi shu kartaga o'tkazma qiladi, to'lov chekining
 *      skrinshotini yuklaydi va `submitManualTariffPayment`ni chaqiradi
 *      — bu `atmosPayments/{docId}` hujjatini `method: "manual"`,
 *      `status: "pending_review"` bilan yaratadi (kolleksiya nomi
 *      `atmosPayments` bo'lib qolgan, qarang: `tariffPayments.js`).
 *   3. Admin (`admins/{uid}`) yangi Admin panel bo'limida
 *      (`AdminManualTariffPaymentsPage.jsx`) chek skrinshotini ko'rib,
 *      HAQIQATAN o'z kartasiga pul tushganini TASHQARIDA (bank ilovasi)
 *      tekshiradi, so'ng `reviewManualTariffPayment`ni chaqiradi:
 *      tasdiqlasa — `tariffPayments.js`dagi `activateTariffPayment`
 *      ishga tushadi, rad etsa — hujjat `status: "rejected"` bo'ladi va
 *      sotuvchiga sababi bilan Telegram xabari yuboriladi.
 *
 * XAVFSIZLIK: bu yerda HECH QANDAY tashqi to'lov API'si yo'q — bor-yo'g'i
 * ikkita Firestore yozuvi (holat) va Telegram xabarnomasi. Haqiqiy pul
 * harakati BUTUNLAY tizim TASHQARISIDA (bank ilovasi orqali) sodir
 * bo'ladi — shuning uchun `reviewManualTariffPayment`ga faqat admin
 * kira olishi AYNIQSA muhim (pastdagi qo'lda tekshiruv, `firestore.rules`
 * bilan bir xil `admins/{uid}` konvensiyasi).
 */

/**
 * SUPER-ADMIN: ZeloShop'ning qo'lda-to'lov uchun karta raqami/egasi
 * F.I.SH.ini o'rnatadi yoki yangilaydi. `enabled: false` yuborilsa —
 * ma'lumot O'CHIRILMAYDI, faqat sotuvchilarga ko'rsatilishi to'xtaydi
 * (masalan vaqtincha qabul qilishni to'xtatish uchun, karta raqamini
 * qaytadan kiritishga hojat qoldirmasdan).
 */
async function handleSetManualTariffPaymentInfo(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  // Parol bilan (veb) kirilgan sessiya HECH QACHON admin huquqiga ega emas
  // (`webAppAuth.js`dagi `loginMethod: "password"` da'vosi) — admin faqat Telegram orqali.
  if (!adminSnap.exists || request.auth.token?.loginMethod === "password") {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  const { cardNumber, cardHolderName, enabled } = request.data || {};
  const normalizedCardNumber = String(cardNumber || "").replace(/\s+/g, "");
  const normalizedHolderName = String(cardHolderName || "").trim();

  if (enabled !== false) {
    if (!/^\d{16}$/.test(normalizedCardNumber)) {
      throw new HttpsError("invalid-argument", "Karta raqami 16 ta raqamdan iborat bo'lishi kerak.");
    }
    if (!normalizedHolderName) {
      throw new HttpsError("invalid-argument", "Karta egasining F.I.SH.i talab qilinadi.");
    }
  }

  await db.collection("settings").doc("manualTariffPayment").set({
    cardNumber: normalizedCardNumber || null,
    cardHolderName: normalizedHolderName || null,
    enabled: enabled !== false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  }, { merge: true });

  return { success: true };
}

exports.setManualTariffPaymentInfo = onCall(
  { region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleSetManualTariffPaymentInfo)
);

/**
 * Sotuvchi ZeloShop kartasiga o'tkazma qilib, chek skrinshotini
 * yuklaganidan keyin — ko'rib chiqish uchun navbatga qo'yadi.
 */
async function handleSubmitManualTariffPayment(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`submitManualTariffPayment:${sellerId}`, 10, 3600);

  const plan = String(request.data?.plan || "");
  if (!isTariffPurchasable(plan)) {
    throw new HttpsError("invalid-argument", "Bu tarif hozircha to'g'ridan-to'g'ri sotib olinmaydi.");
  }
  const receiptUrl = String(request.data?.receiptUrl || "").trim();
  if (!receiptUrl) {
    throw new HttpsError("invalid-argument", "To'lov chekining skrinshotini yuklashingiz shart.");
  }

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists) {
    throw new HttpsError("failed-precondition", "Sotuvchi hujjati topilmadi.");
  }
  const seller = sellerSnap.data();

  const settingsSnap = await db.collection("settings").doc("manualTariffPayment").get();
  if (!settingsSnap.exists || !settingsSnap.data().enabled) {
    throw new HttpsError("failed-precondition", "Qo'lda to'lov hozircha yoqilmagan.");
  }

  const amountSom = TARIFF_MONTHLY_PRICE_SOM[plan];
  const amountTiyin = Math.round(amountSom * 100);
  const safeSellerId = String(sellerId).toLowerCase().replace(/[^a-z0-9]/g, "");
  const docId = `manual_${safeSellerId}_${Date.now()}`;

  // `storeName`/`sellerPhone` — SURATGA OLINADI (snapshot), sotuvchi
  // hujjatidan yana o'qimasdan Admin panelida ("To'lov tekshiruvi")
  // ko'rsatish uchun — `tariffRequests`dagi (`AdminTariffRequestsPage.jsx`)
  // BIR XIL naqsh.
  await db.collection(TARIFF_PAYMENTS_COLLECTION).doc(docId).set({
    sellerId,
    plan,
    amountSom,
    amountTiyin,
    method: "manual",
    status: "pending_review",
    receiptUrl,
    storeName: seller.storeName || null,
    sellerPhone: seller.phone || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Adminga (barcha `admins/{uid}` hujjatlariga — loyihada odatda
  // bitta, egasining o'zi) Telegram orqali darhol xabar beramiz, u
  // Admin panelni ochmasdan ham yangi so'rov borligini bilsin.
  // Xabar yuborilmasa ham (Telegram vaqtincha ishlamasa) so'rovning
  // o'zi allaqachon yaratilgan — shuning uchun xato TASHLANMAYDI.
  try {
    const adminsSnap = await db.collection("admins").get();
    const storeName = seller.storeName || "Nomsiz do'kon";
    const text = [
      "💳 *Yangi qo'lda to'lov cheki*",
      "",
      `Do'kon: ${storeName}`,
      `Tarif: ${plan.toUpperCase()}`,
      `Summa: ${amountSom.toLocaleString()} so'm`,
      "",
      "Admin panelidagi \"To'lov tekshiruvi\" bo'limidan ko'rib chiqing.",
    ].join("\n");
    await Promise.all(
      adminsSnap.docs.map((doc) =>
        sendTelegramMessage(BOT_TOKEN.value(), doc.id, text, {
          buttonText: "Ko'rib chiqish",
          buttonUrl: buildSellerAppLink("/manual-tariff-payments"),
        }).catch(() => {})
      )
    );
  } catch (err) {
    console.error("submitManualTariffPayment: adminga xabar yuborishda xatolik:", err);
  }

  return { paymentDocId: docId, status: "pending_review", amountSom };
}

exports.submitManualTariffPayment = onCall(
  { region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(handleSubmitManualTariffPayment)
);

/**
 * SUPER-ADMIN: qo'lda yuborilgan to'lovni ko'rib chiqib, tasdiqlaydi
 * yoki rad etadi. Tasdiqlash — `tariffPayments.js`dagi `activateTariffPayment`
 * orqali, shuning uchun `tariffPaidUntil`/
 * AI CEO faollashtirish IKKALA oqim uchun bir xil, izchil ishlaydi.
 */
async function handleReviewManualTariffPayment(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  // Parol bilan (veb) kirilgan sessiya HECH QACHON admin huquqiga ega emas
  // (`webAppAuth.js`dagi `loginMethod: "password"` da'vosi) — admin faqat Telegram orqali.
  if (!adminSnap.exists || request.auth.token?.loginMethod === "password") {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  const paymentDocId = String(request.data?.paymentDocId || "");
  const action = request.data?.action;
  if (!paymentDocId) {
    throw new HttpsError("invalid-argument", "paymentDocId talab qilinadi.");
  }
  if (action !== "approve" && action !== "reject") {
    throw new HttpsError("invalid-argument", `Noto'g'ri amal: "${action}".`);
  }

  const paymentRef = db.collection(TARIFF_PAYMENTS_COLLECTION).doc(paymentDocId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    throw new HttpsError("not-found", "To'lov topilmadi.");
  }
  const payment = paymentSnap.data();
  if (payment.method !== "manual") {
    // Bu funksiya FAQAT qo'lda yuborilgan (`method: "manual"`) to'lovlar
    // uchun - boshqa turdagi yozuvlarga tegilmasligi kerak.
    throw new HttpsError("invalid-argument", "Bu to'lov qo'lda yuborilgan emas.");
  }

  if (action === "approve") {
    if (payment.status === "paid") {
      return { status: "paid", alreadyProcessed: true };
    }
    const result = await activateTariffPayment({ paymentDocId, callbackRaw: null });
    await paymentRef.update({
      reviewedBy: request.auth.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await sendTelegramMessage(
        BOT_TOKEN.value(),
        payment.sellerId,
        `✅ To'lovingiz tasdiqlandi!\n\n${payment.plan.toUpperCase()} tarifi faollashtirildi.`,
        { buttonText: "Tariflarni ko'rish", buttonUrl: buildSellerAppLink("/seller/tariffs") }
      );
    } catch (err) {
      console.error("reviewManualTariffPayment: sotuvchiga xabar yuborishda xatolik:", err);
    }

    return { status: "paid", plan: result.plan, paidUntilMs: result.paidUntilMs };
  }

  // action === "reject"
  if (payment.status === "paid") {
    throw new HttpsError("failed-precondition", "Bu to'lov allaqachon tasdiqlangan, rad etib bo'lmaydi.");
  }
  if (payment.status === "rejected") {
    return { status: "rejected", alreadyProcessed: true };
  }

  const rejectReason = String(request.data?.rejectReason || "").trim() || null;
  await paymentRef.update({
    status: "rejected",
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    rejectedBy: request.auth.uid,
    rejectReason,
  });

  try {
    const reasonLine = rejectReason ? `\n\nSabab: ${rejectReason}` : "";
    await sendTelegramMessage(
      BOT_TOKEN.value(),
      payment.sellerId,
      `❌ To'lov cheki rad etildi.${reasonLine}\n\nIltimos, to'lovni tekshirib, qaytadan yuboring yoki admin bilan bog'laning.`,
      { buttonText: "Tariflarni ko'rish", buttonUrl: buildSellerAppLink("/seller/tariffs") }
    );
  } catch (err) {
    console.error("reviewManualTariffPayment: sotuvchiga xabar yuborishda xatolik (rad etish):", err);
  }

  return { status: "rejected" };
}

exports.reviewManualTariffPayment = onCall(
  { region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  withSentry(handleReviewManualTariffPayment)
);

exports._testables = {
  handleSetManualTariffPaymentInfo,
  handleSubmitManualTariffPayment,
  handleReviewManualTariffPayment,
};
