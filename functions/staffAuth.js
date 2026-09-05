const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, STAFF_BOT_TOKEN } = require("./lib/admin");
const { sanitizeFirestoreData } = require("./lib/helpers");
const { verifyTelegramInitData } = require("./telegramAuth");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * XODIM (STAFF) Mini App AUTENTIFIKATSIYASI.
 *
 * `courierAuth.js`dagi `verifyCourierTelegramAuth` bilan AYNAN BIR XIL
 * arxitektura qarori: bu — `auth.js`dagi `verifyTelegramAuth`ga
 * QO'SHIMCHA emas, BUTUNLAY ALOHIDA, MUSTAQIL funksiya. Sabab: xodim
 * Mini App'i BUTUNLAY BOSHQA botdan (foydalanuvchi alohida yaratadigan
 * "xodim boti", `STAFF_BOT_TOKEN`) ochiladi — shuning uchun `initData`
 * ham BOSHQA token bilan imzolangan bo'ladi, mavjud (eng KRITIK)
 * sotuvchi/mijoz/admin autentifikatsiya yo'li BUTUNLAY tegilmasdan
 * qoladi.
 *
 * Frontend'da bu `src/context/StaffSessionContext.jsx` orqali
 * chaqiriladi — sotuvchi/mijoz/admin (`SessionContext.jsx`) va kuryer
 * (`CourierSessionContext.jsx`) bilan PARALEL, uchinchi mustaqil
 * "sessiya daraxti".
 */
async function handleVerifyStaffTelegramAuth(request) {
  const { initData } = request.data || {};

  let verified;
  try {
    verified = await verifyTelegramInitData(initData, STAFF_BOT_TOKEN.value());
  } catch (err) {
    console.error("Xodim auth tekshiruvi muvaffaqiyatsiz:", err.message);
    throw new HttpsError("unauthenticated", "Telegram autentifikatsiyasi tasdiqlanmadi.");
  }

  const { user } = verified;
  if (!user || !user.id) {
    throw new HttpsError("unauthenticated", "Telegram foydalanuvchi ma'lumoti topilmadi.");
  }
  const uid = String(user.id);

  await checkRateLimit(`verifyStaffTelegramAuth:${uid}`, 60, 300);

  const staffSnap = await db.collection("staff").doc(uid).get();
  if (!staffSnap.exists) {
    // MUHIM: bu HOLAT ODATDA yuz bermasligi kerak - "Ilovani ochish"
    // tugmasi FAQAT allaqachon ulangan (`/start <token>` orqali)
    // xodimlarga ko'rsatiladi. Shunga qaramay, aniq va tushunarli xato
    // xabari bilan himoyalanadi.
    throw new HttpsError(
      "failed-precondition",
      "Siz hali hech qanday do'konga xodim sifatida ulanmagansiz. Sotuvchingizdan taklif havolasini so'rang."
    );
  }

  const staff = staffSnap.data();
  if (staff.status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "Sizning xodim profilingiz hozir faol emas. Sotuvchingiz bilan bog'laning."
    );
  }

  const sellerSnap = await db.collection("sellers").doc(staff.sellerId).get();

  const customToken = await admin.auth().createCustomToken(uid, { role: "staff" }).catch((err) => {
    console.error("Xodim uchun custom token yaratishda xatolik:", err);
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
    staff: { id: uid, ...sanitizeFirestoreData(staff) },
    store: sellerSnap.exists ? { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) } : null,
  };
}

exports.verifyStaffTelegramAuth = onCall(
  { secrets: [STAFF_BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  withSentry(async (request) => {
    try {
      return await handleVerifyStaffTelegramAuth(request);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("verifyStaffTelegramAuth — kutilmagan xato:", err.message, err.stack);
      throw new HttpsError("internal", "Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    }
  })
);

exports._testables = { handleVerifyStaffTelegramAuth };
