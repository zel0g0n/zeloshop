import { db } from "@/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Click/Payme kabi to'lov tizimlari uchun HISOB MA'LUMOTLARI (masalan
// secret key) — bular boshqa hech kimga (mijozlarga, boshqa
// sotuvchilarga) ko'rinmasligi SHART. Shuning uchun bu ataylab asosiy
// `sellers/{id}` hujjatidan (u endi ommaviy o'qiladi) ALOHIDA,
// `sellers/{id}/private/paymentConfig` quyi hujjatida saqlanadi.
const PATH = (sellerId) => doc(db, "sellers", sellerId, "private", "paymentConfig");

export const getPaymentConfig = async (sellerId) => {
  if (!sellerId) return null;
  try {
    const snap = await getDoc(PATH(sellerId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    throw new Error(error.message || "To'lov sozlamalarini yuklashda xatolik", { cause: error });
  }
};

export const savePaymentConfig = async (sellerId, config) => {
  if (!sellerId) throw new Error("Sotuvchi ID topilmadi.");
  try {
    await setDoc(
      PATH(sellerId),
      {
        clickServiceId: config.clickServiceId || null,
        clickSecretKey: config.clickSecretKey || null,
        clickEnabled: Boolean(config.clickEnabled && config.clickServiceId && config.clickSecretKey),
        paymeMerchantId: config.paymeMerchantId || null,
        paymeKey: config.paymeKey || null,
        paymeEnabled: Boolean(config.paymeEnabled && config.paymeMerchantId && config.paymeKey),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    throw new Error(error.message || "To'lov sozlamalarini saqlashda xatolik", { cause: error });
  }
};
