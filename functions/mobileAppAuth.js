const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Mobil ilova (React Native) uchun MAXSUS LOGIN/PAROL autentifikatsiyasi
 * (2026-09-26, foydalanuvchi so'roviga ko'ra: "sellerga zeloshopbot
 * orqali maxsus login parol yuboriladigan qilaman").
 *
 * NEGA Telegram `initData` EMAS: veb (Mini App) versiyasi sotuvchini
 * Telegram WebApp'ning o'zi in'ektsiya qilgan, kriptografik imzolangan
 * `initData` orqali taniydi (`auth.js`dagi `verifyTelegramAuth`). Bu
 * FAQAT ilova Telegram ICHIDA (WebView) ochilganda ishlaydi — mustaqil
 * native ilovada bunday obyekt umuman mavjud emas. Shuning uchun bu
 * yerda BUTUNLAY BOSHQA, mustaqil autentifikatsiya yo'li qurildi.
 *
 * OQIM:
 *   1) Sotuvchi ZeloShop botiga (`zeloshop_bot`) yozib, "📱 Ilova
 *      login/parol" tugmasini bosadi (`telegramBotMenu.js`).
 *   2) Bot shu yerdagi `generateMobileAppCredentials()`ni chaqiradi —
 *      tasodifiy login+parol juftligi yaratiladi, PAROL FAQAT HASH
 *      holida saqlanadi (ochiq matnda HECH QAYERDA, hatto vaqtinchalik
 *      ham, Firestore'ga yozilmaydi), ochiq juftlik esa bot xabari
 *      sifatida sotuvchiga yuboriladi (faqat SHU bir martalik
 *      ko'rsatishda ko'rinadi).
 *   3) Sotuvchi RN ilovaga shu login+parolni kiritadi ->
 *      `mobileAppLogin` (bu yerda) tekshiradi -> muvaffaqiyatli bo'lsa,
 *      Firebase custom token qaytaradi.
 *
 * MUHIM ARXITEKTURA QARORI: custom token AYNAN SOTUVCHINING Telegram
 * ID'si (`sellerId`, veb versiyada ham `uid` shu) bilan yaratiladi —
 * shuning uchun Firestore xavfsizlik qoidalari, `SessionContext.jsx`
 * mantig'i (`isOwner(sellerId)` va h.k.) BUTUNLAY O'ZGARISHSIZ, RN
 * ilova ham xuddi veb kabi `sellers/{sellerId}` hujjatiga ega bo'ladi —
 * ikkita alohida "foydalanuvchi turi" yaratilmaydi.
 *
 * SAQLASH SXEMASI:
 *   - `appLogins/{login}` (top-level, MIJOZ HECH QACHON to'g'ridan-
 *     to'g'ri o'qiy/yoza olmaydi — faqat Cloud Function, Admin SDK):
 *     `{ sellerId, passwordHash, salt, createdAt }`.
 *   - `sellers/{sellerId}/private/appAuth`: `{ login, createdAt }` —
 *     joriy login qaysi ekanini "orqaga qarab" (sellerId -> login)
 *     topish uchun, qayta generatsiya qilinganda ESKI `appLogins`
 *     hujjatini o'chirish maqsadida (bir vaqtning o'zida faqat BITTA
 *     amaldagi login/parol juftligi bo'lishi kerak).
 *
 * XAVFSIZLIK: parol HECH QACHON ochiq saqlanmaydi (`scrypt` + tasodifiy
 * `salt`, `timingSafeEqual` bilan solishtiriladi — vaqt asosidagi
 * hujumlarning oldini olish uchun). Login/parol alifbosi ATAYLAB
 * chalkash harflarni (0/O, 1/I/L) chiqarib tashlaydi — qo'lda
 * kiritishda xato ehtimolini kamaytirish uchun. Qo'pol kuch (brute-
 * force) hujumidan `checkRateLimit` orqali himoyalangan.
 */

// 0/O, 1/I/L kabi chalkash belgilar YO'Q — qo'lda (bot xabaridan RN
// ilovaga) ko'chirib/qayta kiritishda xato ehtimoli kamayadi.
const CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LOGIN_LENGTH = 8;
const PASSWORD_LENGTH = 10;
const SCRYPT_KEYLEN = 64;

