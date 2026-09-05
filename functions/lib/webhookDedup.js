const { db } = require("./admin");

/**
 * TELEGRAM WEBHOOK IDEMPOTENTLIGI (4-BOT EKOTIZIM AUDITI, P1).
 *
 * Telegram webhook yetkazish kafolati — "kamida bir marta" (at-least-once),
 * "ANIQ bir marta" EMAS: agar bizning `onRequest` funksiyamiz javob
 * qaytarishga ULGURMASA (tarmoq uzilishi, sovuq start, vaqtinchalik
 * yuklama), Telegram xuddi SHU yangilanishni (`update_id`) qayta
 * yuborishi mumkin. Uchala webhook'imiz ham (`telegramCallbackWebhook`,
 * `courierBotWebhook`, `staffBotWebhook`) doim HTTP 200 qaytaradi —
 * bu Telegram'ning o'zining qayta-urinish "bo'ronini" oldini oladi,
 * lekin "bitta callback_query ATIGI BIR MARTA to'liq qayta ishlanishi"
 * kafolatini bermaydi.
 *
 * Muammo aniq: kuryer "✅ Yetkazildi" tugmasini bosadi, `applyCourierOrderAction`
 * ishlaydi, LEKIN javob Telegramga yetib bormasdan tarmoq uzilib
 * qoladi — Telegram xuddi shu callback_query'ni QAYTA yuboradi.
 * Dublikat tekshiruvisiz, `applyCourierOrderAction` YANA bir marta
 * ishlaydi: mijozga "jonli joylashuv to'xtatildi" xabari, sotuvchiga
 * "Yetkazildi" bildirishnomasi VA h.k. IKKINCHI marta yuboriladi —
 * ma'lumotning o'zi buzilmaydi (harakatlar ko'p jihatdan idempotent),
 * lekin foydalanuvchilar BIR XIL Telegram xabarini ikki marta oladi.
 *
 * YECHIM: har bir kiruvchi yangilanish (`update_id`, Telegram HAR BIR
 * botga BERADIGAN, shu bot doirasida globalда o'sib boruvchi raqam)
 * Firestore TRANZAKSIYASI orqali "men buni birinchi marta ko'ryapmanmi?"
 * deb ATOMIK tekshiriladi — xuddi `lib/rateLimit.js`dagi
 * `checkRateLimit` bilan bir xil naqsh.
 *
 * "FAIL OPEN" TAMOYILI (ATAYLAB): agar tekshiruvning O'ZI xato bersa
 * (masalan Firestore vaqtincha ishlamay qolsa, yoki sinov muhitida
 * soddalashtirilgan `db` obyekti ishlatilsa), funksiya xato
 * TASHLAMAYDI — `false` (dublikat EMAS) qaytaradi, yangilanish esa
 * ODATDAGIDEK qayta ishlanadi. Sabab: dublikatni ANIQLAY OLMASLIK
 * hech qachon HAQIQIY (birinchi marta kelgan) buyurtma/amalni qayta
 * ishlashni TO'XTATIB QO'YMASLIGI kerak — bu ikkinchi darajali,
 * yordamchi himoya, asosiy oqimning o'zi emas.
 */
async function isDuplicateUpdate(botName, updateId) {
  if (updateId === null || updateId === undefined) return false; // update_id yo'q - tekshirib bo'lmaydi, oddiy davom etiladi

  const docId = `${botName}_${updateId}`;
  const ref = db.collection("processedTelegramUpdates").doc(docId);

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists) return true;
      transaction.set(ref, { processedAt: Date.now() });
      return false;
    });
  } catch (err) {
    console.error(`Webhook dublikat tekshiruvida xatolik (${docId}):`, err);
    return false; // "fail open" — tekshirib bo'lmasa, yangilanish odatdagidek ishlanadi
  }
}

module.exports = { isDuplicateUpdate };
