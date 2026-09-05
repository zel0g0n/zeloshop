const { onSchedule } = require("firebase-functions/v2/scheduler");
const { createGeminiClient } = require("./lib/geminiClient");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY } = require("./lib/admin");
const { sendTelegramMessage } = require("./lib/helpers");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
// 15-NICHE UNIVERSAL PLATFORMA: AI qoralama tayyorlash endi
// sotuvchining HAQIQIY sohasiga (niche) qarab ishlaydi - kategoriya
// ro'yxati, AI konteksti va qaysi atributlarni ekstraksiya qilish
// kerakligi shu yerdan olinadi (batafsil izoh: `lib/niches.js`).
const { getNicheConfig } = require("./lib/niches");
const { getAttributeDefinition } = require("./lib/attributeDictionary");
const { fetchTrustedImage } = require("./lib/safeFetch");
// 15-NICHE UNIVERSAL PLATFORMA (band #20 - custom kategoriya
// boshqaruvi): sotuvchi yashirgan kategoriya AI'ga taklif qilinmasin,
// sotuvchi qo'shgan CUSTOM kategoriya esa AI'ga MA'LUM bo'lsin -
// batafsil izoh: `lib/categoryCustomization.js`.
const { getEffectiveCategoryNamesForSeller } = require("./lib/categoryCustomization");
// Barcha Gemini chaqiruvlari uchun umumiy imlo/ohang qoidalari va
// generatsiya parametrlari - batafsil izoh: `lib/aiStyle.js`. Past
// `temperature` bu yerda alohida muhim - javob qat'iy
// "NOM:/TAVSIF:/KATEGORIYA:" formatida bo'lishi shart (pastdagi
// `parseDraftResponse` shu formatni kutadi).
const { DEFAULT_GENERATION_CONFIG, BASE_STYLE_INSTRUCTION } = require("./lib/aiStyle");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * AI CEO — 2-bosqich: mahsulot qoralamasini tayyorlash.
 *
 * Oqim: sotuvchi kun davomida (`submitProductDraft` — to'g'ridan-
 * to'g'ri mijoz tomonidan Firestore'ga yoziladi, alohida Cloud
 * Function shart emas, xuddi oddiy `addProduct` kabi) faqat rasm va
 * qisqa izoh bilan "navbatga" mahsulot qo'shadi - to'liq forma
 * to'ldirmaydi. Kechqurun (bu funksiya) AI ularni qayta ishlaydi:
 * tavsif yozadi va kategoriya taklif qiladi. Sotuvchi ilovani
 * ochganda, tayyor qoralamalarni bir necha soniyada ko'rib chiqadi.
 *
 * AI narxni taklif qilmaydi - faqat rasm/nomdan narxni "taxmin
 * qilish" ishonchsiz bo'lardi (haqiqiy bozor ma'lumoti yo'q), bu
 * yolg'on ma'lumot berish bilan teng. Kategoriya ham faqat tavsiya
 * sifatida beriladi - yakuniy tanlov har doim sharhlash ekranidagi
 * haqiqiy, tasdiqlangan kategoriyalar ro'yxatidan
 * (`getCategoriesForNiche`) bo'ladi, AI matnidan emas - shu orqali
 * noto'g'ri yoki mavjud bo'lmagan kategoriya hech qachon saqlanmaydi.
 *
 * Xarajat nazorati: xuddi `aiCeo.js`dagi kabi - faqat
 * `aiCeoEnabled === true` sotuvchilar, faqat `status:"queued"`
 * qoralamalar mavjud bo'lsagina ko'rib chiqiladi.
 */

const MODEL = "gemini-3.5-flash-lite";

// Platforma boshlanishida FAQAT kosmetika sohasi bo'lgani uchun,
// sotuvchining `category` (niche) maydoni hali o'rnatilmagan/noto'g'ri
// bo'lgan HAR QANDAY (juda kam uchraydigan, masalan eski test
// ma'lumoti) holatda ishlatiladigan xavfsiz standart qiymat - xuddi
// `nicheMigration.js`dagi `DEFAULT_NICHE` bilan bir xil bo'lishi shart.
const DEFAULT_NICHE = "Kosmetika";

