// AI CEO / KOPIRAYTING — UMUMIY YOZISH QOIDALARI VA MODEL SOZLAMALARI.
//
// FOYDALANUVCHI YUBORGAN "AI Copywriter va SMM Setup Guide" hujjatidan
// ILHOMLANIB QO'SHILDI. Loyihada Gemini'ga 10 dan ortiq turli joyda
// (mahsulot tavsifi, SMM posti, mijozlarga xabarlar, AI CEO hisobotlari)
// murojaat qilinadi, lekin har birida bir xil uslub qoidalari (imlo,
// ohang) ALOHIDA-ALOHIDA, promptning o'zi ICHIGA yozib qo'yilgan edi -
// bu, birini o'zgartirsang qolganlarida eskicha qolib ketishiga olib
// keladi. Endi bu qoidalar SHU YERDA, BIR MARTA yozilgan va HAR BIR
// chaqiruvga `config.systemInstruction` sifatida (Gemini'ning promptdan
// ALOHIDA, doimiy qo'llaydigan qism) uzatiladi.
//
// MUHIM: hujjat `@google/vertexai` (Firebase Vertex AI SDK) formatidagi
// kod namunasini bergan edi - lekin loyihamiz `@google/genai` (Google AI
// Studio, `GEMINI_API_KEY` orqali) ishlatadi. Ikkalasi BOSHQA-BOSHQA
// paket - shuning uchun parametrlar shakli ham boshqacha:
// `ai.models.generateContent({ model, contents, config: { temperature,
// topP, topK, systemInstruction } })` - hujjatdagi
// `generationConfig: {...}` emas, TO'G'RIDAN-TO'G'RI `config` ICHIDA.

// Past temperature (hujjat tavsiyasiga mos, 0.2-0.4 oralig'i) AI'ning
// "xayolparastlik" qilib, so'ralmagan fakt/raqam o'ylab topishini VA
// kutilmagan formatga chiqib ketishini kamaytiradi - bu ayniqsa
// `productDrafts.js`/`aiCeo.js`dagi QAT'IY formatli ("NOM:/TAVSIF:/...",
// "TARTIB:/SABAB:") javoblar uchun muhim, chunki ular regex bilan
// PARSE qilinadi - format buzilsa, butun oqim ishlamay qoladi.
const DEFAULT_GENERATION_CONFIG = Object.freeze({
  temperature: 0.4,
  topP: 0.9,
  topK: 40,
});

const UZBEK_SPELLING_RULE =
  "O'ZBEK IMLOSI: o' va g' harflarini albatta TO'G'RI apostrof/harflar bilan yoz (masalan \"to'g'ri\", \"go'zallik\", \"o'zbek\") - oddiy tirnoq (') yoki teskari tirnoq bilan ALMASHTIRMA. Ruscha so'zlarni so'zma-so'z tarjima qiladigan sun'iy iboralardan (rusizm/kalka) qoch - tabiiy, o'qishga qulay o'zbek tilida yoz.";

const AVOID_CLICHE_RULE =
  "\"Biz xursandmiz\", \"jamoamiz intiladi\", \"hurmatli mijoz\" kabi sun'iy, rasmiy va zerikarli kirish gaplaridan QOCH - to'g'ridan-to'g'ri mohiyatdan boshla.";

// Har qanday Gemini matn-yaratish chaqiruviga xavfsiz qo'llash mumkin
// bo'lgan BAZA qoidalar - tarkibi (mahsulot tavsifimi, mijozga
// xabarmi, ichki hisobotmi) qanday bo'lishidan qat'i nazar foydali.
const BASE_STYLE_INSTRUCTION = [UZBEK_SPELLING_RULE, AVOID_CLICHE_RULE].join("\n");

// Faqat MIJOZGA yuboriladigan, ERKIN (qat'iy formatga PARSE
// qilinmaydigan) BITTA xabar/post uchun - masalan SMM posti yoki savat
// eslatmasi. MUHIM: bu ATAYLAB `craftWinBackMessage`/
// `craftFavoriteReminderMessage`ga QO'SHILMAYDI - o'sha ikkalasi
// ATAYLAB "bosim o'tkazmaydigan" ohangda yozadi (aniq chegirma/CTA
// TAKLIF QILMASLIK ularning mavjud dizayn qarori), qattiq CTA talabi
// shu maqsadga zid bo'lardi.
const CTA_RULE =
  "Matn oxirida qisqa va tabiiy harakatga chaqiriq (masalan xarid qilish yoki katalogni ko'rishga undash) bo'lsin.";

module.exports = {
  DEFAULT_GENERATION_CONFIG,
  UZBEK_SPELLING_RULE,
  AVOID_CLICHE_RULE,
  BASE_STYLE_INSTRUCTION,
  CTA_RULE,
};
