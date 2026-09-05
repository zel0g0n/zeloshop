const { randomUUID } = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, GEMINI_API_KEY } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { incrementDailyStat } = require("./lib/dailyStats");
const { generateProductStoryImage } = require("./lib/aiImage");
const { fetchTrustedImage } = require("./lib/safeFetch");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * SOTUVCHI — bitta mahsulot uchun, TALAB BO'YICHA (on-demand), 9:16
 * "Story" (Instagram/Telegram Stories) formatidagi reklama surati
 * yaratadi.
 *
 * NEGA `productAutomation.js`dagi kvadrat reklama rasmidan FARQLI
 * ravishda, STANDART BO'YICHA AVTOMATIK EMAS, balki SOTUVCHI O'ZI
 * SO'RAGANDA ishlaydi: Story — vaqtinchalik, "hozir" e'lon qilish
 * uchun mo'ljallangan kontent (masalan sotuvchi aynan HOZIR bir
 * mahsulotni "story"ga qo'ymoqchi bo'lganda). Uni HAR bir mahsulot
 * yaratilganda AVTOMATIK generatsiya qilish (xuddi kvadrat rasm kabi)
 * KO'PCHILIK sotuvchi uchun foydasiz xarajat bo'lardi — ko'p mahsulot
 * hech qachon story sifatida ulashilmaydi. Shuning uchun bu ALOHIDA,
 * sotuvchi tomonidan aniq bosiladigan tugma orqali chaqiriladigan
 * onCall funksiya, HAR DOIM mavjud.
 *
 * YANGILANISH (#116): sotuvchi buni HAM ATAYLAB YOQISHI mumkin
 * (`aiAutoStoryImageEnabled: true`, standart bo'yicha O'CHIQ) —
 * bunday holda `productAutomation.js`dagi `maybeGenerateStoryImage`
 * xuddi shu natijani (bir xil `aiStoryImageUrl` maydoniga) HAR BIR
 * yangi mahsulot uchun AVTOMATIK yaratadi. Bu ikkalasi BUTUNLAY
 * mustaqil yo'llar — faqat natija maydoni bir xil, shuning uchun
 * qaysi yo'l bilan yaratilgan bo'lishidan qat'iy nazar, mavjud UI
 * (masalan "Story yuklab olish" tugmasi) baribir ishlayveradi.
 *
 * Xavfsizlik/xarajat nazorati (`maybeGenerateAdImage`dagi bilan bir
 * xil tamoyillar):
 * - Faqat mahsulot egasi (`product.sellerId === request.auth.uid`).
 * - Faqat `aiCeoEnabled === true` sotuvchilar uchun (premium xususiyat
 *   - rasm generatsiyasi qimmat).
 * - Sotuvchi uchun kunlik chegara (`checkRateLimit`) - qo'lda
 *   chaqirilsa ham, nazoratsiz xarajatning oldini olish uchun.
 */
const MAX_STORY_IMAGES_PER_SELLER_PER_DAY = 15;

async function handleGenerateStoryImage(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;

  const { productId } = request.data || {};
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "Mahsulot ID'si ko'rsatilishi shart.");
  }

  const [productSnap, sellerSnap] = await Promise.all([
    db.collection("products").doc(productId).get(),
    db.collection("sellers").doc(sellerId).get(),
  ]);

  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Mahsulot topilmadi.");
  }
  const product = productSnap.data();
  if (product.sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu mahsulot sizga tegishli emas.");
  }
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    throw new HttpsError("failed-precondition", "Bu funksiya faqat AI CEO yoqilgan sotuvchilar uchun mavjud.");
  }
  if (!product.image) {
    throw new HttpsError("failed-precondition", "Mahsulotda asosiy rasm yo'q.");
  }

  await checkRateLimit(`generateStoryImage:${sellerId}`, MAX_STORY_IMAGES_PER_SELLER_PER_DAY, 24 * 60 * 60);

  // RASM RESIZE (2026-09 audit): `product.image` yuklashda allaqachon
  // siqilgan (`useUploadStorage.jsx` → `compressImage`, maks. 1000x1000,
  // sifat 0.75) — qo'shimcha resize shart emas (`productAutomation.js`dagi
  // batafsil izohga qarang).
  let imageRes;
  try {
    imageRes = await fetchTrustedImage(product.image);
  } catch (err) {
    console.error(`Story rasm manbasi rad etildi (${sellerId}/${productId}):`, err.message);
    throw new HttpsError("failed-precondition", "Mahsulot rasmi manzili yaroqsiz.");
  }
  if (!imageRes.ok) {
    throw new HttpsError("internal", "Mahsulot rasmini yuklab bo'lmadi.");
  }
  const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());
  const sourceMimeType = imageRes.headers.get("content-type") || "image/jpeg";

  let imageBase64, mimeType;
  try {
    ({ imageBase64, mimeType } = await generateProductStoryImage({
      imageBase64: sourceBuffer.toString("base64"),
      imageMimeType: sourceMimeType,
      productName: product.name,
      category: product.category,
    }));
  } catch (err) {
    console.error(`Story rasm generatsiyasida xatolik (${sellerId}/${productId}):`, err);
    throw new HttpsError("internal", "AI story rasm yarata olmadi. Birozdan so'ng qayta urinib ko'ring.");
  }

  const extension = mimeType.split("/").pop() || "png";
  const filePath = `products/${sellerId}/ai-story-${productId}.${extension}`;
  const downloadToken = randomUUID();
  const bucket = admin.storage().bucket();
  await bucket.file(filePath).save(Buffer.from(imageBase64, "base64"), {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });
  // `storage.rules`dagi `products/{sellerId}/{fileName}` yo'li
  // allaqachon `allow read: if true` - kvadrat reklama rasmi bilan bir
  // xil qoida, qo'shimcha o'zgarish shart emas.
  const storyImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  await db.collection("products").doc(productId).update({
    aiStoryImageUrl: storyImageUrl,
    aiStoryImageGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await incrementDailyStat(sellerId, "aiStoryImagesGenerated");

  return { imageUrl: storyImageUrl };
}

exports.generateStoryImage = onCall(
  { region: "asia-south1", secrets: [GEMINI_API_KEY, SENTRY_DSN], timeoutSeconds: 120 },
  withSentry(handleGenerateStoryImage)
);

exports._testables = { handleGenerateStoryImage, MAX_STORY_IMAGES_PER_SELLER_PER_DAY };
