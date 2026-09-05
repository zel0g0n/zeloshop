const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * ANALITIKA UCHUN — TO'LIQ (sahifalashsiz) MA'LUMOT.
 *
 * MUHIM TUZATISH (haqiqiy production xatosi, chuqur o'z-o'zini
 * tekshiruv orqali topilgan): `ProductAnalytics.jsx`/`OrderAnalytics.jsx`
 * OLDIN Buyurtmalar/Mahsulotlar BOSHQARUV sahifalari ishlatadigan
 * HOOK'larni ("useFilterOrders"/"useGetSellerProducts") qayta
 * ishlatardi - bular esa ATAYLAB CHEGARALANGAN (150 ta buyurtma,
 * 100 ta mahsulot, "Yana yuklash" bilan kengaytiriladigan) - bu,
 * ODDIY KO'RIB CHIQISH uchun to'g'ri (sahifa tez ochiladi), lekin
 * ANALITIKA uchun NOTO'G'RI edi: 150+ buyurtmasi bor do'kon uchun,
 * "Yil" davri tanlansa, daromad/buyurtma soni HAQIQIYSIDAN KAMROQ
 * ko'rsatilardi, "o'lik mahsulot" aniqlash esa noto'g'ri "hech
 * qachon sotilmagan" deb belgilashi mumkin edi - chunki haqiqiy
 * oxirgi sotuv sanasi 150-chegaradan TASHQARIDA qolib ketardi.
 *
 * YECHIM: Analitika sahifalari endi BU YERGA — alohida, sahifalashsiz
 * (faqat xavfsizlik uchun yuqori chegara bilan cheklangan) so'rovga
 * murojaat qiladi. Oddiy Buyurtmalar/Mahsulotlar BOSHQARUV sahifalari
 * esa O'ZGARISHSIZ, eski (tez, arzon, 150/100 talik) yo'lni
 * ishlatishda davom etadi - ular uchun to'liqlik unchalik muhim emas.
 *
 * XARAJAT HAQIDA OCHIQ GAP: bu, avvalgi (150 talik) yondashuvga
 * nisbatan KO'PROQ Firestore o'qishiga olib keladi - lekin bu,
 * noto'g'ri biznes ma'lumoti (masalan yolg'on "o'lik mahsulot"
 * statusi) keltirishi mumkin bo'lgan zarardan ko'ra arzonroq,
 * oqlangan almashinuv.
 */

const MAX_ANALYTICS_ORDERS = 3000;
const MAX_ANALYTICS_PRODUCTS = 2000;

async function handleGetAnalyticsOrders(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`getAnalyticsOrders:${request.auth.uid}`, 30, 300);

  const snap = await db.collection("orders")
    .where("sellerId", "==", request.auth.uid)
    .orderBy("createdAt", "desc")
    .limit(MAX_ANALYTICS_ORDERS)
    .get();

  const orders = snap.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data, createdAt: data.createdAt ? data.createdAt.toMillis() : null };
  });

  return { orders, truncated: orders.length === MAX_ANALYTICS_ORDERS };
}

async function handleGetAnalyticsProducts(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`getAnalyticsProducts:${request.auth.uid}`, 30, 300);

  const snap = await db.collection("products")
    .where("sellerId", "==", request.auth.uid)
    .limit(MAX_ANALYTICS_PRODUCTS)
    .get();

  const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return { products, truncated: products.length === MAX_ANALYTICS_PRODUCTS };
}

exports.getAnalyticsOrders = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetAnalyticsOrders));
exports.getAnalyticsProducts = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetAnalyticsProducts));

exports._testables = { handleGetAnalyticsOrders, handleGetAnalyticsProducts, MAX_ANALYTICS_ORDERS, MAX_ANALYTICS_PRODUCTS };
