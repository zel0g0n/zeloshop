const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { createGeminiClient } = require("./lib/geminiClient");
const { admin, db, GEMINI_API_KEY } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
// AI CEO natija kuzatuvi va o'rganish qatlami bilan bog'lovchi vosita
// (batafsil izoh: `aiCeoLearning.js`): sotuvchi "AI CEO'dan so'rang"
// orqali "sen menga qanchalik samarali ishlayapsan?" deb so'rashi
// mumkin bo'lishi uchun.
const { buildLearningSummaryForDisplay, learningSummaryRef } = require("./aiCeoLearning");
// 15-NICHE UNIVERSAL PLATFORMA: "AI CEO'dan so'rang" ham sotuvchining
// HAQIQIY sohasiga mos kontekst bilan javob beradi - batafsil izoh:
// `lib/niches.js`.
const { getNicheConfig } = require("./lib/niches");
// P&L (yalpi foyda) va AI narx tavsiyalari holatini o'qish uchun -
// batafsil izoh: quyida `execGetPnlSummary`/`execGetPendingPricingSuggestions`.
const { dateKeyFromMillis } = require("./lib/rollups");
// "AI Business Manager" (Z-Biznes, 2026-09 punkt-royxati, 4-band)
// vositalari FAQAT Z-Biznes tarifidagi (yoki uning faol sinovidagi)
// sotuvchilarga ko'rsatiladi - batafsil izoh: quyida `handleAskAiCeo`.
const { getEffectiveTariffPlan } = require("./lib/tariffs");
// MIJOZLAR RAZVEDKASI ("Advanced Customer Intelligence", Z-Biznes,
// 2026-09 punkt-royxati, 9-band) - sof tasniflash mantig'i (batafsil
// izoh: `lib/customerIntelligence.js`).
const {
  classifyCustomerIntelligence,
  filterClassifiedCustomers,
  PRIMARY_SEGMENT_KEYS,
  TAG_KEYS,
} = require("./lib/customerIntelligence");
const { CUSTOMER_SEGMENTS_SAMPLE_LIMIT, loadHighIntentClientIds } = require("./lib/customerIntelligenceQueries");
// YANGI (ZeloShop — AI Business Operating System boyitish, 2026-09):
// "AI CEO'dan so'rang" ENDI faqat o'qish/tahlil bilan CHEKLANMAYDI -
// Z-Biznes tarifida AI o'zi HAQIQIY, ijro etiladigan harakat (reklama
// kampaniyasi) TAKLIF qila oladi - lekin rasmiy Approval Engine
// (`lib/aiApprovalEngine.js`, `telegramApproval.js` bilan BIR XIL)
// orqali, sotuvchi tasdiqlamaguncha HECH NARSA ijro etilmaydi.
const { createPendingAction } = require("./lib/aiApprovalEngine");
const { AD_CAMPAIGN_MIN_DISCOUNT_PERCENT, AD_CAMPAIGN_MAX_DISCOUNT_PERCENT, AD_CAMPAIGN_MAX_RECIPIENTS } = require("./lib/aiActionRegistry");

/**
 * AI CEO — tool-calling arxitekturasi.
 *
 * `aiCeo.js`ning `craftActionPlan`idan farqli: u yerda Gemini'ga har
 * doim oldindan, bitta promptda tayyorlangan, qat'iy signal to'plami
 * yuborilardi ("mana senga raqamlar, shu asosida javob ber"). Bu yerda
 * esa Gemini'ga haqiqiy, chaqiriladigan vositalar
 * (`tools`/`functionDeclarations`) beriladi - u o'zi qaysi ma'lumot
 * kerakligini hal qiladi, kerakli vositani chaqiradi, natijani oladi
 * va kerak bo'lsa yana boshqa vosita chaqiradi - bularning barchasi
 * `runToolCallingLoop` orqali, chegaralangan (`MAX_TOOL_ROUNDS`)
 * aylanma suhbat sifatida amalga oshadi. Bu "AI o'zi qaror qabul
 * qiladi"dan "AI o'zi qaysi ma'lumot kerakligini ham hal qiladi"ga
 * o'tish - haqiqiy agentlik xatti-harakatining bir ko'rinishi.
 *
 * Birinchi qo'llanilish joyi: "AI CEO'dan so'rang" - sotuvchi erkin
 * matnda (masalan "bu hafta eng ko'p nima sotildi?") savol beradi,
 * Gemini esa faqat kerakli vositalarni chaqirib (barchasini emas),
 * haqiqiy, joriy Firestore ma'lumotidan asoslangan javob beradi.
 *
 * Xavfsizlik: bu yerdagi vositalarning barchasi faqat o'qish
 * (read-only). Hech biri Firestore'ga yozmaydi, xabar yubormaydi,
 * narx/chegirma o'zgartirmaydi - shuning uchun ishonch zinapoyasi
 * modeliga ehtiyoj yo'q: bu funksiya hech qanday moliyaviy yoki
 * obro'ga oid xavf tug'dirmaydi, faqat sotuvchining o'z ma'lumotini
 * o'qib, tabiiy tilda tushuntirib beradi.
 *
 * Xarajat nazorati: (1) har bir vosita faqat sotuvchining o'z
 * ma'lumotiga (`sellerId` bo'yicha) cheklangan va natija sifatida
 * qisqa, agregatsiya qilingan raqam qaytaradi (xom hujjatlar emas);
 * (2) aylanma suhbat `MAX_TOOL_ROUNDS`dan oshmaydi - oxirgi turda
 * vositalar o'chiriladi, Gemini albatta matn bilan javob berishga
 * majburlanadi (cheksiz "tool-loop"ning oldini olish uchun); (3) savol
 * uzunligi cheklangan (300 belgi) - haddan tashqari uzun/qimmat
 * so'rovlarning oldini olish uchun; (4) alohida, past chegarali rate
 * limit (`askAiCeo:${uid}`, soatiga 15 marta).
 */

const MODEL = "gemini-3.5-flash-lite";
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TOOL_ROUNDS = 4;

// `aiCeo.js`dagi `CRM_VIP_THRESHOLD`/`CRM_CHURN_DAYS` bilan bir xil
// bo'lib qolishi shart (frontend'dagi `src/utils/customerSegments.js`
// bilan ham mos kelishi kerak).
const VIP_THRESHOLD = 500_000;
const CHURN_DAYS = 30;

