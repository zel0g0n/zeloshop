const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { createGeminiClient } = require("./lib/geminiClient");
const { admin, db, GEMINI_API_KEY } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
// FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: barcha Gemini chaqiruvlari
// uchun UMUMIY imlo/ohang qoidalari va generatsiya parametrlari -
// batafsil izoh: `lib/aiStyle.js`.
const { DEFAULT_GENERATION_CONFIG, BASE_STYLE_INSTRUCTION, CTA_RULE } = require("./lib/aiStyle");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { getNicheConfig } = require("./lib/niches");
const { buildStockAuditEntryFromChange, writeStockAuditEntry } = require("./lib/stockAuditLog");
const { resolveImageBase64 } = require("./lib/safeFetch");

/**
 * Sof funksiya - Gemini'ga yuboriladigan promptni tuzadi. ALOHIDA
 * funksiya sifatida ajratilgan (to'g'ridan-to'g'ri testlanishi uchun).
 *
 * 15-NICHE UNIVERSAL PLATFORMA (2026-09, niche tizimini oxirigacha
 * ulash): OLDIN bu funksiya sotuvchining sohasini UMUMAN bilmasdi -
 * promptning o'zi ATAYLAB umumiy (har qanday soha uchun to'g'ri)
 * shaklda yozilgan edi. Bu, "Mahsulot qo'shish" formasidagi "AI bilan
 * to'ldirish" tugmasi - ilovaning ENG KO'P ishlatiladigan AI xususiyati
 * - hech qachon `buildSocialPostPrompt`/`buildDraftPrompt` kabi
 * niche-kontekstidan foydalanmasligini anglatardi. Endi `nicheId`
 * (sotuvchining O'Z hujjatidan, server tomonida - `handleGenerateProductDescription`ga
 * qarang) orqali `getNicheConfig(nicheId).aiContext` ham promptga
 * qo'shiladi - natijada AI, masalan, Avto ehtiyot qismlari uchun
 * texnik/ishonchli, Suvenir uchun hissiy ohangda yozadi. "Hech qachon
 * o'ylab topma" qoidasi esa BARCHA soha uchun BIR XIL, MAJBURIY bo'lib
 * qoladi (bu - xavfsizlik qoidasi, niche'ga qarab yumshatilmaydi).
 */
function buildDescriptionPrompt(name, category, hasImage, nicheId) {
  const nicheConfig = getNicheConfig(nicheId);
  return `Sen — onlayn do'kon uchun mahsulot tavsifi yozuvchi yordamchisan. ${nicheConfig.aiContext}
${hasImage ? "Ilova qilingan RASMga qarab va" : "Quyidagi"} mahsulot nomi/kategoriyasi asosida, O'ZBEK TILIDA, jozibali, ishonchli va qisqa (2-3 gap, 40-60 so'z) tavsif yoz.

Mahsulot nomi: ${name}
${category ? `Kategoriya: ${category}` : ""}

Qoidalar:
- Faqat tavsif matnini yoz, boshqa hech narsa (sarlavha, izoh, tirnoq belgisi) qo'shma.
${hasImage ? "- Rasmda haqiqatan ko'rinib turgan narsalar (rang, shakl, material) haqida yoz." : ""}
- Aniq raqamli da'volar (masalan "99% samarali", sertifikat nomlari) ISHLATMA — bular haqiqiy bo'lmasligi mumkin.
- Tarkib/material, texnik xususiyat (masalan xotira, quvvat, hajm), moslik, kafolat yoki sog'liq/tibbiy da'vo — agar bu ANIQ berilgan mahsulot nomi/kategoriyasida yoki rasmda ko'rinib turmasa — HECH QACHON o'ylab topma yoki taxmin qilma.
- Tabiiy, sotuvga undaydigan, lekin ishonchli ohangda yoz.`;
}

/**
 * Sotuvchi "Mahsulot qo'shish" formasida "AI bilan to'ldirish"
 * tugmasini bosganda chaqiriladi. Mahsulot nomi va kategoriyasi
 * (va, agar bo'lsa, rasmi) asosida, Gemini yordamida haqiqiy,
 * mahsulotga xos tavsif matnini yaratadi.
 */
