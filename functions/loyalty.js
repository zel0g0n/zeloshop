const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * SODIQLIK DASTURI ("Bonus hisobi") — YANGI TAVSIYA QILINGAN
 * FUNKSIYA (2026-09, "sellerning savdosini oshiruvchi" ro'yxati).
 *
 * Mijoz har bir YETKAZIB BERILGAN buyurtmadan (sotuvchi yoqqan
 * bo'lsa) bonus (so'm) yig'adi (`orderRollups.js`dagi
 * `applyCustomerRollup` orqali, `sellers/{id}/customers/{clientId}.
 * bonusBalance`ga yoziladi) va keyingi xaridida shu bonusni chegirma
 * sifatida ishlatishi mumkin (`orders.js`dagi `handleCreateOrder`,
 * `redeemBonusAmount`).
 *
 * Mijoz o'z bonus balansini TO'G'RIDAN-TO'G'RI Firestore'dan o'qiy
 * olmaydi — `sellers/{id}/customers/{clientId}` butun hujjati
 * FAQAT sotuvchi/admin uchun o'qiladigan (`firestore.rules`, CRM
 * ma'lumoti: LTV, telefon, F.I.Sh) — shuning uchun (xuddi
 * `paymentCardInfo.js`dagi kabi) FAQAT kerakli, tor doiradagi
 * ma'lumotni qaytaruvchi alohida onCall funksiya kerak.
 */
async function handleGetMyLoyaltyBalance(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const clientId = request.auth.uid;
  await checkRateLimit(`getMyLoyaltyBalance:${clientId}`, 30, 60);

  const { sellerId } = request.data || {};
  if (!sellerId) {
    throw new HttpsError("invalid-argument", "Sotuvchi ko'rsatilmagan.");
  }

  const sellerSnap = await db.collection("sellers").doc(String(sellerId)).get();
  const seller = sellerSnap.exists ? sellerSnap.data() : {};
  const enabled = seller.loyaltyEnabled === true;

  // Dastur o'chirilgan bo'lsa - so'rov qilib ko'rish shart emas, 0
  // qaytaramiz (checkout UI shunchaki bo'limni ko'rsatmaydi).
  if (!enabled) {
    return { enabled: false, balance: 0, earnPercent: 0, maxRedeemPercent: 0 };
  }

  const customerSnap = await db.collection("sellers").doc(String(sellerId))
    .collection("customers").doc(clientId).get();
  const balance = customerSnap.exists ? Math.max(0, Number(customerSnap.data().bonusBalance) || 0) : 0;

  return {
    enabled: true,
    balance,
    earnPercent: Number(seller.loyaltyEarnPercent) > 0 ? Number(seller.loyaltyEarnPercent) : 0,
    maxRedeemPercent: Number(seller.loyaltyMaxRedeemPercent) > 0 ? Number(seller.loyaltyMaxRedeemPercent) : 50,
  };
}

exports.getMyLoyaltyBalance = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetMyLoyaltyBalance));
exports._testables = { handleGetMyLoyaltyBalance };