// ---------------------------------------------------------------------
// Vosita e'lonlari (Gemini ko'radigan sxema) - `parametersJsonSchema`
// oddiy JSON Schema, Gemini'ning o'zi qat'iy validatsiya qiladi
// (regex bilan qo'lda ajratish shart emas).
// ---------------------------------------------------------------------
const TOOL_DECLARATIONS = [
  {
    name: "get_revenue_summary",
    description: "So'nggi N kunlik tushum, buyurtmalar soni, yetkazilganlar soni va bekor qilish darajasini qaytaradi.",
    parametersJsonSchema: {
      type: "object",
      properties: { days: { type: "integer", description: "Necha kunlik davr (masalan 1, 7, 30)" } },
      required: ["days"],
    },
  },
  {
    name: "get_top_products",
    description: "So'nggi N kun ichida ENG KO'P sotilgan mahsulotlar ro'yxatini (nomi, soni, tushumi) qaytaradi.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Necha kunlik davr" },
        limit: { type: "integer", description: "Nechta mahsulot qaytarilsin (standart 5, maksimal 10)" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_customer_segments",
    description: "VIP (yuqori xarid summasiga ega) va \"uxlab qolgan\" (30+ kun xarid qilmagan) mijozlar sonini qaytaradi.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "get_low_stock_products",
    description: "Zaxirasi kam qolgan (tez tugab qolishi mumkin bo'lgan) mahsulotlar ro'yxatini qaytaradi.",
    parametersJsonSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Nechta mahsulot qaytarilsin (standart 5, maksimal 10)" } },
    },
  },
  {
    name: "get_ai_ceo_learning_summary",
    description: "AI CEO'ning O'ZI yozgan avtomatik xabarlarining (qaytarish va sevimlilar eslatmalari) HAQIQIY, o'lchangan konversiya darajasini (necha foiz mijoz keyin xarid qildi) qaytaradi.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_auto_discounts",
    description: "AI CEO tomonidan avtomatik (sotuvchi tasdiqisiz) yaratilgan, mijozlarni qaytarish uchun ishlatiladigan bir martalik chegirma promokodlari haqida statistika va so'nggilarini qaytaradi.",
    parametersJsonSchema: { type: "object", properties: {} },
  },
  // 2026-09 punkt-royxati, "AI Business Manager" (Z-Biznes), 4-band:
  // AI CEO'ni allaqachon mavjud, lekin unga hali "ko'rinmas" bo'lgan
  // ikkita real tizimga (server-side P&L rollup, haftalik AI narx
  // tavsiyalari) o'qish huquqi bilan ulash - yangi hisoblash mantig'i
  // emas, MAVJUD, sinovdan o'tgan ma'lumotni AI CEO suhbatiga ochish.
  {
    name: "get_pnl_summary",
    description: "So'nggi N kunlik YALPI foyda (tushum minus tannarx/COGS, OPEX va soliqsiz) va margin foizini qaytaradi.",
    parametersJsonSchema: {
      type: "object",
      properties: { days: { type: "integer", description: "Necha kunlik davr (masalan 7, 30)" } },
      required: ["days"],
    },
  },
  {
    name: "get_pending_pricing_suggestions",
    description: "Sotuvchi hali ko'rib chiqmagan (hal qilmagan) AI narx tavsiyalari sonini va namunasini qaytaradi (narxni oshirish/pasaytirish takliflari).",
    parametersJsonSchema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------
// "AI BUSINESS MANAGER" - Z-BIZNES'GA XOS VOSITALAR (2026-09
// punkt-royxati, 4-band). Bular yuqoridagi `TOOL_DECLARATIONS`dan
// ATAYLAB ALOHIDA saqlanadi - `handleAskAiCeo` ularni FAQAT sotuvchining
// samarali tarifi ("pro" emas, aynan "biznes") bo'lganda Gemini'ga
// beriladigan vositalar ro'yxatiga qo'shadi (quyida, `getEffectiveTariffPlan`
// orqali). Gemini FIZIKAVIY jihatdan e'lon qilinmagan vositani chaqira
// olmaydi - shuning uchun bu, alohida endpoint yoki ishonch tekshiruvi
// qatlamisiz, tabiiy tarzda "Biznes-only" cheklovni ta'minlaydi.
const BIZNES_TOOL_DECLARATIONS = [
  {
    name: "get_sales_decline_diagnostic",
    description: "Sotuvlar nima uchun kamayganini (yoki oshganini) tushunish uchun joriy davrni oldingi (bir xil uzunlikdagi) davr bilan taqqoslaydi: tushum, buyurtmalar soni, bekor qilish darajasi, eng ko'p pasaygan mahsulotlar (ularning joriy ombordagi zaxirasi bilan birga) va yangi mijozlar oqimidagi o'zgarish. DIQQAT: bu FAQAT statistik taqqoslash - to'g'ridan-to'g'ri isbotlangan sabab-oqibat bog'lanishi EMAS.",
    parametersJsonSchema: {
      type: "object",
      properties: { days: { type: "integer", description: "Joriy davr uzunligi kunlarda (masalan 30) - oldingi taqqoslash davri ham xuddi shuncha kun bo'ladi" } },
      required: ["days"],
    },
  },
  {
    name: "plan_ad_campaign",
    description: "Berilgan byudjet va mijozlar segmentiga/belgisiga asoslanib reklama/CRM kampaniyasi rejasini tuzadi: nechta mijozga yetadi, promokod uchun ENG YUQORI chegirma chegarasi (100% foydalanish taxminida - kafolatlangan xarajat emas), segmentga mos xabar ohangi tavsiyasi va HAQIQIY o'tgan buyurtmalar vaqti asosidagi eng maqbul yuborish soati.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        budget: { type: "integer", description: "Kampaniya uchun ajratilgan umumiy byudjet (so'mda)" },
        segment: {
          type: "string",
          enum: [...PRIMARY_SEGMENT_KEYS, "all"],
          description: "Nishonlanadigan mijozlar segmenti - vip (LTV eng yuqori), high_value (LTV sezilarli, lekin VIP emas), sleeping (90+ kun xarid qilmagan), churn_risk (30+ kun xarid qilmagan), at_risk (o'z odatiy xarid vaqtidan orqada qolgan), new (bitta marta xarid qilgan), returning (doimiy faol), all (barchasi). Standart: all",
        },
        tag: { type: "string", enum: TAG_KEYS, description: "Ixtiyoriy qo'shimcha belgi (segment bilan BIRGA qo'llanishi mumkin) - discount_hunter (asosan chegirma bilan xarid qiladi), high_intent (hozir faol savatcha/sevimlilar ro'yxatiga ega)" },
      },
      required: ["budget"],
    },
  },
  // MIJOZLAR RAZVEDKASI (2026-09 punkt-royxati, 9-band): "Uxlab
  // qolayotgan VIP mijozlarimni top qil" kabi so'rovlar uchun -
  // to'liq 7-segment + 2-belgi tasnifi (batafsil izoh:
  // `lib/customerIntelligence.js`).
  {
    name: "get_customer_intelligence",
    description: "Mijozlarni 7 ta o'zaro EKSKLYUZIV segmentga (vip, high_value, sleeping, churn_risk, at_risk, new, returning - HAR BIR mijoz FAQAT bittasiga tegishli) va 2 ta MUSTAQIL, bir-biri bilan BIRGA bo'lishi mumkin bo'lgan belgiga (discount_hunter, high_intent) ajratadi. `segment`/`tag` berilsa, O'SHA guruhga mos mijozlar sonini VA namunasini (ism, LTV, oxirgi xariddan necha kun o'tgani) qaytaradi - berilmasa, BARCHA segment/belgilarning umumiy sonini qaytaradi.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        segment: { type: "string", enum: [...PRIMARY_SEGMENT_KEYS, "all"], description: "Mijoz segmenti. Standart: all (barchasining umumiy sonini qaytaradi)" },
        tag: { type: "string", enum: TAG_KEYS, description: "Ixtiyoriy qo'shimcha belgi - berilsa, FAQAT shu belgiga ega mijozlar qoladi" },
      },
    },
  },
  {
    name: "get_trending_products",
    description: "Bugun eng ko'p sotilishi MUMKIN bo'lgan, hozir omborda mavjud mahsulotlarni ko'rsatadi. DIQQAT: bu haqiqiy sun'iy intellekt/mashinali o'qitish bashorati EMAS - so'nggi kunlardagi sotuv tezligi va tendentsiyasiga asoslangan DETERMINISTIK, sof arifmetik heuristika.",
    parametersJsonSchema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Nechta mahsulot qaytarilsin (standart 10, maksimal 10)" } },
    },
  },
  // YANGI: birinchi YOZISH QOBILIYATIGA ega vosita - boshqalardan farqli
  // o'laroq, bu HAQIQIY `aiCeoPendingActions` yozuvi yaratadi (rasmiy
  // Approval Engine orqali). Hech qachon to'g'ridan-to'g'ri ijro
  // ETILMAYDI - sotuvchi "AI CEO Inbox" yoki Telegram orqali albatta
  // tasdiqlashi kerak (`aiActionRegistry.js`dagi `adCampaign` - hech
  // qachon LOW xavf emas, avtomatik ijro imkoniyati yo'q).
  {
    name: "propose_ad_campaign",
    description: "Byudjet, mijozlar segmenti va chegirma foizi asosida HAQIQIY, ijro etilishi mumkin bo'lgan reklama kampaniyasi TAKLIFINI yaratadi ('AI CEO Inbox'ga yoziladi) - `plan_ad_campaign`dan FARQLI (u faqat hisob-kitob/tavsiya), bu vosita chaqirilganda sotuvchi ko'rib chiqishi va TASDIQLASHI uchun real yozuv paydo bo'ladi. Tasdiqlanmaguncha HECH QANDAY mijozga xabar yuborilmaydi va promokod yaratilmaydi - shuning uchun natijani sotuvchiga 'tayyor bo'ldi/yuborildi' emas, 'taklif tayyorlandi, tasdiqlash kerak' deb tushuntir.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        budget: { type: "integer", description: "Kampaniya uchun mo'ljallangan umumiy byudjet (so'mda) - faqat ma'lumot/kontekst uchun, promokodning o'zi bu summaga qat'iy bog'lanmagan" },
        segment: {
          type: "string",
          enum: [...PRIMARY_SEGMENT_KEYS, "all"],
          description: "Nishonlanadigan mijozlar segmenti (`get_customer_intelligence`/`plan_ad_campaign` bilan bir xil kalitlar). Standart: all",
        },
        tag: { type: "string", enum: TAG_KEYS, description: "Ixtiyoriy qo'shimcha belgi (segment bilan BIRGA)" },
        discountPercent: { type: "integer", description: `Taklif qilinayotgan chegirma foizi (${AD_CAMPAIGN_MIN_DISCOUNT_PERCENT}-${AD_CAMPAIGN_MAX_DISCOUNT_PERCENT} oralig'ida)` },
        title: { type: "string", description: "Kampaniya sarlavhasi - mijozga ko'rinadigan, qisqa va jozibali (masalan 'Bahorgi aksiya')" },
        message: { type: "string", description: "Mijozga yuboriladigan xabar matni - ANIQ promokod HAQIDA o'zing yozma (ijro paytida avtomatik qo'shiladi), faqat taklif mazmunini yoz" },
      },
      required: ["budget", "segment", "discountPercent", "title", "message"],
    },
  },
];

