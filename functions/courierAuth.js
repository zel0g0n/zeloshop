const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, COURIER_BOT_TOKEN } = require("./lib/admin");
const { sanitizeFirestoreData } = require("./lib/helpers");
const { verifyTelegramInitData } = require("./telegramAuth");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * KURYER Mini App AUTENTIFIKATSIYASI (v39).
 *
 * MUHIM ARXITEKTURA QARORI: bu — `auth.js`dagi `verifyTelegramAuth`ga
 * QO'SHIMCHA emas, BUTUNLAY ALOHIDA, MUSTAQIL funksiya. Sabab: mavjud
 * `verifyTelegramAuth` — butun ilovaning (sotuvchi/mijoz/admin) ENG
 * KRITIK, ENG KO'P ishlatiladigan yo'li, va uni to'rtinchi (kuryer)
 * holat bilan murakkablashtirish, xato qilish xavfini oshiradi. Kuryer
 * Mini App'i esa BUTUNLAY BOSHQA botdan (`zeloshop_kuryer_bot`,
 * `COURIER_BOT_TOKEN`) ochiladi — shuning uchun `initData`ning O'ZI
 * ham BOSHQA token bilan imzolangan bo'ladi, mavjud funksiya buni
 * UMUMAN TEKSHIRA OLMAYDI (imzo mos kelmaydi). Bu — mavjud, ishlab
 * turgan yo'lni HECH QANDAY tarzda o'zgartirmasdan, YANGI, izolyatsiya
 * qilingan qism qo'shishning eng xavfsiz yo'li.
 *
 * Frontend'da bu `src/context/CourierSessionContext.jsx` orqali
 * chaqiriladi (asosiy `SessionContext.jsx` — sotuvchi/mijoz/admin
 * uchun — bilan PARALEL, alohida "sessiya daraxti").
 */
async function handleVerifyCourierTelegramAuth(request) {
  const { initData } = request.data || {};

  let verified;
  try {
    verified = await verifyTelegramInitData(initData, COURIER_BOT_TOKEN.value());
  } catch (err) {
    console.error("Kuryer auth tekshiruvi muvaffaqiyatsiz:", err.message);
    throw new HttpsError("unauthenticated", "Telegram autentifikatsiyasi tasdiqlanmadi.");
  }

  const { user } = verified;
  if (!user || !user.id) {
    throw new HttpsError("unauthenticated", "Telegram foydalanuvchi ma'lumoti topilmadi.");
  }
  const uid = String(user.id);

  await checkRateLimit(`verifyCourierTelegramAuth:${uid}`, 60, 300);

  const courierSnap = await db.collection("couriers").doc(uid).get();
  if (!courierSnap.exists) {
    // MUHIM: bu HOLAT ODATDA yuz bermasligi kerak - kuryer botning
    // "📦 Yetkazmalarim" tugmasi FAQAT allaqachon ulangan
    // (`/start <token>` orqali) kuryerlarga ko'rsatiladi. Shunga
    // qaramay, aniq va tushunarli xato xabari bilan himoyalanadi.
    throw new HttpsError(
      "failed-precondition",
      "Siz hali hech qanday do'konga kuryer sifatida ulanmagansiz. Sotuvchingizdan taklif havolasini so'rang."
    );
  }

  const courier = courierSnap.data();
  if (courier.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Sizning kuryer profilingiz hozir faol emas. Sotuvchingiz bilan bog'laning."
    );
  }

  const sellerSnap = await db.collection("sellers").doc(courier.sellerId).get();

  const customToken = await admin.auth().createCustomToken(uid, { role: "courier" }).catch((err) => {
    console.error("Kuryer uchun custom token yaratishda xatolik:", err);
    throw new HttpsError("internal", "Token yaratishda xatolik. Birozdan so'ng qayta urinib ko'ring.");
  });

  return {
    token: customToken,
    telegramUser: {
      id: uid,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      username: user.username || null,
    },
    courier: { id: uid, ...sanitizeFirestoreData(courier) },
    store: sellerSnap.exists ? { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) } : null,
  };
}

exports.verifyCourierTelegramAuth = onCall(
  { secrets: [COURIER_BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  withSentry(async (request) => {
    try {
      return await handleVerifyCourierTelegramAuth(request);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("verifyCourierTelegramAuth — kutilmagan xato:", err.message, err.stack);
      throw new HttpsError("internal", "Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    }
  })
);

exports._testables = { handleVerifyCourierTelegramAuth };
