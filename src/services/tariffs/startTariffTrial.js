import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Sotuvchi "Keyingi tarifni 7 kun bepul sinash" tugmasini bosganda.
 * Batafsil izoh: `functions/tariffs.js`dagi `startTariffTrial`.
 * Har bir tarif faqat BIR MARTA sinalishi mumkin — xato bo'lsa,
 * server tomonidan qaytarilgan aniq sababni (`error.message`) ko'rsatish
 * kifoya.
 */
const startTariffTrial = async () => {
  const callable = httpsCallable(functions, "startTariffTrial");
  const { data } = await callable();
  return data; // { trialPlan, expiresAtMs }
};

export default startTariffTrial;
