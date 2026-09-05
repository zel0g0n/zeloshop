import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * CRM Hub'dagi "Broadcast" tugmasi — HAQIQIY Telegram xabarini
 * yuboradi (Cloud Function orqali, bot tokeni frontend'da hech
 * qachon ko'rinmaydi). Banner rasm, inline tugma va promokod —
 * barchasi ixtiyoriy.
 */
export const sendCrmNotification = async ({
  sellerId, targetClientIds, title, message, bannerImageUrl, buttonText, buttonUrl, couponCode,
}) => {
  const callable = httpsCallable(functions, "sendCrmNotification");
  const { data } = await callable({
    sellerId, targetClientIds, title, message, bannerImageUrl, buttonText, buttonUrl, couponCode,
  });
  return data;
};
