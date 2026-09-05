const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { computeSellerRatingDelta } = require("./lib/sellerTrustStats");
const { withSentry, SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");

// Sharhga biriktirilishi mumkin bo'lgan rasmlar soni chegarasi -
// Firestore hujjatini shishirmaslik va UI'ni oddiy saqlash uchun.
const MAX_REVIEW_PHOTOS = 3;

/**
 * XARIDOR — mahsulotga sharh va baho (reyting) qoldiradi.
 *
 * MUHIM XAVFSIZLIK QOIDASI: faqat shu mahsulotni HAQIQATAN xarid
 * qilib, YETKAZIB BERILGAN ("delivered") buyurtmasi bor mijozgina
 * sharh qoldira oladi — bu, soxta/spam sharhlarning oldini oladi va
 * "tasdiqlangan xarid" (verified purchase) tamoyilini ta'minlaydi.
 *
 * Har bir mijoz — har bir mahsulotga FAQAT BITTA sharh qoldiradi
 * (hujjat ID'si = mijoz ID'si) — qayta yuborsa, ESKI sharhi
 * YANGILANADI (tahrirlash imkoniyati sifatida ishlaydi).
 *
 * RASMLAR (`photoUrls`, IXTIYORIY): mijoz rasmni AVVAL o'zi
 * to'g'ridan-to'g'ri Storage'ga (`review-photos/{productId}/{clientId}/...`
 * - `storage.rules`da FAQAT shu mijozning o'ziga yozish ruxsat
 * etilgan) yuklaydi, bu yerga esa faqat TAYYOR URL manzillar
 * keladi - bu funksiya o'zi hech qanday fayl bilan ishlamaydi
 * (boshqa `onCall` funksiyalar - masalan `storyImage.js` - dagidan
 * farqli, chunki bu yerda AI qayta ishlash shart emas).
 */
async function handleSubmitProductReview(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  const clientId = request.auth.uid;
  await checkRateLimit(`submitProductReview:${clientId}`, 15, 3600);

  const { productId, rating, text, photoUrls } = request.data || {};
  const ratingNum = Number(rating);

  if (!productId) {
    throw new HttpsError("invalid-argument", "Mahsulot ko'rsatilishi shart.");
  }
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    throw new HttpsError("invalid-argument", "Baho 1 dan 5 gacha butun son bo'lishi kerak.");
  }
  const trimmedText = (text || "").trim().slice(0, 1000);
  const safePhotoUrls = Array.isArray(photoUrls)
    ? photoUrls.filter((url) => typeof url === "string" && url.trim().length > 0).slice(0, MAX_REVIEW_PHOTOS)
    : [];

  const productSnap = await db.collection("products").doc(productId).get();
  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Mahsulot topilmadi.");
  }
  const sellerId = productSnap.data().sellerId;

  // TASDIQLANGAN XARID TEKSHIRUVI: mijozning shu sotuvchidan, shu
  // mahsulotni o'z ichiga olgan, YETKAZIB BERILGAN buyurtmasi
  // borligini tekshiramiz.
  const ordersSnap = await db.collection("orders")
    .where("sellerId", "==", sellerId)
    .where("clientId", "==", clientId)
    .where("status", "==", "delivered")
    .get();

  const hasPurchased = ordersSnap.docs.some((doc) =>
    (doc.data().orders || []).some((item) => item.id === productId)
  );
  if (!hasPurchased) {
    throw new HttpsError(
      "permission-denied",
      "Faqat sotib olib, yetkazib berilgan mahsulotga sharh qoldirishingiz mumkin."
    );
  }

  // Mijozning ko'rinadigan ismini — HAQIQIY buyurtmasidan olamiz
  // (mijoz o'zi ixtiyoriy ism kiritib yubormasin).
  const customerName = ordersSnap.docs[0].data().customer?.fullName || "Mijoz";

  await db.collection("products").doc(productId).collection("reviews").doc(clientId).set({
    clientId,
    customerName,
    rating: ratingNum,
    text: trimmedText,
    photoUrls: safePhotoUrls,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    pinned: false,
  }, { merge: true });

  return { success: true };
}

/**
 * SOTUVCHI — o'z mahsulotidagi sharhni o'chiradi yoki "pin"
 * (birinchi o'ringa) qiladi. Faqat shu mahsulotning EGASI bajara
 * oladi.
 */
