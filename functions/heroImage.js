const { randomUUID } = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, GEMINI_API_KEY } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { incrementDailyStat } = require("./lib/dailyStats");
const { generateProductAdImage, generateProductShowcaseImage, isGeminiRateLimitError } = require("./lib/aiImage");
const { fetchTrustedImage } = require("./lib/safeFetch");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * SOTUVCHI — bitta mahsulot uchun, TALAB BO'YICHA (on-demand), AI
 * yordamida yangi "asosiy rasm" (hero image) yaratadi va uni DARHOL
 * mahsulotning asosiy (birinchi) rasmi sifatida saqlaydi.
 *
 * 2026-09, foydalanuvchi so'rovi bilan ESKI "Story rasm yaratish"
 * (`storyImage.js`, vertikal 9:16, faqat Instagram/Telegram
 * Story'larga qo'yish uchun mo'ljallangan, alohida yuklab olinadigan)
 * QO'LDA CHAQIRILADIGAN tugma O'RNIGA YARATILDI — sabab: 9:16 vertikal
 * rasm `ProductCard.jsx`dagi mahsulot kartochkasi joyiga (kengroq,
 * qariyb kvadrat, 180px balandlik, `object-cover`) SIG'MAYDI, juda
 * ko'p qismi kesilib qolardi. Bu YANGI funksiya esa doim KVADRAT (1:1)
 * rasm yaratadi — xuddi mavjud avtomatik "Instagram reklama rasmi"
 * (`productAutomation.js`dagi `maybeGenerateAdImage`) kabi, lekin bu
 * yerda SOTUVCHI ikkita tayyor USLUBDAN birini tanlaydi:
 * - "adCreative" — harakatchan, e'tibor tortuvchi reklama surati
 *   (mavjud `buildInstagramAdPrompt`, qayta ishlatiladi).
 * - "premiumShowcase" — tinch, hashamatli katalog/boutique uslubi
 *   (YANGI `buildPremiumShowcasePrompt`).
 *
 * MUHIM: bu, avtomatik "9:16 Story" pipeline'ini (`productAutomation.js`
 * dagi `maybeGenerateStoryImage`, `aiAutoStoryImageEnabled` sozlamasi
 * orqali yoqiladigan) UMUMAN O'ZGARTIRMAYDI — u alohida, haqiqiy
 * Story'larga qo'yish uchun MO'LJALLANGAN, o'z holicha davom etadi.
 * Bu YERDA faqat SOTUVCHI QO'LDA bosadigan, "asosiy rasmni
 * yaxshilash" tugmasi almashtirilmoqda.
 *
 * Xavfsizlik/xarajat nazorati (`storyImage.js`dagi ASL qaror bilan bir
 * xil tamoyillar):
 * - Faqat mahsulot egasi (`product.sellerId === request.auth.uid`).
 * - Faqat `aiCeoEnabled === true` sotuvchilar uchun (premium xususiyat
 *   - rasm generatsiyasi qimmat).
 * - Sotuvchi uchun kunlik chegara (`checkRateLimit`).
 */
const MAX_HERO_IMAGES_PER_SELLER_PER_DAY = 15;

// Uslub nomi -> Gemini chaqiruvchi funksiya. Noma'lum/berilmagan uslub
// "adCreative"ga tushadi (xavfsiz standart - funksiya hech qachon
// shunchaki noto'g'ri qiymat sababli butunlay ishlamay qolmasligi
// kerak).
const HERO_IMAGE_GENERATORS = {
  adCreative: generateProductAdImage,
  premiumShowcase: generateProductShowcaseImage,
};

