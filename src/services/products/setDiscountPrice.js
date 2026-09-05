import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Mahsulotga TO'G'RIDAN-TO'G'RI chegirma narxi qo'yadi/olib tashlaydi.
 *
 * MUHIM: `updateProductFull.js`dan FARQLI - bu funksiya FAQAT
 * `discountPrice`/`discountExpiresAt` maydonlarini o'zgartiradi
 * (qisman yangilash). Agar to'liq mahsulotni qayta yozadigan
 * funksiyadan foydalanilganda edi, "Aksiya yaratish" sahifasi
 * mahsulotning BOSHQA barcha maydonlarini (nom, tavsif, rasm va h.k.)
 * ham qayta yuklab, qayta yozishi kerak bo'lardi - keraksiz
 * murakkablik va tasodifan boshqa ma'lumotni "yo'qotib qo'yish" xavfi.
 *
 * "VAQTLI AKSIYA": `discountExpiresAt` (ISO satr, IXTIYORIY) - agar
 * berilsa, chegirma shu vaqtdan keyin ENDI ko'rsatilmaydi/qo'llanmaydi
 * (`utils/productPricing.js`dagi `isDiscountActive`, va HAQIQIY
 * to'lov uchun - `functions/orders.js` - ikkalasi ham shu maydonni
 * tekshiradi). `null`/berilmasa - chegirma MUDDATSIZ.
 */
const setDiscountPrice = async (productId, discountPrice, discountExpiresAt = null) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");
  try {
    await updateDoc(doc(db, "products", productId), {
      discountPrice: discountPrice != null ? Number(discountPrice) : null,
      discountExpiresAt: discountPrice != null ? (discountExpiresAt || null) : null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(error.message || "Chegirma narxini saqlashda xatolik yuz berdi", { cause: error });
  }
};

export default setDiscountPrice;
