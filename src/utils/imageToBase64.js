import { compressImage } from "@/utils/compress/compressImage";

/**
 * Berilgan rasmni (yangi tanlangan `File` yoki mavjud `url`) AI'ga
 * yuborish uchun kerakli ko'rinishga — base64 matn + mimeType —
 * aylantiradi.
 *
 * RASM RESIZE (2026-09 audit, "AI: rasm resize qo'shish"): mahsulot
 * rasmlarini Storage'ga YUKLASH oqimi (`useUploadStorage.jsx`)
 * allaqachon `compressImage` orqali (maks. 1000x1000, sifat 0.75)
 * siqadi — shuning uchun Storage'dagi (`product.image` va h.k.) va
 * backend orqali Gemini'ga yuboriladigan rasmlar (`productAutomation.js`,
 * `storyImage.js`, `productDrafts.js`) ALLAQACHON kichik hajmda.
 *
 * LEKIN bu funksiya — `generateProductDescription`/`generateSocialPost`
 * uchun ISHLATILADI — bu yerda rasm hali Storage'ga yuklanmagan bo'lishi
 * mumkin (foydalanuvchi hali "Saqlash"ni bosmagan, faqat AI'dan tavsif
 * so'ramoqda): ya'ni `image.file` — telefon kamerasidan to'g'ridan-to'g'ri
 * olingan, HALI SIQILMAGAN, ko'pincha bir necha MB hajmdagi asl fayl
 * bo'lishi mumkin. Buni siqilmagan holda yuborish (a) Gemini so'rovini
 * sekinlashtiradi va ko'proq token/xarajat talab qiladi, (b) Cloud
 * Function `onCall` so'rov hajmi chegarasiga yaqinlashtiradi. Shuning
 * uchun bu yerda ham, YUKLASH oqimi bilan BIR XIL (`compressImage`,
 * bir xil parametrlar — izchillik uchun) siqish qo'llanadi.
 *
 * Siqish muvaffaqiyatsiz bo'lsa (masalan noma'lum/qo'llab-
 * quvvatlanmaydigan format) — xatoni yutib, ASL faylni yuboramiz: resize
 * shunchaki optimallashtirish, uning ishlamasligi AI xususiyatini
 * BUTUNLAY to'xtatib qo'ymasligi kerak.
 *
 * MUHIM TUZATISH (2026-09, "Avto-to'ldirish ishlamayabdi / Failed to
 * fetch" xatoligi): rasm ALLAQACHON Storage'da bo'lsa (`image.url` bor,
 * `image.file` yo'q — mahsulotni TAHRIRLASH sahifasida bo'lgani kabi),
 * OLDIN bu yerda brauzerning O'ZI `fetch(image.url)` orqali Storage'dan
 * rasmni yuklab olardi. Bu Storage bucket CORS siyosatiga bog'liq edi
 * (`fetch()` CORS tekshiruvidan o'tadi, oddiy `<img>` tegi esa YO'Q —
 * shuning uchun rasm ekranda muammosiz ko'rinib turishi CORS
 * ishlayotganining DALILI EMAS). Agar bucket'ning CORS ro'yxati mos
 * kelmasa (yoki `cors.json` haqiqiy bucket'ga hali qo'llanilmagan
 * bo'lsa), brauzer so'rovni jim rad etadi va aynan sirli "Failed to
 * fetch" xatosini tashlaydi.
 *
 * YECHIM: bu holatda endi HECH QANDAY client-side `fetch()` qilinmaydi
 * — shunchaki `{ url }` qaytariladi, chaqiruvchi xizmat (`generateDescription.js`/
 * `generateSocialPost.js`) buni backend'ga yuboradi, backend esa
 * rasmni SERVERDAN SERVERGA (`functions/lib/safeFetch.js`dagi
 * `resolveImageBase64`/`fetchTrustedImage` orqali, CORS'ga UMUMAN
 * bog'liq emas) yuklab oladi.
 */
export const imageToBase64Payload = async (image) => {
  if (!image) return null;

  const readBlobAsBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader.result shakli: "data:image/jpeg;base64,AAAA..."
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const toResizedPayload = async (fileOrBlob, fallbackMimeType) => {
    try {
      const resized = await compressImage(fileOrBlob, { maxWidth: 1000, maxHeight: 1000, quality: 0.75 });
      const base64 = await readBlobAsBase64(resized);
      return { base64, mimeType: resized.type || fallbackMimeType };
    } catch {
      // Resize ixtiyoriy optimallashtirish — muvaffaqiyatsiz bo'lsa, asl
      // faylni (siqilmagan) yuboramiz, AI xususiyati baribir ishlaydi.
      const base64 = await readBlobAsBase64(fileOrBlob);
      return { base64, mimeType: fileOrBlob.type || fallbackMimeType };
    }
  };

  if (image.file) {
    return toResizedPayload(image.file, image.file.type || "image/jpeg");
  }

  if (image.url) {
    return { url: image.url };
  }

  return null;
};
