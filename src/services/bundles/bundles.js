import { db } from "@/firebase/config";
import { doc, setDoc, deleteDoc, collection, query, orderBy, where, serverTimestamp } from "firebase/firestore";

/**
 * Mahsulot bandllari ("combo takliflar") — `sellers/{sellerId}/bundles/{bundleId}`
 * quyi kolleksiyasida saqlanadi. Xuddi kupon xizmati (`services/coupons/coupons.js`)
 * bilan BIR XIL naqsh: sotuvchi to'g'ridan-to'g'ri Firestore'ga yozadi
 * (`firestore.rules` egasiga cheklaydi), YAKUNIY narx esa checkout
 * paytida serverda (`functions/orders.js`) qayta tekshiriladi.
 */
export const createBundle = async (sellerId, { name, productIds, bundlePrice }) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error("Combo nomi kiritilishi shart.");
  const ids = Array.isArray(productIds) ? [...new Set(productIds)] : [];
  if (ids.length < 2) throw new Error("Combo uchun kamida 2 ta mahsulot tanlang.");
  if (!bundlePrice || Number(bundlePrice) <= 0) throw new Error("Combo narxi to'g'ri kiritilishi shart.");

  try {
    const ref = doc(collection(db, "sellers", sellerId, "bundles"));
    await setDoc(ref, {
      name: trimmedName,
      productIds: ids,
      bundlePrice: Number(bundlePrice),
      isActive: true,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });
    return ref.id;
  } catch (error) {
    throw new Error(error.message || "Combo yaratishda xatolik yuz berdi", { cause: error });
  }
};

export const toggleBundleActive = async (sellerId, bundleId, isActive) => {
  if (!sellerId || !bundleId) throw new Error("Ma'lumot yetarli emas.");
  try {
    await setDoc(doc(db, "sellers", sellerId, "bundles", bundleId), { isActive }, { merge: true });
  } catch (error) {
    throw new Error(error.message || "Combo holatini o'zgartirishda xatolik", { cause: error });
  }
};

export const deleteBundle = async (sellerId, bundleId) => {
  if (!sellerId || !bundleId) throw new Error("Ma'lumot yetarli emas.");
  try {
    await deleteDoc(doc(db, "sellers", sellerId, "bundles", bundleId));
  } catch (error) {
    throw new Error(error.message || "Combo'ni o'chirishda xatolik yuz berdi", { cause: error });
  }
};

export const sellerBundlesQuery = (sellerId) =>
  query(collection(db, "sellers", sellerId, "bundles"), orderBy("createdAtMs", "desc"));

/**
 * Mahsulot detail sahifasida - shu MAHSULOT kiruvchi FAOL combo
 * takliflarni topish uchun.
 */
export const productBundlesQuery = (sellerId, productId) =>
  query(
    collection(db, "sellers", sellerId, "bundles"),
    where("productIds", "array-contains", productId),
    where("isActive", "==", true)
  );
