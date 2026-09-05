const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createGeminiClient } = require("./lib/geminiClient");
const { db, GEMINI_API_KEY } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const {
  containsMedicalIntent,
  pickReviewsForContext,
  buildProductContextText,
  buildProductAssistantSystemPrompt,
  MAX_REVIEWS_IN_CONTEXT,
} = require("./lib/productAssistant");

const MODEL = "gemini-3.5-flash-lite";
const SUPPORTED_LANGUAGES = ["uz", "ru", "en"];

// Faqat sotuvchi tomonidan kiritilgan sharhlarning eng SO'NGGI, matni
// bor qismini olamiz (`orderBy` YO'Q — mavjud, ALLAQACHON bor
// `products/{id}/reviews` kolleksiyasida qo'shimcha indeks talab
// qilmasligi uchun; `MAX_REVIEWS_IN_CONTEXT`dan biroz ko'proq (2x)
// o'qib, keyin `pickReviewsForContext` matni bor bo'lganlarini
// tanlaydi — chunki ko'p sharhning matni bo'sh, faqat yulduzcha
// bo'lishi mumkin).
const REVIEWS_FETCH_LIMIT = MAX_REVIEWS_IN_CONTEXT * 2;

/**
 * XARIDOR — mahsulot sahifasida erkin savol beradi, Gemini FAQAT
 * sotuvchi kiritgan mahsulot matni asosida javob beradi.
 *
 * XAVFSIZLIK (foydalanuvchi tasdiqlagan "qattiq cheklangan qamrov" —
 * batafsil izoh: `lib/productAssistant.js`): SOG'LIQ/tibbiy savollar
 * ikki qatlamda to'xtatiladi — bu yerda (1-qatlam, Gemini
 * chaqirilishidan OLDIN) va Gemini'ning o'zidagi tizim yo'riqnomasida
 * (2-qatlam).
 *
 * XARAJAT NAZORATI: (1) savol uzunligi cheklangan; (2) sharhlar soni
 * cheklangan (`MAX_REVIEWS_IN_CONTEXT`); (3) har bir MIJOZ-MAHSULOT
 * juftligi uchun ALOHIDA rate limit (bitta mahsulot haqida ko'p
 * savol berish normal, lekin cheksiz emas).
 */
async function handleAskProductQuestion(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  const clientId = request.auth.uid;

  const { productId, question, language } = request.data || {};
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "Mahsulot ko'rsatilishi shart.");
  }

  // Har bir MIJOZ-MAHSULOT juftligi uchun alohida chegara — foydalanuvchi
  // ko'p turli mahsulot haqida so'rasa ham, BITTA mahsulot bo'yicha
  // suhbatni cheksiz davom ettira olmaydi.
  await checkRateLimit(`askProductQuestion:${clientId}:${productId}`, 15, 3600);
  // XAVFSIZLIK (2026-09 audit, P2): yuqoridagi chegara FAQAT bitta
  // mahsulot bo'yicha — ya'ni bitta mijoz ko'p turli `productId`larga
  // tarqatib so'rasa (masalan skript orqali 1000 ta mahsulotga 15
  // tadan), UMUMIY xarajat CHEKSIZ o'sishi mumkin edi. Shuning uchun,
  // MIJOZNING O'ZI bo'yicha (mahsulotdan qat'i nazar) UMUMIY chegara
  // ham qo'shildi.
  await checkRateLimit(`askProductQuestionTotal:${clientId}`, 60, 3600);

  const trimmedQuestion = typeof question === "string" ? question.trim() : "";
  if (!trimmedQuestion || trimmedQuestion.length > 300) {
    throw new HttpsError("invalid-argument", "Savol matni noto'g'ri (1-300 belgi orasida bo'lishi kerak).");
  }
  const resolvedLanguage = SUPPORTED_LANGUAGES.includes(language) ? language : "uz";

  const productSnap = await db.collection("products").doc(productId).get();
  if (!productSnap.exists) {
    throw new HttpsError("not-found", "Mahsulot topilmadi.");
  }
  const product = productSnap.data();

  // 1-QATLAM: tezkor, deterministik kalit so'z tekshiruvi — Gemini
  // CHAQIRILMAYDI, javob har doim bir xil (kafolatlangan xavfsizlik).
  if (containsMedicalIntent(trimmedQuestion)) {
    return { answer: null, refused: true, refusalReason: "medical" };
  }

  let sellerName = "";
  if (product.sellerId) {
    const sellerSnap = await db.collection("sellers").doc(product.sellerId).get();
    sellerName = sellerSnap.exists ? sellerSnap.data().storeName || "" : "";
  }

  const reviewsSnap = await db
    .collection("products")
    .doc(productId)
    .collection("reviews")
    .limit(REVIEWS_FETCH_LIMIT)
    .get();
  const contextReviews = pickReviewsForContext(reviewsSnap.docs.map((d) => d.data()));
  const contextText = buildProductContextText(product, contextReviews);

  try {
    const ai = createGeminiClient(GEMINI_API_KEY.value());
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: trimmedQuestion,
      config: {
        // Past temperature — xayolparastlik (o'zi to'qib chiqargan
        // fakt) ehtimolini kamaytiradi, bu yerda ayniqsa muhim, chunki
        // yordamchi FAQAT berilgan matndan foydalanishi SHART.
        temperature: 0.2,
        systemInstruction: buildProductAssistantSystemPrompt({
          storeName: sellerName,
          contextText,
          language: resolvedLanguage,
        }),
      },
    });

    const answer = (response.text || "").trim();
    if (!answer) throw new Error("AI bo'sh javob qaytardi.");
    return { answer, refused: false };
  } catch (err) {
    console.error(`Mahsulot yordamchisi xatosi (mahsulot ${productId}):`, err);
    throw new HttpsError("internal", "Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

exports.askProductQuestion = onCall({ region: "asia-south1", secrets: [GEMINI_API_KEY, SENTRY_DSN] }, withSentry(handleAskProductQuestion));

exports._testables = { handleAskProductQuestion };
