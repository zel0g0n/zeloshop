const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createGeminiClient } = require("./lib/geminiClient");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY } = require("./lib/admin");
const { sendTelegramMessage } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { todayDocId } = require("./lib/dailyStats");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
// AI CEO natija kuzatuvi va o'rganish qatlami (batafsil izoh:
// `aiCeoLearning.js`): `buildLearningSummaryForDisplay` kunlik
// hisobotga "AI CEO samaradorligi" bo'limini qo'shish uchun,
// `learningSummaryRef` esa o'sha hujjatning o'zini o'qish uchun kerak.
const { buildLearningSummaryForDisplay, learningSummaryRef } = require("./aiCeoLearning");
// Barcha Gemini chaqiruvlari uchun umumiy imlo/ohang qoidalari va
// generatsiya parametrlari (`temperature`/`topP`/`topK`) - batafsil
// izoh: `lib/aiStyle.js`.
const { DEFAULT_GENERATION_CONFIG, BASE_STYLE_INSTRUCTION, CTA_RULE } = require("./lib/aiStyle");
const { computeContentQualityIssues } = require("./lib/contentQuality");
// 15-NICHE UNIVERSAL PLATFORMA: AI CEO endi sotuvchining HAQIQIY
// sohasiga (niche) mos "persona"/kontekst bilan gapiradi (masalan
// "Bugungi rejalar" va CRM kampaniya matni) - batafsil izoh:
// `lib/niches.js`.
const { getNicheConfig } = require("./lib/niches");

/**
 * AI CEO — kunlik/haftalik biznes xulosasi.
 *
 * Premium funksiya. Faqat `seller.aiCeoEnabled === true` bo'lgan
 * sotuvchilar uchun ishlaydi (bu bayroq faqat admin panel orqali,
 * qo'lda yoqiladi - platformada markazlashtirilgan to'lov tizimi
 * yo'q, shuning uchun "sotib olish" mavjud emas, TariffsPage'dagi
 * "qiziqish bildirish" oqimidan keyin admin o'zi yoqadi).
 *
 * Mavjud `sendDailyPnLReport`dan alohida funksiya: `sendDailyPnLReport`
 * — hamma sotuvchi uchun bepul, xom raqamlar bilan ishlaydigan
 * hisobot. Bu esa premium, Gemini orqali "tushunarli tilga
 * o'girilgan + aniq tavsiyalar bilan" boyitilgan versiya. Ikkalasi
 * bir-biriga alohida, xohlagan sotuvchi ikkalasini ham (yoki birini)
 * yoqishi mumkin.
 *
 * Firebase/Gemini xarajati nazorat ostida:
 * 1) `aiCeoEnabled !== true` bo'lgan sotuvchilar umuman ko'rib
 *    chiqilmaydi - Gemini so'rovi ular uchun hisoblanmaydi ham.
 * 2) Davr ichida bitta ham buyurtma bo'lmasa, Gemini chaqirilmaydi
 *    (mavjud `sendDailyPnLReport`dagi bilan bir xil tejash tamoyili)
 *    - "hech narsa bo'lmadi" degan xabar uchun pul to'lashning
 *    ma'nosi yo'q.
 * 3) Eng arzon, allaqachon tasdiqlangan model
 *    (`gemini-3.5-flash-lite`, xuddi `generateProductDescription`
 *    ishlatgan) ishlatiladi.
 * 4) Gemini'ga faqat qisqa, tayyor hisoblangan raqamlar yuboriladi
 *    (xom buyurtma hujjatlari emas) - bu so'rov hajmini (demak,
 *    xarajatni) minimal darajada ushlab turadi.
 *
 * Vaqt: hozircha sotuvchiga xos vaqt sozlamasi yo'q - kunlik xulosa
 * har kuni soat 22:00da (mavjud `sendDailyPnLReport`dan 1 soat keyin,
 * ikkalasi bir vaqtda yugurib, resurs talashib qolmasligi uchun),
 * haftalik xulosa esa faqat yakshanba kuni yuboriladi. Sotuvchiga xos
 * vaqt sozlamasi kelajakdagi, alohida yaxshilanish sifatida
 * qoldirilgan (buni amalga oshirish soatlik tekshiruv sikli talab
 * qiladi, bu esa ancha murakkabroq infratuzilma).
 */

const MODEL = "gemini-3.5-flash-lite";
const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;

// `src/utils/customerSegments.js`dan duplikatsiya qilingan - bir xil
// bo'lib qolishi shart (frontend'dagi VIP/"uxlab qolgan" belgilashi
// bilan mos kelmasa, kunlik hisobotdagi "diqqat talab qiladi" soni
// CRM Hub'da ko'rsatilgan haqiqiy segmentlardan farq qilib qoladi).
const CRM_VIP_THRESHOLD = 500_000;
const CRM_CHURN_DAYS = 30;

/**
 * Sof funksiya - oldindan yig'ilgan mijoz yozuvlaridan ("VIP"ga
 * ustuvorlik bilan, xuddi `computeCustomerSegments` kabi) nechta
 * mijoz "diqqat talab qilishi"ni hisoblaydi. Kunlik hisobotdagi
 * proaktiv eslatma uchun - Gemini chaqiruvisiz, faqat oddiy sanash
 * (arzon, tez).
 */
function countAttentionSegments(customers, nowMs) {
  const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;
  let vip = 0;
  let churn = 0;
  (Array.isArray(customers) ? customers : []).forEach((c) => {
    const ltv = Number(c.ltv) || 0;
    const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
    const daysSinceLastOrder = Math.floor((nowMs - lastOrderAtMs) / DAY_MS_LOCAL);
    if (ltv >= CRM_VIP_THRESHOLD) vip += 1;
    else if (daysSinceLastOrder > CRM_CHURN_DAYS) churn += 1;
  });
  return { vip, churn };
}

/**
 * Sof funksiya - `countAttentionSegments` bilan bir xil segmentatsiya
 * mantig'i, lekin faqat son emas, haqiqiy mijoz ID'lari (`clientId`)
 * ro'yxatini qaytaradi. Telegram bir tugmali tasdiqlash uchun zarur:
 * kunlik hisobot sahifasidan farqli o'laroq, bu funksiya sotuvchi
 * tomonsiz, jadval bo'yicha (`onSchedule`) ishlaydi - shuning uchun
 * "kimga xabar yuborish kerak" ro'yxati oldindan, server tomonida
 * tayyorlanishi kerak. `customers` massividagi har bir element `id`
 * maydoniga ega bo'lishi shart (Firestore hujjat ID'si = clientId,
 * `sellers/{id}/customers/{clientId}` yo'liga qarang).
 */
function collectAttentionSegmentClientIds(customers, nowMs) {
  const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;
  const vipClientIds = [];
  const churnClientIds = [];
  (Array.isArray(customers) ? customers : []).forEach((c) => {
    if (!c.id) return;
    const ltv = Number(c.ltv) || 0;
    const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
    const daysSinceLastOrder = Math.floor((nowMs - lastOrderAtMs) / DAY_MS_LOCAL);
    if (ltv >= CRM_VIP_THRESHOLD) vipClientIds.push(c.id);
    else if (daysSinceLastOrder > CRM_CHURN_DAYS) churnClientIds.push(c.id);
  });
  return { vipClientIds, churnClientIds };
}

/**
 * Berilgan vaqt oralig'idagi buyurtmalar asosida, Gemini'ga yuborish
 * uchun qisqa, sof (aggregatsiya qilingan) raqamli xulosa tuzadi. Sof
 * funksiya - Firestore'ga bog'liq emas, shuning uchun to'g'ridan-to'g'ri
 * test qilinadi.
 *
 * @param {Array} periodOrders - davr ichidagi buyurtmalar (barcha holatlar)
 * @param {Array} prevPeriodOrders - undan oldingi, teng uzunlikdagi davr buyurtmalari (solishtirish uchun)
 * @param {Map<string, number>} costPriceMap - productId -> tannarx
 */
