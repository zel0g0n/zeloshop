const { Modality } = require("@google/genai");
const { createGeminiClient } = require("./geminiClient");
const { GEMINI_API_KEY } = require("./admin");

/**
 * AI CEO — MAHSULOT UCHUN AVTOMATIK "INSTAGRAM REKLAMA RASMI".
 *
 * FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: mahsulot qo'shilganda (AI CEO
 * "Tez qo'shish"/qoralama tasdiqlash oqimi orqali HAM, sotuvchining
 * o'zi oddiy formadan qo'lda HAM — ikkalasi ham `products.js`dagi
 * yagona `products/{id}` hujjatini yaratadi, chaqiruvchi
 * `productAutomation.js`ga qarang), mahsulotning ASOSIY (birinchi,
 * `product.image`) rasmidan, ijtimoiy tarmoqqa (Instagram) mos,
 * e'tibor tortadigan reklama surati AVTOMATIK yaratiladi.
 *
 * IKKITA ALOHIDA TADQIQOT SAVOLI VA QAROR:
 *
 * 1) QAYSI MODEL/USUL ISHLATILADI: Google'ning rasm generatsiya
 *    qatorida ikkita yo'l bor — (a) standalone Imagen
 *    (`ai.models.generateImages`/`editImage`, `EDIT_MODE_PRODUCT_IMAGE`
 *    rejimi bilan — REFERENCE-IMAGE asosida "professional" tahrirlash),
 *    yoki (b) Gemini'ning o'zining rasm chiqarish qobiliyati ("Nano
 *    Banana" oilasi, `gemini-3.1-flash-image` va sh.k.),
 *    `generateContent` orqali — oddiy rasm+matn INPUT bilan.
 *    (a) — Vertex AI backend'ni talab qiladi (alohida GCP
 *    billing/sozlash), (b) esa LOYIHA ALLAQACHON ishlatayotgan, oddiy
 *    `GEMINI_API_KEY`ga asoslangan `@google/genai` SDK'sining bir
 *    qismi — xuddi `products.js`/`aiCeo.js`/`productDrafts.js`dagi
 *    BARCHA boshqa chaqiruvlar kabi (sabab: `aiStyle.js`dagi izohga
 *    qarang — loyiha ATAYLAB Vertex AI SDK'sidan foydalanmaydi).
 *    Shuning uchun (b) — `generateContent` + `responseModalities:
 *    [Modality.IMAGE]` — tanlandi: bir xillik, soddalik, mavjud
 *    infratuzilma (bitta `GEMINI_API_KEY` secret) bilan ishlaydi.
 *
 * 2) QAYSI PROMPT USLUBI ENG "E'TIBOR TORTADIGAN"/IDEAL (foydalanuvchi
 *    "internetdan qidirib, eng ideal buyruqni ishlat" deb so'ragan):
 *    tadqiqot (Photoroom/Blendnow/AdLibrary kabi e-commerce AI-rasm
 *    qo'llanmalari) natijasida, samarali reklama-rasm prompti quyidagi
 *    tarkibga ega bo'lishi kerak ekan: (a) ANIQ USLUB so'zi
 *    (fotorealistik, yuqori kontrast), (b) PLATFORMA formati
 *    (Instagram uchun kvadrat 1:1), (c) "e'tibor tortuvchi"
 *    sifatlovchilar ("vibrant", "bold", "dynamic lighting", "premium,
 *    scroll-stopping"). Bularning barchasi pastdagi promptga
 *    kiritilgan.
 *
 *    QO'SHIMCHA, LOYIHAGA XOS, MUHIM QOIDA (tadqiqot manbalarida
 *    alohida ta'kidlanmagan, lekin BIZNING holatda SHART): "mahsulotni
 *    o'zgartirmaslik" talabi. Agar AI mahsulotning haqiqiy ko'rinishini
 *    (rangi/shakli/yozuvi) o'zgartirib chizsa — reklama rasmi
 *    xaridorni CHALG'ITUVCHI bo'lib qoladi (haqiqatda kelayotgan
 *    mahsulot rasmda ko'ringanidan farq qiladi). Shuning uchun promptga
 *    qat'iy "mahsulotni ASL holida saqla" yo'riqnomasi qo'shilgan —
 *    bu, loyihaning "AI haqiqiy ma'lumotni o'ylab topmasligi kerak"
 *    umumiy tamoyili bilan BIR XIL mantiq, faqat bu yerda VIZUAL
 *    haqiqat uchun qo'llangan.
 *
 * XAVFSIZLIK: bu modul SOF, mustaqil funksiyalardan iborat — Firestore/
 * Storage bilan ISHLAMAYDI (chaqiruvchi, `productAutomation.js`,
 * natijani qayerga yozishni hal qiladi va xatoni jim ushlaydi — shu
 * orqali rasm generatsiyasi hech qachon mahsulot yaratish oqimini
 * BUZMAYDI).
 */
const AD_IMAGE_MODEL = "gemini-3.1-flash-image";

/**
 * SOF FUNKSIYA — to'g'ridan-to'g'ri test qilinadi.
 */