// ---------------------------------------------------------------------
// Vosita bajaruvchilari - har biri faqat `sellerId` doirasida o'qiydi,
// natija sifatida qisqa, agregatsiya qilingan obyekt qaytaradi (xom
// Firestore hujjatlari emas), va bu Gemini so'raganda sodir bo'ladi.
// ---------------------------------------------------------------------

function clampInt(value, fallback, min, max) {
  const n = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  return Math.min(Math.max(n, min), max);
}

async function execGetRevenueSummary(sellerId, args) {
  const days = clampInt(args.days, 7, 1, 90);
  const since = Date.now() - days * DAY_MS;
  const ordersSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(since)).get();
  const orders = ordersSnap.docs.map((d) => d.data());
  const delivered = orders.filter((o) => o.status === "delivered");
  const revenue = delivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const cancelCount = orders.filter((o) => o.status === "cancel").length;
  const cancelRatePercent = orders.length > 0 ? Math.round((cancelCount / orders.length) * 100) : 0;
  return {
    days,
    orderCount: orders.length,
    deliveredCount: delivered.length,
    revenue: Math.round(revenue),
    cancelRatePercent,
  };
}

async function execGetTopProducts(sellerId, args) {
  const days = clampInt(args.days, 7, 1, 90);
  const limit = clampInt(args.limit, 5, 1, 10);
  const since = Date.now() - days * DAY_MS;
  const ordersSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(since))
    .where("status", "==", "delivered").get();

  const qtyByProduct = new Map();
  const revenueByProduct = new Map();
  ordersSnap.docs.forEach((d) => {
    (d.data().orders || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      qtyByProduct.set(item.name, (qtyByProduct.get(item.name) || 0) + qty);
      revenueByProduct.set(item.name, (revenueByProduct.get(item.name) || 0) + qty * (Number(item.price) || 0));
    });
  });

  const products = Array.from(qtyByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, qty]) => ({ name, soldQty: qty, revenue: Math.round(revenueByProduct.get(name) || 0) }));

  return { days, products };
}

// XAVFSIZLIK/COST TUZATISHI (2026-09 audit, P0): juda ko'p mijozli
// sotuvchida (masalan 10,000+) bu vosita OLDIN BUTUN
// `customers` quyi-to'plamini xotiraga yuklardi — timeout/OOM xavfi VA
// har chaqiruvda minglab hujjat o'qish xarajati. TO'LIQ to'g'ri yechim
// (`ltv`/`lastOrderAtMs` bo'yicha ikkita mustaqil `count()` agregatsiya
// so'rovi, yoki `orderRollups.js`dagi kabi oldindan hisoblab qo'yilgan
// rollup hujjat) alohida composite index yaratish/joylashtirishni talab
// qiladi — buni shu muhitda (Firestore emulator/production'ga ulanish
// imkoni yo'q) haqiqatan tekshirib bo'lmadi, shuning uchun XATO
// composite-index talabiga ega, ishlamaydigan so'rov joylashtirish
// xavfidan qochib, BUNING O'RNIGA aniq xavfsizlik chegarasi (`limit`)
// qo'yildi — bu OOM/timeout xavfini yo'qotadi, lekin 5000 dan ortiq
// mijozli sotuvchida natija ENG SO'NGGI 5000 ta mijoz asosida
// (TAXMINIY) bo'ladi. Bu — ANIQLIKdan RELIABILITY foydasiga ongli
// kelishuv: funksiya butunlay ishlamay qolishidan ko'ra, juda katta
// mijozlar bazasida taxminiy-lekin-ishlaydigan javob afzal.
// (`CUSTOMER_SEGMENTS_SAMPLE_LIMIT` endi `lib/customerIntelligenceQueries.js`dan
// import qilinadi — `customerIntelligence.js` onCall'i bilan BIR XIL
// qiymatdan foydalanish uchun, yuqoridagi importlarga qarang.)

async function execGetCustomerSegments(sellerId) {
  const customersSnap = await db
    .collection("sellers")
    .doc(sellerId)
    .collection("customers")
    .limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT)
    .get();
  const nowMs = Date.now();
  let vipCount = 0;
  let churnCount = 0;
  customersSnap.docs.forEach((d) => {
    const c = d.data();
    const ltv = Number(c.ltv) || 0;
    const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
    const daysSinceLastOrder = Math.floor((nowMs - lastOrderAtMs) / DAY_MS);
    if (ltv >= VIP_THRESHOLD) vipCount += 1;
    else if (daysSinceLastOrder > CHURN_DAYS) churnCount += 1;
  });
  return {
    vipCount,
    churnCount,
    totalCustomers: customersSnap.size,
    // Gemini'ga aniq ayting: agar sample chegarasiga urilgan bo'lsa,
    // bu raqamlar TAXMINIY (eng so'nggi N mijoz asosida) — aks holda
    // AI "aniq" deb noto'g'ri taqdim qilib qo'yishi mumkin edi.
    isApproximate: customersSnap.size >= CUSTOMER_SEGMENTS_SAMPLE_LIMIT,
  };
}

// XAVFSIZLIK/COST TUZATISHI (2026-09 audit, P0): OLDIN sotuvchining
// BARCHA mahsulotlarini (`sellerId` bo'yicha, cheklovsiz) o'qib, faqat
// SHUNDAN KEYIN JavaScript'da stock<=5 bo'yicha filtrlar edi — minglab
// mahsulotli sotuvchida bitta "kam qolgan tovarlar" so'rovi butun
// katalogni o'qishga (va mos ravishda xarajatga) olib kelardi. ENDI
// filtr Firestore SO'ROVINING O'ZIGA ko'chirildi — `firestore.indexes.json`da
// ALLAQACHON mavjud `products (sellerId ASC, stock ASC)` composite
// index'dan foydalanadi (bu index boshqa joyda ham ishlatiladi,
// shuning uchun YANGI index joylashtirish/kutish shart emas — bu
// fixni ishonchli qiladi). Natijada eng ko'pi bilan `limit` (<=10) ta
// hujjat o'qiladi, butun katalog emas.
async function execGetLowStockProducts(sellerId, args) {
  const limit = clampInt(args.limit, 5, 1, 10);
  const productsSnap = await db
    .collection("products")
    .where("sellerId", "==", sellerId)
    .where("stock", ">", 0)
    .where("stock", "<=", 5)
    .orderBy("stock", "asc")
    .limit(limit)
    .get();
  const lowStock = productsSnap.docs.map((d) => {
    const p = d.data();
    return { name: p.name, stock: Number(p.stock) };
  });
  return { lowStock };
}

/**
 * `aiCeoLearning.js`dagi `buildLearningSummaryForDisplay` bilan bir
 * xil, inson o'qiydigan shaklni qaytaradi - Gemini shu raqamlarni
 * o'qib, tabiiy tilda javob yozadi (raqamlarni o'zi o'ylab topmaydi).
 */
async function execGetAiCeoLearningSummary(sellerId) {
  const snap = await learningSummaryRef(sellerId).get();
  return buildLearningSummaryForDisplay(snap.exists ? snap.data() : {});
}

/**
 * AI CEO avtonom chegirma moduli bilan bog'lovchi vosita (batafsil
 * izoh: `aiCeoAutoDiscount.js`): faqat o'qish -
 * `isAiCeoWinBackReward===true` bo'lgan promokodlarni (mavjud
 * `coupons` kolleksiyasidan) o'qib, sotuvchiga "AI CEO qancha va
 * qanday chegirma bergan"ni tabiiy tilda tushuntirish uchun. Faqat
 * bitta tenglik filtri (`.where("isAiCeoWinBackReward","==",true)`)
 * ishlatiladi - Firestore'da bunday so'rov qo'shimcha kompozit
 * indeksga muhtoj emas (tartiblash - `orderBy` - dasturiy JS kodida,
 * o'qilgandan keyin amalga oshiriladi).
 */
