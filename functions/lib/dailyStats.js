const { admin, db } = require("./admin");

/**
 * Kunlik "AI CEO faoliyati" hisoblagichlari.
 *
 * Har bir bildirishnoma funksiyasi (savat, sevimlilar, qayta sotib
 * olish, CRM broadcast) xabar yuborish jarayonini o'zi amalga
 * oshiradi, lekin buni alohida hisobga olmaydi - shu sabab kunlik
 * faoliyat statistikasi shu fayl orqali markazlashtirilgan holda
 * yuritiladi.
 *
 * Hujjat yo'li: `sellers/{sellerId}/dailyStats/{YYYY-MM-DD}` - har
 * bir sotuvchi va har bir kun uchun alohida hujjat, shunda kunlar
 * statistikasi bir-biriga aralashmaydi.
 */
function todayDocId() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }); // "YYYY-MM-DD"
}

/**
 * Berilgan turdagi hisoblagichni birga oshiradi. Xatolik yuz berganda
 * jim log yozadi - hisoblagichning yangilanmay qolishi asosiy
 * funksiyaning (xabar yuborish) muvaffaqiyatiga ta'sir qilmasligi
 * kerak.
 */
async function incrementDailyStat(sellerId, field, amount = 1) {
  if (!sellerId) return;
  try {
    const ref = db.collection("sellers").doc(sellerId).collection("dailyStats").doc(todayDocId());
    await ref.set({ [field]: admin.firestore.FieldValue.increment(amount) }, { merge: true });
  } catch (err) {
    console.error(`Kunlik statistikani yangilashda xatolik (${field}, sotuvchi ${sellerId}):`, err);
  }
}

/**
 * CRM broadcast xabari yuborilgan mijozlarning ID'larini saqlaydi -
 * "necha kishi sotib oldi" (konversiya) hisobotini keyinroq
 * hisoblash uchun kerak. `arrayUnion` - takroriy ID'larni avtomatik
 * chetlab o'tadi.
 */
async function trackCrmMessageRecipients(sellerId, clientIds) {
  if (!sellerId || !Array.isArray(clientIds) || clientIds.length === 0) return;
  try {
    const ref = db.collection("sellers").doc(sellerId).collection("dailyStats").doc(todayDocId());
    await ref.set(
      {
        crmMessagesSent: admin.firestore.FieldValue.increment(clientIds.length),
        crmMessageRecipientIds: admin.firestore.FieldValue.arrayUnion(...clientIds),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`CRM xabar oluvchilarini kuzatishda xatolik (sotuvchi ${sellerId}):`, err);
  }
}

module.exports = { incrementDailyStat, trackCrmMessageRecipients, todayDocId, logNotification };

/**
 * Mijozga yuborilgan har bir xabarni "bildirishnoma jurnali"ga
 * yozadi — mijoz ilova ichida (`/notifications` sahifasida) o'ziga
 * yuborilgan xabarlar tarixini ko'rishi uchun.
 *
 * Bu yozuv Telegram orqali xabar yuborish jarayonining o'zidan
 * mustaqil ishlaydi - xabar Telegram orqali muvaffaqiyatli
 * yuborilgan-yubormaganidan qat'i nazar amalga oshiriladi (`delivered`
 * maydoni orqali qaysi holat ekanini bilib olish mumkin), shu orqali
 * Telegram xabari sababsiz yetib bormasa ham, sotuvchi yoki xaridor
 * buni ilova ichida ko'rib, muammoni aniqlay oladi.
 */
async function logNotification({ sellerId, clientId, type, title, message, delivered = true }) {
  if (!sellerId || !clientId) return;
  try {
    await db.collection("notificationLogs").add({
      sellerId,
      clientId,
      type,
      title,
      message,
      delivered,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`Bildirishnoma jurnaliga yozishda xatolik (${type}, mijoz ${clientId}):`, err);
  }
}
