const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");

/**
 * AI CEO — natija kuzatuvi va o'rganish qatlami.
 *
 * Arxitekturaviy ma'no: AI CEO'ning matn yozish/qaror qabul qilish
 * mantig'i o'zi yozgan matn/qarorning real hayotda qanday natija
 * berganini bilmaydi. Bu fayl AI CEO'ning Tier-1 avtonom xabarlari
 * (`engagementReminders.js`dagi avtomatik qaytarish/sevimlilar
 * eslatmasi) uchun haqiqiy natijani (mijoz keyinroq xarid qildimi)
 * kuzatib boradi va shu natijani AI'ning o'ziga - keyingi safar xuddi
 * shu turdagi xabarni yozayotganda - qaytarib beradi
 * (`getRecentAiPerformance`, `aiCeo.js`dagi promptlarga qarang) - bu
 * o'z-o'zini yaxshilash qatlami.
 *
 * Alohida faylga ajratilgan sabab: bu qayta ishlatiladigan, umumiy
 * "o'rganish" infratuzilmasi, `aiCeo.js`ning matn yozish mantig'idan
 * mustaqil.
 *
 * Bu modulning hech bir funksiyasi xato tashlamaydi (hammasi ichki
 * try/catch bilan o'ralgan, jim log yozadi) - natija kuzatuvi asosiy
 * funksiyaning (eslatma yuborish) ishlashiga ta'sir qilmasligi kerak,
 * xuddi `lib/dailyStats.js`dagi `incrementDailyStat` kabi.
 *
 * Ma'lumot saqlash: `sellers/{id}/aiCeoOutcomes/{outcomeId}` - har bir
 * yuborilgan avtonom xabar uchun bitta hujjat (`type`, `clientId`,
 * `aiGenerated`, `sentAtMs`, `status`: "pending"/"converted"/
 * "not_converted"). `sellers/{id}/aiCeoLearning/summary` - shu
 * hujjatlardan yig'ilgan, tez o'qiladigan agregat hisoblagichlar
 * (`winbackAiSent`, `winbackAiConverted`, `winbackTemplateSent`,
 * `winbackTemplateConverted`, va xuddi shunday `favorite*` to'rttasi) -
 * faqat flat (ichma-ich emas) maydonlar, Firestore nuqta-yo'l
 * (dot-path) murakkabligidan qochish uchun.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Xabar yuborilgandan keyin, mijoz "xarid qildimi" tekshiriladigan
// oyna - 7 kun (odatiy xarid qarori qabul qilish muddati uchun
// yetarli, lekin cheksiz emas - eski xabarlar abadiy "pending" bo'lib
// qolmasligi uchun).
const EVALUATION_WINDOW_DAYS = 7;

// Bir sotuvchi uchun, bir yugurishda ko'rib chiqiladigan maksimal
// "pending" hujjatlar soni - `engagementReminders.js`dagi
// `MAX_FAVORITES_PER_RUN`/`MAX_ORDERS_PER_RUN` bilan bir xil xavfsizlik
// chegarasi naqshi.
const MAX_PENDING_PER_SELLER_PER_RUN = 500;

// Kamida shuncha AI-yozgan xabar baholanmaguncha (ya'ni haqiqiy
// natija ma'lum bo'lmaguncha), konversiya darajasi Gemini'ga
// ko'rsatilmaydi - juda kichik namunada (masalan 1ta xabardan 0% yoki
// 100%) noto'g'ri, chalg'ituvchi xulosaga olib kelmasligi uchun.
const MIN_SAMPLE_SIZE = 5;

function learningSummaryRef(sellerId) {
  return db.collection("sellers").doc(sellerId).collection("aiCeoLearning").doc("summary");
}

function outcomesCollectionRef(sellerId) {
  return db.collection("sellers").doc(sellerId).collection("aiCeoOutcomes");
}

/**
 * Sof funksiya - agregat hisoblagich hujjatidagi flat maydon nomini
 * quradi (masalan "winbackAiSent", "favoriteTemplateConverted").
 */
function summaryFieldName(type, aiGenerated, suffix) {
  return `${type}${aiGenerated ? "Ai" : "Template"}${suffix}`;
}

