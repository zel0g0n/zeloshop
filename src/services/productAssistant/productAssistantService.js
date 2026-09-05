import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * "AI Mahsulot Yordamchisi" (ZeloShop TOP 15, #15) — mahsulot
 * sahifasida xaridor erkin savol beradi. Backend (`functions/
 * productAssistant.js`) FAQAT sotuvchi kiritgan mahsulot matnidan
 * javob beradi va sog'liq/tibbiy savollarni rad etadi
 * (`{ refused: true, refusalReason: "medical" }`) — bu holatni
 * chaqiruvchi (`ProductAssistant.jsx`) alohida, o'zining tarjima
 * qilingan xabari bilan ko'rsatadi (backend xabari faqat o'zbekcha
 * bo'lgani uchun, xaridorning tanlagan tiliga mos bo'lishi uchun).
 *
 * @param {string} productId
 * @param {string} question
 * @param {"uz"|"ru"|"en"} language
 * @returns {Promise<{answer: string|null, refused: boolean, refusalReason?: string}>}
 */
export const askProductQuestion = async (productId, question, language) => {
  const callable = httpsCallable(functions, "askProductQuestion");
  const { data } = await callable({ productId, question, language });
  return data;
};
