import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Kuryer Mini App'ida amal tugmasi (Yo'lga chiqdim/Yetkazildi/Yetkaza
 * olmadim) bosilganda chaqiriladi. Backend'dagi (`functions/couriers.js`)
 * `applyCourierOrderAction` — bot inline tugmalari BILAN BIR XIL
 * asosiy mantiqni ishlatadi (kod duplikatsiyasi yo'q).
 */
export const updateCourierOrderStatus = async (orderId, action) => {
  const fn = httpsCallable(functions, "updateCourierOrderStatus");
  const { data } = await fn({ orderId, action });
  return data;
};

/**
 * Kuryer Mini App'i, "Jarayonda" bosqichida (faqat "picked_up"
 * holatidagi yetkazma uchun) brauzer joylashuvini bir necha soniyada
 * bir marta shu yerga yuboradi — jonli xarita (`LiveDeliveryMap.jsx`)
 * shu ma'lumotni ko'rsatadi, HAM kuryerning o'zida, HAM mijozning
 * kuzatuv sahifasida.
 */
export const updateCourierLocation = async (orderId, lat, lng) => {
  const fn = httpsCallable(functions, "updateCourierLocation");
  const { data } = await fn({ orderId, lat, lng });
  return data;
};
