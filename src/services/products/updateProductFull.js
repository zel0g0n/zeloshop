import { db } from "@/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Mahsulotning BARCHA maydonlarini yangilaydi (avvalgi `updateProduct.js`
 * faqat narx/stok uchun edi — bu esa to'liq tahrirlash sahifasi uchun).
 *
 * ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
 * muammoni yechish bo'limi): agar `productData.lastStockChangeReason`
 * berilgan bo'lsa (`EditProductPage.jsx`/`StaffProductForm.jsx`
 * `stock` HAQIQATAN o'zgarganda buni majburiy qiladi), shu maydon +
 * ixtiyoriy `lastStockChangeNote`/`lastStockChangeByStaffId`/
 * `lastStockChangeByStaffName` HAM mahsulot hujjatiga yoziladi -
 * `firestore.rules` buni stock o'zgarganda TALAB qiladi, va
 * `functions/lib/stockAuditLog.js`dagi trigger shu maydonlarni o'qib,
 * `sellers/{id}/stockAuditLog`ga haqiqiy audit-yozuv qo'shadi.
 */
const updateProductFull = async (productId, productData) => {
  if (!productId) throw new Error("Mahsulot ID topilmadi.");

  const images = Array.isArray(productData.images) ? productData.images.filter(Boolean).slice(0, 4) : [];

  // 15-NICHE UNIVERSAL PLATFORMA - batafsil izoh: `addProduct.js`.
  const attributes = {};
  if (productData.attributes && typeof productData.attributes === "object") {
    Object.entries(productData.attributes).forEach(([key, value]) => {
      if (value !== "" && value != null) attributes[key] = value;
    });
  }

  const updateData = {
    name: productData.title || "",
    category: productData.category || "Boshqa",
    price: Number(productData.price) || 0,
    discountPrice: productData.discountPrice != null ? Number(productData.discountPrice) : null,
    // `paymentTypes` endi mahsulot darajasida SAQLANMAYDI - to'lov
    // turi butun do'kon uchun `sellers/{id}.paymentTypes`da (2026-09
    // punkt-royxati) markazlashtirilgan. Batafsili: `addProduct.js`.
    stock: Number(productData.stock) || 0,
    description: productData.description || "",
    variants: productData.variants || [],
    attributes,
    images,
    image: images[0] || null,
    updatedAt: new Date().toISOString(),
  };

  // KORPORATIV RBAC (2026-09): `costPrice` FAQAT haqiqatan
  // `productData`da berilgan bo'lsa yoziladi. Buni SHART qiladigan
  // sabab — `StaffProductForm.jsx` `viewFinance` huquqi bo'lmagan
  // xodim uchun bu maydonni payload'dan ATAYLAB olib tashlaydi (chunki
  // xodim uni ko'rmaydi ham); agar shu yerda "berilmagansa 0" degan
  // eski qoida qolganida, HAR safar shunday xodim boshqa maydonni
  // (masalan, nom yoki stok) tahrirlaganida mavjud mahsulotning
  // HAQIQIY tannarxi jimgina 0ga tushib qolar edi.
  if (productData.costPrice !== undefined) {
    updateData.costPrice = Number(productData.costPrice) || 0;
  }

  // Faqat HAQIQATAN berilgan bo'lsa qo'shiladi - `firestore.rules`
  // `stock` o'zgarmagan yozuvlarda bu maydonni UMUMAN talab qilmaydi,
  // shuning uchun bo'sh/undefined qiymat bilan hujjatni shishirmaymiz.
  if (productData.lastStockChangeReason) {
    updateData.lastStockChangeReason = productData.lastStockChangeReason;
    updateData.lastStockChangeNote = productData.lastStockChangeNote?.trim() || null;
    if (productData.lastStockChangeByStaffId) {
      updateData.lastStockChangeByStaffId = productData.lastStockChangeByStaffId;
      updateData.lastStockChangeByStaffName = productData.lastStockChangeByStaffName || null;
    }
  }

  try {
    await updateDoc(doc(db, "products", productId), updateData);
    return { id: productId, ...updateData };
  } catch (error) {
    throw new Error(error.message || "Mahsulotni yangilashda xatolik yuz berdi", { cause: error });
  }
};

export default updateProductFull;
