import { buildDeepLink } from "./shareLink";
import { buildProductShareText } from "./productShareText";

// FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI (v38): Storage bucket'ning
// CORS sozlamasi (`cors.json`) hali HAQIQIY loyihada ishga
// tushirilmagan - shuning uchun sotuvchi rasm bilan ulashish
// tugmasini VAQTINCHA, BUTUNLAY yashirishni so'radi (ichki fallback
// - CORS bo'lmasa ham matn+havola bilan ishlashi - baribir, ammo
// sotuvchi hozircha tugmaning o'zini ko'rsatishni xohlamadi). Kodning
// o'zi O'CHIRILMAGAN - `ProductCard.jsx`/`ProductGallery.jsx` shu
// flagga qarab tugmani render qiladi. CORS sozlangach, shuni
// `true`ga qaytaring.
export const PRODUCT_SHARE_BUTTON_ENABLED = false;

/**
 * Mahsulotni "POST" KO'RINISHIDA ulashadi.
 *
 * FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI: oldin `ProductCard.jsx`/
 * `ProductGallery.jsx`dagi ulashish tugmasi faqat MATN+HAVOLA
 * yuborardi (`navigator.share({text, url})`) - rasm hech qachon
 * qo'shilmasdi. Foydalanuvchi buni AI CEO'ning KANALGA avtomatik
 * post qilish tajribasi bilan solishtirdi (`productAutomation.js`dagi
 * `postToConnectedChannel` - u yerda rasm+matn BIRGA, Telegram'ning
 * `sendPhoto`+caption orqali, HAQIQIY "post" ko'rinishida yuboriladi)
 * va xaridor ulashganda ham AYNAN SHU ko'rinish (rasm+matn) bo'lishini
 * so'radi.
 *
 * NEGA BUTUNLAY BOSHQA MEXANIZM ISHLATILADI (backend `sendPhoto`
 * EMAS): kanalga post qilish - backendda, bot TOKENI orqali, bitta
 * ma'lum manzilga (kanal) yuboriladi. Bu yerda esa MIJOZ o'z
 * qurilmasidagi ISTALGAN ilovaga (Telegram, Instagram, SMS va h.k.,
 * u TANLAYDI) ulashadi - bu, backend emas, FAQAT brauzer/qurilma
 * darajasidagi Web Share API (`navigator.share`) orqali mumkin.
 * Web Share API'ning 2-darajasi FAYL (demak - RASM) ulashishni ham
 * qo'llab-quvvatlaydi (`files` maydoni + `navigator.canShare`) -
 * shuning uchun rasmni FAYL sifatida ham qo'shishga urinib ko'ramiz,
 * bu esa qabul qiluvchi tomonda (masalan, Telegram tanlansa) matn
 * bilan BIRGA HAQIQIY rasm sifatida keladi - AYNAN "post"
 * ko'rinishi.
 *
 * XAVFSIZLIK/MOSLIK (nozik joy, ATAYLAB shunday qurilgan):
 * 1) Rasm avval FETCH qilinadi (`Blob`ga aylantirish uchun) - bu,
 *    Storage bucket CORS sozlamasiga bog'liq (loyihaning oldingi
 *    tajribasi: AI mahsulot tavsifi ham xuddi shunday `fetch(url)`
 *    qiladi, `cors.json` shu sabab bilan qo'shilgan). Agar bu
 *    muvaffaqiyatsiz bo'lsa (tarmoq/CORS/eskirgan qurilma) - JIM
 *    qolib, rasmsiz (faqat matn+havola) ulashishga o'tamiz.
 * 2) `navigator.share()` ANIQ BIR MARTA chaqiriladi (fayl bilan
 *    YOKI fayl bilan emas - ikkalasi emas) - shu orqali, agar
 *    foydalanuvchi ochilgan ulashish oynasini bekor qilsa, IKKINCHI
 *    marta oyna qayta ochilib ketmaydi (yomon UX bo'lardi).
 * 3) `files` bilan birga `url`ni ALOHIDA maydon sifatida EMAS,
 *    matnning ICHIGA qo'shamiz - ba'zi brauzer/ilovalar `files`+`url`
 *    birgalikda berilganda notinch xatti-harakat qilishi mumkin,
 *    matn ichida bo'lsa havola HAR DOIM saqlanib qoladi.
 */
export async function shareProductAsPost(product, sellerId) {
  const productLink = buildDeepLink(sellerId, `/product/${product?.id}`);
  const shareText = buildProductShareText(product);
  const name = product?.name || product?.title || "";
  const imageUrl = product?.image || null;

  if (!navigator.share) {
    // Zaxira: Telegram'ning o'z ulashish oynasi - bu YO'L orqali
    // rasm biriktirib bo'lmaydi (URL asosidagi mexanizm), faqat
    // matn+havola.
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(productLink)}&text=${encodeURIComponent(shareText)}`;
    window.open(shareUrl, "_blank");
    return;
  }

  // Rasmni FAYL sifatida tayyorlashga urinib ko'ramiz - faqat
  // TAYYORLAYMIZ, hali `navigator.share()`ni CHAQIRMAYMIZ (pastda,
  // FAQAT BIR MARTA chaqiriladi).
  let imageFile = null;
  if (imageUrl && navigator.canShare) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const extension = (blob.type && blob.type.split("/")[1]) || "jpg";
      const candidate = new File([blob], `mahsulot.${extension}`, { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files: [candidate] })) {
        imageFile = candidate;
      }
    } catch {
      // Rasmni olib bo'lmadi (tarmoq/CORS) - rasmsiz davom etamiz.
    }
  }

  try {
    if (imageFile) {
      await navigator.share({ title: name, text: `${shareText}\n${productLink}`, files: [imageFile] });
    } else {
      await navigator.share({ title: name, text: shareText, url: productLink });
    }
  } catch {
    // Foydalanuvchi bekor qilgan yoki qurilma rad etdi - jim
    // qolamiz (qayta urinib ko'rmaymiz).
  }
}
