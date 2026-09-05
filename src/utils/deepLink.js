/**
 * ILOVA ICHKI YO'LLARINI (masalan "/category/Skincare") Telegram
 * `start_param`ga JOYLASHTIRISH uchun kodlash/dekodlash.
 *
 * MUHIM: Telegram `start_param` FAQAT harf/raqam/pastki chiziq/tire
 * qabul qiladi (boshqa belgilar, jumladan oddiy base64'dagi "+"/"/"
 * RAD ETILADI). Shuning uchun BASE64URL (URL-xavfsiz variant)
 * ishlatiladi - bu, `functions/lib/helpers.js`dagi
 * `decodeDeepLinkPath` bilan BIR XIL kodlash bo'lishi SHART.
 */
export const encodeDeepLinkPath = (path) => {
  if (!path) return "";
  const base64 = btoa(unescape(encodeURIComponent(path)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