function buildDigestStats(periodOrders, prevPeriodOrders, costPriceMap) {
  const delivered = periodOrders.filter((o) => o.status === "delivered");
  const prevDelivered = prevPeriodOrders.filter((o) => o.status === "delivered");

  const revenue = delivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const prevRevenue = prevDelivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

  let cogs = 0;
  const productRevenue = new Map(); // productName -> revenue (top mahsulotni topish uchun)
  delivered.forEach((order) => {
    (order.orders || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      cogs += (costPriceMap.get(item.id) || 0) * qty;
      const lineRevenue = (Number(item.price) || 0) * qty;
      productRevenue.set(item.name, (productRevenue.get(item.name) || 0) + lineRevenue);
    });
  });

  const netProfit = revenue - cogs;
  const cancelCount = periodOrders.filter((o) => o.status === "cancel").length;
  const cancelRate = periodOrders.length > 0 ? (cancelCount / periodOrders.length) * 100 : 0;

  const topProductEntry = Array.from(productRevenue.entries()).sort((a, b) => b[1] - a[1])[0];

  // Foiz o'zgarish - oldingi davr 0 bo'lsa, foiz hisoblashning
  // ma'nosi yo'q (cheksizlikka bo'linish) - null qaytaramiz, Gemini
  // promptida bu holatni alohida ko'rsatamiz.
  const revenueChangePercent = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  return {
    orderCount: periodOrders.length,
    deliveredCount: delivered.length,
    revenue,
    netProfit,
    cancelRate,
    revenueChangePercent,
    topProductName: topProductEntry ? topProductEntry[0] : null,
    topProductRevenue: topProductEntry ? topProductEntry[1] : 0,
  };
}

// Har bir avtomatlashtirilgan harakat qo'lda bajarilganda o'rtacha
// qancha vaqt olishi haqidagi TAXMINIY (bahoviy) qiymatlar - haqiqiy
// o'lchov emas, balki odatiy "qo'lda yozish/bajarish" vaqtiga
// asoslangan mantiqiy taxmin. Frontend bu raqamni har doim
// "taxminiy" deb ko'rsatadi (soxta aniqlik yaratilmaydi - haqiqiy
// bo'lmagan shoshilinchlik/raqam ko'rsatmaslik tamoyiliga mos).
const MINUTES_PER_AUTO_REMINDER = 3; // savat/sevimli/qayta xarid eslatmasi
const MINUTES_PER_CRM_CAMPAIGN = 15; // bitta segment kampaniyasi matnini yozish
const MINUTES_PER_AUTO_ACTION = 3; // Tier-1 avtonom xabar (qayta sotib olish/sevimli)
const MINUTES_PER_AI_PRODUCT_DRAFT = 5; // rasmdan mahsulot nomi/tavsifi/kategoriyasini yaratish

/**
 * Sof funksiya - bugun AI CEO avtomatik bajargan harakatlar sonidan
 * (allaqachon `crmActivity`/`productAdditions` uchun hisoblangan xom
 * sonlar) "sotuvchi bugun taxminan necha daqiqa tejadi"ni hisoblaydi.
 * Yangi Firestore so'rovi kerak emas - faqat mavjud sonlarni
 * ko'paytiradi, shuning uchun kunlik hisobotga arzon qo'shiladi.
 */
function computeTimeSavedMinutes({
  cartRemindersSent = 0,
  favoriteRemindersSent = 0,
  repurchaseRemindersSent = 0,
  crmMessagesSent = 0,
  aiAutoActionsCount = 0,
  productsAddedTodayCount = 0,
}) {
  const reminderMinutes = (cartRemindersSent + favoriteRemindersSent + repurchaseRemindersSent) * MINUTES_PER_AUTO_REMINDER;
  const campaignMinutes = crmMessagesSent > 0 ? MINUTES_PER_CRM_CAMPAIGN : 0;
  const autoActionMinutes = aiAutoActionsCount * MINUTES_PER_AUTO_ACTION;
  const draftMinutes = productsAddedTodayCount * MINUTES_PER_AI_PRODUCT_DRAFT;
  return reminderMinutes + campaignMinutes + autoActionMinutes + draftMinutes;
}

/**
 * AI CEO — kunlik hisobot ("AI CEO bugun nima qildi").
 *
 * Sotuvchi AI CEO'ning o'zi uchun haqiqatan ishlayotganini ko'rishi
 * kerak. Bu funksiya har safar sahifa ochilganda, haqiqiy, bugungi
 * ma'lumotdan hisobot tuzadi:
 *   1) Mahsulot tavsiyalari (chegirma/aksiya kerak bo'lganlar)
 *   2) CRM faoliyati (necha xabar yuborilgan, konversiya)
 *   3) Moliyaviy qisqa hisobot (bugun vs kecha)
 *   4) Mahsulot qo'shish statistikasi
 *
 * `onCall` sahifa ochilganda ishga tushadi - shuning uchun so'rovlarni
 * chegaralash shart (sotuvchi sahifani tez-tez qayta ochib, ortiqcha
 * Firestore o'qishga sabab bo'lmasligi uchun).
 */
async function handleGenerateDailyReport(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`generateDailyReport:${request.auth.uid}`, 30, 3600);

  const sellerId = request.auth.uid;
  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    throw new HttpsError("permission-denied", "Bu funksiya faqat AI CEO premium mijozlari uchun mavjud.");
  }

  // Asosiy mantiq try/catch ichida - shu orqali haqiqiy xato
  // (masalan, Firestore "indeks yetishmayapti" xatosi) Cloud
  // Functions logiga to'liq yoziladi (`console.error`), aks holda
  // mijoz ekranida faqat umumiy "internal" xatosi ko'rinadi.
  try {
    return await buildDailyReport(sellerId, sellerSnap.data());
  } catch (err) {
    console.error(`generateDailyAiCeoReport xatosi (sotuvchi ${sellerId}):`, err);
    throw new HttpsError("internal", `Hisobotni tayyorlashda xatolik: ${err.message || "noma'lum sabab"}`);
  }
}