async function handleGenerateProductDescription(request) {
  // Faqat tizimga kirgan (haqiqiy Telegram orqali tasdiqlangan)
  // foydalanuvchilar chaqira oladi — bu AI so'rovi pullik bo'lgani
  // uchun, tasodifiy/anonim suiiste'molning oldini olish uchun kerak.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }

  // SO'ROVLARNI CHEGARALASH: har bir AI so'rovi HAQIQIY pul
  // xarajatiga olib keladi — shuning uchun bir soatda 20 tadan
  // ortiq so'rov yuborilishiga yo'l qo'yilmaydi.
  await checkRateLimit(`generateProductDescription:${request.auth.uid}`, 20, 3600);
  // XAVFSIZLIK (2026-09 audit, P2): oldin FAQAT soatlik chegara bor
  // edi (20/soat = nazariy jihatdan kuniga ~480 tagacha) — bu funksiya
  // (Story/Ad rasm generatsiyasidan FARQLI) `aiCeoEnabled` premium
  // darvozasiga EGA EMAS (barcha sotuvchilar uchun BEPUL, asosiy
  // xususiyat sifatida ATAYLAB ochiq — shuning uchun bu yerga
  // premium cheklov QO'YILMAYDI, biznes modelni buzmaslik uchun).
  // Lekin xarajatni ENG YOMON holatda ham chegaralash uchun, KUNLIK
  // qo'shimcha chegara qo'shildi — 100/kun haqiqiy sotuvchi uchun
  // (hatto butun katalogni bir kunda qo'shsa ham) yetarli, lekin
  // 480/kunlik nazariy maksimumni ancha pasaytiradi.
  await checkRateLimit(`generateProductDescriptionDaily:${request.auth.uid}`, 100, 86400);

  const { productName, category, imageBase64, imageMimeType, imageUrl } = request.data || {};
  const name = (productName || "").trim();

  if (!name) {
    throw new HttpsError("invalid-argument", "Mahsulot nomi ko'rsatilishi shart.");
  }

  try {
    const ai = createGeminiClient(GEMINI_API_KEY.value());

    // 15-NICHE UNIVERSAL PLATFORMA: `nicheId` sotuvchining O'Z
    // Firestore hujjatidan olinadi - `handleGenerateSocialPost`dagi
    // BILAN AYNAN BIR XIL xavfsizlik naqshi (client hech qachon o'z
    // niche'ini "soxtalashtira" olmaydi, chunki bu yerga umuman
    // yuborilmaydi ham). Hujjat topilmasa (masalan juda eski test
    // ma'lumoti), `getNicheConfig(undefined)` xavfsiz "Boshqa"
    // zaxirasiga qaytadi - funksiya baribir ishlayveradi.
    const sellerSnap = await db.collection("sellers").doc(request.auth.uid).get();
    const nicheId = sellerSnap.exists ? sellerSnap.data().category : null;

    // Agar sotuvchi rasm yuklagan bo'lsa, o'sha rasm ham AI'ga
    // yuboriladi (Gemini multimodal — matn VA rasmni birga tahlil
    // qila oladi) — natijada tavsif haqiqiy mahsulotning ko'rinishiga
    // (rangi, shakli, turi) asoslanadi, faqat nomga emas. `imageUrl` —
    // mahsulotni TAHRIRLASHDA, rasm ALLAQACHON Storage'da bo'lganda
    // (mijoz uni CORS'ga bog'liq bo'lmagan holda serverga yuboradi -
    // batafsil izoh: `lib/safeFetch.js`dagi `resolveImageBase64`).
    const imagePayload = await resolveImageBase64({ imageBase64, imageMimeType, imageUrl });
    const hasImage = Boolean(imagePayload);
    const textPrompt = buildDescriptionPrompt(name, category, hasImage, nicheId);

    const contents = hasImage
      ? [
          {
            role: "user",
            parts: [
              { text: textPrompt },
              { inlineData: { mimeType: imagePayload.mimeType, data: imagePayload.base64 } },
            ],
          },
        ]
      : textPrompt;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
    });

    const description = (response.text || "").trim();
    if (!description) {
      throw new Error("AI bo'sh javob qaytardi.");
    }

    return { description };
  } catch (err) {
    console.error("AI tavsif yaratishda xatolik:", err);
    throw new HttpsError("internal", "Tavsif yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

exports.generateProductDescription = onCall({ secrets: [GEMINI_API_KEY, SENTRY_DSN], region: "asia-south1" }, withSentry(handleGenerateProductDescription));

/**
 * AI CEO — 3-BOSQICH: IJTIMOIY TARMOQ POSTI GENERATORI.
 *
 * MUHIM: bu — AVTOMATIK JOYLASH EMAS (Instagram/TikTok'ga to'g'ridan-
 * to'g'ri joylash uchun Meta/TikTok Business API'lari rasmiy
 * tasdiqlash jarayonidan (haftalar/oylar) o'tishi kerak - bu
 * BUTUNLAY ALOHIDA, kelajakdagi loyiha). Bu yerda faqat TAYYOR MATN
 * yaratiladi - sotuvchi uni nusxalab, o'zi joylaydi.
 *
 * PREMIUM: `generateProductDescription`dan farqli, bu funksiya
 * FAQAT `aiCeoEnabled===true` sotuvchilar uchun ishlaydi - AI CEO
 * dasturining bir qismi sifatida joylashtirilgan.
 *
 * EMOJI HAQIDA ESLATMA: loyihaning O'Z INTERFEYSIDA emoji ISHLATILMAYDI
 * (faqat lucide-react ikonkalar) - lekin BU YERDA, AI YARATGAN
 * Instagram/TikTok POST MATNIDA, emoji ATAYLAB ta'qiqlanmagan - chunki
 * bu, haqiqiy ijtimoiy tarmoq postlarining TABIIY, kutilgan uslubi
 * (haqiqiy SMM mutaxassis ham shunday yozadi). Bu - ilova UI'si bilan
 * ijtimoiy tarmoq uchun MO'LJALLANGAN KONTENT o'rtasidagi ataylab
 * qilingan farq, ikkalasi bir xil qoidaga bo'ysunmaydi.
 */

/**
 * Sof funksiya - ijtimoiy tarmoq posti uchun promptni tuzadi.
 * ALOHIDA funksiya sifatida ajratilgan (to'g'ridan-to'g'ri testlanishi
 * uchun).
 *
 * 15-NICHE UNIVERSAL PLATFORMA: `nicheId` orqali sotuvchining SOHASI
 * (`lib/niches.js`dagi `aiContext`) promptga qo'shiladi - natijada
 * post matni "kichik onlayn do'kon" kabi umumiy emas, balki aniq
 * sohaga mos SMM uslubida yaratiladi (masalan Avto ehtiyot qismlari
 * uchun texnik/ishonchli ohang, Suvenir uchun hissiy/tantanali ohang).
 * `nicheId` — HECH QACHON mijoz (client) so'rovidan olinmaydi, doim
 * sotuvchining o'z Firestore hujjatidan server tomonida aniqlanadi
 * (`handleGenerateSocialPost`ga qarang) - bu boshqa AI CEO
 * funksiyalari (`aiCeo.js`, `aiCeoAgent.js`) bilan bir xil xavfsizlik
 * naqshi.
 */
function buildSocialPostPrompt(name, description, price, platformStyle, nicheId) {
  const nicheConfig = getNicheConfig(nicheId);
  return `Sen — tajribali SMM (ijtimoiy tarmoqlar marketingi) mutaxassisisan, ${nicheConfig.aiContext}

${platformStyle} uchun, quyidagi mahsulot ma'lumoti asosida TAYYOR POST MATNINI yoz.

Mahsulot nomi: ${name}
${description ? `Tavsif: ${description}` : ""}
${price ? `Narx: ${Number(price).toLocaleString()} so'm` : ""}

QOIDALAR:
- O'ZBEK TILIDA yoz.
- Tabiiy, samimiy Instagram/TikTok uslubida - mos joylarda emoji ISHLATISHING MUMKIN (bu yerda ilovaning o'zidagi qoidalar emas, ijtimoiy tarmoq postining tabiiy uslubi qo'llaniladi).
- Postning oxirida 5-8 ta tegishli, O'ZBEKISTON bozoriga mos HASHTAG qo'sh (masalan #toshkent #onlayndokon kabi).
- Aniq raqamli da'volar (masalan "99% samarali") ISHLATMA.
- Faqat POST MATNINI yoz - boshqa hech narsa (izoh, sarlavha) qo'shma.`;
}

async function handleGenerateSocialPost(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }

  await checkRateLimit(`generateSocialPost:${request.auth.uid}`, 20, 3600);

  // PREMIUM TEKSHIRUVI - `aiCeoEnabled` bo'lmasa, Gemini so'rovi
  // UMUMAN qilinmaydi (xarajatni oldindan chegaralash).
  const sellerSnap = await db.collection("sellers").doc(request.auth.uid).get();
  if (!sellerSnap.exists || sellerSnap.data().aiCeoEnabled !== true) {
    throw new HttpsError("permission-denied", "Bu funksiya faqat AI CEO premium mijozlari uchun mavjud.");
  }

  const { productName, description, price, platform, imageBase64, imageMimeType, imageUrl } = request.data || {};
  const name = (productName || "").trim();
  if (!name) {
    throw new HttpsError("invalid-argument", "Mahsulot nomi ko'rsatilishi shart.");
  }

  const platformStyle = platform === "tiktok"
    ? "TikTok uchun - qisqa, energik, tez o'qiladigan, yoshlarga xos ohangda"
    : "Instagram uchun - chiroyli, hikoya uslubidagi, biroz uzunroq bo'lishi mumkin";

  try {
    const ai = createGeminiClient(GEMINI_API_KEY.value());
    // `imageUrl` - `handleGenerateProductDescription`dagi BILAN BIR
    // XIL "Failed to fetch" (CORS) tuzatishi: batafsil izoh
    // `lib/safeFetch.js`dagi `resolveImageBase64`da.
    const imagePayload = await resolveImageBase64({ imageBase64, imageMimeType, imageUrl });
    const hasImage = Boolean(imagePayload);

    // 15-NICHE UNIVERSAL PLATFORMA: `nicheId` sotuvchining O'Z
    // Firestore hujjatidan (yuqorida `sellerSnap` orqali allaqachon
    // o'qilgan) olinadi - client `nicheId` yuborsa ham e'tiborga
    // olinmaydi (tenant-isolation xavfsizlik qoidasi).
    const nicheId = sellerSnap.data().category;
    const textPrompt = `${buildSocialPostPrompt(name, description, price, platformStyle, nicheId)}\n\n${hasImage ? "Ilova qilingan RASMga ham qarab yoz." : ""}`;

    const contents = hasImage
      ? [{ role: "user", parts: [{ text: textPrompt }, { inlineData: { mimeType: imagePayload.mimeType, data: imagePayload.base64 } }] }]
      : textPrompt;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      // MUHIM: `CTA_RULE` bu yerga ATAYLAB qo'shiladi - bu tayyor
      // ijtimoiy tarmoq posti, xarid qilishga undash TABIIY va kutilgan
      // (win-back/sevimlilar eslatmalaridan FARQLI, u yerda ATAYLAB
      // qo'shilmagan - izoh `aiCeo.js`da).
      config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: `${BASE_STYLE_INSTRUCTION}\n${CTA_RULE}` },
    });
    const postText = (response.text || "").trim();
    if (!postText) throw new Error("AI bo'sh javob qaytardi.");

    return { postText };
  } catch (err) {
    console.error("Ijtimoiy tarmoq posti yaratishda xatolik:", err);
    throw new HttpsError("internal", "Post matnini yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

exports.generateSocialPost = onCall({ secrets: [GEMINI_API_KEY, SENTRY_DSN], region: "asia-south1" }, withSentry(handleGenerateSocialPost));

/**
 * AKSIYA (faol chegirma) SONI HISOBLAGICHI (`sellers/{id}.activeDiscountCount`)
 * — Z-Tariflar limit tekshiruvi uchun (`firestore.rules`dagi
 * `products/{productId}` yaratish/yangilash qoidasi shu maydonni
 * o'qiydi, batafsil izoh: `functions/coupons.js`dagi promokod
 * hisoblagichi bilan AYNAN BIR XIL naqsh).
 *
 * "FAOL AKSIYA" = `discountPrice != null`. Mahsulot yaratilganda
 * darhol chegirma bilan, EDIT sahifasida chegirma qo'shilganda,
 * "Aksiya yaratish" (`CreatePromotionPage.jsx`) orqali — QAYSI YO'L
 * bilan o'zgarganidan qat'iy nazar, faqat `discountPrice`ning
 * null <-> qiymat O'TISHI hisobga olinadi (narxning O'ZI
 * o'zgarishi - masalan 10000 dan 8000ga - sonni o'zgartirmaydi).
 */
async function handleProductDiscountCounterWrite(event) {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  const wasActive = before?.discountPrice != null;
  const isActive = after?.discountPrice != null;
  if (wasActive === isActive) return; // o'zgarish yo'q (yoki narx ichki o'zgardi)

  const sellerId = after?.sellerId || before?.sellerId;
  if (!sellerId) return;

  const delta = isActive ? 1 : -1;
  await db.collection("sellers").doc(sellerId).set(
    { activeDiscountCount: admin.firestore.FieldValue.increment(delta) },
    { merge: true }
  );
}

exports.onProductWriteUpdateDiscountCounter = onDocumentWritten(
  { document: "products/{productId}", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleProductDiscountCounterWrite)
);

/**
 * ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
 * muammoni yechish bo'limi): batafsil izoh — `lib/stockAuditLog.js`.
 * Yuqoridagi `handleProductDiscountCounterWrite` bilan BIR XIL trigger
 * hujjatiga (`products/{productId}`) ulangan, lekin ATAYLAB MUSTAQIL
 * funksiya sifatida (bitta trigger — bitta mas'uliyat, mavjud kod
 * uslubiga mos).
 */
async function handleStockAuditLogWrite(event) {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return; // o'chirish - bu jurnalga kirmaydi (izoh: `lib/stockAuditLog.js`)

  const entry = buildStockAuditEntryFromChange({ productId: event.params.productId, before, after });
  if (!entry) return;

  const sellerId = after.sellerId;
  if (!sellerId) return;

  await writeStockAuditEntry(db, admin, { sellerId, ...entry });
}

exports.onProductWriteUpdateStockAudit = onDocumentWritten(
  { document: "products/{productId}", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleStockAuditLogWrite)
);

exports._testables = {
  handleGenerateSocialPost, buildDescriptionPrompt, buildSocialPostPrompt, handleGenerateProductDescription,
  handleProductDiscountCounterWrite, handleStockAuditLogWrite,
};