async function execGetRecentAutoDiscounts(sellerId) {
  const snap = await db.collection("sellers").doc(sellerId).collection("coupons")
    .where("isAiCeoWinBackReward", "==", true)
    .limit(50)
    .get();
  const all = snap.docs.map((d) => d.data());
  const recent = all
    .slice()
    .sort((a, b) => (Number(b.createdAtMs) || 0) - (Number(a.createdAtMs) || 0))
    .slice(0, 5)
    .map((c) => ({ code: c.code, discountPercent: c.discountValue, used: (Number(c.usedCount) || 0) > 0 }));
  const activeUnusedCount = all.filter((c) => c.isActive === true && (Number(c.usedCount) || 0) < (Number(c.usageLimit) || 1)).length;
  return { totalIssuedCount: all.length, activeUnusedCount, recent };
}

/**
 * `sellers/{id}/orderRollups/{YYYY-MM-DD}` (batafsil izoh:
 * `functions/orderRollups.js`) — SERVER TOMONIDA OLDINDAN
 * hisoblangan kunlik yig'ma yozuvlardan yalpi foyda (revenue - COGS)
 * va margin foizini hisoblaydi. Doc ID'lari "YYYY-MM-DD" shaklida
 * (leksikografik = xronologik tartib), shuning uchun oraliq so'rov
 * hujjat ID'sining o'zi bo'yicha (`FieldPath.documentId()`) amalga
 * oshiriladi - qo'shimcha kompozit indeks shart emas.
 *
 * ATAYLAB "yalpi" (gross) deb ataladi, "sof" (net) EMAS: OPEX/
 * marketing/soliq - sotuvchi P&L panelida QO'LDA kiritadigan
 * xarajatlar (`expenses` kolleksiyasi) - bu vosita ularni o'qimaydi,
 * shuning uchun haqiqatda bilmagan narsani "sof foyda" deb
 * noto'g'ri taqdim etmaslik uchun aniq "yalpi" deb belgilanadi.
 */
async function execGetPnlSummary(sellerId, args) {
  const days = clampInt(args.days, 30, 1, 90);
  const startDateKey = dateKeyFromMillis(Date.now() - days * DAY_MS);
  const rollupsSnap = await db.collection("sellers").doc(sellerId).collection("orderRollups")
    .where(admin.firestore.FieldPath.documentId(), ">=", startDateKey)
    .get();

  let revenue = 0;
  let cogs = 0;
  let deliveredCount = 0;
  rollupsSnap.docs.forEach((d) => {
    const data = d.data();
    revenue += Number(data.revenue) || 0;
    cogs += Number(data.cogs) || 0;
    deliveredCount += Number(data.deliveredCount) || 0;
  });
  const grossProfit = revenue - cogs;
  const marginPercent = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

  return {
    days,
    revenue: Math.round(revenue),
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    marginPercent,
    deliveredCount,
    note: "Bu yalpi foyda - OPEX/marketing/soliq xarajatlari kirmagan (ular P&L panelida qo'lda kiritiladi).",
  };
}

/**
 * `sellers/{id}/pricingSuggestions` (batafsil izoh:
 * `pricingSuggestions.js`) - sotuvchi hali "Qo'llash"/rad etmagan,
 * kutilayotgan AI narx tavsiyalarini o'qiydi. FAQAT O'QISH - bu
 * vosita hech qanday narxni o'zgartirmaydi (narx faqat sotuvchi
 * o'zi aniq tasdiqlaganda o'zgaradi, batafsil izoh: shu faylning
 * boshidagi arxitekturaviy izoh).
 */
async function execGetPendingPricingSuggestions(sellerId) {
  const snap = await db.collection("sellers").doc(sellerId).collection("pricingSuggestions")
    .where("status", "==", "pending")
    .limit(10)
    .get();
  const suggestions = snap.docs.map((d) => {
    const s = d.data();
    return {
      productName: s.productName || "Mahsulot",
      type: s.type,
      currentPrice: Number(s.currentPrice) || 0,
      suggestedPrice: Number(s.suggestedPrice) || 0,
      changePercent: Number(s.changePercent) || 0,
    };
  });
  return { pendingCount: snap.size, suggestions };
}

// ---------------------------------------------------------------------
// "AI BUSINESS MANAGER" - Z-BIZNES'GA XOS VOSITA BAJARUVCHILARI
// (2026-09 punkt-royxati, 4-band).
// ---------------------------------------------------------------------

// Millisekund bo'yicha Toshkent vaqti bo'yicha soatni (0-23) qaytaradi -
// UTC+5 siljishini qo'lda hisoblash o'rniga, kodning boshqa joylaridagi
// (`dateKeyFromMillis`) kabi `Intl`ga asoslangan konventsiyaga mos.
function hourInTashkent(ms) {
  const str = new Date(ms).toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false });
  return Number(str);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Xarajat nazorati: taqqoslash uchun ikkala davrni ("joriy" + "oldingi")
// QOPLAYDIGAN oraliqni BITTA so'rovda o'qiydi (ikkita alohida so'rov
// o'rniga) - `execGetRevenueSummary`dagi bilan bir xil
// (`sellerId`+`createdAt`) kompozit indeksdan foydalanadi, status
// bo'yicha filtr YO'Q (chunki bekor qilish darajasi uchun BARCHA
// statusdagi buyurtmalar kerak) - shuning uchun qo'shimcha indeks shart
// emas.
const DECLINE_MAX_ORDERS_SCANNED = 3000;
const DECLINE_MIN_PREVIOUS_UNITS = 3;
const DECLINE_THRESHOLD_PERCENT = 20;

/**
 * "Oxirgi oy sotuvim nega kamaydi?" (2026-09 punkt-royxati, 4-band) -
 * joriy davrni oldingi (bir xil uzunlikdagi) davr bilan taqqoslab,
 * pasayishga OID bo'lishi mumkin bo'lgan omillarni chiqaradi.
 *
 * HALOLLIK CHEGARASI: bu FAQAT statistik taqqoslash - to'g'ridan-to'g'ri
 * isbotlangan sabab-oqibat bog'lanishi EMAS (masalan mahsulot sotuvi
 * kamaygani va uning zaxirasi kamligi orasida KORRELYATSIYA bo'lishi
 * mumkin, lekin bu vosita buni "isbot" sifatida taqdim etmaydi - faqat
 * ikkala faktni yonma-yon ko'rsatadi, xulosani Gemini tabiiy tilda
 * ehtiyotkorlik bilan chiqaradi).
 *
 * `src/utils/businessInsights.js`dagi `computeProductDeclineInsights`
 * bilan BIR XIL chegara qiymatlaridan (`minPreviousUnits=3`,
 * `thresholdPercent=20`) foydalanadi - "0dan 1ga" kabi tasodifiy
 * o'zgarishlarni haqiqiy tendentsiya deb noto'g'ri talqin qilmaslik
 * uchun.
 */