async function handleModerateProductReview(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  // MUHIM TUZATISH: bu funksiyada avval HECH QANDAY so'rov chegarasi
  // yo'q edi (loyihaning barcha boshqa `onCall` funksiyalari bilan
  // solishtirilganda topilgan yagona bo'shliq) - xato yoki
  // suiiste'mol tufayli tez-tez chaqirilib, Firestore yozuvlarini
  // keraksiz ko'paytirib yuborishning oldini olish uchun qo'shildi.
  await checkRateLimit(`moderateProductReview:${request.auth.uid}`, 30, 300);

  const { productId, reviewId, action } = request.data || {};
  if (!productId || !reviewId || !["delete", "pin", "unpin"].includes(action)) {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }

  const productSnap = await db.collection("products").doc(productId).get();
  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Mahsulot topilmadi.");
  }
  if (productSnap.data().sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z mahsulotingizdagi sharhlarni boshqarishingiz mumkin.");
  }

  const reviewRef = db.collection("products").doc(productId).collection("reviews").doc(reviewId);

  if (action === "delete") {
    await reviewRef.delete();
  } else {
    // "Pin" — bittadan ortiq sharh bir vaqtda pin qilinmasligi uchun,
    // avval BOSHQA barcha pin'larni tozalaymiz.
    if (action === "pin") {
      const pinnedSnap = await db.collection("products").doc(productId)
        .collection("reviews").where("pinned", "==", true).get();
      const batch = db.batch();
      pinnedSnap.forEach((doc) => batch.update(doc.ref, { pinned: false }));
      batch.update(reviewRef, { pinned: true });
      await batch.commit();
    } else {
      await reviewRef.update({ pinned: false });
    }
  }

  return { success: true };
}

/**
 * Sharh qo'shilganda/o'chirilganda/o'zgarganda, mahsulotning umumiy
 * (`averageRating`, `reviewCount`) ko'rsatkichlarini AVTOMATIK qayta
 * hisoblaydi — shu orqali mahsulot kartochkasida haqiqiy o'rtacha
 * bahoni ko'rsatish uchun, HAR SAFAR barcha sharhlarni yuklashning
 * hojati bo'lmaydi.
 *
 * SOTUVCHI ISHONCH TIZIMI (Trust Badges, v39.13): shu bir xil hodisada
 * — qo'shimcha Firestore o'qishsiz — sotuvchi darajasidagi (barcha
 * mahsulotlari bo'yicha JAMLANGAN) reyting yig'indisi/soni ham DELTA
 * orqali yangilanadi (`lib/sellerTrustStats.js`). Bu, `Header.jsx`/
 * `StoreInfoPage.jsx`dagi HAQIQIY ishonch nishonlari uchun asos —
 * hech qanday raqam o'ylab topilmaydi, faqat haqiqiy sharhlardan.
 */
const onReviewWritten = onDocumentWritten(
  { document: "products/{productId}/reviews/{reviewId}", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(async (event) => {
    const { productId } = event.params;
    const reviewsSnap = await db.collection("products").doc(productId).collection("reviews").get();

    if (reviewsSnap.empty) {
      await db.collection("products").doc(productId).set(
        { averageRating: 0, reviewCount: 0 },
        { merge: true }
      );
    } else {
      let sum = 0;
      reviewsSnap.forEach((doc) => { sum += Number(doc.data().rating) || 0; });
      const averageRating = Math.round((sum / reviewsSnap.size) * 10) / 10;

      await db.collection("products").doc(productId).set(
        { averageRating, reviewCount: reviewsSnap.size },
        { merge: true }
      );
    }

    try {
      const before = event.data?.before?.exists ? event.data.before.data() : null;
      const after = event.data?.after?.exists ? event.data.after.data() : null;
      const { ratingSumDelta, ratingCountDelta } = computeSellerRatingDelta(before, after);
      if (ratingSumDelta === 0 && ratingCountDelta === 0) return;

      const productSnap = await db.collection("products").doc(productId).get();
      const sellerId = productSnap.exists ? productSnap.data().sellerId : null;
      if (!sellerId) return; // Mahsulot o'chirilgan/topilmadi - sotuvchini aniqlab bo'lmaydi.

      await db.collection("sellers").doc(sellerId).set(
        {
          trustStats: {
            ratingSum: admin.firestore.FieldValue.increment(ratingSumDelta),
            ratingCount: admin.firestore.FieldValue.increment(ratingCountDelta),
          },
        },
        { merge: true }
      );
    } catch (err) {
      // Ishonch nishonlari — YORDAMCHI ko'rsatkich, mahsulot sharhi
      // yozuvining o'ziga (yuqorida, allaqachon muvaffaqiyatli
      // bajarilgan) ta'sir qilmasligi kerak.
      console.error(`Sotuvchi ishonch ko'rsatkichini yangilashda xatolik (mahsulot ${productId}):`, err);
      initSentry();
      Sentry.captureException(err, { extra: { productId } });
    }
  })
);

exports.submitProductReview = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleSubmitProductReview));
exports.moderateProductReview = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleModerateProductReview));
exports.onReviewWritten = onReviewWritten;

exports._testables = { handleSubmitProductReview, handleModerateProductReview, MAX_REVIEW_PHOTOS };
