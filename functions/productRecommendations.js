const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("./lib/admin");
const { processBatched } = require("./lib/batchProcess");
const { buildCooccurrenceMap, buildFrequentlyBoughtWithEntries } = require("./lib/productRecommendations");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Smart Upsell/Cross-sell (v39.13) — HAQIQIY (yetkazib berilgan)
 * buyurtmalar tarixidan, har bir mahsulot uchun "ko'pincha birga
 * sotib olinadigan" mahsulotlar ro'yxatini hisoblab,
 * `products/{id}.frequentlyBoughtWith`ga yozadi. Frontend
 * (`src/utils/productRecommendations.js`) bu ma'lumot yetarli
 * bo'lmagan hollarda (yangi mahsulot/kam buyurtma) avtomatik
 * ravishda kategoriya-asoslangan zaxiraga qaytadi - hech qanday
 * uydirma/taxminiy "trend" YO'Q.
 *
 * MUHIM (indeks tejash): so'rov ATAYLAB `orderBy("createdAt")` DAN
 * FOYDALANMAYDI — bu, mavjud bo'lmagan YANGI uch maydonli composite
 * indeks (`sellerId`+`status`+`createdAt`) talab qilar edi, alohida
 * `firestore:indexes` deploy bosqichini talab qiladi (loyiha
 * xotirasidagi o'rnatilgan qoida: "avoid a new composite index when
 * existing data/queries can serve"). Mavjud `sellerId`+`status`
 * indeksi YETARLI — narxi: juda ko'p (1000+) yetkazilgan buyurtmasi
 * bor sotuvchi uchun "ENG SO'NGGI 1000 ta" emas, balki "1000 ta"
 * buyurtma tanlanadi (tartib kafolatlanmaydi) — naqsh aniqlash uchun
 * bu YETARLI, va hozirgi bosqichda (yangi platforma) amalda hech bir
 * sotuvchida bunday hajm yo'q.
 */
const MAX_ORDERS_PER_SELLER = 1000;
// Firestore `batch()` operatsiyasining qattiq chegarasi - 500 ta yozuv.
const FIRESTORE_BATCH_LIMIT = 500;

async function computeSellerProductRecommendations(sellerId) {
  const ordersSnap = await db.collection("orders")
    .where("sellerId", "==", sellerId)
    .where("status", "==", "delivered")
    .limit(MAX_ORDERS_PER_SELLER)
    .get();

  if (ordersSnap.empty) return { productsUpdated: 0 };

  const orders = ordersSnap.docs.map((d) => d.data());
  const cooccurrenceMap = buildCooccurrenceMap(orders);
  if (cooccurrenceMap.size === 0) return { productsUpdated: 0 };

  const entries = Array.from(buildFrequentlyBoughtWithEntries(cooccurrenceMap).entries());

  for (let i = 0; i < entries.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch();
    entries.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach(([productId, frequentlyBoughtWith]) => {
      batch.set(db.collection("products").doc(productId), { frequentlyBoughtWith }, { merge: true });
    });
    await batch.commit();
  }

  return { productsUpdated: entries.length };
}

exports.computeProductRecommendations = onSchedule(
  {
    // Tunda, boshqa og'ir kunlik ishlardan (P&L hisoboti 21:00, AI
    // CEO tasdiqlash 20:30) uzoqroq vaqtda - resurs to'qnashuvidan
    // qochish uchun.
    schedule: "0 4 * * *", timeZone: "Asia/Tashkent", region: "asia-south1",
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi (batafsil izoh:
    // `lib/batchProcess.js`).
    timeoutSeconds: 300,
    secrets: [SENTRY_DSN],
  },
  withSentry(async () => {
    const sellersSnap = await db.collection("sellers").get();
    if (sellersSnap.empty) return;

    // Sotuvchilar orasida umumiy o'zgaruvchan holat yo'q (har biri
    // faqat o'z mahsulotlarini yangilaydi), shuning uchun oddiy
    // PARALEL guruhlash yetarli.
    const result = await processBatched(sellersSnap.docs, async (sellerDoc) => {
      try {
        await computeSellerProductRecommendations(sellerDoc.id);
      } catch (err) {
        console.error(`Mahsulot tavsiyalarini hisoblashda xatolik (sotuvchi ${sellerDoc.id}):`, err);
        throw err;
      }
    });
    console.log(`computeProductRecommendations: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

exports._testables = { computeSellerProductRecommendations };
