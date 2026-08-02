import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * CRM Hub'dagi "Yuborish" tugmasi — HAQIQIY Telegram xabarini
 * yuboradi (Cloud Function orqali, bot tokeni frontend'da hech
 * qachon ko'rinmaydi).
 */
export const sendCrmNotification = async ({ sellerId, targetClientIds, channel, title, message }) => {
  const callable = httpsCallable(functions, "sendCrmNotification");
  const { data } = await callable({ sellerId, targetClientIds, channel, title, message });
  return data;
};