/**
 * Berilgan niche uchun, AI'dan ekstraksiya qilishga URINISH kerak
 * bo'lgan atributlar bo'yicha prompt bo'limini tuzadi. FAQAT
 * `aiExtractable: true` bo'lgan atributlar so'raladi - qolganlari
 * (masalan `ingredients`, `warranty`, `compatibility`, `safetyInfo`,
 * `oemNumber`) AI'dan HECH QACHON so'ralmaydi, chunki bularni AI
 * to'qib chiqarishi xavfli (loyihaning "AI hech qachon mavjud
 * bo'lmagan spetsifikatsiyani o'ylab topmasin" qat'iy qoidasi).
 */
function buildAttributePromptSection(nicheConfig) {
  const extractableKeys = (nicheConfig.attributeKeys || []).filter((key) => {
    const def = getAttributeDefinition(key);
    return def && def.aiExtractable;
  });
  if (extractableKeys.length === 0) return null;

  const fieldLines = extractableKeys.map((key) => {
    const def = getAttributeDefinition(key);
    if (def.type === "select") return `  - "${key}": FAQAT quyidagi qiymatlardan biri (aynan shu inglizcha so'z): ${def.options.join(", ")}`;
    if (def.type === "number") return `  - "${key}": faqat son (masalan 50)`;
    return `  - "${key}": qisqa matn`;
  });

  return {
    instructions: `4. ATRIBUTLAR: rasm(lar)da/izohda ANIQ ko'rinib turgan yoki ANIQ aytilgan quyidagi xususiyatlarni JSON obyekt shaklida ber:
${fieldLines.join("\n")}
MUHIM: agar biror xususiyat aniq bo'lmasa yoki uni faqat TAXMIN qilish mumkin bo'lsa, o'sha kalitni OBYEKTGA UMUMAN QO'SHMA (hech qachon o'ylab topma yoki taxmin qilma). Aniq bo'lgan xususiyat bo'lmasa, bo'sh obyekt qaytar.`,
    responseLine: "ATRIBUTLAR: <JSON obyekt, masalan {\"brand\": \"Nivea\", \"volume\": \"50ml\"} yoki bo'sh {}>",
  };
}

function buildDraftPrompt(rawHint, hasImage, nicheConfig = getNicheConfig(DEFAULT_NICHE)) {
  const hintLine = rawHint
    ? `Sotuvchi izohi: "${rawHint}"`
    : "Sotuvchi hech qanday izoh qoldirmagan - FAQAT rasmga qarab aniqla.";
  const categoryNames = nicheConfig.categories;
  const attributeSection = buildAttributePromptSection(nicheConfig);

  return `Sen — mahsulot ma'lumotini tayyorlovchi tajribali kontent yozuvchisisan. ${nicheConfig.aiContext}
${hasImage ? "Ilova qilingan RASM(LAR)ga qarab" : "Quyidagi izoh asosida"}, quyidagilarni tayyorla:

${hintLine}

1. NOM: qisqa, aniq mahsulot nomi (masalan "Qora rangli teri krem, 50ml").

2. TAVSIF: O'ZBEK TILIDA, batafsil (4-6 gap, taxminan 80-150 so'z) mahsulot tavsifi. BU ODDIY REKLAMA GAPI EMAS - quyidagi UCH qismni albatta qamrab ol:
   a) Mahsulotning HAQIQIY xususiyatlari - tarkibi/materiali, hajmi/miqdori, ko'rinishi, rasm(lar)da haqiqatan ko'rinib turgan belgilar asosida.
   b) Foydalanish yo'riqnomasi - qanday va qachon qo'llash/ishlatish kerakligi haqida aniq, amaliy tavsiya.
   c) Foydaliligi - bu xususiyatlar xaridorga aniq qanday foyda/natija berishi (umumiy "ajoyib mahsulot" kabi bo'sh, "oldi-qochdi" gaplar EMAS - har bir da'vo aniq xususiyatga bog'langan bo'lishi kerak).

3. KATEGORIYA: albatta va FAQAT quyidagi ro'yxatdan BITTASINI, ro'yxatda yozilganidek AYNAN o'sha shaklda tanla (boshqa so'z qo'shma, tarjima qilma) - rasmda ko'rinib turgan mahsulot turiga ENG mos kelganini tanla:
${categoryNames.map((c) => `- ${c}`).join("\n")}
${attributeSection ? `\n${attributeSection.instructions}` : ""}

QOIDALAR:
- Aniq raqamli da'volar (masalan "99% samarali") ISHLATMA - buni tekshirib bo'lmaydi.
${hasImage ? "- TAVSIF, KATEGORIYA va ATRIBUTLAR uchun rasm(lar)da haqiqatan ko'rinib turgan narsalarga tayan - o'zingdan to'qima." : ""}
- Javobni FAQAT quyidagi formatda ber, boshqa hech narsa yozma:
NOM: <mahsulot nomi>
TAVSIF: <tavsif matni>
KATEGORIYA: <ro'yxatdagi kategoriya nomi>${attributeSection ? `\n${attributeSection.responseLine}` : ""}`;
}

