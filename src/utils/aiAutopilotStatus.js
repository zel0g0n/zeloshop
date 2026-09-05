/**
 * "AI Sales Autopilot" (ZeloShop TOP 15, #14) - sotuvchiga BITTA joyda,
 * avtomatik ishlaydigan BARCHA funksiyalarning HOLATINI (yoqilgan/
 * o'chirilgan) ko'rsatish uchun sof funksiya.
 *
 * MUHIM: bu YANGI avtomatlashtirish YARATMAYDI. Har bir funksiya
 * ALLAQACHON mavjud va ishlaydi (`carts.js`, `engagementReminders.js`,
 * `notifications.js`, `aiCeo.js`, `telegramApproval.js`) - lekin
 * ularning yoqish/o'chirish tugmalari turli sahifalarga TARQALGAN edi
 * (ba'zilari `MarketingCoupons.jsx`da, ba'zilari `AiCeoInfoPage.jsx`ning
 * "Kengaytirilgan sozlamalar" bo'limida, `notifyDailyReport` esa
 * HECH QAYERDA sozlanmasdi). Bu funksiya faqat ularni BITTA ro'yxatga
 * yig'ib, sotuvchiga "AI hozir men uchun nima qilmoqda?" savoliga bir
 * qarashda javob beradi.
 *
 * `basicTier` — har doim mavjud (Pro/AI CEO talab qilmaydi), standart
 * holatda YOQILGAN (`!== false` - maydon YOZILMAGAN bo'lsa ham ON,
 * chunki backend xuddi shunday talqin qiladi).
 * `aiTier` — AI CEO (Pro) talab qiladi, standart holatda O'CHIRILGAN
 * (opt-in). `aiCeoEnabled` yolg'on bo'lsa - hammasi "locked" (sotib
 * olinmagan), holat ko'rsatilsa ham, o'zgartirib bo'lmaydi.
 */
export function computeAutopilotStatus(seller) {
  const s = seller || {};
  const aiCeoEnabled = s.aiCeoEnabled === true;

  const basicTier = [
    { key: "cartReminder", active: s.cartReminderEnabled !== false, field: "cartReminderEnabled" },
    { key: "favoriteReminder", active: s.favoriteReminderEnabled !== false, field: "favoriteReminderEnabled" },
    { key: "repurchaseReminder", active: s.repurchaseReminderEnabled !== false, field: "repurchaseReminderEnabled" },
    { key: "dailyReport", active: s.notifyDailyReport !== false, field: "notifyDailyReport" },
  ];

  const aiTier = [
    { key: "aiFavoriteText", active: aiCeoEnabled && s.aiCeoAutoFavoriteEnabled === true, locked: !aiCeoEnabled },
    { key: "aiWinBackText", active: aiCeoEnabled && s.aiCeoAutoWinBackEnabled === true, locked: !aiCeoEnabled },
    // Bog'liqlik: avtomatik chegirma FAQAT win-back matni yoqilgan
    // bo'lsagina ma'noga ega (`aiCeoAutoDiscount.js`dagi haqiqiy
    // shart bilan bir xil - `engagementReminders.js`).
    { key: "aiAutoDiscount", active: aiCeoEnabled && s.aiCeoAutoWinBackEnabled === true && s.aiCeoAutoDiscountEnabled === true, locked: !aiCeoEnabled },
    { key: "telegramApproval", active: aiCeoEnabled && s.aiCeoTelegramApprovalEnabled === true, locked: !aiCeoEnabled },
  ];

  const allAutomations = [...basicTier, ...aiTier];
  const activeCount = allAutomations.filter((a) => a.active).length;

  return { basicTier, aiTier, activeCount, totalCount: allAutomations.length, aiCeoEnabled };
}
