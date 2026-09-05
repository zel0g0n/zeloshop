import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi tomonidan kuryerlarni boshqarish — "Kuryerlar" sahifasi
 * (`CourierManagementPage.jsx`) va `OrderCard.jsx`dagi "Kuryerga
 * topshirish" oqimi shu wrapper funksiyalarni ishlatadi.
 */

export const createCourierInvite = async (name, phone) => {
  const fn = httpsCallable(functions, "createCourierInvite");
  const { data } = await fn({ name, phone });
  return data; // { inviteLink, token }
};

export const setCourierActive = async (courierId, active) => {
  const fn = httpsCallable(functions, "setCourierActive");
  const { data } = await fn({ courierId, active });
  return data;
};

export const removeCourier = async (courierId) => {
  const fn = httpsCallable(functions, "removeCourier");
  const { data } = await fn({ courierId });
  return data;
};

/**
 * YANGI — kuryer Mini App'ining "Profil" bo'limi: kuryer O'ZINING
 * ism/telefon raqamini yangilaydi (`removeCourier`dan farqli
 * o'laroq, `courierId` yubormaymiz — backend har doim
 * `request.auth.uid`dan foydalanadi, shuning uchun kuryer FAQAT
 * o'zining profilini o'zgartira oladi).
 */
export const updateCourierProfile = async (name, phone) => {
  const fn = httpsCallable(functions, "updateCourierProfile");
  const { data } = await fn({ name, phone });
  return data;
};

export const assignOrderToCourier = async (orderId, courierId) => {
  const fn = httpsCallable(functions, "assignOrderToCourier");
  const { data } = await fn({ orderId, courierId });
  return data;
};

/**
 * Sotuvchi tomonidan "Kuzatuv havolasini qayta yuborish" tugmasi —
 * ASOSIY yo'l (kuryer "Boshladim" bosganda) AVTOMATIK ishlaydi
 * (`functions/couriers.js`), bu FAQAT zaxira/qo'lda qayta yuborish
 * uchun.
 */
export const resendTrackingLink = async (orderId) => {
  const fn = httpsCallable(functions, "resendCourierTrackingLink");
  const { data } = await fn({ orderId });
  return data;
};