/**
 * Gemini javobini {name, description, category, rawAttributes} ga
 * ajratadi. Sof funksiya - to'g'ridan-to'g'ri test qilinadi (Gemini
 * matn formatini har doim to'g'ri qaytarishiga kafolat yo'q, shuning
 * uchun bu parser ishonchli bo'lishi muhim).
 *
 * `rawAttributes` HALI TEKSHIRILMAGAN (AI matnidan JSON.parse orqali
 * olingan xom qiymat) - uni sxema bo'yicha tekshirish uchun
 * `validateExtractedAttributes` ishlatiladi. Bu ikki bosqichli
 * yondashuv `parseDraftResponse`ni "faqat matnni ajratish" mas'uliyati
 * bilan sof va testlash oson qilib qoladi.
 */
function parseDraftResponse(rawText) {
  const nameMatch = rawText.match(/NOM:\s*(.+?)(?=\nTAVSIF:|$)/s);
  const descMatch = rawText.match(/TAVSIF:\s*(.+?)(?=\nKATEGORIYA:|$)/s);
  const catMatch = rawText.match(/KATEGORIYA:\s*(.+?)(?=\nATRIBUTLAR:|$)/s);
  const attrMatch = rawText.match(/ATRIBUTLAR:\s*(\{[\s\S]*\})\s*$/);

  let rawAttributes = {};
  if (attrMatch) {
    try {
      const parsed = JSON.parse(attrMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) rawAttributes = parsed;
    } catch {
      // Gemini har doim to'g'ri JSON qaytarishiga kafolat yo'q - bunday
      // holatda xavfsiz tomoni: hech qanday atribut saqlanmaydi (bo'sh
      // obyekt), lekin NOM/TAVSIF/KATEGORIYA baribir ishlatiladi.
    }
  }

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : rawText.trim(),
    category: catMatch ? catMatch[1].trim() : null,
    rawAttributes,
  };
}