async function handleGenerateProductHeroImage(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;

  const { productId, style } = request.data || {};
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "Mahsulot ID'si ko'rsatilishi shart.");
  }
  const resolvedStyle = HERO_IMAGE_GENERATORS[style] ? style : "adCreative";

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

  await checkRateLimit(`generateHeroImage:${sellerId}`, MAX_HERO_IMAGES_PER_SELLER_PER_DAY, 24 * 60 * 60);

  // RASM RESIZE: `product.image` yuklashda allaqachon siqilgan
  // (`storyImage.js`/`productAutomation.js`dagi izohga qarang) —
  // qo'shimcha resize shart emas.
  let imageRes;
  try {
    imageRes = await fetchTrustedImage(product.image);
  } catch (err) {
    console.error(`Hero rasm manbasi rad etildi (${sellerId}/${productId}):`, err.message);
    throw new HttpsError("failed-precondition", "Mahsulot rasmi manzili yaroqsiz.");
  }
  if (!imageRes.ok) {
    throw new HttpsError("internal", "Mahsulot rasmini yuklab bo'lmadi.");
  }
  const sourceBuffer = Buffer.from(await imageRes.arrayBuffer());
  const sourceMimeType = imageRes.headers.get("content-type") || "image/jpeg";

  let imageBase64, mimeType;
  try {
    ({ imageBase64, mimeType } = await HERO_IMAGE_GENERATORS[resolvedStyle]({
      imageBase64: sourceBuffer.toString("base64"),
      imageMimeType: sourceMimeType,
      productName: product.name,
      category: product.category,
    }));
  } catch (err) {
    console.error(`Hero rasm generatsiyasida xatolik (${sellerId}/${productId}):`, err);
    // 2026-09, Sentry orqali production'da ANIQLANGAN haqiqiy holat:
    // Gemini o'zining 429 (kvota/so'rovlar limiti) xatosini SDK'ning
    // ICHKI qayta urinishlaridan (`geminiClient.js`ga qarang) keyin ham
    // qaytarishi mumkin. Bu ODDIY ichki xato EMAS — foydalanuvchiga buni
    // aynan shunday, "vaqtinchalik band" sifatida ko'rsatish kerak,
    // "tizim buzilgan" degan noto'g'ri taassurot qoldirmaslik uchun.
    if (isGeminiRateLimitError(err)) {
      throw new HttpsError(
        "resource-exhausted",
        "AI hozircha juda band (so'rovlar limiti). Bir necha daqiqadan so'ng qayta urinib ko'ring."
      );
    }
    throw new HttpsError("internal", "AI rasm yarata olmadi. Birozdan so'ng qayta urinib ko'ring.");
  }

  const extension = mimeType.split("/").pop() || "png";
  const filePath = `products/${sellerId}/ai-hero-${productId}.${extension}`;
  const downloadToken = randomUUID();
  const bucket = admin.storage().bucket();
  await bucket.file(filePath).save(Buffer.from(imageBase64, "base64"), {
    metadata: {
      contentType: mimeType,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });
  // `storage.rules`dagi `products/{sellerId}/{fileName}` yo'li
  // allaqachon `allow read: if true` - boshqa AI rasmlar bilan bir xil
  // qoida, qo'shimcha o'zgarish shart emas.
  const heroImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  // ASOSIY RASM SIFATIDA O'RNATISH (foydalanuvchi so'rovi): yangi rasm
  // `images` ro'yxatining BOSHIGA qo'shiladi ("birinchi element = asosiy
  // rasm" qoidasi - `useProductImages.jsx`/`updateProductFull.js`dagi
  // BILAN BIR XIL), mavjud (haqiqiy) rasmlar esa GALEREYADA qoladi -
  // xaridor baribir mahsulotning haqiqiy ko'rinishini ko'ra oladi,
  // faqat kartochkada birinchi bo'lib AI rasm ko'rinadi. 4 tadan
  // ortiq bo'lib qolsa, eng oxirgisi chiqarib tashlanadi.
  const existingImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image ? [product.image] : []);
  const newImages = [heroImageUrl, ...existingImages].slice(0, 4);

  await db.collection("products").doc(productId).update({
    images: newImages,
    image: newImages[0],
    aiHeroImageUrl: heroImageUrl,
    aiHeroImageStyle: resolvedStyle,
    aiHeroImageGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await incrementDailyStat(sellerId, "aiHeroImagesGenerated");

  return { imageUrl: heroImageUrl, images: newImages };
}

exports.generateProductHeroImage = onCall(
  { region: "asia-south1", secrets: [GEMINI_API_KEY, SENTRY_DSN], timeoutSeconds: 120 },
  withSentry(handleGenerateProductHeroImage)
);

exports._testables = { handleGenerateProductHeroImage, MAX_HERO_IMAGES_PER_SELLER_PER_DAY };