/**
 * Har bir avtonom (Tier-1) xabar MUVAFFAQIYATLI YUBORILGANDA
 * chaqiriladi - "kim, qachon, qanday (AI yozganmi yoki oddiy
 * shablonmi) xabar oldi"ni alohida hujjat sifatida yozadi VA umumiy
 * "yuborildi" hisoblagichini oshiradi.
 *
 * @param {object} params
 * @param {string} params.sellerId
 * @param {"winback"|"favorite"} params.type
 * @param {string} params.clientId
 * @param {boolean} params.aiGenerated - matnni AI yozganmi (aks holda oddiy shablon)
 * @param {boolean} [params.discountIssued] - shu xabar bilan birga
 *   haqiqiy, bir martalik chegirma kodi ham avtomatik yaratilib
 *   yuborilganmi (batafsil izoh: `aiCeoAutoDiscount.js`). Faqat
 *   audit/keyingi tahlil uchun saqlanadi - baholash
 *   (`evaluateSellerOutcomes`) yoki agregat hisoblagichlar mantig'iga
 *   ta'sir qilmaydi.
 */
async function recordAiCeoOutcome({ sellerId, type, clientId, aiGenerated, discountIssued = false }) {
  if (!sellerId || !clientId || !type) return;
  try {
    await outcomesCollectionRef(sellerId).add({
      type,
      clientId,
      aiGenerated: aiGenerated === true,
      discountIssued: discountIssued === true,
      status: "pending",
      sentAtMs: Date.now(),
    });
    await learningSummaryRef(sellerId).set(
      { [summaryFieldName(type, aiGenerated === true, "Sent")]: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );
  } catch (err) {
    console.error(`AI CEO natija kuzatuvini yozishda xatolik (${type}, sotuvchi ${sellerId}):`, err);
  }
}

/**
 * `craftWinBackMessage`/`craftFavoriteReminderMessage` chaqirilishidan
 * oldin o'qiladi - AI shu turdagi xabarlar bo'yicha o'tgan, baholangan
 * natijasini biladi va shunga qarab yozish uslubini moslashtirishi
 * mumkin (o'rganish qatlami, batafsil izoh - fayl boshida). Namuna
 * hali yetarli bo'lmasa (`MIN_SAMPLE_SIZE`dan kam) yoki hujjat mavjud
 * bo'lmasa `null` qaytaradi, chaqiruvchi tomon buni "ma'lumot yo'q"
 * deb tushunadi va promptga hech narsa qo'shmaydi.
 *
 * @param {string} sellerId
 * @param {"winback"|"favorite"} type
 */
async function getRecentAiPerformance(sellerId, type) {
  try {
    const snap = await learningSummaryRef(sellerId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const sentCount = Number(data[summaryFieldName(type, true, "Sent")]) || 0;
    const convertedCount = Number(data[summaryFieldName(type, true, "Converted")]) || 0;
    if (sentCount < MIN_SAMPLE_SIZE) return null;
    return { sentCount, convertedCount, conversionRatePercent: Math.round((convertedCount / sentCount) * 100) };
  } catch (err) {
    console.error(`AI CEO oldingi natijasini o'qishda xatolik (${type}, sotuvchi ${sellerId}):`, err);
    return null;
  }
}

/**
 * Sof funksiya - `aiCeoLearning/summary` hujjatining xom (flat)
 * maydonlarini frontend'ga (va `askAiCeo`ning vositasiga) qulay,
 * inson o'qiy oladigan shaklga aylantiradi. `sentCount === 0` bo'lgan
 * turlar `null` qaytariladi - hali umuman xabar yuborilmagan (yoki AI
 * CEO endigina yoqilgan) sotuvchiga bo'sh/chalg'ituvchi "0%"
 * ko'rsatilmasligi uchun.
 */
function buildLearningSummaryForDisplay(rawData) {
  const data = rawData || {};
  const buildType = (type) => {
    const sentCount = Number(data[summaryFieldName(type, true, "Sent")]) || 0;
    if (sentCount === 0) return null;
    const convertedCount = Number(data[summaryFieldName(type, true, "Converted")]) || 0;
    return { sentCount, convertedCount, conversionRatePercent: Math.round((convertedCount / sentCount) * 100) };
  };
  return { winback: buildType("winback"), favorite: buildType("favorite") };
}

/**
 * Bitta sotuvchining "pending" (hali baholanmagan) natijalarini ko'rib
 * chiqadi - `EVALUATION_WINDOW_DAYS` kun to'lganlarni HAQIQIY buyurtma
 * tarixi bilan solishtirib, "konversiya bo'ldimi" hal qiladi.
 */
async function evaluateSellerOutcomes(sellerId) {
  const cutoffMs = Date.now() - EVALUATION_WINDOW_DAYS * DAY_MS;
  const pendingSnap = await outcomesCollectionRef(sellerId)
    .where("status", "==", "pending")
    .limit(MAX_PENDING_PER_SELLER_PER_RUN)
    .get();
  if (pendingSnap.empty) return;

  // Bitta sotuvchi ichidagi natijalar orasida ham umumiy o'zgaruvchan
  // holat yo'q (har biri o'z hujjatini yangilaydi; `learningSummaryRef`
  // yozuvi Firestore'ning atomik `increment()`i orqali amalga oshadi,
  // JS xotirasidagi hisoblagich emas) - shuning uchun bu yerda ham
  // oddiy PARALEL guruhlash xavfsiz (batafsil izoh: `lib/batchProcess.js`).
  await processBatched(pendingSnap.docs, async (outcomeDoc) => {
    const outcome = outcomeDoc.data();
    // Hali baholash vaqti kelmagan (oyna to'lmagan) - keyingi
    // yugurishda qayta ko'rib chiqiladi.
    if (!outcome.sentAtMs || outcome.sentAtMs > cutoffMs) return;

    try {
      // Mijoz o'sha xabardan keyin yangi buyurtma berganmi -
      // `sendRepurchaseReminders`dagi "qayta buyurtma bergani"
      // tekshiruvi bilan bir xil naqsh.
      const newerOrderSnap = await db.collection("orders")
        .where("sellerId", "==", sellerId)
        .where("clientId", "==", outcome.clientId)
        .where("createdAt", ">", admin.firestore.Timestamp.fromMillis(outcome.sentAtMs))
        .limit(1)
        .get();
      const converted = !newerOrderSnap.empty;

      await outcomeDoc.ref.update({
        status: converted ? "converted" : "not_converted",
        evaluatedAtMs: Date.now(),
      });

      if (converted) {
        await learningSummaryRef(sellerId).set(
          { [summaryFieldName(outcome.type, outcome.aiGenerated === true, "Converted")]: admin.firestore.FieldValue.increment(1) },
          { merge: true }
        );
      }
    } catch (err) {
      console.error(`AI CEO natijasini baholashda xatolik (${outcomeDoc.id}, sotuvchi ${sellerId}):`, err);
      throw err;
    }
  });
}

exports.evaluateAiCeoOutcomes = onSchedule(
  {
    // `sendFavoriteReminders`(12:00)/`sendRepurchaseReminders`(13:00)dan
    // oldin, ertalab ishlaydi - shu kuni yuboriladigan yangi xabarlar
    // bilan aralashib ketmasligi uchun vaqt jihatdan ajratilgan.
    schedule: "0 9 * * *", timeZone: "Asia/Tashkent", region: "asia-south1",
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
    secrets: [SENTRY_DSN],
  },
  withSentry(async () => {
    // Xarajat nazorati (kolleksiya darajasida): faqat
    // `aiCeoEnabled == true` bo'lgan sotuvchilarni ko'rib chiqamiz -
    // boshqa hech kim uchun bitta `aiCeoOutcomes` hujjati ham
    // yaratilmagan (`recordAiCeoOutcome` shu bayroqqa qarab yozadi),
    // shuning uchun ularni tekshirishning ma'nosi yo'q.
    const eligibleSellersSnap = await db.collection("sellers").where("aiCeoEnabled", "==", true).get();
    if (eligibleSellersSnap.empty) return;

    // Sotuvchilar orasida umumiy o'zgaruvchan holat yo'q, shuning uchun
    // oddiy PARALEL guruhlash yetarli.
    const result = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
      try {
        await evaluateSellerOutcomes(sellerDoc.id);
      } catch (err) {
        console.error(`AI CEO natija baholashda xatolik (sotuvchi ${sellerDoc.id}):`, err);
        throw err;
      }
    });
    console.log(`evaluateAiCeoOutcomes: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

exports.recordAiCeoOutcome = recordAiCeoOutcome;
exports.getRecentAiPerformance = getRecentAiPerformance;
exports.buildLearningSummaryForDisplay = buildLearningSummaryForDisplay;
exports.learningSummaryRef = learningSummaryRef;

exports._testables = {
  recordAiCeoOutcome,
  getRecentAiPerformance,
  buildLearningSummaryForDisplay,
  evaluateSellerOutcomes,
  summaryFieldName,
};
