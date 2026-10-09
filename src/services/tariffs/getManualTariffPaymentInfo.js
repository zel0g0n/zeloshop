import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * ZeloShop'ning "qo'lda tasdiqlash" (to'lov cheki) uchun karta
 * ma'lumotini o'qiydi (2026-09-25, batafsil izoh: `functions/manualTariffPayments.js`).
 * `settings/manualTariffPayment` — bitta GLOBAL, PII bo'lmagan hujjat
 * bo'lgani uchun to'g'ridan-to'g'ri Firestore SDK orqali o'qiladi
 * (`firestore.rules`dagi `allow read: if isSignedIn()` yetarli) —
 * Cloud Function shart emas. Admin panelidagi sozlash formasi
 * (`AdminManualTariffPaymentsPage.jsx`) HAM shu funksiyani ishlatadi.
 *
 * MUHIM: `enabled` bu yerda hujjatda saqlangan XOM (raw) qiymat —
 * admin sozlash formasi (`AdminManualTariffPaymentsPage.jsx`) aynan
 * shu holatni tumblerda ko'rsatishi kerak. Sotuvchiga tugmani
 * ko'rsatish-ko'rsatmaslikni hal qiluvchi kod (`TariffsSection.jsx`)
 * ESA `enabled && cardNumber && cardHolderName` uchtasini BIRGA
 * tekshiradi — hujjat umuman yo'q yoki karta ma'lumoti to'liq
 * bo'lmagan holatda tugma yashirin qolishi uchun.
 *
 * @returns {Promise<{enabled: boolean, cardNumber: string|null, cardHolderName: string|null}>}
 */
const getManualTariffPaymentInfo = async () => {
  try {
    const snap = await getDoc(doc(db, "settings", "manualTariffPayment"));
    if (!snap.exists()) {
      return { enabled: false, cardNumber: null, cardHolderName: null };
    }
    const data = snap.data();
    return {
      enabled: Boolean(data.enabled),
      cardNumber: data.cardNumber || null,
      cardHolderName: data.cardHolderName || null,
    };
  } catch (error) {
    throw new Error(error.message || "To'lov sozlamasini yuklashda xatolik", { cause: error });
  }
};

export default getManualTariffPaymentInfo;
