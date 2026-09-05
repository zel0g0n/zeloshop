const { db, BOT_TOKEN } = require("./admin");
const { sendTelegramMessage } = require("./helpers");

/**
 * Mijozga (xaridorga) bildirishnoma yuborishning yagona yo'li.
 *
 * Arxitektura: xaridor sotuvchining o'z shaxsiy boti (`customBot.js`
 * orqali ulangan) bilan ishlaydi - do'konni o'sha bot orqali ochadi va
 * buyurtma beradi. `zeloshop_bot` faqat sotuvchi uchun mo'ljallangan
 * (do'konni boshqarish: buyurtmalar, CRM, AI CEO va hokazo) - xaridor
 * "zeloshop" haqida umuman bilmaydi. Shu sababli mijozga yuboriladigan
 * xabar ham sotuvchining shaxsiy botidan kelishi kerak, aks holda
 * xaridor tanimagan "zeloshop_bot" nomidan xabar kelib, chalkashlik
 * yaratadi.
 *
 * Platforma cheklovi: Telegram bot foydalanuvchi ilgari "Start"
 * bosmagan boshqa botdan xabar yubora olmaydi ("chat not found"
 * xatosi). Shu sababli zaxira (fallback) majburiy: sotuvchi shaxsiy
 * bot ulamagan yoki mijoz o'sha botni hali ishga tushirmagan bo'lsa,
 * xabar platforma boti orqali yuboriladi - mijoz butunlay xabarsiz
 * qolmasligi uchun.
 */

/**
 * Sotuvchining ulangan shaxsiy bot tokenini o'qiydi. Token
 * `sellers/{id}/private/customerBot` (MAXFIY quyi kolleksiya) da
 * saqlanadi - hech qachon ommaviy `sellers/{id}` hujjatida emas.
 *
 * Chaqiruvchi buni bir marta (yoki ko'p mijozga ketma-ket yuborish
 * siklida - keshlab) chaqirib, natijasini
 * `sendCustomerNotification`ga uzatishi kerak - funksiyaning o'zi
 * natijani keshlamaydi, chunki chaqiruvchi tomonlar buni turlicha
 * (masalan bir nechta buyurtma bo'ylab) talab qilishi mumkin.
 *
 * Firestore o'qishda xatolik yuz bersa `null` qaytaradi va xato
 * tashlamaydi, chunki bu funksiya asosiy oqimni to'xtatmasligi kerak.
 */
async function getSellerCustomBotToken(sellerId) {
  if (!sellerId) return null;
  try {
    const snap = await db.collection("sellers").doc(String(sellerId)).collection("private").doc("customerBot").get();
    return snap.exists ? (snap.data()?.botToken || null) : null;
  } catch (err) {
    console.error(`Sotuvchining shaxsiy bot tokenini o'qishda xatolik (${sellerId}):`, err);
    return null;
  }
}

/**
 * Mijozga (xaridorga) bitta xabar yuboradi - AVVAL `customBotToken`
 * (agar berilgan bo'lsa) orqali, muvaffaqiyatsiz bo'lsa (yoki umuman
 * berilmagan bo'lsa) ZAXIRA sifatida platforma boti orqali.
 *
 * `customBotToken` — chaqiruvchi `getSellerCustomBotToken(sellerId)`
 * natijasini shu yerga uzatadi (`null` bo'lsa sotuvchi shaxsiy bot
 * ulamagan, to'g'ridan-to'g'ri platforma botiga o'tiladi).
 *
 * @returns sendTelegramMessage natijasi (oxirgi muvaffaqiyatli/oxirgi
 * urinilgan chaqiruv natijasi) - chaqiruvchilar buni oldingi kabi
 * `.ok`/`.description` uchun ishlatishda davom etadi.
 */
async function sendCustomerNotification(customBotToken, clientId, text, options) {
  // `options` chaqiruvchi tomonidan berilmagan bo'lsa,
  // `sendTelegramMessage`ga to'rtinchi argumentni umuman uzatmaymiz
  // (aks holda uning ichki `options = {}` standart qiymati o'rniga
  // aniq `undefined` uzatilgan bo'lardi - bu ba'zi test/log
  // vositalarida chaqiruv argumentlari sonini kutilganidan farqli
  // qilib ko'rsatishi mumkin).
  const args = options !== undefined ? [clientId, text, options] : [clientId, text];
  if (customBotToken) {
    const result = await sendTelegramMessage(customBotToken, ...args);
    if (result.ok) return result;
  }
  return sendTelegramMessage(BOT_TOKEN.value(), ...args);
}

module.exports = { getSellerCustomBotToken, sendCustomerNotification };