async function buildDailyReport(sellerId, seller) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - DAY_MS;

  const [todayOrdersSnap, yesterdayOrdersSnap, productsSnap, dailyStatsSnap, allOrdersSnap, customersSnap, learningSnap] = await Promise.all([
    db.collection("orders").where("sellerId", "==", sellerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(todayStart)).get(),
    db.collection("orders").where("sellerId", "==", sellerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(yesterdayStart))
      .where("createdAt", "<", admin.firestore.Timestamp.fromMillis(todayStart)).get(),
    db.collection("products").where("sellerId", "==", sellerId).get(),
    db.collection("sellers").doc(sellerId).collection("dailyStats").doc(todayDocId()).get(),
    // Xarajat nazorati: "aktiv/nofaol mijozlar" hisoblash uchun
    // oxirgi 500 ta buyurtma yetarli (juda katta do'konlar uchun ham
    // haqiqiy tendensiyani ko'rsatadi) - butun tarixni cheksiz
    // o'qishning ma'nosi yo'q.
    db.collection("orders").where("sellerId", "==", sellerId)
      .orderBy("createdAt", "desc").limit(500).get(),
    // Proaktiv "diqqat talab qiladi" eslatmasi uchun - arzon, chunki
    // `sellers/{id}/customers` allaqachon oldindan yig'ilgan
    // (`orderRollups.js`), demak faqat bitta qo'shimcha kolleksiya
    // o'qish, xom buyurtmalarni qayta skanerlash emas.
    db.collection("sellers").doc(sellerId).collection("customers").get(),
    // AI CEO Tier-1 avtonom xabarlarining haqiqiy, evaluatsiya
    // qilingan konversiya darajasini ko'rsatish uchun - arzon (bitta
    // qo'shimcha hujjat o'qish, batafsil izoh: `aiCeoLearning.js`).
    learningSummaryRef(sellerId).get(),
  ]);

  const todayOrders = todayOrdersSnap.docs.map((d) => d.data());
  const yesterdayOrders = yesterdayOrdersSnap.docs.map((d) => d.data());
  const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const dailyStats = dailyStatsSnap.exists ? dailyStatsSnap.data() : {};
  const recentOrders = allOrdersSnap.docs.map((d) => d.data());
  const customers = customersSnap.docs.map((d) => d.data());
  const learningSummary = buildLearningSummaryForDisplay(learningSnap.exists ? learningSnap.data() : {});
  const attentionSegments = countAttentionSegments(customers, now.getTime());
  // Mahsulot tavsifi/rasmi sifati (#118) - HECH QANDAY qo'shimcha
  // so'rov kerak emas, `products` allaqachon yuqorida o'qilgan.
  // Faqat ikkita ODDIY, HAQIQIY signal (tavsif uzunligi, rasm
  // borligi) - AI'ning subyektiv bahosi emas (batafsil izoh:
  // `lib/contentQuality.js`).
  const contentQuality = computeContentQualityIssues(products);

  // 1) Moliyaviy qisqa hisobot
  const todayDelivered = todayOrders.filter((o) => o.status === "delivered");
  const yesterdayDelivered = yesterdayOrders.filter((o) => o.status === "delivered");
  const todayRevenue = todayDelivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const yesterdayRevenue = yesterdayDelivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const revenueChangePercent = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  // 2) Mahsulot tavsiyalari - oxirgi 500 buyurtma ichida sotilmagan
  // mahsulotlar (chegirma nomzodlari), va eng ko'p sotilganlar
  // (aksiya/reklama uchun nomzodlar).
  const soldProductIds = new Set();
  const salesCountByProduct = new Map();
  recentOrders.forEach((o) => {
    (o.orders || []).forEach((item) => {
      soldProductIds.add(item.id);
      salesCountByProduct.set(item.id, (salesCountByProduct.get(item.id) || 0) + (Number(item.quantity) || 0));
    });
  });
  const discountCandidates = products
    .filter((p) => !soldProductIds.has(p.id) && Number(p.stock) > 0 && !p.discountPrice)
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name }));
  const promoteCandidates = Array.from(salesCountByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, qty]) => ({ id, name: products.find((p) => p.id === id)?.name || "Noma'lum", soldQty: qty }));

  // 3) Mahsulot qo'shish statistikasi - bugun yaratilgan mahsulotlar
  // + o'sha mahsulotlardan bugun qilingan sotuvlar.
  const productsAddedToday = products.filter((p) => {
    const createdMs = p.createdAt?.toMillis ? p.createdAt.toMillis() : new Date(p.createdAt).getTime();
    return createdMs >= todayStart;
  });
  const addedTodayIds = new Set(productsAddedToday.map((p) => p.id));
  let salesFromNewProducts = 0;
  todayDelivered.forEach((o) => {
    (o.orders || []).forEach((item) => {
      if (addedTodayIds.has(item.id)) salesFromNewProducts += (Number(item.price) || 0) * (Number(item.quantity) || 0);
    });
  });

  // 4) CRM faoliyati - bugun yuborilgan xabarlar + konversiya
  // (xabar olganlardan nechtasi bugun buyurtma berdi).
  const messagedIds = new Set(dailyStats.crmMessageRecipientIds || []);
  const todayOrderClientIds = new Set(todayOrders.map((o) => o.clientId));
  const convertedCount = Array.from(messagedIds).filter((id) => todayOrderClientIds.has(id)).length;

  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  const lastOrderByClient = new Map();
  recentOrders.forEach((o) => {
    const createdMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : new Date(o.createdAt).getTime();
    if (!lastOrderByClient.has(o.clientId) || createdMs > lastOrderByClient.get(o.clientId)) {
      lastOrderByClient.set(o.clientId, createdMs);
    }
  });
  const activeCustomers = Array.from(lastOrderByClient.values()).filter((ms) => ms >= thirtyDaysAgo).length;
  const inactiveCustomers = lastOrderByClient.size - activeCustomers;

  // 5) AI CEO o'zi reja tuzadi: qaysi "Bugungi rejalar" bandi bugun
  // eng muhimligini AI o'zi hal qiladi - qattiq kodlangan tartib
  // (VIP > churn > chegirma > aksiya,
  // `src/.../AiCeoInfoPage.jsx`dagi `buildActionPlan`) faqat zaxira
  // (fallback) hisoblanadi. Batafsil izoh - pastda,
  // `buildActionPlanPrompt`ga qarang.
  const availableActionKeys = [];
  if (attentionSegments.vip > 0) availableActionKeys.push("vip");
  if (attentionSegments.churn > 0) availableActionKeys.push("churn");
  if (discountCandidates.length > 0) availableActionKeys.push("discount");
  if (promoteCandidates.length > 0) availableActionKeys.push("promote");

  let aiActionPlan = null;
  // Xarajat nazorati: 0 yoki 1 ta band bo'lsa, "tartiblash"ning
  // ma'nosi yo'q - Gemini chaqirilmaydi.
  if (availableActionKeys.length > 1) {
    // Bir kunda, bir xil band to'plami uchun faqat bir marta
    // chaqiriladi - natija `dailyStats`ga keshlanadi. Band to'plami
    // o'zgarsa (masalan sotuvchi VIP harakatini bajardi, endi faqat
    // "churn" qoldi), keshdan farqli fingerprint buni avtomatik
    // yangilaydi - eskirgan tartib qaytarilmaydi.
    const keysFingerprint = availableActionKeys.slice().sort().join(",");
    if (dailyStats.aiActionPlanKeysFingerprint === keysFingerprint && Array.isArray(dailyStats.aiActionPlanOrder)) {
      aiActionPlan = { order: dailyStats.aiActionPlanOrder, reasoning: dailyStats.aiActionPlanReasoning || null };
    } else {
      try {
        const revenueChangeText = revenueChangePercent === null
          ? "solishtirish uchun yetarli ma'lumot yo'q"
          : `${revenueChangePercent >= 0 ? "+" : ""}${revenueChangePercent.toFixed(0)}%`;
        const plan = await craftActionPlan({
          vipCount: attentionSegments.vip,
          churnCount: attentionSegments.churn,
          discountCandidateName: discountCandidates[0]?.name || null,
          promoteCandidateName: promoteCandidates[0]?.name || null,
          revenueChangeText,
          convertedCount,
          availableKeys: availableActionKeys,
        }, seller?.storeName, seller?.category);
        aiActionPlan = plan;
        await db.collection("sellers").doc(sellerId).collection("dailyStats").doc(todayDocId()).set({
          aiActionPlanOrder: plan.order,
          aiActionPlanReasoning: plan.reasoning,
          aiActionPlanKeysFingerprint: keysFingerprint,
        }, { merge: true });
      } catch (err) {
        // Xato bo'lsa `aiActionPlan` `null` qoladi - frontend
        // (`buildActionPlan`) buzilmaydi, faqat qattiq kodlangan
        // (rule-based) tartibga qaytadi. AI'ning "reja tuzish" qadami
        // sahifaning o'zini ishlamay qo'yishiga sabab bo'lmasligi
        // kerak.
        console.error(`AI CEO reja tuzishda xatolik (sotuvchi ${sellerId}):`, err);
      }
    }
  }

  return {
    date: todayDocId(),
    financial: {
      todayRevenue,
      yesterdayRevenue,
      revenueChangePercent,
      todayOrderCount: todayOrders.length,
      todayDeliveredCount: todayDelivered.length,
    },
    productRecommendations: {
      discountCandidates,
      promoteCandidates,
    },
    productAdditions: {
      addedTodayCount: productsAddedToday.length,
      salesFromNewProducts,
    },
    crmActivity: {
      cartRemindersSent: dailyStats.cartRemindersSent || 0,
      favoriteRemindersSent: dailyStats.favoriteRemindersSent || 0,
      repurchaseRemindersSent: dailyStats.repurchaseRemindersSent || 0,
      crmMessagesSent: dailyStats.crmMessagesSent || 0,
      convertedCount,
      activeCustomers,
      inactiveCustomers,
      // AI CEO bugun o'zi, sotuvchi tugma bosmasdan, avtomatik
      // bajargan harakatlar soni (faqat sotuvchi buni alohida yoqqan
      // bo'lsa, `engagementReminders.js`ga qarang) - shaffoflik
      // uchun. Ikki turdagi avtomatik harakatni ham qo'shib
      // hisoblaydi (qayta sotib olish + sevimlilar eslatmasi).
      aiAutoActionsCount: (dailyStats.aiCeoAutoWinBackSent || 0) + (dailyStats.aiCeoAutoFavoriteSent || 0),
      // Alohida ko'rsatiladi (yuqoridagi `aiAutoActionsCount`ga
      // aralashtirilmaydi), chunki bu moliyaviy oqibatga ega harakat,
      // sotuvchi buni oddiy xabar sonidan aniq ajratib ko'rishi kerak
      // (batafsil izoh: `aiCeoAutoDiscount.js`).
      autoDiscountsIssuedCount: dailyStats.aiCeoAutoDiscountsIssued || 0,
    },
    // "Sellerga vaqt sotamiz" - bugun AI CEO avtomatik bajargan
    // harakatlar asosida taxminiy tejalgan vaqt (batafsil izoh:
    // `computeTimeSavedMinutes`). Yangi so'rov kerak emas - yuqorida
    // hisoblangan sonlardan qayta foydalaniladi.
    impact: {
      timeSavedMinutesToday: computeTimeSavedMinutes({
        cartRemindersSent: dailyStats.cartRemindersSent || 0,
        favoriteRemindersSent: dailyStats.favoriteRemindersSent || 0,
        repurchaseRemindersSent: dailyStats.repurchaseRemindersSent || 0,
        crmMessagesSent: dailyStats.crmMessagesSent || 0,
        aiAutoActionsCount: (dailyStats.aiCeoAutoWinBackSent || 0) + (dailyStats.aiCeoAutoFavoriteSent || 0),
        productsAddedTodayCount: productsAddedToday.length,
      }),
    },
    // Proaktiv eslatma - sotuvchi CRM Hub'ni o'zi ochib qidirishi
    // shart emas, AI CEO diqqatni o'zi tortadi.
    attentionNeeded: {
      vipCount: attentionSegments.vip,
      churnCount: attentionSegments.churn,
    },
    // AI o'zi tanlagan ustuvorlik tartibi + bitta gaplik sababi.
    // `null` bo'lsa (0/1 band, yoki AI xato bergan) - frontend qattiq
    // kodlangan tartibga tinch qaytadi.
    aiActionPlan,
    // AI CEO avtonom (Tier-1) xabarlarining haqiqiy, evaluatsiya
    // qilingan konversiya darajasi (batafsil izoh:
    // `aiCeoLearning.js`). Har bir tur (`winback`/`favorite`) hali
    // umuman xabar yuborilmagan bo'lsa `null` bo'ladi.
    learningSummary,
    // Mahsulot tavsifi/rasmi sifati (#118) - qattiq, haqiqiy
    // signallar asosida (batafsil izoh: `lib/contentQuality.js`).
    contentQuality,
  };
}