function randomCode(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return result;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

/**
 * Login+parol juftligini xavfsiz solishtiradi (vaqt asosidagi hujumdan
 * himoyalangan). Ikkala hash HAR DOIM bir xil uzunlikda (`scrypt`,
 * belgilangan `SCRYPT_KEYLEN`) — shuning uchun `timingSafeEqual`
 * xavfsiz chaqiriladi.
 */
function verifyPassword(password, salt, expectedHash) {
  const actualHash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

/**
 * Berilgan sotuvchi uchun YANGI login+parol juftligi yaratadi. Agar
 * sotuvchida ALLAQACHON amaldagi juftlik bo'lsa (qayta generatsiya —
 * masalan sotuvchi "parolni unutdim/yangilayman" desa), ESKISI
 * o'chiriladi — bir vaqtning o'zida faqat BITTA amaldagi juftlik
 * bo'ladi.
 *
 * @param {string} sellerId
 * @returns {Promise<{login: string, password: string}>} OCHIQ qiymatlar
 *   — faqat shu chaqiruvda qaytariladi, keyin hech qayerda ochiq
 *   saqlanmaydi.
 */
async function generateMobileAppCredentials(sellerId) {
  const sellerAuthRef = db.collection("sellers").doc(sellerId).collection("private").doc("appAuth");
  const priorSnap = await sellerAuthRef.get();
  if (priorSnap.exists && priorSnap.data()?.login) {
    await db.collection("appLogins").doc(priorSnap.data().login).delete().catch(() => {
      // Eskisi allaqachon yo'q bo'lsa ham muammo emas — asosiysi yangisi yaratiladi.
    });
  }

  // Amalda deyarli hech qachon to'qnashmaydi (32^8 ≈ 1.1 trln kombinatsiya),
  // lekin himoya sifatida — mavjud bo'lib qolsa, qayta generatsiya qilamiz.
  let login;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCode(LOGIN_LENGTH);
    const existing = await db.collection("appLogins").doc(candidate).get();
    if (!existing.exists) {
      login = candidate;
      break;
    }
  }
  if (!login) {
    throw new HttpsError("internal", "Login yaratib bo'lmadi. Qayta urinib ko'ring.");
  }

  const password = randomCode(PASSWORD_LENGTH);
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  await db.collection("appLogins").doc(login).set({
    sellerId,
    passwordHash,
    salt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await sellerAuthRef.set({
    login,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { login, password };
}

/**
 * RN ilovadagi Login ekranidan chaqiriladi — AUTENTIFIKATSIYASIZ (`onCall`
 * bo'lsa-da, `request.auth` TALAB QILINMAYDI, chunki bu aynan
 * autentifikatsiyaning O'ZI). Muvaffaqiyatli bo'lsa, `verifyTelegramAuth`
 * bilan bir xil shakldagi Firebase custom token qaytaradi.
 */
async function handleMobileAppLogin(request) {
  const { login: rawLogin, password: rawPassword } = request.data || {};
  if (!rawLogin || !rawPassword || typeof rawLogin !== "string" || typeof rawPassword !== "string") {
    throw new HttpsError("invalid-argument", "Login va parolni kiriting.");
  }

  // Ikkalasi ham FAQAT `CODE_CHARSET`dan iborat qilib yaratiladi —
  // qo'lda kiritishda register (katta/kichik harf) xatosi bo'lmasligi
  // uchun, ikkalasini ham katta harfga o'tkazamiz (xavfsizlikka
  // ta'sir qilmaydi, chunki alifbo boshidanoq shunga mo'ljallangan).
  const login = rawLogin.trim().toUpperCase();
  const password = rawPassword.trim().toUpperCase();

  // Qo'pol kuch himoyasi: BIR XIL login uchun soatiga cheklangan urinish.
  await checkRateLimit(`mobileAppLogin:${login}`, 10, 3600);

  const loginSnap = await db.collection("appLogins").doc(login).get();
  if (!loginSnap.exists) {
    throw new HttpsError("permission-denied", "Login yoki parol noto'g'ri.");
  }

  const { sellerId, passwordHash, salt } = loginSnap.data();
  if (!verifyPassword(password, salt, passwordHash)) {
    throw new HttpsError("permission-denied", "Login yoki parol noto'g'ri.");
  }

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists) {
    throw new HttpsError("not-found", "Sotuvchi topilmadi. Bot orqali yangi login/parol so'rang.");
  }

  const customToken = await admin.auth().createCustomToken(sellerId);
  const seller = sellerSnap.data();

  return {
    customToken,
    sellerId,
    storeName: seller.storeName || null,
  };
}

exports.generateMobileAppCredentials = generateMobileAppCredentials;
exports.mobileAppLogin = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleMobileAppLogin));

exports._testables = {
  randomCode, hashPassword, verifyPassword, handleMobileAppLogin, generateMobileAppCredentials,
  CODE_CHARSET, LOGIN_LENGTH, PASSWORD_LENGTH,
};
