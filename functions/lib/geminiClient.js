const { GoogleGenAI } = require("@google/genai");

/**
 * BUTUN ilova bo'yicha Gemini (`@google/genai`) mijozini yaratish
 * uchun YAGONA joy — `productDrafts.js`, `pricingSuggestions.js`,
 * `productAssistant.js`, `products.js`, `aiCeo.js`, `aiCeoAgent.js`,
 * `lib/aiStyle.js` barchasi shu orqali yaratadi (ILGARI har biri
 * `new GoogleGenAI(...)`ni MUSTAQIL, TAKRORLANGAN holda chaqirardi).
 *
 * 2026-09: `lib/aiImage.js` (AI rasm generatsiyasi — avtomatik reklama
 * surati, avtomatik Story rasmi, qo'lda "AI asosiy rasm") sotuvchi
 * so'roviga ko'ra BUTUNLAY OLIB TASHLANDI (Gemini rasm modelining
 * kvota/429 muammolari sababli). Ro'yxatdan ATAYLAB o'chirilmadi —
 * kelajakda kimdir shu faylni qayta o'qisa, "aiImage.js nega yo'q"
 * degan savolga javob bo'lsin deb.
 *
 * 2026-09 audit (P1 — "AI: Gemini retry/backoff qo'shish"):
 * TEKSHIRUV natijasi — `@google/genai` SDK'sining o'zi (node_modules/
 * @google/genai/dist/node/index.cjs, `BaseApiClient` klassi) HAR BIR
 * so'rov uchun ALLAQACHON standart bo'yicha ISHLAYDIGAN qayta urinish
 * (retry) + eksponensial kutish (exponential backoff) mexanizmiga ega:
 *   - `maxRetries` standart qiymati — 2 (ya'ni 3 ta jami urinish);
 *   - Qayta urinadigan holatlar: tarmoq xatosi/vaqt tugashi (timeout),
 *     HTTP 408 (so'rov vaqti tugashi), 409 (band/lock), 429 (limitdan
 *     oshish), va BARCHA 5xx (server xatolari);
 *   - Kutish vaqti — eksponensial (`0.5s * 2^urinish`, 8s'gacha
 *     chegaralangan) + tasodifiy "jitter" (ko'p mijoz bir vaqtda qayta
 *     urinib, yana to'qnashib qolmasligi uchun).
 * Ushbu loyihaning HECH BIR fayli bu standart sozlamani ustidan
 * yozmagan (`retryOptions`/`httpOptions`/`maxRetries` hech qayerda
 * berilmagan) — demak, HAR BIR Gemini chaqiruvi ALLAQACHON shu himoyaga
 * ega.
 *
 * SHUNING UCHUN: bu yerga qo'lda yozilgan, QO'SHIMCHA retry/backoff
 * mantiqi ATAYLAB QO'SHILMADI — bu SDK darajasidagi mexanizm ustiga
 * yana bir qatlam qo'yib, kutilmagan (masalan 3x3=9 marta qayta urinish)
 * xatti-harakatga olib kelishi mumkin edi, real foyda bermasdan. Bu
 * fayl faqat BITTA haqiqiy, kichik yaxshilanishni qo'shadi: barcha
 * mijoz yaratish chaqiruvlarini BITTA joyga jamlash (DRY) — kelajakda
 * chindan ham sozlash kerak bo'lsa (masalan `maxRetries`ni oshirish),
 * buni FAQAT shu bitta faylda qilish kifoya, 8 ta faylni emas.
 */
function createGeminiClient(apiKey) {
  return new GoogleGenAI({ apiKey });
}

module.exports = { createGeminiClient };
