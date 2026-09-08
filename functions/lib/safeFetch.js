/**
 * XAVFSIZLIK (2026-09 audit, P1 — SSRF): `storyImage.js`,
 * `productAutomation.js` va `productDrafts.js` AI'ga yuborish uchun
 * mahsulot rasmini `fetch(product.image)` orqali serverdan yuklab
 * olardi — `image`/`imageUrls` maydoni esa Firestore Security Rules
 * darajasida FAQAT `sellerId` egaligini tekshiradi, URL sxemasi/hosti
 * tekshirilmaydi (`firestore.rules`, `products/{id}`). Demak, HAR
 * QANDAY sotuvchi (yoki mahsulot qoralamasi orqali) bu maydonga
 * o'zboshimchalik bilan URL yozib, Cloud Function serverini o'zi
 * xohlagan manzilga (masalan GCP metadata serveri
 * `169.254.169.254`, ichki tarmoq xizmatlari, yoki `file://`) so'rov
 * yuborishga MAJBURLASHI mumkin edi (Server-Side Request Forgery).
 *
 * Yechim: haqiqiy mahsulot rasmlari FAQAT Firebase Storage'ning
 * `getDownloadURL()` natijasi bo'lib, doim shu ikki domendan biriga
 * ega bo'ladi (`src/services/storage/uploadStorage.js`) — shuning
 * uchun bu yerda IP-manzillarni qora ro'yxatga olish (fragile, DNS
 * orqali aylanib o'tish mumkin) o'rniga qat'iy DOMEN OQ RO'YXATI
 * (allowlist) qo'llaniladi: faqat shu ikki HTTPS domenidan kelgan
 * so'rovlar ruxsat etiladi, qolgani (ichki tarmoq, boshqa domenlar,
 * boshqa protokollar) darhol rad etiladi.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

/**
 * Berilgan URL ishonchli (Firebase Storage) manzilmi — tekshiradi va,
 * agar shunday bo'lsa, natijani (native `fetch` javobi) qaytaradi.
 * Aks holda — tarmoqqa HECH QANDAY so'rov yubormasdan — xato tashlaydi.
 *
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchTrustedImage(url) {
  if (!url || typeof url !== "string") {
    throw new Error("Rasm manzili ko'rsatilmagan.");
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Rasm manzili yaroqsiz (to'g'ri URL emas).");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Rasm manzili rad etildi: faqat HTTPS qo'llab-quvvatlanadi.");
  }
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    throw new Error("Rasm manzili rad etildi: faqat Firebase Storage domeniga ruxsat berilgan.");
  }

  return fetch(url);
}

/**
 * "AVTO-TO'LDIRISH ISHLAMAYABDI" XATOLIGI TUZATISHI (2026-09):
 * `generateProductDescription`/`generateSocialPost` avval FAQAT
 * mijoz (brauzer) tomonidan oldindan base64'ga aylantirilgan rasmni
 * qabul qilardi (`imageBase64`+`imageMimeType`). Mahsulotni
 * QO'SHISHDA bu muammosiz ishlaydi (rasm hali local `File`, brauzer
 * o'zi o'qiydi) — lekin mahsulotni TAHRIRLASHDA, rasm ALLAQACHON
 * Storage'da (`image.url` bor, `image.file` yo'q) bo'lganda, mijoz
 * `fetch(image.url)` orqali Storage'dan rasmni yuklab olishga
 * urinardi (`src/utils/imageToBase64.js`) — bu Storage bucket CORS
 * siyosatiga (`cors.json`, brauzerdan `fetch()` chaqirilganda talab
 * qilinadi, oddiy `<img>` tegida talab qilinmaydi) bog'liq edi va
 * ko'p hollarda tushunarsiz "Failed to fetch" xatosi bilan
 * muvaffaqiyatsiz tugardi — rasmning o'zi ekranda muammosiz
 * ko'rinib turishiga qaramasdan.
 *
 * YECHIM: endi mijoz bunday holatda faqat URL'ni yuboradi
 * (`imageUrl`), backend esa uni SERVERDAN SERVERGA (`fetchTrustedImage`
 * orqali, CORS'ga UMUMAN bog'liq emas) yuklab, base64'ga aylantiradi
 * — `productDrafts.js`/`productAutomation.js`/`storyImage.js`da
 * ALLAQACHON ishlatiladigan xavfsiz naqshning O'ZI.
 *
 * @param {{imageBase64?: string|null, imageMimeType?: string|null, imageUrl?: string|null}} params
 * @returns {Promise<{base64: string, mimeType: string}|null>}
 */
async function resolveImageBase64({ imageBase64, imageMimeType, imageUrl }) {
  if (imageBase64 && imageMimeType) {
    return { base64: imageBase64, mimeType: imageMimeType };
  }
  if (!imageUrl) return null;
  try {
    const res = await fetchTrustedImage(imageUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString("base64"), mimeType: res.headers.get("content-type") || "image/jpeg" };
  } catch (err) {
    // Rasm IXTIYORIY - URL yaroqsiz/yuklanmasa ham, AI so'rovi
    // faqat matn asosida davom etadi (butun xususiyat to'xtamaydi).
    console.error("Rasmni URL orqali yuklab olishda xatolik:", err);
    return null;
  }
}

module.exports = { fetchTrustedImage, ALLOWED_IMAGE_HOSTS, resolveImageBase64 };