/**
 * Gemini uchun SMM/biznes-maslahatchi ohangidagi prompt tuzadi.
 * Gemini'ga qat'iy taqiqlar beriladi - u faqat berilgan raqamlar
 * asosida yozishi, o'zidan raqam/da'vo o'ylab topmasligi kerak
 * (hallyutsinatsiyaning oldini olish uchun eng muhim himoya).
 */
function buildDigestPrompt(stats, periodLabel, storeName) {
  const changeText = stats.revenueChangePercent === null
    ? "o'tgan davr bilan solishtirish uchun yetarli ma'lumot yo'q"
    : `${stats.revenueChangePercent >= 0 ? "+" : ""}${stats.revenueChangePercent.toFixed(0)}% (oldingi davrga nisbatan)`;

  return `Sen — kichik onlayn do'konlar uchun ishlaydigan, SMM va biznes-o'sish bo'yicha tajribali maslahatchisan. Ohangingiz: samimiy, ishontiruvchi, professional - lekin QURUQ EMAS, "sun'iy intellekt" kabi emas, tirik inson bilan gaplashayotgandek yoz.

Do'kon: "${storeName}"
Davr: ${periodLabel}

RAQAMLAR (FAQAT shularga tayaning, boshqa hech narsa o'ylab topmang):
- Jami buyurtmalar: ${stats.orderCount} ta
- Yetkazilgan: ${stats.deliveredCount} ta
- Tushum: ${formatMoney(stats.revenue)}
- Taxminiy sof foyda: ${formatMoney(stats.netProfit)}
- Tushum o'zgarishi: ${changeText}
- Bekor qilish darajasi: ${stats.cancelRate.toFixed(0)}%
${stats.topProductName ? `- Eng ko'p sotilgan: "${stats.topProductName}" (${formatMoney(stats.topProductRevenue)})` : "- Bu davrda hech narsa sotilmagan"}

VAZIFA: Telegram xabari sifatida yuboriladigan, 4-6 gapdan iborat qisqa xulosa yoz:
1. Birinchi 1-2 gap: umumiy holatni samimiy tarzda tasvirla (raqamlarni takrorlama, ULARNI SHARHLA).
2. Keyingi 2-3 gap: aniq, AMALIY 1-2 ta tavsiya ber (masalan qaysi mahsulotga e'tibor qaratish, bekor qilish darajasi yuqori bo'lsa nima qilish kerak).

QAT'IY QOIDALAR:
- FAQAT yuqoridagi raqamlardan foydalan - hech qanday YANGI raqam, foiz yoki fakt O'YLAB TOPMA.
- Agar biror ko'rsatkich yo'q yoki noaniq bo'lsa (masalan solishtirish ma'lumoti yo'q), buni oddiy qilib aytib o'tib, o'ylab topma.
- Faqat O'ZBEK TILIDA, oddiy so'zlashuv uslubida yoz.
- Sarlavha, tirnoq belgisi yoki "Mana sizning hisobotingiz" kabi kirish so'zlarisiz, TO'G'RIDAN-TO'G'RI matn bilan boshla.
- Haddan tashqari his-hayajonli ("ajoyib!", "zo'r!") bo'lma, lekin quruq ham bo'lma - muvozanatli, ishonchli ohang tanla.`;
}

async function generateDigestText(stats, periodLabel, storeName) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildDigestPrompt(stats, periodLabel, storeName),
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const text = (response.text || "").trim();
  if (!text) throw new Error("AI bo'sh javob qaytardi.");
  return text;
}

async function processSellerDigest(sellerDoc, { periodStart, periodEnd, prevPeriodStart, periodLabel }) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;

  // Xarajat nazorati: premium emas - darhol chiqamiz, Firestore
  // so'rovi yoki Gemini chaqiruvi qilinmaydi.
  if (seller.aiCeoEnabled !== true) return;
  if (seller.aiCeoDigestEnabled === false) return;

  const [periodOrdersSnap, prevOrdersSnap, productsSnap, customBotSnap] = await Promise.all([
    db.collection("orders").where("sellerId", "==", sellerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(periodStart))
      .where("createdAt", "<", admin.firestore.Timestamp.fromMillis(periodEnd))
      .get(),
    db.collection("orders").where("sellerId", "==", sellerId)
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(prevPeriodStart))
      .where("createdAt", "<", admin.firestore.Timestamp.fromMillis(periodStart))
      .get(),
    db.collection("products").where("sellerId", "==", sellerId).get(),
    db.collection("sellers").doc(sellerId).collection("private").doc("customerBot").get(),
  ]);

  const periodOrders = periodOrdersSnap.docs.map((d) => d.data());

  // Xarajat nazorati: davr ichida hech narsa bo'lmagan bo'lsa,
  // Gemini so'rovi yuborilmaydi.
  if (periodOrders.length === 0) return;

  const prevPeriodOrders = prevOrdersSnap.docs.map((d) => d.data());
  const costPriceMap = new Map();
  productsSnap.forEach((p) => costPriceMap.set(p.id, Number(p.data().costPrice) || 0));

  const stats = buildDigestStats(periodOrders, prevPeriodOrders, costPriceMap);
  const digestText = await generateDigestText(stats, periodLabel, seller.storeName || "Do'kon");

  const token = customBotSnap.exists && customBotSnap.data().botToken ? customBotSnap.data().botToken : BOT_TOKEN.value();
  await sendTelegramMessage(token, sellerId, `AI CEO — ${periodLabel}\n\n${digestText}`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

exports.sendAiCeoDigests = onSchedule(
  {
    schedule: "0 22 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - endi PARALEL guruhlab
    // ishlangani uchun ham, qo'shimcha xavfsizlik zaxirasi sifatida
    // ham oshirilgan (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const isSunday = now.getDay() === 0;

    // Xarajat nazorati (kolleksiya darajasida): faqat
    // `aiCeoEnabled == true` bo'lgan sotuvchilarni so'raymiz - bu
    // boshqa hamma sotuvchi uchun bitta hujjat ham o'qilishining
    // oldini oladi.
    const eligibleSellersSnap = await db.collection("sellers").where("aiCeoEnabled", "==", true).get();
    if (eligibleSellersSnap.empty) return;

    // Kunlik xulosa - har kuni. Har bir sotuvchi mustaqil (umumiy
    // holat yo'q), shuning uchun PARALEL guruhlarda ishlov berish
    // xavfsiz (batafsil izoh: `lib/batchProcess.js`).
    const dailyResult = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
      try {
        await processSellerDigest(sellerDoc, {
          periodStart: todayStart,
          periodEnd: todayStart + DAY_MS,
          prevPeriodStart: todayStart - DAY_MS,
          periodLabel: "Bugungi kun",
        });
      } catch (err) {
        console.error(`AI CEO kunlik xulosa xatosi (sotuvchi ${sellerDoc.id}):`, err);
        throw err; // `dailyResult.failureCount`ga ham qo'shilishi uchun
      }
    });
    console.log(`sendAiCeoDigests (kunlik): ${dailyResult.successCount}/${dailyResult.total} sotuvchi muvaffaqiyatli, ${dailyResult.failureCount} xato`);

    // Haftalik xulosa - faqat yakshanba kuni, qo'shimcha ravishda.
    if (isSunday) {
      const weekStart = todayStart - 6 * DAY_MS;
      const weeklyResult = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
        try {
          await processSellerDigest(sellerDoc, {
            periodStart: weekStart,
            periodEnd: todayStart + DAY_MS,
            prevPeriodStart: weekStart - 7 * DAY_MS,
            periodLabel: "So'nggi 7 kun",
          });
        } catch (err) {
          console.error(`AI CEO haftalik xulosa xatosi (sotuvchi ${sellerDoc.id}):`, err);
          throw err; // `weeklyResult.failureCount`ga ham qo'shilishi uchun
        }
      });
      console.log(`sendAiCeoDigests (haftalik): ${weeklyResult.successCount}/${weeklyResult.total} sotuvchi muvaffaqiyatli, ${weeklyResult.failureCount} xato`);
    }
  }
);

/**
 * Har ikkala yangi funksiya uchun UMUMIY premium tekshiruvi -
 * `aiCeoEnabled !== true` bo'lsa, Gemini so'rovi UMUMAN qilinmaydi.
 *
 * Sotuvchi hujjatining o'zini qaytaradi (endi shunchaki tekshirish
 * emas) - shu orqali chaqiruvchilar `seller.category` (niche) kabi
 * maydonlarni ikkinchi marta Firestore so'rovi qilmasdan olishlari
 * mumkin (15-NICHE UNIVERSAL PLATFORMA: AI CEO promptlari niche'ga
 * mos bo'lishi uchun kerak).
 */
async function requirePremiumSeller(uid) {
  const sellerSnap = await db.collection("sellers").doc(uid).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    throw new HttpsError("permission-denied", "Bu funksiya faqat AI CEO premium mijozlari uchun mavjud.");
  }
  return sellerSnap.data();
}

/**
 * AI CEO — analitika sahifalariga AI sharhi.
 *
 * Bu yerda yangi Firestore so'rovi qilinmaydi - mijoz (frontend)
 * `productAnalytics.js`/`orderAnalytics.js` orqali allaqachon
 * hisoblab bo'lgan qisqa xulosa raqamlarini (masalan "5 ta o'lik
 * mahsulot", nomlari bilan) to'g'ridan-to'g'ri yuboradi - bu funksiya
 * faqat ularni Gemini'ga uzatib, tabiiy tildagi sharh+tavsiyaga
 * aylantiradi. Ma'lumotning o'zi sotuvchining o'z mahsulotlari
 * haqida (ilovada allaqachon ko'rinadigan), shuning uchun bu xavfsiz.
 */
async function handleGenerateAnalyticsInsight(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`generateAnalyticsInsight:${request.auth.uid}`, 20, 3600);
  await requirePremiumSeller(request.auth.uid);

  const { deadStockNames = [], lowStockNames = [], topProductName = null, totalRevenue = 0 } = request.data || {};

  if (deadStockNames.length === 0 && lowStockNames.length === 0 && !topProductName) {
    throw new HttpsError("invalid-argument", "Tahlil qilish uchun yetarli ma'lumot yo'q.");
  }

  const prompt = `Sen — kichik onlayn do'konlar uchun ombor/mahsulot strategiyasi bo'yicha maslahatchisan.

MA'LUMOTLAR (FAQAT shularga tayaning, boshqa hech narsa o'ylab topmang):
${topProductName ? `- Eng ko'p sotilgan mahsulot: "${topProductName}"` : ""}
${deadStockNames.length > 0 ? `- Uzoq vaqt sotilmagan mahsulotlar (${deadStockNames.length} ta): ${deadStockNames.slice(0, 10).join(", ")}` : ""}
${lowStockNames.length > 0 ? `- Tez tugayotgan mahsulotlar (${lowStockNames.length} ta): ${lowStockNames.slice(0, 10).join(", ")}` : ""}
${totalRevenue > 0 ? `- Davr tushumi: ${Math.round(totalRevenue).toLocaleString()} so'm` : ""}

