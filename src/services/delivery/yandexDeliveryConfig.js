import { db } from "@/firebase/config";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// Yandex Delivery OAuth tokeni — bu, sotuvchining shaxsiy hisobiga
// kirish huquqini beradigan MAXFIY ma'lumot, shuning uchun (Click/Payme
// kabi) `sellers/{id}/private/yandexDelivery` quyi hujjatida saqlanadi
// — faqat sotuvchining o'zi (yoki admin) o'qiy/yoza oladi.
const PATH = (sellerId) => doc(db, "sellers", sellerId, "private", "yandexDelivery");

export const getYandexDeliveryConfig = async (sellerId) => {
  if (!sellerId) return null;
  try {
    const snap = await getDoc(PATH(sellerId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    throw new Error(error.message || "Yandex Delivery sozlamalarini yuklashda xatolik", { cause: error });
  }
};

export const saveYandexDeliveryConfig = async (sellerId, config) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  const isEnabled = Boolean(config.enabled && config.oauthToken && config.pickupLat && config.pickupLng);
  try {
    await setDoc(
      PATH(sellerId),
      {
        oauthToken: config.oauthToken || null,
        pickupAddress: config.pickupAddress || null,
        pickupLat: config.pickupLat ?? null,
        pickupLng: config.pickupLng ?? null,
        enabled: isEnabled,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    // MUHIM: haqiqiy token — HECH QACHON ommaviy hujjatga yozilmaydi.
    // Faqat "yoqilgan-yoqilmagan" bayrog'ining o'zi — mijoz checkout
    // paytida Yandex Delivery variantini ko'rsatish kerakligini
    // bilishi uchun (maxfiy ma'lumotni o'qimasdan) ommaviy hujjatga
    // ko'chiriladi.
    await updateDoc(doc(db, "sellers", sellerId), { yandexDeliveryEnabled: isEnabled });
  } catch (error) {
    throw new Error(error.message || "Yandex Delivery sozlamalarini saqlashda xatolik", { cause: error });
  }
};