async function execGetSalesDeclineDiagnostic(sellerId, args) {
  const days = clampInt(args.days, 30, 7, 90);
  const now = Date.now();
  const currentStart = now - days * DAY_MS;
  const previousStart = currentStart - days * DAY_MS;

  const ordersSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(previousStart))
    .limit(DECLINE_MAX_ORDERS_SCANNED)
    .get();

  const periods = {
    current: { orderCount: 0, deliveredCount: 0, cancelCount: 0, revenue: 0, products: new Map() },
    previous: { orderCount: 0, deliveredCount: 0, cancelCount: 0, revenue: 0, products: new Map() },
  };

  ordersSnap.docs.forEach((d) => {
    const o = d.data();
    const createdAtMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : 0;
    if (createdAtMs < previousStart) return;
    const bucket = createdAtMs >= currentStart ? periods.current : periods.previous;

    bucket.orderCount += 1;
    if (o.status === "cancel") bucket.cancelCount += 1;
    if (o.status === "delivered") {
      bucket.deliveredCount += 1;
      bucket.revenue += Number(o.totalAmount) || 0;
      (o.orders || []).forEach((item) => {
        const key = item.id || item.name;
        if (!key) return;
        const qty = Number(item.quantity) || 0;
        const prev = bucket.products.get(key) || { name: item.name || "Noma'lum", qty: 0 };
        prev.qty += qty;
        bucket.products.set(key, prev);
      });
    }
  });

  const declining = [];
  periods.previous.products.forEach((prev, id) => {
    if (prev.qty < DECLINE_MIN_PREVIOUS_UNITS) return; // yetarli tarix yo'q - taxmin qilinmaydi
    const currentQty = periods.current.products.get(id)?.qty || 0;
    const changePercent = ((currentQty - prev.qty) / prev.qty) * 100;
    if (changePercent <= -DECLINE_THRESHOLD_PERCENT) {
      declining.push({ productId: id, name: prev.name, previousUnits: prev.qty, currentUnits: currentQty, changePercent: round1(changePercent) });
    }
  });
  declining.sort((a, b) => a.changePercent - b.changePercent);
  const topDeclining = declining.slice(0, 5);

  // Har bir eng ko'p pasaygan mahsulot uchun HOZIRGI ombordagi zaxirani
  // qo'shib qo'yish - bu ORQALI Gemini "ehtimol zaxira tugagani sabab
  // bo'lgandir" kabi EHTIYOTKOR gipoteza aytishi mumkin (lekin isbot
  // sifatida emas). Faqat 5 tagacha hujjat o'qiladi - butun katalog
  // emas.
  const stockLookups = await Promise.all(
    topDeclining.map((p) => (p.productId ? db.collection("products").doc(p.productId).get() : Promise.resolve(null)))
  );
  topDeclining.forEach((p, idx) => {
    const snap = stockLookups[idx];
    p.currentStock = snap && snap.exists ? Number(snap.data().stock) || 0 : null;
    delete p.productId;
  });

  const revenueChangePercent = periods.previous.revenue > 0
    ? round1(((periods.current.revenue - periods.previous.revenue) / periods.previous.revenue) * 100)
    : null;
  const cancelRate = (p) => (p.orderCount > 0 ? Math.round((p.cancelCount / p.orderCount) * 100) : 0);

  // Yangi mijozlar oqimi - `orderRollups`dagi tayyor kunlik
  // hisoblagichdan (`execGetPnlSummary` bilan bir xil doc-ID oraliq
  // so'rov naqshi).
  const startDateKey = dateKeyFromMillis(previousStart);
  const rollupsSnap = await db.collection("sellers").doc(sellerId).collection("orderRollups")
    .where(admin.firestore.FieldPath.documentId(), ">=", startDateKey)
    .get();
  const currentStartDateKey = dateKeyFromMillis(currentStart);
  let newCustomersCurrent = 0;
  let newCustomersPrevious = 0;
  rollupsSnap.docs.forEach((d) => {
    const count = Number(d.data().newCustomersCount) || 0;
    if (d.id >= currentStartDateKey) newCustomersCurrent += count;
    else newCustomersPrevious += count;
  });

  return {
    days,
    current: { revenue: Math.round(periods.current.revenue), orderCount: periods.current.orderCount, deliveredCount: periods.current.deliveredCount, cancelRatePercent: cancelRate(periods.current) },
    previous: { revenue: Math.round(periods.previous.revenue), orderCount: periods.previous.orderCount, deliveredCount: periods.previous.deliveredCount, cancelRatePercent: cancelRate(periods.previous) },
    revenueChangePercent,
    topDecliningProducts: topDeclining,
    newCustomersCurrent,
    newCustomersPrevious,
    isApproximate: ordersSnap.size >= DECLINE_MAX_ORDERS_SCANNED,
    note: "Bu FAQAT statistik taqqoslash - to'g'ridan-to'g'ri isbotlangan sabab-oqibat bog'lanishi EMAS. Mahsulot zaxirasi/bekor qilish darajasi kabi omillar pasayishga hissa qo'shgan bo'lishi MUMKIN, lekin bu ehtimoliy gipoteza sifatida talqin qilinishi kerak.",
  };
}

// Segmentga mos, HAQIQIY yozilgan xabar ohangi tavsiyasi - bu ijodiy
// taklif (raqamli o'lchov EMAS), shuning uchun halollik cheklovi
// qo'llanilmaydi (bashorat emas, kontent-rejalashtirish). MIJOZLAR
// RAZVEDKASI (9-band) 7-segment tasnifi bilan BIR XIL kalitlar
// (`lib/customerIntelligence.js`dagi `PRIMARY_SEGMENT_KEYS`).
const AD_CAMPAIGN_MESSAGE_ANGLES = {
  vip: "Bu mijozlar ENG YUQORI umr bo'yi xarid summasiga (LTV) ega - ularga eksklyuziv/maxsus taklif sifatida ('faqat siz uchun') murojaat qiling.",
  high_value: "Bu mijozlar sezilarli darajada xarid qilgan, lekin hali VIP darajasiga yetmagan - ularni VIP darajasiga 'undash' ohangida (masalan, yana bitta xariddan keyingi bonus) murojaat qiling.",
  sleeping: "Bu mijozlar JUDA UZOQ vaqtdan beri xarid qilmagan - kuchli 'sog'indik' yoki maxsus qaytarish chegirmasi bilan murojaat qiling, aks holda ular butunlay yo'qolishi mumkin.",
  churn_risk: "Bu mijozlar 30+ kundan beri xarid qilmagan - ularni QAYTARISH maqsadida, sog'inch/qaytish chegirmasi ohangida murojaat qiling.",
  at_risk: "Bu mijozlarning O'Z odatiy xarid vaqti allaqachon o'tib ketgan (ular odatda hozirgacha qayta xarid qilgan bo'lardi) - hali 'yo'qotilmagan' mijoz sifatida, engil eslatma/tavsiya ohangida murojaat qiling.",
  new: "Bu mijozlar FAQAT bitta marta xarid qilgan - ikkinchi xariddan ishonch hosil qilish, mahsulot sifatiga urg'u berish ohangida murojaat qiling.",
  returning: "Bu doimiy, faol mijozlar - sodiqlik/minnatdorchilik va doimiy mijoz bonusi ohangida murojaat qiling.",
  all: "Butun mijozlar bazasi - keng qamrovli, umumiy chegirma/aksiya ohangida murojaat qiling.",
};

const AD_CAMPAIGN_MIN_BUDGET = 10_000;
const AD_CAMPAIGN_MAX_BUDGET = 100_000_000;
const AD_CAMPAIGN_PEAK_HOUR_ORDERS_DAYS = 30;
const AD_CAMPAIGN_PEAK_HOUR_ORDERS_LIMIT = 2000;

/**
 * "Menga N so'mlik reklama kampaniyasi rejasini tuz" (2026-09
 * punkt-royxati, 4-band) - byudjet + segment asosida amaliy reja.
 *
 * HALOLLIK CHEGARASI: `maxDiscountPerRecipient = budget / recipientCount`
 * - bu FAQAT yuqori chegara (100% foydalanish/qatnashish taxminida).
 * Haqiqiy promokod ishlatilish darajasi deyarli har doim pastroq
 * bo'ladi - kod HECH QACHON taxminiy "haqiqiy" foydalanish darajasini
 * o'ylab topmaydi (`note` maydonida buni aniq ayting).
 *
 * Yuborish vaqti tavsiyasi ijod EMAS - so'nggi haqiqiy buyurtmalarning
 * soat bo'yicha taqsimotidan (`hourInTashkent`) hisoblanadi.
 */