VAZIFA: 3-4 gapdan iborat, samimiy va AMALIY sharh yoz - nima uchun bu holat yuzaga kelgan bo'lishi mumkinligi va aniq 1-2 ta tavsiya.

QOIDALAR:
- FAQAT yuqoridagi ma'lumotlardan foydalan, yangi raqam/fakt O'YLAB TOPMA.
- O'ZBEK TILIDA, oddiy so'zlashuv uslubida yoz.
- To'g'ridan-to'g'ri matn bilan boshla, kirish so'zisiz.`;

  try {
    const ai = createGeminiClient(GEMINI_API_KEY.value());
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
    });
    const insight = (response.text || "").trim();
    if (!insight) throw new Error("AI bo'sh javob qaytardi.");
    return { insight };
  } catch (err) {
    console.error("Analitika sharhi yaratishda xatolik:", err);
    throw new HttpsError("internal", "Sharh yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

/**
 * AI CEO — "uxlab qolgan" mijoz uchun qaytarish xabari qoralamasi.
 */
/**
 * @param {object} params
 * @param {{sentCount: number, convertedCount: number, conversionRatePercent: number}|null} [params.recentPerformance] -
 *   AI'ning o'zi yozgan, xuddi shu turdagi oldingi xabarlarining
 *   haqiqiy, evaluatsiya qilingan konversiya darajasi
 *   (`aiCeoLearning.js`dagi `getRecentAiPerformance`). `null` bo'lsa
 *   (hali yetarli namuna yo'q) promptga hech narsa qo'shilmaydi,
 *   standart xatti-harakat davom etadi. Bu AI'ning o'z oldingi ishi
 *   natijasidan xabardor bo'lib, keyingi xabarni shunga qarab
 *   moslashtirishi (o'z-o'zini yaxshilash) - model qayta o'qitish
 *   (fine-tuning) yoki og'irliklarni yangilash emas, faqat promptga
 *   qo'shiladigan kontekst, oddiy va shaffof usul.
 */
function buildWinBackPrompt({ customerName, daysSinceLastOrder, lastProductName, storeName, recentPerformance = null }) {
  return `Sen — kichik onlayn do'kon egasi uchun mijozlar bilan iliq muloqot matnlari yozuvchi yordamchisisan.

MIJOZ: ${customerName || "mijoz"}, so'nggi buyurtmasidan beri ${daysSinceLastOrder} kun o'tgan.
${lastProductName ? `Oxirgi xarid qilgan mahsuloti: "${lastProductName}"` : ""}
Do'kon: "${storeName || "Do'kon"}"
${buildRecentPerformanceLine(recentPerformance)}

VAZIFA: mijozga Telegram orqali yuboriladigan, QISQA (2-3 gap), ILIQ va SAMIMIY "sizni sog'indik" uslubidagi xabar yoz - mijozni qaytarib xarid qilishga undaydigan, lekin bosim o'tkazmaydigan ohangda.

QOIDALAR:
- O'ZBEK TILIDA yoz.
- Aniq chegirma/promokod TAKLIF QILMA (buni sotuvchi o'zi qo'shishi mumkin).
- Faqat xabar matnini yoz, boshqa hech narsa qo'shma.`;
}

/**
 * Sof funksiya - `recentPerformance` mavjud bo'lsa, promptga
 * qo'shiladigan bitta qatorni quradi (past/yaxshi natija uchun
 * boshqacha ohangda - ikkalasi ham AI'ni "o'zini yaxshilash"ga
 * yo'naltiradi, lekin past natijada aniq o'zgartirish talab qiladi,
 * yaxshi natijada esa mavjud uslubni saqlashni so'raydi). `null`
 * bo'lsa bo'sh qator qaytadi (promptga hech narsa qo'shmaydi).
 */
function buildRecentPerformanceLine(recentPerformance) {
  if (!recentPerformance) return "";
  const { sentCount, conversionRatePercent } = recentPerformance;
  return conversionRatePercent < 15
    ? `\nMUHIM (o'z-o'zini yaxshilash): oxirgi shunga o'xshash ${sentCount} ta AI xabaridan atigi ${conversionRatePercent}%i mijozni qaytarib xarid qildirgan - bu safar YANADA qiziqarli, shaxsiylashtirilgan va ishontiruvchi yozishga alohida harakat qil.`
    : `\nYaxshi natija: oxirgi shunga o'xshash ${sentCount} ta AI xabaridan ${conversionRatePercent}%i mijozni muvaffaqiyatli qaytargan - xuddi shu samarali, iliq uslubda davom et.`;
}

/**
 * Sof Gemini chaqiruvi - auth/premium/HttpsError tekshiruvidan
 * mustaqil, shuning uchun ikki joyda ishlatiladi: (1) quyidagi
 * `handleGenerateWinBackMessage` (sotuvchi tugma bosganda, bitta
 * mijoz uchun, qo'lda), va (2) `engagementReminders.js`dagi avtomatik
 * "qayta sotib olish" eslatmasi - faqat sotuvchi buni alohida,
 * ochiq-oydin yoqqan bo'lsa (`aiCeoAutoWinBackEnabled`, standart
 * holatda o'chiq), batafsil izoh o'sha faylda. Xato bo'lsa oddiy
 * `Error` tashlaydi - chaqiruvchi tomon o'zi hal qiladi (onCall uchun
 * HttpsError'ga o'raladi; avtomatik eslatma uchun jim qolib, oddiy
 * shablonga qaytadi).
 */
async function craftWinBackMessage({ customerName, daysSinceLastOrder, lastProductName, storeName, recentPerformance = null }) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildWinBackPrompt({ customerName, daysSinceLastOrder, lastProductName, storeName, recentPerformance }),
    // `CTA_RULE` ataylab qo'shilmagan - bu xabar bosim
    // o'tkazmaydigan ohangda, aniq chegirma/CTA taklif qilmasdan
    // yozilishi kerak (yuqoridagi izohga qarang).
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const message = (response.text || "").trim();
  if (!message) throw new Error("AI bo'sh javob qaytardi.");
  return message;
}

/**
 * AI CEO — sevimlilar eslatmasi uchun AI-shaxsiylashtirish.
 *
 * `craftWinBackMessage` bilan bir xil naqsh va xavfsizlik darajasi
 * (oddiy, bosimsiz eslatma - moliyaviy va'da yo'q, shuning uchun
 * to'liq avtonom ijro uchun xavfsiz) - faqat mijoz "qayta sotib
 * olish" o'rniga, "like bosgan, lekin hali sotib olmagan" mahsulotlar
 * haqida eslatiladi. `engagementReminders.js`dagi `sendFavoriteReminders`
 * ichida, faqat sotuvchi `aiCeoAutoFavoriteEnabled`ni alohida yoqqan
 * bo'lsa ishlatiladi (standart holatda o'chiq).
 */
/**
 * @param {{sentCount: number, convertedCount: number, conversionRatePercent: number}|null} [params.recentPerformance] -
 *   `buildWinBackPrompt`dagi bilan bir xil "o'z-o'zini yaxshilash"
 *   qatlami, batafsil izoh o'sha yerda.
 */
function buildFavoriteReminderPrompt({ itemNames, storeName, recentPerformance = null }) {
  return `Sen — kichik onlayn do'kon egasi uchun mijozlar bilan iliq muloqot matnlari yozuvchi yordamchisisan.

MIJOZ sevimlilar ro'yxatiga quyidagi mahsulot(lar)ni qo'shgan, lekin hali sotib olmagan: ${itemNames.join(", ")}.
Do'kon: "${storeName || "Do'kon"}"
${buildRecentPerformanceLine(recentPerformance)}

VAZIFA: mijozga Telegram orqali yuboriladigan, QISQA (2-3 gap), ILIQ va O'YINQAROQ (lekin professional) uslubda eslatma yoz - mahsulot(lar) hali ham mavjudligini va tez tugab qolishi mumkinligini eslatib, xarid qilishga undaydigan, lekin bosim o'tkazmaydigan ohangda.

QOIDALAR:
- O'ZBEK TILIDA yoz.
- Mahsulot nomlarini o'z so'zlaring bilan tabiiy ravishda matnga kirit.
- Aniq chegirma/promokod TAKLIF QILMA (buni sotuvchi o'zi qo'shishi mumkin).
- Faqat xabar matnini yoz, boshqa hech narsa qo'shma.`;
}

async function craftFavoriteReminderMessage({ itemNames, storeName, recentPerformance = null }) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildFavoriteReminderPrompt({ itemNames, storeName, recentPerformance }),
    // `CTA_RULE` ataylab qo'shilmagan - `craftWinBackMessage` bilan
    // bir xil sabab (yuqoridagi izohga qarang).
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const message = (response.text || "").trim();
  if (!message) throw new Error("AI bo'sh javob qaytardi.");
  return message;
}