function buildInstagramAdPrompt({ productName, category } = {}) {
  const context = [
    productName ? `Product name: ${productName}` : null,
    category ? `Product category: ${category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Create one professional, photorealistic, high-contrast, vibrant Instagram-style e-commerce advertisement image, square 1:1 format.

CRITICAL RULE: use the EXACT product shown in the attached photo. Do NOT redraw, reinterpret, or alter the product itself in any way — its shape, color, packaging, label, logo and any text printed on it must stay exactly as shown in the source photo.

Place that exact product into an attractive, contextually relevant styled scene with clean, professional composition and dynamic, dramatic lighting that makes the product visually pop and stop the scroll on a social media feed. Premium, scroll-stopping advertising photography look.
${context ? `\n${context}\n` : ""}
Do not add any text, captions, logos, or watermarks into the image itself.`;
}

/**
 * "STORY" (Instagram/Telegram Stories) FORMATI UCHUN PROMPT — yuqoridagi
 * kvadrat reklama-rasm promptining vertikal (9:16) varianti. ATAYLAB
 * ALOHIDA FUNKSIYA sifatida: story formatida QO'SHIMCHA, kvadrat rasmda
 * bo'lmagan talab bor — ekran YUQORI va PASTKI qismlarida Telegram/
 * Instagram'ning o'z interfeys elementlari (username, "javob berish"
 * paneli, stikerlar) joylashadi, shuning uchun promptga ALOHIDA
 * "xavfsiz zona" (safe zone) ko'rsatmasi qo'shilgan — aks holda AI
 * mahsulotni yoki asosiy kompozitsiyani aynan o'sha, keyinchalik
 * interfeys bilan yopiladigan hududlarga joylashtirib qo'yishi mumkin.
 * "Mahsulotni ASL holida saqlash" qoidasi bu yerda ham AYNAN bir xil
 * (yuqoridagi izohga qarang) — story ham oxir-oqibat reklama surati,
 * xaridorni chalg'itmasligi shart.
 *
 * SOF FUNKSIYA — to'g'ridan-to'g'ri test qilinadi.
 */
function buildStoryAdPrompt({ productName, category } = {}) {
  const context = [
    productName ? `Product name: ${productName}` : null,
    category ? `Product category: ${category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Create one professional, photorealistic, high-contrast, vibrant social-media advertisement image for an Instagram/Telegram Story, vertical 9:16 format.

CRITICAL RULE: use the EXACT product shown in the attached photo. Do NOT redraw, reinterpret, or alter the product itself in any way — its shape, color, packaging, label, logo and any text printed on it must stay exactly as shown in the source photo.

Place that exact product into an attractive, contextually relevant styled scene with clean, professional composition and dynamic, dramatic lighting that makes the product visually pop and stop the scroll. Premium, scroll-stopping advertising photography look.

IMPORTANT STORY-FORMAT SAFE ZONE: keep the main product and the most important visual elements centered in the middle of the frame — leave the very top ~15% and very bottom ~20% of the vertical frame visually simple/uncluttered (soft background only), since Telegram/Instagram overlay their own UI (username, reply bar, stickers) in those areas.
${context ? `\n${context}\n` : ""}
Do not add any text, captions, logos, or watermarks into the image itself.`;
}

/**
 * ICHKI, ULASHILGAN YORDAMCHI — Gemini'ga rasm+prompt yuboradi va
 * javobdan rasm baytlarini ajratadi. `generateProductAdImage` HAM,
 * `generateProductStoryImage` HAM AYNAN shu mantiqni ishlatadi — farqi
 * faqat PROMPT matnida (kvadrat vs vertikal format), Gemini chaqiruv
 * shakli va javobni ajratish mantig'i ikkalasida ham bir xil.
 */
async function callGeminiForAdImage(prompt, { imageBase64, imageMimeType }) {
  const ai = createGeminiClient(GEMINI_API_KEY.value());

  const response = await ai.models.generateContent({
    model: AD_IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }],
      },
    ],
    config: { responseModalities: [Modality.IMAGE] },
  });

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p?.inlineData?.data);
  if (!imagePart) {
    throw new Error("AI rasm qaytarmadi.");
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

/**
 * Manba (haqiqiy mahsulot) rasmi + prompt asosida, Gemini orqali
 * yangi reklama rasmini generatsiya qiladi.
 *
 * @returns {Promise<{imageBase64: string, mimeType: string}>}
 * @throws AI rasm qaytarmasa yoki chaqiruv xato bersa.
 */
async function generateProductAdImage({ imageBase64, imageMimeType, productName, category }) {
  if (!imageBase64 || !imageMimeType) {
    throw new Error("Manba rasm berilmagan.");
  }
  const prompt = buildInstagramAdPrompt({ productName, category });
  return callGeminiForAdImage(prompt, { imageBase64, imageMimeType });
}

/**
 * `generateProductAdImage` bilan bir xil, lekin "Story" (9:16, vertikal)
 * formatidagi rasm generatsiya qiladi — sotuvchi buni ALOHIDA, o'zi
 * xohlagan paytda (masalan aksiya e'lon qilmoqchi bo'lganda) qo'lda
 * so'raydi, mahsulot yaratilganda avtomatik EMAS (farqli o'laroq
 * `productAutomation.js`dagi kvadrat reklama rasmidan) — sabab:
 * `functions/storyImage.js`dagi izohga qarang.
 *
 * @returns {Promise<{imageBase64: string, mimeType: string}>}
 * @throws AI rasm qaytarmasa yoki chaqiruv xato bersa.
 */
async function generateProductStoryImage({ imageBase64, imageMimeType, productName, category }) {
  if (!imageBase64 || !imageMimeType) {
    throw new Error("Manba rasm berilmagan.");
  }
  const prompt = buildStoryAdPrompt({ productName, category });
  return callGeminiForAdImage(prompt, { imageBase64, imageMimeType });
}

module.exports = {
  AD_IMAGE_MODEL,
  buildInstagramAdPrompt,
  generateProductAdImage,
  buildStoryAdPrompt,
  generateProductStoryImage,
};
