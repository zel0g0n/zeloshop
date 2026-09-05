import { db } from "@/firebase/config";
import { collection, addDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";

/**
 * "Tez qo'shish" - sotuvchi rasm(lar) + qisqa izoh bilan mahsulotni
 * NAVBATGA qo'yadi. TO'G'RIDAN-TO'G'RI Firestore'ga yoziladi (xuddi
 * `addProduct.js` kabi) - buning uchun Cloud Function shart emas,
 * chunki bu yerda ISHONCHSIZ (server tomonida tekshirilishi kerak
 * bo'lgan) hech qanday ma'lumot yo'q - narx yoki boshqa moliyaviy
 * qiymat kiritilmaydi.
 *
 * MUHIM: OLDIN faqat BITTA rasm (`imageUrl`) qo'llanardi - endi
 * `MultiImageUploadCard`ga mos, 4 tagacha rasm (`imageUrls`, massiv)
 * qabul qilinadi. Birinchi rasm - asosiy (`useProductImages`dagi
 * tartib bilan bir xil qoida).
 */
export const submitProductDraft = async (sellerId, { imageUrls, rawHint }) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const draftsRef = collection(db, "sellers", sellerId, "productDrafts");
  await addDoc(draftsRef, {
    imageUrls: Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [],
    rawHint: (rawHint || "").trim(),
    status: "queued",
    createdAt: serverTimestamp(),
  });
};

/**
 * Qoralamani rad etadi - hujjatni butunlay o'chiradi.
 */
export const rejectProductDraft = async (sellerId, draftId) => {
  await deleteDoc(doc(db, "sellers", sellerId, "productDrafts", draftId));
};

/**
 * Qoralama tasdiqlangandan keyin, endi HAQIQIY mahsulot sifatida
 * yaratilgani uchun, qoralama hujjati endi kerak emas - o'chiramiz.
 * (Haqiqiy mahsulotni yaratish - mavjud `addProduct()` xizmati
 * orqali, bu yerda emas - shu orqali ikkala yo'l - oddiy forma va
 * AI qoralamasi - BIR XIL, allaqachon tekshirilgan yaratish
 * mantig'idan o'tadi.)
 */
export const markDraftApproved = async (sellerId, draftId) => {
  await deleteDoc(doc(db, "sellers", sellerId, "productDrafts", draftId));
};