/**
 * `carts.js`dagi "tashlab ketilgan savat" eslatmasi uchun matnni,
 * faqat `aiCeoEnabled === true` bo'lgan sotuvchilar uchun (xuddi
 * `generateSocialPost`dagi premium tekshiruvi kabi), shu funksiya
 * orqali AI'ga shaxsiylashtirib yozdiradi -
 * `craftWinBackMessage`/`craftFavoriteReminderMessage` bilan bir xil
 * naqsh va xavfsizlik darajasi: mahsulot nomlari beriladi, narx/jami
 * summa yoki chegirma kod AI'ga berilmaydi va AI matniga
 * aralashtirilmaydi - ular `carts.js`da, AI matnidan keyin, har
 * doimgi kabi deterministik ravishda qo'shiladi (AI hech qachon
 * moliyaviy majburiyat tafsilotini o'ylab topmasligi kerak).
 * `CTA_RULE` esa bu yerga ataylab qo'shiladi (win-back/favorite'dan
 * farqli) - chunki bu, xaridni allaqachon boshlagan (savatga solgan)
 * mijozga, xaridni yakunlashga undash - "bosim o'tkazmaslik" talabi
 * bu yerda amal qilmaydi.
 */
function buildCartRecoveryPrompt({ itemNames, storeName }) {
  return `Sen — kichik onlayn do'kon egasi uchun mijozlar bilan iliq muloqot matnlari yozuvchi yordamchisisan.

MIJOZ savatchasiga quyidagi mahsulot(lar)ni solgan, lekin buyurtmani hali yakunlamagan: ${itemNames.join(", ")}.
Do'kon: "${storeName || "Do'kon"}"

VAZIFA: mijozga Telegram orqali yuboriladigan, QISQA (2-3 gap), ILIQ uslubda eslatma yoz - xaridni yakunlashga undaydigan, yengil shoshiltirish (masalan zaxira cheklangan bo'lishi mumkinligi) elementi bilan, lekin TAJOVUZKOR bo'lmagan ohangda.

QOIDALAR:
- O'ZBEK TILIDA yoz.
- Mahsulot nomlarini o'z so'zlaring bilan tabiiy ravishda matnga kirit.
- Aniq narx, summa yoki chegirma/promokod YOZMA (bular xabarga ALOHIDA, avtomatik qo'shiladi).
- Faqat xabar matnini yoz, boshqa hech narsa qo'shma.`;
}

async function craftCartRecoveryMessage({ itemNames, storeName }) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildCartRecoveryPrompt({ itemNames, storeName }),
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: `${BASE_STYLE_INSTRUCTION}\n${CTA_RULE}` },
  });
  const message = (response.text || "").trim();
  if (!message) throw new Error("AI bo'sh javob qaytardi.");
  return message;
}

