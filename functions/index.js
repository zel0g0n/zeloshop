// KIRISH NUQTASI — bu fayl endi faqat boshqa modullardan Cloud
// Function'larni qayta eksport qiladi. OLDIN bu yerda 800+ qatorli
// KOD bo'lardi — hammasi bitta faylda, aralash holda. Endi har bir
// modul o'z, aniq mas'uliyat sohasiga ega:
//
//   lib/admin.js        — Firebase Admin ishga tushirish, secret'lar
//   lib/helpers.js       — umumiy yordamchi funksiyalar
//   telegramAuth.js       — Telegram initData imzosini tekshirish (HMAC)
//   auth.js                — autentifikatsiya + Dashboard "Bugun" statistikasi
//   orders.js               — xavfsiz buyurtma yaratish (narx/promokod server tomonida)
//   products.js               — AI mahsulot tavsifi
//   notifications.js           — CRM push, avtomatik xabarlar, kunlik hisobot
module.exports = {
  ...require("./auth"),
  ...require("./orders"),
  ...require("./products"),
  ...require("./notifications"),
  ...require("./customBot"),
  ...require("./analytics"),
  ...require("./reviews"),
  ...require("./delivery"),
  ...require("./carts"),
  ...require("./aiCeo"),
  ...require("./productDrafts"),
  ...require("./analyticsData"),
  ...require("./channelPosting"),
  ...require("./productAutomation"),
  ...require("./engagementReminders"),
  ...require("./orderRollups"),
  ...require("./telegramApproval"),
  ...require("./aiCeoAgent"),
  ...require("./aiCeoLearning"),
  ...require("./couriers"),
  ...require("./courierBot"),
  ...require("./courierAuth"),
  ...require("./sellerReferrals"),
  ...require("./productRecommendations"),
  ...require("./productAssistant"),
  ...require("./staff"),
  ...require("./staffBot"),
  ...require("./staffAuth"),
  ...require("./adminSellerManagement"),
  ...require("./paymentCardInfo"),
  ...require("./orderStatusNotify"),
  ...require("./loyalty"),
  ...require("./clientReferrals"),
  ...require("./referralLeaderboardBonus"),
  ...require("./birthdayRewards"),
  ...require("./nicheMigration"),
  ...require("./installments"),
  ...require("./storyImage"),
  ...require("./pricingSuggestions"),
  ...require("./managerAlerts"),
  ...require("./tariffs"),
  ...require("./coupons"),
  ...require("./notificationRetryWorker"),
  ...require("./webhookMaintenance"),
  ...require("./atmosProxyTest"),
  ...require("./automationRules"),
  ...require("./customerIntelligence"),
};