async function execPlanAdCampaign(sellerId, args) {
  const budget = clampInt(args.budget, AD_CAMPAIGN_MIN_BUDGET, AD_CAMPAIGN_MIN_BUDGET, AD_CAMPAIGN_MAX_BUDGET);
  const segment = AD_CAMPAIGN_MESSAGE_ANGLES[args.segment] ? args.segment : "all";
  const tag = TAG_KEYS.includes(args.tag) ? args.tag : null;

  // `tag: "high_intent"` FAQAT so'ralganda savatcha/sevimlilar
  // so'roviga chiqiladi - boshqa har qanday kampaniya (segmentga
  // asoslangan yoki `discount_hunter` belgisi) uchun bu qo'shimcha
  // Firestore o'qishlari kerak emas.
  const [customersSnap, highIntentClientIds] = await Promise.all([
    db.collection("sellers").doc(sellerId).collection("customers").limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT).get(),
    tag === "high_intent" ? loadHighIntentClientIds(sellerId) : Promise.resolve(new Set()),
  ]);
  const { customers: classifiedCustomers } = classifyCustomerIntelligence(
    customersSnap.docs.map((d) => d.data()),
    { highIntentClientIds }
  );
  const recipientCount = filterClassifiedCustomers(classifiedCustomers, { segment, tag }).length;
  const isApproximate = customersSnap.size >= CUSTOMER_SEGMENTS_SAMPLE_LIMIT;

  if (recipientCount === 0) {
    return {
      budget,
      segment,
      tag,
      recipientCount: 0,
      note: "Bu segmentda/belgida hozircha bironta ham mijoz yo'q - boshqa segment/belgi tanlang yoki 'all' (barcha mijozlar) segmentidan foydalaning.",
    };
  }

  // O'rtacha buyurtma summasi (AOV) - so'nggi 90 kunlik yetkazilgan
  // buyurtmalardan, `execGetRevenueSummary` bilan bir xil so'rov shakli.
  const since90 = Date.now() - 90 * DAY_MS;
  const revenueSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(since90))
    .where("status", "==", "delivered")
    .limit(AD_CAMPAIGN_PEAK_HOUR_ORDERS_LIMIT)
    .get();
  const deliveredOrders = revenueSnap.docs.map((d) => d.data());
  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const averageOrderValue = deliveredOrders.length > 0 ? Math.round(totalRevenue / deliveredOrders.length) : null;

  // Eng ko'p buyurtma qilinadigan soat (Toshkent) - so'nggi 30 kunlik
  // BARCHA (yetkazilgan+bekor) buyurtmalar asosida, haqiqiy xatti-harakat.
  const sincePeak = Date.now() - AD_CAMPAIGN_PEAK_HOUR_ORDERS_DAYS * DAY_MS;
  const peakSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(sincePeak))
    .limit(AD_CAMPAIGN_PEAK_HOUR_ORDERS_LIMIT)
    .get();
  const hourCounts = new Array(24).fill(0);
  peakSnap.docs.forEach((d) => {
    const ms = d.data().createdAt?.toMillis ? d.data().createdAt.toMillis() : 0;
    if (ms > 0) hourCounts[hourInTashkent(ms)] += 1;
  });
  const totalHourOrders = hourCounts.reduce((a, b) => a + b, 0);
  let peakOrderHour = null;
  if (totalHourOrders > 0) {
    peakOrderHour = hourCounts.indexOf(Math.max(...hourCounts));
  }
  const suggestedSendHour = peakOrderHour !== null ? (peakOrderHour - 1 + 24) % 24 : null;

  return {
    budget,
    segment,
    tag,
    recipientCount,
    isApproximateRecipientCount: isApproximate,
    maxDiscountPerRecipient: Math.floor(budget / recipientCount),
    averageOrderValue,
    suggestedMessageAngle: AD_CAMPAIGN_MESSAGE_ANGLES[segment],
    peakOrderHourTashkent: peakOrderHour,
    suggestedSendHourTashkent: suggestedSendHour,
    note: "Chegirma yuqori chegarasi - agar barcha qabul qiluvchilar promokoddan 100% foydalansa. Haqiqiy foydalanish darajasi odatda PASTROQ bo'ladi, shuning uchun bu ENG YUQORI CHEGARA, kafolatlangan xarajat EMAS. Yuborish vaqti - so'nggi haqiqiy buyurtmalar taqsimotidan hisoblangan.",
  };
}

/**
 * "propose_ad_campaign" vosita bajaruvchisi - YANGI, YOZISH qobiliyatiga
 * ega birinchi vosita. `execPlanAdCampaign`dagi BIR XIL mijoz
 * tanlash mantig'idan (`classifyCustomerIntelligence`/
 * `filterClassifiedCustomers`) foydalanadi, lekin faqat hisob-kitob
 * QAYTARISH o'rniga, HAQIQIY `aiCeoPendingActions` yozuvini yaratadi
 * (`lib/aiApprovalEngine.js`dagi `createPendingAction` orqali - xuddi
 * `telegramApproval.js`dagi ISHLAB TURGAN CRM oqimi kabi).
 *
 * HALOLLIK CHEGARASI: promokodning o'zi bu yerda HALI yaratilmaydi -
 * u FAQAT sotuvchi tasdiqlagandan keyin, ijro vaqtida
 * (`lib/aiActionExecutors.js`dagi `executeAdCampaign`) yaratiladi -
 * shuning uchun bu funksiya natijasi Gemini'ga "taklif tayyor,
 * TASDIQLASH kutilmoqda" deb aniq ayta oladigan ma'lumot qaytaradi,
 * "yuborildi" degan noto'g'ri taassurot EMAS.
 */
async function execProposeAdCampaign(sellerId, args) {
  const budget = clampInt(args.budget, AD_CAMPAIGN_MIN_BUDGET, AD_CAMPAIGN_MIN_BUDGET, AD_CAMPAIGN_MAX_BUDGET);
  const segment = AD_CAMPAIGN_MESSAGE_ANGLES[args.segment] ? args.segment : "all";
  const tag = TAG_KEYS.includes(args.tag) ? args.tag : null;
  const discountPercent = clampInt(args.discountPercent, AD_CAMPAIGN_MIN_DISCOUNT_PERCENT, AD_CAMPAIGN_MIN_DISCOUNT_PERCENT, AD_CAMPAIGN_MAX_DISCOUNT_PERCENT);
  const title = typeof args.title === "string" ? args.title.trim().slice(0, 200) : "";
  const message = typeof args.message === "string" ? args.message.trim().slice(0, 2000) : "";
  if (!title || !message) {
    return { proposed: false, error: "title va message majburiy - kampaniya sarlavhasi va xabar matnini ham bering." };
  }

  const [customersSnap, highIntentClientIds] = await Promise.all([
    db.collection("sellers").doc(sellerId).collection("customers").limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT).get(),
    tag === "high_intent" ? loadHighIntentClientIds(sellerId) : Promise.resolve(new Set()),
  ]);
  const { customers: classifiedCustomers } = classifyCustomerIntelligence(
    customersSnap.docs.map((d) => d.data()),
    { highIntentClientIds }
  );
  const targetClientIds = filterClassifiedCustomers(classifiedCustomers, { segment, tag })
    .map((c) => c.clientId)
    .filter(Boolean)
    .slice(0, AD_CAMPAIGN_MAX_RECIPIENTS);

  if (targetClientIds.length === 0) {
    return { proposed: false, note: "Bu segmentda/belgida hozircha bironta ham mijoz yo'q - taklif YARATILMADI. Boshqa segment/belgi tanlang yoki 'all'dan foydalaning." };
  }

  const dateId = dateKeyFromMillis(Date.now());
  const { actionId, isNew, riskLevel, requiresApproval, expiresAtMs } = await createPendingAction(db, admin, {
    sellerId,
    actionType: "adCampaign",
    payload: { segment, tag, budget, discountPercent, title, message, targetClientIds, dateId },
  });

  return {
    proposed: true,
    isNewProposal: isNew,
    actionId,
    riskLevel,
    requiresApproval,
    recipientCount: targetClientIds.length,
    expiresAtMs,
    note: isNew
      ? "Taklif yaratildi va sotuvchining tasdig'ini kutmoqda ('AI CEO Inbox'/Telegram orqali) - HALI HECH KIMGA xabar yuborilmadi, promokod HALI yaratilmagan."
      : "Bu turdagi taklif (bir xil segment/belgi/kun uchun) ALLAQACHON mavjud - dublikat yaratilmadi, sotuvchi eskisini ko'rib chiqishi kerak.",
  };
}

// Gemini'ga JAVOBDA ko'rsatiladigan namuna mijozlar soni - "top 5-8
// mijozni ismi bilan aytib ber" kabi tabiiy javob berish uchun
// yetarli, lekin javobni haddan tashqari uzun/qimmat qilmaydigan
// chegara.
const CUSTOMER_INTELLIGENCE_SAMPLE_SIZE = 8;

/**
 * MIJOZLAR RAZVEDKASI - "get_customer_intelligence" vosita
 * bajaruvchisi (2026-09 punkt-royxati, 9-band). Sof tasniflash
 * mantig'i `lib/customerIntelligence.js`da - bu yerda FAQAT
 * Firestore'dan xom mijoz/savatcha/sevimlilar ma'lumotini o'qib, o'sha
 * modulga uzatadi va Gemini uchun QISQA, o'qish oson natija shakllantiradi
 * (xom mijoz ro'yxati EMAS - faqat sanoq + kichik namuna).
 */