/**
 * AI tomonidan "topilgan" xom atributlarni HAQIQIY sxema bo'yicha
 * tekshiradi va faqat XAVFSIZ, TASDIQLANGAN qiymatlarni qaytaradi.
 * Sof funksiya - to'g'ridan-to'g'ri test qilinadi, chunki bu butun
 * "AI hech qachon mavjud bo'lmagan xususiyatni o'ylab topmasin"
 * qoidasining YAKUNIY, ishonchli darvozasi:
 *
 *   1) Kalit shu niche'ning `attributeKeys` ro'yxatida bo'lishi SHART
 *      (aks holda - boshqa sohadan "sizib kirgan" yoki AI o'ylab
 *      topgan kalit rad etiladi).
 *   2) Kalitning lug'atdagi ta'rifi `aiExtractable !== true` bo'lsa -
 *      rad etiladi (garchi AI uni "topsa" ham - bu ikkinchi, mustaqil
 *      himoya qatlami, promptga ishonib qolmaslik uchun).
 *   3) "select" turi uchun qiymat ANIQ ro'yxatdagi variantlardan biri
 *      bo'lishi SHART (aks holda AI o'zidan yangi variant o'ylab
 *      topolmaydi).
 *   4) "number" turi uchun qiymat haqiqiy, chekli songa aylantirilishi
 *      SHART.
 *   5) "text" turi uchun qiymat qisqartiriladi (AI'ning uzun,
 *      "to'qilgan" matn yozib yuborishining oldini olish uchun).
 */
function validateExtractedAttributes(rawAttributes, nicheId) {
  const validated = {};
  if (!rawAttributes || typeof rawAttributes !== "object") return validated;

  const nicheConfig = getNicheConfig(nicheId);
  for (const key of nicheConfig.attributeKeys || []) {
    const def = getAttributeDefinition(key);
    if (!def || !def.aiExtractable) continue;

    const rawValue = rawAttributes[key];
    if (rawValue == null || rawValue === "") continue;

    if (def.type === "number") {
      const num = Number(rawValue);
      if (!Number.isFinite(num)) continue;
      validated[key] = num;
    } else if (def.type === "select") {
      const strValue = String(rawValue).trim();
      if (!def.options.includes(strValue)) continue;
      validated[key] = strValue;
    } else {
      const strValue = String(rawValue).trim().slice(0, 100);
      if (!strValue) continue;
      validated[key] = strValue;
    }
  }
  return validated;
}

