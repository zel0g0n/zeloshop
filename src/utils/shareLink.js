import { BOT_USERNAME, APP_SHORT_NAME } from "@/config/telegram";

/**
 * Sotuvchining shaxsiy do'kon havolasini yasaydi.
 *
 * MUHIM: shakli t.me/BOT_USERNAME/APP_SHORT_NAME?startapp=qiymat
 * bo'lishi SHART. Faqat `t.me/BOT_USERNAME?startapp=...` (ilova
 * qisqa nomisiz) ishlatilganda, agar bot uchun BotFather'da `/newapp`
 * orqali rasmiy Mini App ro'yxatdan o'tkazilmagan bo'lsa, Telegram
 * `start_param`ni initData ichiga umuman qo'ymaydi — ilova ochiladi,
 * lekin qaysi sotuvchiga tegishli ekanini bilmay qoladi.
 */
export const buildShopLink = (sellerId) => {
  if (!sellerId) return "";
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}`;
};
