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

module.exports = { fetchTrustedImage, ALLOWED_IMAGE_HOSTS };
