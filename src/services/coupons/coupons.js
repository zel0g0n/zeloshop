import { db } from "@/firebase/config";
import { doc, setDoc, deleteDoc, getDoc, collection, query, orderBy, serverTimestamp } from "firebase/firestore";

/**
 * Promokodlar — "sellers/{sellerId}/coupons/{CODE}" quyi
 * kolleksiyasida saqlanadi. Kodning o'zi hujjat ID sifatida
 * ishlatiladi — bu checkout paytida bitta so'rov bilan tez
 * qidirish imkonini beradi.
 */
export const createCoupon = async (sellerId, { code, discountType, discountValue, expiresAt, usageLimit }) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) throw new Error("Promokod kiritilishi shart.");
  if (!discountValue || Number(discountValue) <= 0) throw new Error("Chegirma qiymati to'g'ri kiritilishi shart.");

  try {
    const ref = doc(db, "sellers", sellerId, "coupons", normalizedCode);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      throw new Error("Bu promokod allaqachon mavjud.");
    }
    await setDoc(ref, {
      code: normalizedCode,
      discountType: discountType === "fixed" ? "fixed" : "percent", // "percent" | "fixed"
      discountValue: Number(discountValue),
      expiresAt: expiresAt || null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usedCount: 0,
      isActive: true,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });
  } catch (error) {
    throw new Error(error.message || "Promokod yaratishda xatolik yuz berdi", { cause: error });
  }
};

export const deleteCoupon = async (sellerId, code) => {
  if (!sellerId || !code) throw new Error("Ma'lumot yetarli emas.");
  try {
    await deleteDoc(doc(db, "sellers", sellerId, "coupons", code));
  } catch (error) {
    throw new Error(error.message || "Promokodni o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export const couponsQuery = (sellerId) =>
  query(collection(db, "sellers", sellerId, "coupons"), orderBy("createdAtMs", "desc"));

/**
 * Mijoz checkout'da kodni kiritganda — mavjudligi, faolligi,
 * muddati va limitini tekshiradi.
 */
export const validateCoupon = async (sellerId, code) => {
  if (!sellerId || !code) return { valid: false, error: "Promokod kiritilmadi." };
  const normalizedCode = code.trim().toUpperCase();

  try {
    const snap = await getDoc(doc(db, "sellers", sellerId, "coupons", normalizedCode));
    if (!snap.exists()) {
      return { valid: false, error: "Bunday promokod topilmadi." };
    }
    const coupon = snap.data();

    if (!coupon.isActive) {
      return { valid: false, error: "Bu promokod faol emas." };
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: "Bu promokodning muddati tugagan." };
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, error: "Bu promokodning ishlatish limiti tugagan." };
    }

    return { valid: true, coupon };
  } catch (error) {
    return { valid: false, error: "Promokodni tekshirishda xatolik yuz berdi." };
  }
};
