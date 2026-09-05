import { httpsCallable } from "firebase/functions";
import { collection } from "firebase/firestore";
import { db, functions } from "@/firebase/config";

/**
 * "AI narx tavsiyalari" — `firestore.rules`da `sellers/{id}/pricingSuggestions`
 * FAQAT O'QISH uchun ochiq (yozish har doim `false`, faqat Cloud
 * Function/Admin SDK yozadi — batafsil izoh: `functions/pricingSuggestions.js`).
 * Shuning uchun bu yerda faqat O'QISH uchun kolleksiya so'rovi (hook
 * `onSnapshot` bilan ishlatadi) va IKKITA onCall chaqiruv (qo'llash/
 * rad etish) bor — hech qanday to'g'ridan-to'g'ri Firestore YOZUVI YO'Q.
 */
export const sellerPricingSuggestionsCollection = (sellerId) =>
  collection(db, "sellers", sellerId, "pricingSuggestions");

/**
 * Sotuvchi bitta tavsiyani ko'rib chiqib, ANIQ tasdiqlaydi — server
 * mahsulotning HOZIRGI holatidan tavsiyani QAYTA tekshiradi
 * (`functions/pricingSuggestions.js`dagi `handleApplyPricingSuggestion`),
 * eskirgan bo'lsa xato qaytaradi.
 *
 * @returns {Promise<{appliedPrice: number}>}
 */
export const applyPricingSuggestion = async (productId) => {
  if (!productId) throw new Error("Mahsulot ID'si topilmadi.");
  const callable = httpsCallable(functions, "applyPricingSuggestion");
  const { data } = await callable({ productId });
  return data;
};

/**
 * Sotuvchi bitta tavsiyani rad etadi — mahsulotga hech qanday ta'sir
 * qilmaydi, faqat tavsiya ro'yxatdan olib tashlanadi.
 *
 * @returns {Promise<{ok: boolean}>}
 */
export const dismissPricingSuggestion = async (productId) => {
  if (!productId) throw new Error("Mahsulot ID'si topilmadi.");
  const callable = httpsCallable(functions, "dismissPricingSuggestion");
  const { data } = await callable({ productId });
  return data;
};
