const { admin, db } = require("./admin");

/**
 * BILDIRISHNOMA "O'LIK XAT" (DEAD-LETTER) NAVBATI (4-BOT EKOTIZIM
 * AUDITI, P2-band: "rasmiy notification queue yo'q").
 *
 * MUHIM: bu — TO'LIQ Cloud Tasks/Pub-Sub asosidagi navbat
 * ARXITEKTURASINI ALMASHTIRMAYDI (bu — katta, alohida loyiha, mavjud
 * ishlab turgan sinxron yuborish yo'lini butunlay qayta qurishni talab
 * qiladi — audit doirasida ATAYLAB amalga oshirilmadi). Bu — TORROQ,
 * lekin HAQIQIY foyda beruvchi ZAXIRA MEXANIZMI: `sendTelegramMessage`
 * o'zining ICHKI qayta urinishlarini (`lib/helpers.js`, 429/5xx uchun
 * 3 martagacha) TUGATGANDAN KEYIN ham muvaffaqiyatsiz bo'lgan
 * YETKAZILISHI MUHIM (masalan "buyurtma tasdiqlandi" mijozga) xabarlar
 * uchun — ular butunlay yo'qolib ketmasin, birozdan keyin (Telegram
 * vaqtincha tiklangach) yana bir necha marta qayta urinilsin, deb.
 *
 * XAVFSIZLIK QARORI: navbat hujjatida HECH QACHON XOM BOT TOKENI
 * saqlanmaydi — faqat qayta urinish uchun YETARLI kontekst (masalan
 * `sellerId`+`clientId`+matn), token esa har safar qayta urinishda
 * `getSellerCustomBotToken`/`BOT_TOKEN.value()` orqali QAYTA, YANGI
 * holda o'qiladi (agar shu orada sotuvchi botni uzgan/almashtirgan
 * bo'lsa ham, ENG YANGI tokendan foydalaniladi).
 *
 * "FAIL OPEN, IKKINCHI DARAJALI" TAMOYILI: navbatga yozishning o'zi
 * xato bersa (masalan Firestore vaqtincha ishlamasa), bu ASOSIY
 * bildirishnoma funksiyasini BUZMAYDI — faqat log yoziladi. Xabar
 * baribir "yetkazilmadi" deb qaytariladi (chunki u haqiqatan ham
 * yetkazilmadi) — navbat FAQAT keyinroq QAYTA URINISH imkoniyatini
 * qo'shadi, asosiy oqimning natijasini o'zgartirmaydi.
 */
const COLLECTION = "notificationRetryQueue";
const MAX_ATTEMPTS = 5;
// Har bir muvaffaqiyatsiz urinishdan keyingi kutish vaqti (daqiqalarda) —
// eksponensial o'sib boradi, lekin ANIQ CHEGARAGA ega (cheksiz emas):
// 10 daq -> 30 daq -> 2 soat -> 6 soat -> 24 soat, shundan keyin butunlay
// tashlab yuboriladi ("no infinite retry on permanent failure" talabi).
const BACKOFF_MINUTES = [10, 30, 120, 360, 1440];

/**
 * `kind` — "customerNotification" (`payload: {sellerId, clientId, text,
 * options}`, ishchi `getSellerCustomBotToken`+`sendCustomerNotification`
 * orqali qayta uradi) yoki "sellerMessage" (`payload: {chatId, text,
 * options}`, ishchi platforma `BOT_TOKEN` orqali qayta uradi — sotuvchi/
 * admin xabarlari doim shu bitta, ishonchli bot orqali ketgani uchun
 * qo'shimcha token-qidirish shart emas).
 */
async function enqueueRetry({ kind, payload, reason }) {
  if (!kind || !payload) return;
  try {
    await db.collection(COLLECTION).add({
      kind,
      payload,
      attempts: 0,
      status: "pending",
      lastError: reason || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      nextAttemptAt: admin.firestore.Timestamp.fromMillis(Date.now() + BACKOFF_MINUTES[0] * 60 * 1000),
    });
  } catch (err) {
    console.error("Bildirishnomani qayta urinish navbatiga yozishda xatolik:", err);
  }
}

/**
 * Bitta navbat hujjatini muvaffaqiyatli/muvaffaqiyatsiz urinishdan
 * keyin yangilaydi. `MAX_ATTEMPTS`ga yetganda hujjat O'CHIRILADI (butun
 * navbat cheksiz o'smasligi uchun) — bu HOLDA yakuniy muvaffaqiyatsizlik
 * chaqiruvchiga (`onFinalFailure`) alohida xabar qilinadi, u buni
 * o'ziga mos tarzda (masalan `logNotification` orqali "yetkazilmadi"
 * deb) qayd etishi mumkin.
 */
async function recordAttemptResult(doc, ok, description) {
  const ref = db.collection(COLLECTION).doc(doc.id);
  if (ok) {
    await ref.delete();
    return { finalFailure: false };
  }

  const attempts = (doc.data().attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await ref.delete();
    return { finalFailure: true };
  }

  const backoffMinutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  await ref.update({
    attempts,
    lastError: description || null,
    nextAttemptAt: admin.firestore.Timestamp.fromMillis(Date.now() + backoffMinutes * 60 * 1000),
  });
  return { finalFailure: false };
}

/**
 * Hozir qayta urinilishi KERAK bo'lgan barcha hujjatlarni qaytaradi.
 * MUHIM: qo'shimcha Firestore KOMPOZIT INDEKS talab qilmaslik uchun
 * (`applyCourierOrderAction`dagi bilan bir xil, mavjud naqsh) — faqat
 * `status=="pending"` bo'yicha so'raladi (bu — kolleksiyaning O'ZI
 * kichik, chunki muvaffaqiyatli/yakuniy muvaffaqiyatsiz hujjatlar
 * DARHOL o'chiriladi), `nextAttemptAt` esa XOTIRADA filtrlanadi.
 */
async function fetchDueRetries(now = Date.now()) {
  const snap = await db.collection(COLLECTION).where("status", "==", "pending").get();
  return snap.docs.filter((doc) => {
    const nextAttemptAt = doc.data().nextAttemptAt;
    const millis = nextAttemptAt?.toMillis ? nextAttemptAt.toMillis() : 0;
    return millis <= now;
  });
}

module.exports = { enqueueRetry, recordAttemptResult, fetchDueRetries, COLLECTION, MAX_ATTEMPTS, BACKOFF_MINUTES };
