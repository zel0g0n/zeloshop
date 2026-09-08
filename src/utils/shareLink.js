import { BOT_USERNAME, APP_SHORT_NAME } from "@/config/telegram";
import { encodeDeepLinkPath } from "@/utils/deepLink";

/**
 * Ulashiladigan (startapp'ga tayanadigan) havolalar doimo
 * platformaning o'z boti orqali quriladi, sotuvchining ulangan
 * shaxsiy boti (`customBotUsername`) orqali emas.
 *
 * Sabab: `t.me/{bot}/{app}?startapp=...` formati ishlashi uchun har
 * bir botda (nafaqat platformaning o'z botida) BotFather orqali
 * `/newapp` buyrug'i bilan xuddi shu qisqa nom ("shop") bilan alohida
 * ro'yxatdan o'tkazilgan Mini App bo'lishi shart. Bu — dasturiy yo'l
 * bilan (Bot API orqali) sozlab bo'lmaydigan, faqat bot egasi
 * tomonidan BotFather'da qo'lda bajariladigan amal; sotuvchining
 * shaxsiy botini ulash oqimi (`connectCustomBot`) buni talab
 * qilmaydi. Shuning uchun sotuvchining shaxsiy boti uchun "/shop"
 * yo'li mavjud bo'lishi kafolatlanmagan va bunday havola Telegram'da
 * "bot not found" xatosiga olib kelishi mumkin.
 *
 * Shu sababli `customBotUsername` bu yerda ishlatilmaydi. Sotuvchining
 * shaxsiy boti "Menyu" tugmasi orqali (`setChatMenuButton` —
 * ro'yxatdan o'tgan Mini App'ga emas, to'g'ridan-to'g'ri URL'ga ishora
 * qiladi, shuning uchun har qanday botda ishlaydi) hamon foydali —
 * lekin bu xaridor allaqachon o'sha bot bilan suhbat ochgan holatlar
 * uchun to'g'ri, hali suhbat ochmagan odamga havola ulashish uchun
 * emas.
 */
export const buildShopLink = (sellerId) => {
  if (!sellerId) return "";
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}`;
};

/**
 * Mijozning SHAXSIY "do'st taklif qilish" havolasini yasaydi.
 *
 * FORMAT: `buildShopLink`ning kengaytmasi - `startapp` qiymati
 * "{sellerId}_r{clientId}" ko'rinishida. Bu, `functions/lib/helpers.js`
 * dagi `parseStartParam()` bilan MOS bo'lishi SHART - ikkalasi ham
 * "_r" ajratkichini ishlatadi. sellerId va clientId - ikkalasi ham
 * Telegram foydalanuvchi ID'lari (faqat raqamlar), shuning uchun bu
 * ajratkich ular bilan hech qachon to'qnashmaydi.
 */
export const buildReferralLink = (sellerId, clientId) => {
  if (!sellerId || !clientId) return "";
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}_r${clientId}`;
};

/**
 * Do'kon ICHIDAGI ma'lum bir sahifaga (masalan bitta kategoriya)
 * to'g'ridan-to'g'ri ochiladigan havola yasaydi - CRM broadcast
 * xabarlari va bosh sahifa bannerlarida ishlatish uchun.
 *
 * FORMAT: `buildShopLink`ning kengaytmasi - `startapp` qiymati
 * "{sellerId}_p{base64url-kodlangan-yol}" ko'rinishida.
 */
export const buildDeepLink = (sellerId, path) => {
  if (!sellerId || !path) return "";
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}_p${encodeDeepLinkPath(path)}`;
};

/**
 * Sotuvchining "boshqa sotuvchini taklif qilish" havolasini yasaydi
 * (`functions/sellerReferrals.js`ga qarang - o'sish/mukofot dasturi).
 *
 * FORMAT: `buildShopLink`ning kengaytmasi - `startapp` qiymati
 * "{sellerId}_i" ko'rinishida. Bu — `buildReferralLink`dagi "_r"
 * (mijozlar uchun) formatidan ATAYLAB FARQ QILADI: bu havola "sotuvchi
 * X ning do'konini ko'rish" DEGANI EMAS, balki "yangi do'kon yaratishga
 * taklif" degani - `parseStartParam` (`functions/lib/helpers.js`) buni
 * shunga mos alohida ajratadi.
 */
export const buildSellerInviteLink = (sellerId) => {
  if (!sellerId) return "";
  return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=${sellerId}_i`;
};

/**
 * Sotuvchining O'Z (shaxsiy) boti orqali ochiladigan havola yasaydi
 * (2026-09, foydalanuvchi so'roviga ko'ra qo'shildi: "Sotib olish"/
 * "Ulashish" tugmasi ZeloShop umumiy boti EMAS, sellerning O'Z botiga
 * ochilishi kerak).
 *
 * `functions/lib/helpers.js`dagi backend `buildSellerBotDeepLink`
 * bilan BIR XIL formatda: `?startapp=` EMAS, oddiy `?start=` — chunki
 * sotuvchining shaxsiy boti BotFather'da Mini App sifatida qo'lda
 * ro'yxatdan o'tkazilmagan (`buildShopLink`dagi izohga qarang). Oddiy
 * `?start=` esa har qanday botda ishlaydi va xususiy chatni ochib,
 * `/start <payload>` yuboradi — bunga sotuvchining O'Z boti
 * (`customBotWebhook.js`) HAQIQIY Mini App tugmasi bilan javob beradi.
 *
 * `botUsername` berilmagan (sotuvchi shaxsiy bot ulamagan) bo'lsa
 * `null` qaytaradi — chaqiruvchi tomon bunda ZeloShop umumiy botiga
 * (`buildShopLink`/`buildDeepLink`) qaytishi kerak.
 */
export const buildSellerBotDeepLink = (botUsername, path) => {
  if (!botUsername) return null;
  const payload = path ? `p${encodeDeepLinkPath(path)}` : "";
  return payload ? `https://t.me/${botUsername}?start=${payload}` : `https://t.me/${botUsername}`;
};