async function processDraft(ai, draftRef, draft, nicheId = DEFAULT_NICHE, categoryCustomization = null) {
  const baseNicheConfig = getNicheConfig(nicheId);
  // Sotuvchining shaxsiy kategoriya moslashtirishi (yashirilgan/custom
  // qo'shilgan) - AI'ga yuboriladigan kategoriya ro'yxatiga qo'llaniladi,
  // niche'ning O'ZI (boshqa sotuvchilarga ta'sir qiluvchi umumiy
  // konfiguratsiya) o'zgarishsiz qoladi.
  const effectiveCategories = getEffectiveCategoryNamesForSeller(baseNicheConfig.categories, categoryCustomization);
  const nicheConfig = { ...baseNicheConfig, categories: effectiveCategories };
  // Eski qoralamalar bitta `imageUrl` (satr) bilan yozilgan, yangilari
  // esa `imageUrls` (4 tagacha rasm massivi, `QuickAddAICard.jsx`dan)
  // bilan yoziladi - ikkalasini ham qo'llab-quvvatlaymiz.
  const imageUrls = Array.isArray(draft.imageUrls) && draft.imageUrls.length > 0
    ? draft.imageUrls
    : draft.imageUrl
    ? [draft.imageUrl]
    : [];

  // Rasm URL'laridan bevosita Gemini'ga base64 sifatida yuborish uchun,
  // avval ularni yuklab olishimiz kerak (Firebase Storage ochiq URL).
  // Bir nechta rasm bo'lsa, HAMMASI bitta so'rovda AI'ga yuboriladi -
  // shu orqali AI mahsulotni turli burchaklardan/qadoq tomonidan
  // ko'rib, aniqroq tavsif va kategoriya taklif qila oladi.
  // RASM RESIZE (2026-09 audit): bu URL'lar `QuickAddAICard.jsx` orqali
  // yuklangan, ya'ni ular ham `useUploadStorage.jsx` → `compressImage`
  // (maks. 1000x1000, sifat 0.75) bilan ALLAQACHON siqilgan holda
  // Storage'da saqlanadi — qo'shimcha resize shart emas
  // (`productAutomation.js`dagi batafsil izohga qarang).
  const imageParts = [];
  for (const url of imageUrls) {
    try {
      const res = await fetchTrustedImage(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      imageParts.push({ inlineData: { mimeType: res.headers.get("content-type") || "image/jpeg", data: buffer.toString("base64") } });
    } catch (err) {
      console.error("Qoralama rasmini yuklab olishda xatolik:", err);
    }
  }

  const textPrompt = buildDraftPrompt(draft.rawHint || "", imageParts.length > 0, nicheConfig);
  const contents = imageParts.length > 0
    ? [{ role: "user", parts: [{ text: textPrompt }, ...imageParts] }]
    : textPrompt;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { ...DEFAULT_GENERATION_CONFIG, systemInstruction: BASE_STYLE_INSTRUCTION },
  });
  const { name, description, category, rawAttributes } = parseDraftResponse((response.text || "").trim());

  if (!description) throw new Error("AI bo'sh javob qaytardi.");

  const attributes = validateExtractedAttributes(rawAttributes, nicheId);

  await draftRef.update({
    status: "ready_for_review",
    aiName: name || draft.rawHint || null,
    aiDescription: description,
    aiCategory: category,
    // Sxema bo'yicha TEKSHIRILGAN (validateExtractedAttributes)
    // atributlar - sotuvchi tasdiqlash ekranida ko'rib, kerak bo'lsa
    // o'zgartirishi mumkin (`ProductDraftReview.jsx`).
    aiAttributes: attributes,
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// Funksiya har soatda ishga tushadi, lekin har bir sotuvchini faqat
// ular o'zlari tanlagan soatda (`aiCeoDraftProcessHour` maydoni,
// standart holatda 21) qayta ishlaydi - shu orqali sotuvchi o'ziga
// qulay vaqtni sozlashi mumkin, standart qiymat esa hamma uchun
// bir xil, oldindan belgilangan vaqt bilan mos keladi.
exports.processProductDrafts = onSchedule(
  {
    schedule: "0 * * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN],
    // 50-100+ faol sotuvchi bir xil soatni tanlagan bo'lishi mumkin -
    // PARALEL guruhlab ishlov berilsa ham, qo'shimcha xavfsizlik
    // zaxirasi sifatida oshirilgan (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const currentHour = new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false });
    const currentHourNum = parseInt(currentHour, 10) % 24; // "24" holatini "0"ga aylantirish uchun

    const eligibleSellersSnap = await db.collection("sellers").where("aiCeoEnabled", "==", true).get();
    if (eligibleSellersSnap.empty) return;

    const ai = createGeminiClient(GEMINI_API_KEY.value());

    // Xavfsizlik chegarasi: bitta sotuvchi uchun, bitta yugurishda,
    // eng ko'pi bilan shuncha qoralama qayta ishlanadi.
    // `submitProductDraft` (mijoz tomonida, to'g'ridan-to'g'ri
    // Firestore'ga yoziladi - Cloud Function orqali emas, chunki u
    // yerda ishonchsiz yoki moliyaviy ma'lumot yo'q) hech qanday
    // server-tomon cheklovga ega emas - agar xato yoki takroriy
    // bosish tufayli navbatga minglab qoralama yig'ilib qolsa, bu
    // yerdagi chegara bo'lmasa, barchasi bitta yugurishda qayta
    // ishlanardi, ya'ni nazoratsiz, minglab Gemini so'rovi va haqiqiy
    // pul xarajati. Qolgan qoralamalar keyingi kunlarga o'tkaziladi
    // (status "queued" bo'lib qolaveradi).
    const MAX_DRAFTS_PER_SELLER_PER_RUN = 30;

    // Faqat hozirgi soatni tanlagan sotuvchilar qayta ishlanadi -
    // qolganlari uchun bitta qo'shimcha Firestore so'rovi ham
    // qilinmaydi.
    const dueSellerDocs = eligibleSellersSnap.docs.filter((sellerDoc) => {
      const preferredHour = Number.isInteger(sellerDoc.data().aiCeoDraftProcessHour) ? sellerDoc.data().aiCeoDraftProcessHour : 21;
      return preferredHour === currentHourNum;
    });
    if (dueSellerDocs.length === 0) return;

    // Har bir sotuvchi mustaqil (umumiy holat yo'q) - PARALEL
    // guruhlarda ishlov berish xavfsiz (batafsil izoh:
    // `lib/batchProcess.js`). Sotuvchi ICHIDAGI qoralamalar ham xuddi
    // shunday - ular bir-biriga bog'liq emas (faqat oddiy hisoblagich
    // `processedCount` bor, JS bir-ipli bo'lgani uchun bu xavfsiz).
    const result = await processBatched(dueSellerDocs, async (sellerDoc) => {
      const sellerId = sellerDoc.id;
      try {
        const queuedSnap = await db.collection("sellers").doc(sellerId).collection("productDrafts")
          .where("status", "==", "queued")
          .limit(MAX_DRAFTS_PER_SELLER_PER_RUN)
          .get();

        if (queuedSnap.empty) return;

        // Sotuvchining HAQIQIY sohasi (`sellers.category`) - AI prompti,
        // kategoriya ro'yxati va ekstraksiya qilinadigan atributlar shu
        // qiymatga qarab tanlanadi (15-NICHE UNIVERSAL PLATFORMA).
        const sellerNicheId = sellerDoc.data().category;
        const sellerCategoryCustomization = sellerDoc.data().categoryCustomization || null;
        const draftResult = await processBatched(queuedSnap.docs, async (draftDoc) => {
          try {
            await processDraft(ai, draftDoc.ref, draftDoc.data(), sellerNicheId, sellerCategoryCustomization);
          } catch (err) {
            console.error(`Mahsulot qoralamasini qayta ishlashda xatolik (${sellerId}/${draftDoc.id}):`, err);
            await draftDoc.ref.update({ status: "failed" }).catch(() => {});
            throw err; // tashqi hisoblagichga ("draftResult.failureCount") ham qayd etilishi uchun
          }
        });

        if (draftResult.successCount > 0) {
          const customBotSnap = await db.collection("sellers").doc(sellerId).collection("private").doc("customerBot").get();
          const token = customBotSnap.exists && customBotSnap.data().botToken ? customBotSnap.data().botToken : BOT_TOKEN.value();
          const text = `AI CEO\n\n${draftResult.successCount} ta mahsulot tayyorlandi va tasdiqlashingizni kutmoqda!\n\nIlovani oching → Mahsulotlar → "Tasdiqlash kutilmoqda" bo'limi.`;
          await sendTelegramMessage(token, sellerId, text);
        }
      } catch (err) {
        console.error(`Sotuvchi ${sellerId} uchun qoralamalarni qayta ishlashda xatolik:`, err);
        throw err; // `result.failureCount`ga ham qo'shilishi uchun
      }
    });
    console.log(`processProductDrafts: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

// `processDraft` - qayta ishlatish uchun eksport qilinadi:
// `telegramBotMenu.js`dagi "AI CEO bilan mahsulot qo'shish" bot-
// suhbat oqimi bir xil Gemini prompt/tahlil mantig'idan foydalanadi,
// faqat soatlik navbat o'rniga darhol (sotuvchi botda rasm yuborgan
// zahoti) chaqiradi - ikki xil kirish yo'li (ilova ichidan yoki bot
// chatidan) bitta, tekshirilgan mantiqqa tayanadi (xuddi oddiy forma
// va AI qoralamasi bitta `addProduct()`ga tayangani kabi).
exports.processDraft = processDraft;

exports._testables = { buildDraftPrompt, parseDraftResponse, validateExtractedAttributes, DEFAULT_NICHE };
