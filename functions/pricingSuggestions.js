const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createGeminiClient } = require("./lib/geminiClient");
const { admin, db, GEMINI_API_KEY } = require("./lib/admin");
const { incrementDailyStat } = require("./lib/dailyStats");
const { DEFAULT_GENERATION_CONFIG, BASE_STYLE_INSTRUCTION } = require("./lib/aiStyle");
const { processBatched } = require("./lib/batchProcess");
const { computePricingSuggestion, buildCategoryPriceIndex, getCategoryPriceContext } = require("./lib/dynamicPricing");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * AI CEO — "AI NARX TAVSIYALARI" (dynamic pricing, TAKLIF SHAKLIDA).
 *
 * MUHIM, ATAYLAB QILINGAN ARXITEKTURAVIY QAROR (`telegramApproval.js`da
 * ALLAQACHON yozilgan izohga qarang): mahsulot narxini o'zgartirish
 * haqiqiy moliyaviy ta'sirga ega va oson qaytariladigan harakat emas -
 * shuning uchun bu modul HECH QACHON narxni o'zi o'zgartirmaydi. Har
 * haftada bir marta (cron), FAQAT ANIQ signal (`lib/dynamicPricing.js`)
 * topilgan mahsulotlar uchun tavsiya yaratiladi va
 * `sellers/{id}/pricingSuggestions/{productId}`ga yoziladi - sotuvchi
 * buni Mini App ichida (`PricingSuggestionsPage.jsx`) ko'radi va FAQAT
 * o'zi aniq "Qo'llash" tugmasini bosgandagina haqiqiy narx o'zgaradi
 * (`applyPricingSuggestion`). Hech qanday Telegram bir-tugmali
 * avto-tasdiqlash YO'Q (`resolvePendingAction` orqali emas) - bu
 * ATAYLAB shunday, xuddi chegirma/kupon harakatlari kabi.
 *
 * IKKI QATLAMLI YONDASHUV (raqam vs matn):
 * - TAVSIYA QILINGAN NARXNING O'ZI (`suggestedPrice`, `changePercent`,
 *   `type`) — 100% DETERMINISTIK, oddiy dastur kodi
 *   (`lib/dynamicPricing.js`) tomonidan, faqat HAQIQIY Firestore
 *   maydonlaridan hisoblanadi. Gemini bu raqamni HECH QACHON
 *   o'zgartirmaydi yoki o'ylab topmaydi.
 * - FAQAT TUSHUNTIRISH MATNI (`reasoning`) Gemini tomonidan, OLDIN
 *   HISOBLANGAN haqiqiy raqamlar asosida yoziladi (`craftWinBackMessage`
 *   naqshi bilan bir xil tamoyil: "AI hech qachon moliyaviy jihatdan
 *   bog'lovchi raqamni o'ylab topmaydi"). Gemini xato bersa/ishlamasa,
 *   oddiy, deterministik shablon matn (`buildFallbackReasoning`)
 *   ishlatiladi - tavsiya HECH QACHON faqat Gemini ishlamagani uchun
 *   yo'qolib qolmaydi.
 *
 * XARAJAT NAZORATI: faqat `aiCeoEnabled === true` VA sotuvchi ALOHIDA
 * yoqqan (`aiPricingSuggestionsEnabled === true`, standart holatda
 * o'chiq) sotuvchilar uchun ishlaydi; bitta ishga tushirishda, bitta
 * sotuvchi uchun ko'rib chiqiladigan mahsulotlar soni cheklangan
 * (`MAX_PRODUCTS_PER_SELLER_PER_RUN`).
 */
const PRICING_MODEL = "gemini-3.5-flash-lite";
const MAX_PRODUCTS_PER_SELLER_PER_RUN = 30;

/**
 * Sof funksiya - Gemini uchun promptni quradi. To'g'ridan-to'g'ri
 * test qilinadi.
 */
function buildPricingReasoningPrompt({ productName, type, currentPrice, suggestedPrice, changePercent, stock, sold, daysListed, categoryAvgPrice, categorySampleSize }) {
  const direction = (type === "slow_mover_discount" || type === "category_price_high") ? "narxni PASAYTIRISH" : "narxni OSHIRISH";
  let context;
  if (type === "slow_mover_discount") {
    context = `Bu mahsulot ${daysListed} kundan beri ro'yxatda, lekin atigi ${sold} dona sotilgan, ombordagi ${stock} dona hali sotilmay turibdi.`;
  } else if (type === "high_demand_increase") {
    context = `Bu mahsulot juda tez sotilmoqda - hozirgacha ${sold} dona sotilgan, ombordan atigi ${stock} dona qoldi.`;
  } else if (type === "category_price_high") {
    context = `Bu mahsulotning narxi, sizning O'ZINGIZning shu kategoriyadagi boshqa ${categorySampleSize} ta mahsulotingizning o'rtacha narxi (${Number(categoryAvgPrice).toLocaleString()} so'm)dan SEZILARLI YUQORI.`;
  } else {
    context = `Bu mahsulotning narxi, sizning O'ZINGIZning shu kategoriyadagi boshqa ${categorySampleSize} ta mahsulotingizning o'rtacha narxi (${Number(categoryAvgPrice).toLocaleString()} so'm)dan SEZILARLI PAST.`;
  }

  return `Sen — kichik onlayn do'kon egasiga narx tavsiyasini tushuntirib beruvchi yordamchisisan.

MAHSULOT: "${productName || "Mahsulot"}"
HOLAT: ${context}
TAVSIYA: ${direction}, ${Number(currentPrice).toLocaleString()} so'mdan ${Number(suggestedPrice).toLocaleString()} so'mga (${changePercent > 0 ? "+" : ""}${changePercent}%).

VAZIFA: sotuvchiga, NEGA aynan shu tavsiya berilganini, QISQA (1-2 gap), sodda va tushunarli tilda tushuntir. Faqat yuqoridagi HAQIQIY raqamlarga tayan — o'zing hech qanday yangi raqam yoki fakt o'ylab topma.

QOIDALAR:
- O'ZBEK TILIDA yoz.
- Faqat tushuntirish matnini yoz, boshqa hech narsa (sarlavha, salomlashish) qo'shma.`;
}

/**
 * Gemini ishlamasa/xato bersa ishlatiladigan, oddiy, deterministik
 * shablon matn — tavsiya hech qachon FAQAT Gemini ishlamagani uchun
 * yo'qolib qolmasligi kerak (`aiImage.js`/boshqa AI CEO funksiyalari
 * bilan bir xil "AI matni ixtiyoriy boyitish" tamoyili).
 */
function buildFallbackReasoning({ type, changePercent, categorySampleSize }) {
  switch (type) {
    case "slow_mover_discount":
      return `Bu mahsulot uzoq vaqtdan beri kam sotilmoqda. ${Math.abs(changePercent)}% chegirma zaxirani harakatga keltirishga yordam berishi mumkin.`;
    case "high_demand_increase":
      return `Bu mahsulotga talab yuqori, zaxira esa kamayib bormoqda. Narxni ${changePercent}%ga oshirish mumkin.`;
    case "category_price_high":
      return `Bu mahsulotning narxi, sizning shu kategoriyadagi boshqa ${categorySampleSize} ta mahsulotingizning o'rtacha narxidan sezilarli yuqori. Narxni ${Math.abs(changePercent)}%ga pasaytirish mumkin.`;
    default:
      return `Bu mahsulotning narxi, sizning shu kategoriyadagi boshqa ${categorySampleSize} ta mahsulotingizning o'rtacha narxidan sezilarli past. Narxni ${changePercent}%ga oshirish mumkin.`;
  }
}

async function craftPricingSuggestionReasoning(params) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: PRICING_MODEL,
    contents: buildPricingReasoningPrompt(params),
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const text = (response.text || "").trim();
  if (!text) throw new Error("AI bo'sh javob qaytardi.");
  return text;
}

/**
 * Bitta sotuvchi uchun: faol mahsulotlarini ko'rib chiqadi, har biri
 * uchun tavsiya hisoblaydi, va Firestore'dagi tavsiyalar ro'yxatini
 * (`sellers/{id}/pricingSuggestions`) YANGI holatga mos qiladi - agar
 * signal endi yo'q bo'lsa (masalan sotuvchi narxni o'zgartirdi yoki
 * zaxira to'ldi), ESKI tavsiya o'chiriladi (ro'yxat doim DOLZARB
 * bo'lib qolishi uchun).
 */
async function processSellerPricingSuggestions(sellerDoc) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;
  if (seller.aiCeoEnabled !== true || seller.aiPricingSuggestionsEnabled !== true) return;

  const productsSnap = await db.collection("products").where("sellerId", "==", sellerId).get();
  if (productsSnap.empty) return;

  const allActiveProducts = productsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.isActive !== false);
  if (allActiveProducts.length === 0) return;

  // Kategoriya bo'yicha o'rtacha narx indeksi - sotuvchining BARCHA
  // faol mahsulotidan (quyidagi `MAX_PRODUCTS_PER_SELLER_PER_RUN`
  // kesilishidan OLDIN) quriladi, shu jumladan bu safar ko'rib
  // chiqilmaydigan mahsulotlar ham - aks holda o'rtacha narx faqat
  // "shu safargi" kichik qismdan hisoblanib, noto'g'ri chiqishi mumkin.
  const categoryIndex = buildCategoryPriceIndex(allActiveProducts);

  const activeProducts = allActiveProducts.slice(0, MAX_PRODUCTS_PER_SELLER_PER_RUN);

  const suggestionsRef = db.collection("sellers").doc(sellerId).collection("pricingSuggestions");

  await processBatched(activeProducts, async (product) => {
    const categoryContext = getCategoryPriceContext(product, categoryIndex);
    const suggestion = computePricingSuggestion(product, Date.now(), categoryContext);
    const docRef = suggestionsRef.doc(product.id);

    if (!suggestion) {
      await docRef.delete().catch(() => {});
      return;
    }

    let reasoning;
    try {
      reasoning = await craftPricingSuggestionReasoning({ productName: product.name, ...suggestion });
    } catch (err) {
      console.warn(`Narx tavsiyasi izohini Gemini yoza olmadi (${sellerId}/${product.id}), zaxira matn ishlatiladi:`, err.message);
      reasoning = buildFallbackReasoning(suggestion);
    }

    await docRef.set({
      productId: product.id,
      productName: product.name || "",
      productImage: product.image || null,
      ...suggestion,
      reasoning,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }, 5);
}

exports.computePricingSuggestions = onSchedule(
  {
    // Haftada bir marta - narx har kuni o'zgarib turishi mijozlar
    // uchun ham, sotuvchi uchun ham chalkash bo'lardi (narxlash
    // barqarorligi), shuning uchun ATAYLAB kunlik emas.
    schedule: "0 6 * * 1",
    timeZone: "Asia/Tashkent",
    region: "asia-south1",
    secrets: [GEMINI_API_KEY, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const eligibleSellersSnap = await db.collection("sellers").where("aiCeoEnabled", "==", true).get();
    if (eligibleSellersSnap.empty) return;

    const result = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
      try {
        await processSellerPricingSuggestions(sellerDoc);
      } catch (err) {
        console.error(`AI narx tavsiyalarini hisoblashda xatolik (sotuvchi ${sellerDoc.id}):`, err);
        throw err;
      }
    });
    console.log(`computePricingSuggestions: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

/**
 * SOTUVCHI — bitta narx tavsiyasini KO'RIB CHIQIB, ANIQ tasdiqlaydi.
 *
 * MUHIM: tavsiyani KO'R-KO'RONA qo'llamaymiz. Tavsiya yaratilganidan
 * beri mahsulot holati o'zgargan bo'lishi mumkin (sotuvchi narxni
 * qo'lda o'zgartirgan, zaxira tugagan va h.k.) - shuning uchun
 * mahsulotning HOZIRGI holatidan tavsiyani QAYTA hisoblaymiz va faqat
 * u ESKI tavsiya bilan BIR XIL turda bo'lsagina qo'llaymiz. Aks holda
 * "eskirgan" xato qaytariladi va eskirgan tavsiya o'chiriladi.
 */
async function handleApplyPricingSuggestion(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  const { productId } = request.data || {};
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "Mahsulot ID'si ko'rsatilishi shart.");
  }

  const suggestionRef = db.collection("sellers").doc(sellerId).collection("pricingSuggestions").doc(productId);
  const productRef = db.collection("products").doc(productId);

  const appliedPrice = await db.runTransaction(async (transaction) => {
    const [suggestionSnap, productSnap] = await Promise.all([
      transaction.get(suggestionRef),
      transaction.get(productRef),
    ]);

    if (!suggestionSnap.exists) {
      throw new HttpsError("not-found", "Bu tavsiya topilmadi (allaqachon hal qilingan bo'lishi mumkin).");
    }
    if (!productSnap.exists) {
      throw new HttpsError("not-found", "Mahsulot topilmadi.");
    }
    const product = productSnap.data();
    if (product.sellerId !== sellerId) {
      throw new HttpsError("permission-denied", "Bu mahsulot sizga tegishli emas.");
    }

    // Kategoriya-asoslangan tavsiya (`category_price_high`/`_low`)
    // to'g'ri QAYTA hisoblanishi uchun, o'sha kategoriyadagi BOSHQA
    // faol mahsulotlar HAM kerak - faqat IKKI TENGLIK filtri
    // (`sellerId`+`category`) bo'lgani uchun bunga qo'shimcha
    // composite indeks SHART emas (Firestore faqat tenglik
    // filtrlarini avtomatik birlashtira oladi).
    let categoryContext = null;
    if (product.category) {
      const categoryProductsSnap = await transaction.get(
        db.collection("products").where("sellerId", "==", sellerId).where("category", "==", product.category)
      );
      const categoryProducts = categoryProductsSnap.docs
        .map((d) => d.data())
        .filter((p) => p.isActive !== false);
      categoryContext = getCategoryPriceContext(product, buildCategoryPriceIndex(categoryProducts));
    }

    const fresh = computePricingSuggestion(product, Date.now(), categoryContext);
    if (!fresh || fresh.type !== suggestionSnap.data().type) {
      transaction.delete(suggestionRef);
      throw new HttpsError("failed-precondition", "Bu tavsiya eskirgan (mahsulot holati o'zgargan). Ro'yxat yangilandi.");
    }

    transaction.update(productRef, { price: fresh.suggestedPrice, updatedAt: new Date().toISOString() });
    transaction.delete(suggestionRef);
    return fresh.suggestedPrice;
  });

  await incrementDailyStat(sellerId, "aiPricingSuggestionsApplied");
  return { appliedPrice };
}

exports.applyPricingSuggestion = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleApplyPricingSuggestion));

/**
 * SOTUVCHI — bitta narx tavsiyasini RAD ETADI (mahsulotga hech qanday
 * ta'sir qilmaydi, faqat tavsiyani ro'yxatdan olib tashlaydi).
 */
async function handleDismissPricingSuggestion(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  const { productId } = request.data || {};
  if (!productId || typeof productId !== "string") {
    throw new HttpsError("invalid-argument", "Mahsulot ID'si ko'rsatilishi shart.");
  }

  const suggestionRef = db.collection("sellers").doc(sellerId).collection("pricingSuggestions").doc(productId);
  const snap = await suggestionRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Bu tavsiya topilmadi.");
  }
  await suggestionRef.delete();
  return { ok: true };
}

exports.dismissPricingSuggestion = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleDismissPricingSuggestion));

exports._testables = {
  buildPricingReasoningPrompt,
  buildFallbackReasoning,
  craftPricingSuggestionReasoning,
  processSellerPricingSuggestions,
  handleApplyPricingSuggestion,
  handleDismissPricingSuggestion,
  MAX_PRODUCTS_PER_SELLER_PER_RUN,
};
