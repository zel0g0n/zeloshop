const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * SUPER-ADMIN: DO'KONNI BUTUNLAY (QAYTARIB BO'LMAYDIGAN) O'CHIRISH.
 *
 * 2026-09 punkt-royxati, 12-band: "dokonlarni butunlay ochirish buttoni
 * qoshilishi kerak ... dokonning barcha malumotlarini(client, products,
 * dokonga oid bolgan barcha malumotlar) ochirish".
 *
 * MUHIM FARQ "faolsizlantirish" (suspend)dan: suspend — QAYTARISH
 * MUMKIN bo'lgan, ma'lumotni saqlab qoluvchi vaqtinchalik holat
 * (`sellers/{id}.status = "suspended"` — `updateSellerStatus.js`).
 * Bu funksiya esa — QAYTARIB BO'LMAYDIGAN, HAQIQIY o'chirish. Shu
 * sababli:
 *   1) faqat `admins/{uid}` hujjatiga ega chaqiruvchi ishlatishi mumkin;
 *   2) chaqiruvchi do'kon nomini ANIQ (harf-baharf, katta-kichik
 *      harfsiz solishtirilgan) qayta yozib tasdiqlashi shart
 *      (`confirmStoreName`) — tasodifiy bosishning oldini olish uchun,
 *      frontendda ham xuddi shunday tasdiqlash oynasi bor
 *      (`AdminSellerCard.jsx`).
 *
 * NIMA O'CHIRILADI:
 *   - `products/{id}` (shu sellerId'ga tegishli barchasi) — HAR BIR
 *     mahsulot `recursiveDelete` bilan, ya'ni uning `reviews`
 *     subkolleksiyasi bilan birga.
 *   - `orders/{id}` (shu sellerId'ga tegishli barchasi).
 *   - `staff/{id}` (shu sellerId'ga tegishli barchasi).
 *   - `couriers/{id}` (shu sellerId'ga tegishli barchasi).
 *   - `carts/{id}` (shu sellerId'ga tegishli barchasi).
 *   - `sellers/{sellerId}` HUJJATINING O'ZI, `recursiveDelete` orqali —
 *     bu uning BARCHA subkolleksiyalarini (private, customerNotes,
 *     productDrafts, expenses, orderCosts, orderRollups, customers,
 *     coupons, referrals, courierInvites, staffInvites, counters,
 *     dailyStats, aiCeoPendingActions, aiCeoOutcomes, aiCeoLearning,
 *     sellerReferrals) HAM avtomatik o'chiradi.
 *
 * ATAYLAB O'CHIRILMAYDI: global `clients/{clientId}` hujjatlari — bu
 * mijoz hisoblari, KO'P sotuvchidan xarid qilishi mumkin, faqat BITTA
 * do'kon o'chirilgani uchun butun mijoz profili yo'q qilinishi
 * noto'g'ri bo'lardi (mijozning boshqa sotuvchilardagi tarixi,
 * bonuslari va h.k. saqlanib qolishi kerak).
 */
async function handleDeleteSellerPermanently(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  const { sellerId, confirmStoreName } = request.data || {};
  if (!sellerId) {
    throw new HttpsError("invalid-argument", "Do'kon ID'si berilmagan.");
  }

  const sellerRef = db.collection("sellers").doc(String(sellerId));
  const sellerSnap = await sellerRef.get();
  if (!sellerSnap.exists) {
    throw new HttpsError("not-found", "Bunday do'kon topilmadi.");
  }
  const seller = sellerSnap.data();
  const actualName = String(seller.storeName || "").trim().toLowerCase();
  const typedName = String(confirmStoreName || "").trim().toLowerCase();
  if (!typedName || typedName !== actualName) {
    throw new HttpsError(
      "failed-precondition",
      "Tasdiqlash uchun do'kon nomini ANIQ kiritishingiz kerak."
    );
  }

  const firestore = admin.firestore();

  // Mahsulotlarni HAR BIRINI alohida `recursiveDelete` bilan
  // o'chiramiz (shunda ularning `reviews` subkolleksiyasi ham
  // ketadi) — oddiy `batch.delete()` faqat mahsulot hujjatining
  // O'ZINI o'chiradi, subkolleksiyani QOLDIRIB ketardi.
  const productsSnap = await firestore.collection("products").where("sellerId", "==", sellerId).get();
  await Promise.all(productsSnap.docs.map((doc) => firestore.recursiveDelete(doc.ref)));

  // Qolgan "yassi" (subkolleksiyasiz) kolleksiyalar — oddiy
  // to'plamli (batched) o'chirish yetarli.
  const flatDeletes = [
    ["orders", "sellerId"],
    ["staff", "sellerId"],
    ["couriers", "sellerId"],
    ["carts", "sellerId"],
  ];

  let deletedCounts = { products: productsSnap.size, orders: 0, staff: 0, couriers: 0, carts: 0 };

  for (const [collectionName, field] of flatDeletes) {
    const snap = await firestore.collection(collectionName).where(field, "==", sellerId).get();
    deletedCounts[collectionName] = snap.size;
    // Firestore to'plamli yozuv (batch) chegarasi — 500. 400talik
    // bo'laklarga bo'lib, xavfsiz zaxira bilan o'chiramiz.
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = firestore.batch();
      docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  // Eng oxirida — do'konning o'zi, BARCHA subkolleksiyalari bilan
  // birga (private, coupons, customers, expenses, orderCosts,
  // orderRollups, productDrafts, customerNotes, courierInvites,
  // staffInvites, counters, dailyStats, aiCeoPendingActions,
  // aiCeoOutcomes, aiCeoLearning, sellerReferrals, referrals va h.k.)
  await firestore.recursiveDelete(sellerRef);

  console.log(`[adminSellerManagement] Do'kon butunlay o'chirildi: ${sellerId} ("${seller.storeName}") - admin: ${request.auth.uid}`, deletedCounts);

  return { success: true, deletedCounts };
}

exports.deleteSellerPermanently = onCall(
  { region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleDeleteSellerPermanently)
);

exports._testables = { handleDeleteSellerPermanently };
