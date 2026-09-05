import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

/**
 * Mahsulotlar Analitikasi sahifasida hisoblangan (allaqachon
 * xotirada mavjud) o'lik/tez tugayotgan mahsulot ro'yxatlarini AI
 * sharhiga aylantiradi. FAQAT AI CEO premium mijozlari uchun.
 */
export const generateAnalyticsInsight = async ({ deadStockNames, lowStockNames, topProductName, totalRevenue }) => {
  const callable = httpsCallable(functions, "generateAnalyticsInsight");
  const { data } = await callable({ deadStockNames, lowStockNames, topProductName, totalRevenue });
  return data.insight;
};

/**
 * "Uxlab qolgan" mijoz uchun qaytarish xabari qoralamasini yaratadi.
 * FAQAT AI CEO premium mijozlari uchun.
 */
export const generateWinBackMessage = async ({ customerName, daysSinceLastOrder, lastProductName, storeName }) => {
  const callable = httpsCallable(functions, "generateWinBackMessage");
  const { data } = await callable({ customerName, daysSinceLastOrder, lastProductName, storeName });
  return data.message;
};

/**
 * AI CEO'ning KUNLIK HISOBOTINI so'raydi (moliyaviy qisqa hisobot,
 * mahsulot tavsiyalari, CRM faoliyati, mahsulot qo'shish statistikasi)
 * - hammasi HAQIQIY, bugungi ma'lumotdan. FAQAT AI CEO premium
 * mijozlari uchun.
 */
export const generateDailyAiCeoReport = async () => {
  const callable = httpsCallable(functions, "generateDailyAiCeoReport");
  const { data } = await callable();
  return data;
};

/**
 * AI CEO — 2-BOSQICH: tanlangan CRM segment (VIP yoki "uxlab qolgan")
 * uchun to'liq TAYYOR kampaniya matnini (sarlavha + xabar + nega bu
 * taktika samarali) yaratadi. MUHIM: bu funksiya HECH NARSA
 * YUBORMAYDI - natija `CrmHub.jsx`ning MAVJUD xabar yuborish
 * formasiga joylanadi, sotuvchi ko'rib chiqib, o'zi "Yuborish"ni
 * bosadi. FAQAT AI CEO premium mijozlari uchun.
 */
export const generateCrmCampaign = async ({ segment, segmentCount, storeName, topProductName }) => {
  const callable = httpsCallable(functions, "generateCrmCampaign");
  const { data } = await callable({ segment, segmentCount, storeName, topProductName });
  return data;
};

/**
 * AI CEO — 6-BOSQICH: "AI CEO'dan so'rang" - sotuvchi erkin matnda
 * savol beradi (masalan "bu hafta eng ko'p nima sotildi?"), backend
 * (`functions/aiCeoAgent.js`) esa Gemini'ga HAQIQIY, chaqiriladigan
 * vositalar (tools) berib, Gemini O'ZI qaysi ma'lumot kerakligini hal
 * qiladi va shu asosida javob beradi - oldindan tayyorlangan qat'iy
 * shablon EMAS. Barcha vositalar FAQAT O'QISH (read-only), shuning
 * uchun bu funksiya hech qanday tasdiqlashni talab qilmaydi. FAQAT AI
 * CEO premium mijozlari uchun.
 */
export const askAiCeo = async (question) => {
  const callable = httpsCallable(functions, "askAiCeo");
  const { data } = await callable({ question });
  return data;
};

/**
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12) — sotuvchi, birlashtirilgan
 * bildirishnomalar oqimidan (`InboxPage.jsx`) turib, kutilayotgan AI CEO
 * harakatini (`sellers/{id}/aiCeoPendingActions`) TASDIQLAYDI yoki RAD
 * ETADI. Backend (`functions/telegramApproval.js`ning
 * `resolvePendingAction`i) — Telegram bot tugmasi orqali bajariladigan
 * BILAN AYNAN BIR XIL mantiq, faqat boshqa kirish nuqtasi.
 */
export const respondToAiCeoPendingAction = async (actionId, approve) => {
  const callable = httpsCallable(functions, "respondToAiCeoPendingAction");
  const { data } = await callable({ actionId, approve });
  return data;
};