/**
 * Bu funksiya xabarni avtomatik yubormaydi - faqat tayyor matn
 * yaratadi, sotuvchi uni ko'rib chiqib, o'zi (CRM yoki to'g'ridan-to'g'ri
 * Telegram orqali) yuboradi.
 */
async function handleGenerateWinBackMessage(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`generateWinBackMessage:${request.auth.uid}`, 20, 3600);
  await requirePremiumSeller(request.auth.uid);

  const { customerName, daysSinceLastOrder, lastProductName, storeName } = request.data || {};
  if (!daysSinceLastOrder) {
    throw new HttpsError("invalid-argument", "Mijoz ma'lumoti to'liq emas.");
  }

  try {
    const message = await craftWinBackMessage({ customerName, daysSinceLastOrder, lastProductName, storeName });
    return { message };
  } catch (err) {
    console.error("Qaytarish xabari yaratishda xatolik:", err);
    throw new HttpsError("internal", "Xabar yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

/**
 * AI CEO — CRM segment kampaniyasi ("senior sotuv menejeri" taktikasi).
 *
 * Ishonch zinapoyasi (trust ladder) modeliga muvofiq: bu funksiya
 * xabarni hech qachon o'zi yubormaydi. U faqat tanlangan segment
 * (VIP yoki "uxlab qolgan") uchun to'liq tayyor kampaniya matnini
 * (sarlavha + xabar + nega bu taktika samarali) yaratadi. Frontend
 * (`CrmHub.jsx`) bu natijani to'g'ridan-to'g'ri mavjud, allaqachon
 * tasdiqlangan xabar yuborish formasiga joylaydi - sotuvchi ko'rib
 * chiqadi, xohlasa tahrirlaydi, va o'zi "Yuborish" tugmasini bosadi
 * (haqiqiy yuborish - eski, allaqachon xavfsiz tekshirilgan
 * `sendCrmNotification`, bu yerda qayta yozilmaydi).
 *
 * Promokod AI tomonidan taklif qilinmaydi: agar AI o'zidan promokod
 * o'ylab topsa, lekin bu kod haqiqatda `coupons` kolleksiyasida
 * yaratilmagan bo'lsa, checkout paytida mijoz uchun ishlamaydigan,
 * ishonchni yo'qotadigan va'da bo'lib qoladi. Shuning uchun promokod
 * maydoni CRM Hub formasida qanday bo'lsa, shunday qoladi (sotuvchi
 * faqat haqiqiy, o'zi yaratgan promokodni tanlashi mumkin) - AI
 * faqat matn yozadi, moliyaviy va'da bermaydi.
 */
/**
 * AI CEO o'zi reja tuzadi.
 *
 * Bu hali tool-calling emas (Gemini'ga vositalar berilmagan, u
 * ma'lumotni o'zi so'rab ololmaydi) - bu, xuddi
 * `buildCrmCampaignPrompt`/`buildWinBackPrompt` kabi, oldindan
 * tayyorlangan qisqa, sof (aggregatsiya qilingan) signallarni bitta
 * promptga joylab, Gemini'dan bitta, labelli-matn formatidagi javob
 * so'raydigan naqsh. Farqi - bu safar Gemini'dan so'ralayotgan narsa
 * matn yozish emas, balki qaror (qaysi harakat turi eng muhim) -
 * ya'ni "Bugungi rejalar" markazining ustuvorlik tartibi qattiq
 * kodlangan qoida (VIP > churn > chegirma > aksiya) emas, balki
 * bugungi haqiqiy vaziyatga qarab AI tomonidan hal qilinadi.
 *
 * Hallyutsinatsiyadan himoya: Gemini faqat berilgan, mavjud kalitlar
 * (`availableKeys`) orasidan tanlashi mumkin -
 * `parseActionPlanResponse` har qanday boshqa/o'ylab topilgan kalitni
 * e'tiborsiz qoldiradi, va agar AI biror mavjud kalitni tushirib
 * qoldirsa, u avtomatik oxiriga qo'shiladi - hech qaysi band
 * yo'qolib qolmaydi.
 */
function buildActionPlanPrompt(signals, storeName, nicheId) {
  const nicheConfig = getNicheConfig(nicheId);
  const lines = [];
  if (signals.vipCount > 0) lines.push(`- VIP mijozlar: ${signals.vipCount} ta (hali ular bilan maxsus aloqa qilinmagan)`);
  if (signals.churnCount > 0) lines.push(`- Uxlab qolgan mijozlar: ${signals.churnCount} ta (30+ kundan beri xarid qilmagan)`);
  if (signals.discountCandidateName) lines.push(`- Uzoq vaqt sotilmagan mahsulot bor: "${signals.discountCandidateName}"`);
  if (signals.promoteCandidateName) lines.push(`- Eng ko'p sotilayotgan mahsulot: "${signals.promoteCandidateName}" (reklama/aksiya qilish mumkin)`);
  lines.push(`- Bugungi tushum kechagiga nisbatan: ${signals.revenueChangeText}`);
  if (signals.convertedCount > 0) lines.push(`- So'nggi CRM xabarlaridan ${signals.convertedCount} kishi sotib oldi (bu strategiya HOZIRDA ISHLAYAPTI)`);

  return `Sen — kichik onlayn do'kon uchun strategik maslahatchisan (AI CEO). ${nicheConfig.aiContext} Vazifang: bugun sotuvchi UCHTA-TO'RTTA mumkin bo'lgan harakatdan qaysi birini BIRINCHI navbatda ko'rishi kerakligini hal qilish.

Do'kon: "${storeName || "Do'kon"}"

BUGUNGI SIGNALLAR (FAQAT shularga tayaning, boshqa hech narsa o'ylab topma):
${lines.join("\n")}

MAVJUD HARAKAT TURLARI (FAQAT shu kalitlardan foydalan, boshqa kalit YOZMA): ${signals.availableKeys.join(", ")}

VAZIFA: quyidagi ANIQ formatda javob ber, boshqa hech narsa yozma:
TARTIB: <mavjud kalitlarni ENG MUHIMIDAN boshlab, vergul bilan ajratib - masalan: vip, discount, promote>
SABAB: <bitta gap - nega aynan shu bitta harakat BUGUN eng muhim (aniq raqamlarga tayanib)>

QOIDALAR:
- TARTIB qatorida FAQAT yuqorida berilgan MAVJUD kalitlardan foydalan.
- Barcha mavjud kalitlarni albatta tartibda ko'rsat (birontasi tushib qolmasin).
- Faqat O'ZBEK TILIDA yoz.`;
}

/**
 * Sof funksiya - Gemini javobini {order, reasoning}ga ajratadi va
 * xavfsizlik filtrini qo'llaydi (yuqoridagi izohga qarang).
 */
function parseActionPlanResponse(rawText, availableKeys) {
  const orderMatch = rawText.match(/TARTIB:\s*(.+?)(?=\nSABAB:|$)/s);
  const reasonMatch = rawText.match(/SABAB:\s*(.+?)$/s);
  const rawOrder = orderMatch
    ? orderMatch[1].split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const seen = new Set();
  const order = rawOrder.filter((key) => availableKeys.includes(key) && !seen.has(key) && seen.add(key));
  // Gemini biror MAVJUD kalitni tushirib qoldirgan bo'lsa - oxiriga
  // qo'shamiz, hech qaysi band butunlay yo'qolib qolmasligi uchun.
  availableKeys.forEach((key) => {
    if (!seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  });

  return { order, reasoning: reasonMatch ? reasonMatch[1].trim() : null };
}

async function craftActionPlan(signals, storeName, nicheId) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildActionPlanPrompt(signals, storeName, nicheId),
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const text = (response.text || "").trim();
  if (!text) throw new Error("AI bo'sh javob qaytardi.");
  const parsed = parseActionPlanResponse(text, signals.availableKeys);
  if (parsed.order.length === 0) throw new Error("AI tartib qaytarmadi.");
  return parsed;
}

const CRM_SEGMENT_TACTICS = {
  vip: "Bu — ENG QIMMATLI mijozlar guruhi (eng yuqori umumiy xarid summasiga ega). Vazifang: ularni QADRLASH, ular uchun MAXSUS/eksklyuziv his qildiruvchi ohangda yozish - uzoq muddatli sodiqlikni mustahkamlash uchun.",
  churn: "Bu — 30 kundan ortiq xarid qilmagan, \"uxlab qolgan\" mijozlar guruhi. Vazifang: ularni BOSIM O'TKAZMASDAN, iliq va samimiy \"sizni sog'indik\" ohangida QAYTARISH - ular haqida qayg'urayotganingizni bildirib.",
};

function buildCrmCampaignPrompt(segment, segmentCount, storeName, topProductName, nicheId) {
  const nicheConfig = getNicheConfig(nicheId);
  return `Sen — kichik onlayn do'konlar uchun ishlaydigan, tajribali SOTUV MENEJERI va MARKETING STRATEGISTSAN. ${nicheConfig.aiContext} Vazifang - sotuvni oshirish uchun samarali Telegram broadcast xabari yozish.

Do'kon: "${storeName}"
Auditoriya: ${segmentCount} ta mijoz.
${CRM_SEGMENT_TACTICS[segment]}
${topProductName ? `Do'konning eng ko'p sotiladigan mahsuloti: "${topProductName}" (agar tabiiy mos kelsa, eslatib o'tishing mumkin, majburiy emas).` : ""}

VAZIFA: quyidagi ANIQ formatda javob ber, boshqa hech narsa yozma:
SARLAVHA: <push-xabar sarlavhasi, 3-6 so'z>
XABAR: <asosiy xabar matni, 2-4 gap, iliq va professional ohangda>
SABAB: <bitta gap - nega aynan shu taktika bu auditoriya uchun samarali>

QOIDALAR:
- Bu — barcha ${segmentCount} mijozga BIR XILDA yuboriladigan umumiy xabar (bironta mijozning shaxsiy ismini ISHLATMA).
- Aniq chegirma/promokod TAKLIF QILMA (sotuvchi buni o'zi, agar xohlasa, alohida qo'shadi).
- Yolg'on/tekshirib bo'lmaydigan da'vo (masalan xayoliy statistika yoki reyting) ISHLATMA.
- Faqat O'ZBEK TILIDA, oddiy so'zlashuv uslubida yoz.`;
}

/**
 * Sof funksiya - Gemini javobini {title, message, reasoning}ga
 * ajratadi (`productDrafts.js`dagi `parseDraftResponse` bilan bir
 * xil yondashuv - labelli matn formati, JSON emas, chunki Gemini
 * erkin matnda ko'proq ishonchli natija beradi).
 */
function parseCrmCampaignResponse(rawText) {
  const titleMatch = rawText.match(/SARLAVHA:\s*(.+?)(?=\nXABAR:|$)/s);
  const messageMatch = rawText.match(/XABAR:\s*(.+?)(?=\nSABAB:|$)/s);
  const reasonMatch = rawText.match(/SABAB:\s*(.+?)$/s);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    message: messageMatch ? messageMatch[1].trim() : null,
    reasoning: reasonMatch ? reasonMatch[1].trim() : null,
  };
}

/**
 * Sof Gemini chaqiruvi - `craftWinBackMessage` bilan bir xil naqsh:
 * auth/premium/HttpsError tekshiruvidan mustaqil, shuning uchun ikki
 * joyda ishlatiladi: (1) quyidagi `handleGenerateCrmCampaign`
 * (sotuvchi CRM Hub'da tugma bosganda), va (2) Telegram orqali
 * "bir tugmali tasdiqlash" kunlik tavsiya xabari
 * (`telegramApprovalDigest.js`) - sotuvchi Mini App'ni ochmasdan,
 * to'g'ridan-to'g'ri Telegram'da tayyor kampaniya matnini ko'radi va
 * bitta tugma bilan tasdiqlaydi. Xato bo'lsa oddiy `Error` tashlaydi -
 * chaqiruvchi tomon o'zi hal qiladi.
 */
async function craftCrmCampaign(segment, segmentCount, storeName, topProductName, nicheId) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildCrmCampaignPrompt(segment, segmentCount, storeName || "Do'kon", topProductName || null, nicheId),
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const { title, message, reasoning } = parseCrmCampaignResponse((response.text || "").trim());
  if (!title || !message) throw new Error("AI bo'sh yoki noto'g'ri formatli javob qaytardi.");
  return { title, message, reasoning: reasoning || "" };
}

async function handleGenerateCrmCampaign(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`generateCrmCampaign:${request.auth.uid}`, 20, 3600);
  const seller = await requirePremiumSeller(request.auth.uid);

  const { segment, segmentCount, storeName, topProductName } = request.data || {};
  if (!CRM_SEGMENT_TACTICS[segment]) {
    throw new HttpsError("invalid-argument", "Noto'g'ri segment tanlandi.");
  }
  if (!Number.isInteger(segmentCount) || segmentCount <= 0) {
    throw new HttpsError("invalid-argument", "Bu segmentda mijoz topilmadi.");
  }

  try {
    // Niche - HECH QACHON mijoz (client) so'rovidan olinmaydi, faqat
    // server tomonida, sotuvchining o'z hujjatidan (tenant izolyatsiyasi
    // buzilmasligi uchun - client `nicheId` yuborsa ham e'tiborsiz
    // qoldiriladi).
    return await craftCrmCampaign(segment, segmentCount, storeName, topProductName, seller.category);
  } catch (err) {
    console.error("CRM kampaniyasi yaratishda xatolik:", err);
    throw new HttpsError("internal", "Kampaniya matni yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

exports.generateAnalyticsInsight = onCall({ secrets: [GEMINI_API_KEY], region: "asia-south1" }, handleGenerateAnalyticsInsight);
exports.generateWinBackMessage = onCall({ secrets: [GEMINI_API_KEY], region: "asia-south1" }, handleGenerateWinBackMessage);
exports.generateCrmCampaign = onCall({ secrets: [GEMINI_API_KEY], region: "asia-south1" }, handleGenerateCrmCampaign);
exports.generateDailyAiCeoReport = onCall({ region: "asia-south1", secrets: [SENTRY_DSN, GEMINI_API_KEY] }, withSentry(handleGenerateDailyReport));

// Bu `onCall`/`onSchedule` bilan o'ralmagan, oddiy funksiya eksporti
// (xuddi pastdagi `_testables` kabi) - Firebase deploy vaqtida Cloud
// Function sifatida aniqlanmaydi (Firebase CLI faqat maxsus ichki
// belgisi bor eksportlarni "funksiya" deb hisoblaydi, qolganini
// e'tiborsiz qoldiradi) - shuning uchun `index.js`da boshqa fayllar
// bilan birga spread qilinsa ham xavfsiz. `engagementReminders.js`
// buni to'g'ridan-to'g'ri `require("./aiCeo")` orqali chaqiradi.
exports.craftWinBackMessage = craftWinBackMessage;
exports.craftFavoriteReminderMessage = craftFavoriteReminderMessage;
exports.craftCartRecoveryMessage = craftCartRecoveryMessage;
exports.craftCrmCampaign = craftCrmCampaign;
exports.collectAttentionSegmentClientIds = collectAttentionSegmentClientIds;
exports.craftActionPlan = craftActionPlan;
// `telegramBotMenu.js`dagi "📊 AI CEO hisobotlari" bot-tugmasi uchun -
// Mini App'dagi `AiCeoInfoPage.jsx` bilan bir xil, haqiqiy kunlik
// hisobotni Telegram chatida, ilovani ochmasdan ko'rsatish uchun
// qayta ishlatiladi (yangi hisoblash mantig'i yozilmaydi).
exports.buildDailyReport = buildDailyReport;

exports._testables = {
  buildDigestStats, buildDigestPrompt, handleGenerateAnalyticsInsight, handleGenerateWinBackMessage,
  handleGenerateDailyReport, parseCrmCampaignResponse, handleGenerateCrmCampaign, countAttentionSegments,
  craftWinBackMessage, craftFavoriteReminderMessage, craftCrmCampaign, collectAttentionSegmentClientIds,
  buildActionPlanPrompt, parseActionPlanResponse, craftActionPlan,
  buildCrmCampaignPrompt,
  buildWinBackPrompt, buildFavoriteReminderPrompt, buildRecentPerformanceLine,
  buildCartRecoveryPrompt, craftCartRecoveryMessage,
  computeTimeSavedMinutes,
};