async function execGetCustomerIntelligence(sellerId, args) {
  const segment = PRIMARY_SEGMENT_KEYS.includes(args.segment) ? args.segment : "all";
  const tag = TAG_KEYS.includes(args.tag) ? args.tag : null;

  const [customersSnap, highIntentClientIds] = await Promise.all([
    db.collection("sellers").doc(sellerId).collection("customers").limit(CUSTOMER_SEGMENTS_SAMPLE_LIMIT).get(),
    loadHighIntentClientIds(sellerId),
  ]);
  const { customers, counts, tagCounts } = classifyCustomerIntelligence(
    customersSnap.docs.map((d) => d.data()),
    { highIntentClientIds }
  );

  const filtered = filterClassifiedCustomers(customers, { segment, tag });
  const sample = filtered.slice(0, CUSTOMER_INTELLIGENCE_SAMPLE_SIZE).map((c) => ({
    fullName: c.fullName,
    ltv: c.ltv,
    orderCount: c.orderCount,
    daysSinceLastOrder: c.daysSinceLastOrder,
    primarySegment: c.primarySegment,
    tags: c.tags,
  }));

  return {
    segment,
    tag,
    matchingCount: filtered.length,
    counts,
    tagCounts,
    sample,
    isApproximate: customersSnap.size >= CUSTOMER_SEGMENTS_SAMPLE_LIMIT,
    note: "Bu DETERMINISTIK qoidalarga (LTV chegaralari, oxirgi xariddan o'tgan kunlar, mijozning o'z tarixidagi o'rtacha xarid oralig'i) asoslangan tasnif - haqiqiy sun'iy intellekt/ML modeli EMAS.",
  };
}

const TREND_RECENT_DAYS = 3;
const TREND_BASELINE_DAYS = 14;
const TREND_MAX_ORDERS_SCANNED = 3000;
const TREND_CANDIDATE_LOOKUP_LIMIT = 20;

/**
 * "Bugun eng ko'p sotilishi mumkin bo'lgan 10 ta mahsulotni top qilish"
 * (2026-09 punkt-royxati, 4-band).
 *
 * HALOLLIK CHEGARASI: bu haqiqiy AI/ML bashorati EMAS - DETERMINISTIK
 * heuristika: so'nggi `TREND_RECENT_DAYS` kunlik kunlik o'rtacha sotuv
 * tezligi, oldingi `TREND_BASELINE_DAYS` kunlik bazaviy tezlik bilan
 * taqqoslanadi (tendentsiya ko'paytiruvchisi sifatida, lekin ASOSIY
 * saralash mezoni haligacha HAQIQIY so'nggi sotuv hajmi) - faqat
 * omborda mavjud (stock>0) mahsulotlar ko'rsatiladi (aks holda
 * "bugun sotilishi mumkin" degan da'vo noto'g'ri bo'lardi).
 */
async function execGetTrendingProducts(sellerId, args) {
  const limit = clampInt(args.limit, 10, 1, 10);
  const now = Date.now();
  const recentStart = now - TREND_RECENT_DAYS * DAY_MS;
  const baselineStart = now - (TREND_RECENT_DAYS + TREND_BASELINE_DAYS) * DAY_MS;

  const ordersSnap = await db.collection("orders").where("sellerId", "==", sellerId)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(baselineStart))
    .where("status", "==", "delivered")
    .limit(TREND_MAX_ORDERS_SCANNED)
    .get();

  const recentQty = new Map();
  const baselineQty = new Map();
  ordersSnap.docs.forEach((d) => {
    const o = d.data();
    const createdAtMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : 0;
    if (createdAtMs < baselineStart) return;
    const isRecent = createdAtMs >= recentStart;
    const map = isRecent ? recentQty : baselineQty;
    (o.orders || []).forEach((item) => {
      const key = item.id;
      if (!key) return;
      const qty = Number(item.quantity) || 0;
      const prev = map.get(key) || { name: item.name || "Noma'lum", qty: 0 };
      prev.qty += qty;
      map.set(key, prev);
    });
  });

  const candidates = Array.from(recentQty.entries())
    .filter(([, v]) => v.qty > 0)
    .map(([id, v]) => {
      const baseline = baselineQty.get(id);
      const recentDailyAvg = v.qty / TREND_RECENT_DAYS;
      const baselineDailyAvg = baseline ? baseline.qty / TREND_BASELINE_DAYS : 0;
      const momentumRatio = baselineDailyAvg > 0 ? round1(recentDailyAvg / baselineDailyAvg) : null;
      // Bazaviy davrda sotuv bo'lmagan (yangi yoki kamdan-kam sotiladigan)
      // mahsulotlarga engil ustunlik (1.2x) - flat/o'rtacha mahsulotlarga
      // nisbatan tendentsiya ko'rsatuvchilarni ozgina yuqoriga ko'taradi,
      // lekin baribir ASOSAN haqiqiy so'nggi hajm (`recentDailyAvg`)
      // boshqaradi (ko'paytiruvchi 0.5-2 oralig'ida cheklangan).
      const momentumMultiplier = momentumRatio === null ? 1.2 : Math.min(Math.max(momentumRatio, 0.5), 2);
      return { id, name: v.name, recentUnits: v.qty, baselineDailyAvg: round1(baselineDailyAvg), momentumRatio, score: recentDailyAvg * momentumMultiplier };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TREND_CANDIDATE_LOOKUP_LIMIT);

  // Faqat nomzodlar (butun katalog emas) uchun joriy zaxirani tekshirish.
  const stockSnaps = await Promise.all(candidates.map((c) => db.collection("products").doc(c.id).get()));
  const inStock = candidates
    .map((c, idx) => {
      const snap = stockSnaps[idx];
      const stock = snap.exists ? Number(snap.data().stock) || 0 : 0;
      return { ...c, currentStock: stock };
    })
    .filter((c) => c.currentStock > 0)
    .slice(0, limit)
    .map((c) => ({
      name: c.name,
      recentUnitsSold: c.recentUnits,
      baselineDailyAverage: c.baselineDailyAvg,
      momentumRatio: c.momentumRatio,
      currentStock: c.currentStock,
      isNewOrRarelyPreviouslySold: c.momentumRatio === null,
    }));

  return {
    products: inStock,
    method: "deterministic_heuristic",
    note: "Bu HAQIQIY sun'iy intellekt/ML bashorati EMAS - so'nggi kunlardagi haqiqiy sotuv tezligi va tendentsiyasiga asoslangan sof arifmetik heuristika. Faqat hozir omborda mavjud mahsulotlar ko'rsatilgan.",
  };
}

const TOOL_EXECUTORS = {
  get_revenue_summary: execGetRevenueSummary,
  get_top_products: execGetTopProducts,
  get_customer_segments: execGetCustomerSegments,
  get_low_stock_products: execGetLowStockProducts,
  get_ai_ceo_learning_summary: execGetAiCeoLearningSummary,
  get_recent_auto_discounts: execGetRecentAutoDiscounts,
  get_pnl_summary: execGetPnlSummary,
  get_pending_pricing_suggestions: execGetPendingPricingSuggestions,
  // "AI Business Manager" (Z-Biznes) vositalari - bajaruvchi shu yerda
  // mavjud bo'lishi ZARARSIZ: Gemini FAQAT `BIZNES_TOOL_DECLARATIONS`
  // `handleAskAiCeo`da haqiqatan yuborilganda bu nomlarni chaqira oladi
  // (e'lon qilinmagan vosita nomini model FIZIKAVIY chaqira olmaydi).
  get_sales_decline_diagnostic: execGetSalesDeclineDiagnostic,
  plan_ad_campaign: execPlanAdCampaign,
  get_trending_products: execGetTrendingProducts,
  get_customer_intelligence: execGetCustomerIntelligence,
  propose_ad_campaign: execProposeAdCampaign,
};

/**
 * Umumiy, qayta ishlatiladigan aylanma tool-calling suhbat mexanizmi -
 * "AI CEO'dan so'rang"ga bog'liq emas, boshqa `toolDeclarations`/
 * `executors` bilan qayta ishlatilishi mumkin.
 *
 * Ishlash tartibi: Gemini'ga prompt+vositalar yuboriladi -> agar Gemini
 * bitta yoki bir nechta vosita chaqirsa, ular server tomonida bajariladi
 * va natija Gemini'ga "functionResponse" sifatida qaytariladi -> Gemini
 * yana vosita chaqirishi (ko'proq ma'lumot kerak bo'lsa) yoki yakuniy
 * matn bilan javob berishi mumkin -> vosita chaqiruvi bo'lmasa (yoki
 * `maxRounds`ga yetilsa), suhbat tugaydi.
 *
 * @param {object} params
 * @param {string} params.prompt - boshlang'ich foydalanuvchi promti
 * @param {Array} params.toolDeclarations - Gemini'ga beriladigan vosita sxemalari
 * @param {Record<string, Function>} params.executors - vosita nomi -> `(context, args) => Promise<object>`
 * @param {*} params.executorContext - har bir bajaruvchiga uzatiladigan kontekst (masalan `sellerId`)
 * @param {number} [params.maxRounds] - xavfsizlik chegarasi (standart `MAX_TOOL_ROUNDS`)
 */
async function runToolCallingLoop({ prompt, toolDeclarations, executors, executorContext, maxRounds = MAX_TOOL_ROUNDS }) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());
  const contents = [{ role: "user", parts: [{ text: prompt }] }];
  const toolsUsed = [];

  for (let round = 0; round < maxRounds; round += 1) {
    // Xarajat nazorati: oxirgi (majburiy) turda vositalar o'chiriladi -
    // Gemini albatta matn bilan javob berishi kerak, aks holda cheksiz
    // "vosita so'rayveradigan" tsiklga tushib qolishi mumkin.
    const isLastRound = round === maxRounds - 1;
    // Bu tsikldagi `await` ATAYLAB ketma-ket: har bir tur oldingi
    // turning natijasiga (Gemini'ning vosita chaqiruviga) bog'liq —
    // parallel bajarish mumkin emas, bu haqiqiy aylanma suhbat.
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: isLastRound ? {} : { tools: [{ functionDeclarations: toolDeclarations }] },
    });

    const calls = response.functionCalls || [];
    if (calls.length === 0) {
      return { text: (response.text || "").trim(), toolsUsed };
    }

    // `response.functionCalls`dan qo'lda `{ functionCall: c }` yasash
    // (faqat {id,name,args} saqlaydigan, yengillashtirilgan qayta
    // qurish) Gemini 3 modellari (`gemini-3.5-flash-lite`) har bir
    // vosita chaqiruvi bilan birga qaytaradigan `thoughtSignature`ni
    // (Part darajasida, FunctionCall ichida emas) yo'qotadi. Gemini
    // 3'da bu imzo keyingi turda albatta qaytarilishi shart - aks
    // holda API "missing thought_signature" 400-xatosini qaytaradi.
    // Google hujjatlari tavsiyasiga ko'ra, modelning to'liq `content`
    // obyektini (asl `parts`, imzo bilan birga) o'zgarishsiz tarixga
    // qo'shish kerak.
    contents.push(response.candidates?.[0]?.content || { role: "model", parts: calls.map((c) => ({ functionCall: c })) });
    const responseParts = [];
    for (const call of calls) {
      const executor = executors[call.name];
      let output;
      try {
        // Bu yerdagi `await` ham ATAYLAB ketma-ket: bir turdagi bir
        // nechta chaqiruv ham ketma-ket bajariladi (soddalik va aniq
        // xato-kuzatuv uchun — bu funksiyalar arzon/tez).
        output = executor ? await executor(executorContext, call.args || {}) : { error: "noma'lum vosita" };
      } catch (err) {
        output = { error: err.message || "vosita xatosi" };
      }
      toolsUsed.push({ name: call.name, args: call.args || {} });
      responseParts.push({ functionResponse: { id: call.id, name: call.name, response: { output } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { text: "", toolsUsed };
}

/**
 * Sof funksiya - "AI CEO'dan so'rang" uchun boshlang'ich prompt. Bu
 * yerda oldindan tayyorlangan raqamlar emas, balki vositalar tavsifi
 * beriladi - Gemini o'zi qaysi vositani qachon chaqirishni hal qiladi.
 */
function buildAskAiCeoPrompt(question, storeName, nicheId) {
  const nicheConfig = getNicheConfig(nicheId);
  return `Sen — kichik onlayn do'kon uchun ishlaydigan AI CEO yordamchisisan. ${nicheConfig.aiContext} Sotuvchi senga savol beryapti, sen esa unga berilgan VOSITALAR (tools) orqali HAQIQIY, joriy ma'lumotni tekshirib javob berasan.

Do'kon: "${storeName || "Do'kon"}"
Sotuvchi savoli: "${question}"

QOIDALAR:
- Savolga javob berish uchun ZARUR vosita(lar)ni chaqir - faqat kerakligini, hammasini emas.
- Vositadan olingan HAQIQIY natijaga tayangan holda javob ber - hech qanday raqam yoki faktni O'ZING O'YLAB TOPMA.
- Javob QISQA (2-4 gap) va ANIQ bo'lsin.
- Agar savol berilgan vositalar doirasidan tashqarida bo'lsa (masalan umumiy, ma'lumotga bog'liq bo'lmagan savol), buni ochiq-oydin ayt va vosita chaqirma.
- MUHIM ('propose_ad_campaign' uchun): bu vosita HAQIQIY yozuv yaratadi - sotuvchi FAQAT "reja tuz"/"hisoblab ber" kabi so'rasa 'plan_ad_campaign'ni chaqir (hech narsa yaratilmaydi); sotuvchi ANIQ "tayyorla"/"yarat"/"taklif qil"/"tasdiqlash uchun jo'nat" desagina 'propose_ad_campaign'ni chaqir. Chaqirgandan keyin sotuvchiga ANIQ ayt: taklif "AI CEO Inbox"ga tushdi va u HALI hech kimga yuborilmagan - tasdiqlash kerak.
- Faqat O'ZBEK TILIDA javob ber.`;
}

async function handleAskAiCeo(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`askAiCeo:${request.auth.uid}`, 15, 3600);

  const sellerId = request.auth.uid;
  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    throw new HttpsError("permission-denied", "Bu funksiya faqat AI CEO premium mijozlari uchun mavjud.");
  }

  const { question } = request.data || {};
  const trimmedQuestion = typeof question === "string" ? question.trim() : "";
  if (!trimmedQuestion || trimmedQuestion.length > 300) {
    throw new HttpsError("invalid-argument", "Savol matni noto'g'ri (1-300 belgi orasida bo'lishi kerak).");
  }

  // "AI Business Manager" (2026-09 punkt-royxati, 4-band): chuqurroq,
  // Z-Biznes'ga xos tahlil vositalari FAQAT sotuvchining samarali
  // tarifi ("sinov" davri ham hisobga olingan holda) aynan "biznes"
  // bo'lganda Gemini'ga taqdim etiladi - "pro" tarifi bazaviy "AI
  // CEO'dan so'rang"ni ("aiCeoEnabled") saqlab qoladi, lekin bu YANGI,
  // chuqurroq vositalarni ko'rmaydi.
  const isBiznes = getEffectiveTariffPlan(sellerSnap.data()) === "biznes";
  const toolDeclarations = isBiznes ? [...TOOL_DECLARATIONS, ...BIZNES_TOOL_DECLARATIONS] : TOOL_DECLARATIONS;

  try {
    const { text, toolsUsed } = await runToolCallingLoop({
      prompt: buildAskAiCeoPrompt(trimmedQuestion, sellerSnap.data().storeName, sellerSnap.data().category),
      toolDeclarations,
      executors: TOOL_EXECUTORS,
      executorContext: sellerId,
    });
    if (!text) throw new Error("AI javob bera olmadi.");
    return { answer: text, toolsUsed: toolsUsed.map((c) => c.name) };
  } catch (err) {
    console.error(`AI CEO savol-javob xatosi (sotuvchi ${sellerId}):`, err);
    throw new HttpsError("internal", "Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

// TUZATISH (2026-09 audit, P1): oldin `timeoutSeconds` ko'rsatilmagan
// edi — standart (kichik) qiymatda qolar edi. `runToolCallingLoop`
// esa `MAX_TOOL_ROUNDS`gacha KETMA-KET Gemini so'roviga chiqishi
// mumkin (har birida qo'shimcha Firestore o'qish bilan) — sekin
// tarmoqda yoki Gemini biroz kechiksa, standart chegara yetarli
// bo'lmasligi va foydalanuvchiga tushunarsiz "internal" xato
// qaytishi mumkin edi. `storyImage.js`dagi kabi naqsh: og'ir/ko'p
// bosqichli AI operatsiyalariga aniq, kengroq timeout beriladi.
exports.askAiCeo = onCall(
  { region: "asia-south1", secrets: [SENTRY_DSN, GEMINI_API_KEY], timeoutSeconds: 120 },
  withSentry(handleAskAiCeo)
);

exports._testables = {
  runToolCallingLoop,
  buildAskAiCeoPrompt,
  handleAskAiCeo,
  execGetRevenueSummary,
  execGetTopProducts,
  execGetCustomerSegments,
  execGetLowStockProducts,
  execGetAiCeoLearningSummary,
  execGetRecentAutoDiscounts,
  execGetPnlSummary,
  execGetPendingPricingSuggestions,
  execGetSalesDeclineDiagnostic,
  execPlanAdCampaign,
  execGetTrendingProducts,
  execGetCustomerIntelligence,
  execProposeAdCampaign,
  loadHighIntentClientIds,
  hourInTashkent,
  TOOL_DECLARATIONS,
  BIZNES_TOOL_DECLARATIONS,
  TOOL_EXECUTORS,
  clampInt,
};
