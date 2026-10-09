const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { sanitizeFirestoreData } = require("./lib/helpers");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { _testables: authTestables } = require("./auth");

/**
 * VEB (brauzer) uchun MAXSUS LOGIN/PAROL autentifikatsiyasi
 * (2026-10, foydalanuvchi so'roviga ko'ra: sotuvchi panelini Telegram
 * ICHIDAN tashqarida, oddiy brauzerda ham — responsive va xavfsiz —
 * ishlatish; login/parol ZeloShop bot orqali yuboriladi).
 *
 * NEGA Telegram `initData` EMAS: Mini App sotuvchini Telegram WebApp'ning
 * o'zi in'ektsiya qilgan, kriptografik imzolangan `initData` orqali
 * taniydi (`auth.js`dagi `verifyTelegramAuth`). Bu FAQAT ilova Telegram
 * ICHIDA ochilganda ishlaydi — oddiy brauzerda bunday obyekt yo'q.
 *
 * OQIM:
 *   1) Sotuvchi ZeloShop botiga (`zeloshop_bot`) yozib, "🔐 Veb login/
 *      parol" tugmasini bosadi (`telegramBotMenu.js`).
 *   2) Bot shu yerdagi `generateWebAppCredentials()`ni chaqiradi —
 *      tasodifiy login+parol juftligi yaratiladi, PAROL FAQAT HASH
 *      holida saqlanadi, ochiq juftlik bot xabari sifatida yuboriladi.
 *   3) Sotuvchi veb-saytdagi Kirish sahifasiga shu juftlikni kiritadi ->
 *      `webAppLogin` tekshiradi -> Firebase custom token qaytaradi.
 *   4) Brauzer `signInWithCustomToken` qiladi, so'ng `getWebSession`
 *      orqali do'kon/xavfsizlik/dashboard ma'lumotini oladi (Telegram'da
 *      buni `verifyTelegramAuth` javobining o'zi beradi).
 *
 * MUHIM ARXITEKTURA QARORI: custom token AYNAN SOTUVCHINING Telegram
 * ID'si (`sellerId`) bilan yaratiladi — shuning uchun Firestore
 * xavfsizlik qoidalari va butun sotuvchi paneli kodi O'ZGARISHSIZ
 * ishlaydi, ikkita alohida "foydalanuvchi turi" yaratilmaydi.
 *
 * XAVFSIZLIK (veb uchun kuchaytirilgan):
 *   - Parol HECH QACHON ochiq saqlanmaydi: `scrypt` + tasodifiy `salt`,
 *     `timingSafeEqual` bilan solishtiriladi.
 *   - Qo'pol kuch himoyasi IKKI qatlamli: har bir login uchun (10/soat)
 *     VA har bir IP manzil uchun (30/soat) — ikkinchisi bitta hujumchi
 *     ko'plab loginlarni ketma-ket sinashining oldini oladi.
 *   - Token `loginMethod: "password"` da'vosini oladi. Bunday sessiya
 *     HECH QACHON admin huquqiga ega emas: `firestore.rules`dagi
 *     `isAdmin()` ham, admin `onCall` funksiyalari ham buni rad etadi.
 *     (Admin faqat Telegram imzosi orqali — parol o'g'irlansa ham
 *     platforma boshqaruvi xavf ostida qolmaydi.)
 *   - Xato xabarlari login mavjudligini oshkor qilmaydi.
 *
 * SAQLASH SXEMASI:
 *   - `appLogins/{login}` (top-level, mijoz HECH QACHON o'qiy/yoza
 *     olmaydi): `{ sellerId, passwordHash, salt, createdAt }`.
 *   - `sellers/{sellerId}/private/appAuth`: `{ login, createdAt }` —
 *     qayta generatsiyada ESKI `appLogins` hujjatini o'chirish uchun
 *     (bir vaqtda faqat BITTA amaldagi juftlik).
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
async function generateWebAppCredentials(sellerId) {
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
 * Veb Kirish sahifasidan chaqiriladi — AUTENTIFIKATSIYASIZ (`onCall`
 * bo'lsa-da, `request.auth` TALAB QILINMAYDI, chunki bu aynan
 * autentifikatsiyaning O'ZI). Muvaffaqiyatli bo'lsa, Firebase custom
 * token qaytaradi.
 */
async function handleWebAppLogin(request) {
  const { login: rawLogin, password: rawPassword } = request.data || {};
  if (!rawLogin || !rawPassword || typeof rawLogin !== "string" || typeof rawPassword !== "string") {
    throw new HttpsError("invalid-argument", "Login va parolni kiriting.");
  }
  // Haddan tashqari uzun kiritish — scrypt/Firestore'ga yetib bormasin.
  if (rawLogin.length > 64 || rawPassword.length > 64) {
    throw new HttpsError("invalid-argument", "Login yoki parol noto'g'ri.");
  }

  // Ikkalasi ham FAQAT `CODE_CHARSET`dan iborat qilib yaratiladi —
  // qo'lda kiritishda register (katta/kichik harf) xatosi bo'lmasligi
  // uchun, ikkalasini ham katta harfga o'tkazamiz (xavfsizlikka
  // ta'sir qilmaydi, chunki alifbo boshidanoq shunga mo'ljallangan).
  const login = rawLogin.trim().toUpperCase();
  const password = rawPassword.trim().toUpperCase();

  // Qo'pol kuch himoyasi (1-qatlam): IP manzil bo'yicha. Bitta hujumchi
  // ko'plab turli loginlarni ketma-ket sinab ko'rishi mumkin edi —
  // faqat login bo'yicha cheklov buni to'xtatmaydi.
  const ip = request.rawRequest?.ip;
  if (ip) {
    await checkRateLimit(`webAppLogin:ip:${ip}`, 30, 3600);
  }
  // (2-qatlam): BIR XIL login uchun soatiga cheklangan urinish.
  await checkRateLimit(`webAppLogin:${login}`, 10, 3600);

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

  // `loginMethod: "password"` — bu sessiya admin huquqiga EGA EMAS
  // (qarang: faylning yuqori izohi).
  const customToken = await admin.auth().createCustomToken(sellerId, { loginMethod: "password" });
  const seller = sellerSnap.data();

  return {
    customToken,
    sellerId,
    storeName: seller.storeName || null,
  };
}

/**
 * Parol bilan kirilgan brauzer sessiyasi uchun boshlang'ich ma'lumot
 * (do'kon hujjati, xavfsizlik/PIN sozlamasi, dashboard xulosasi) —
 * Telegram'da buni `verifyTelegramAuth` javobining o'zi beradi.
 *
 * FAQAT `loginMethod: "password"` tokenli, haqiqatan tasdiqlangan
 * sotuvchi uchun; `sellerId` HECH QACHON so'rovdan olinmaydi — faqat
 * `request.auth.uid`dan (server tomonidan tasdiqlangan).
 */
async function handleGetWebSession(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  if (request.auth.token?.loginMethod !== "password") {
    throw new HttpsError("permission-denied", "Bu funksiya faqat veb-kirish sessiyasi uchun.");
  }
  const uid = String(request.auth.uid);
  await checkRateLimit(`getWebSession:${uid}`, 60, 300);

  const [sellerSnap, securitySnap, dashboardSummary] = await Promise.all([
    db.collection("sellers").doc(uid).get(),
    db.collection("sellers").doc(uid).collection("private").doc("security").get(),
    authTestables.computeDashboardSummary(uid),
  ]);
  if (!sellerSnap.exists) {
    throw new HttpsError("not-found", "Sotuvchi topilmadi. Bot orqali yangi login/parol so'rang.");
  }

  return {
    sellerId: uid,
    store: { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) },
    security: securitySnap.exists ? sanitizeFirestoreData(securitySnap.data()) : null,
    dashboardSummary,
  };
}

exports.generateWebAppCredentials = generateWebAppCredentials;
exports.webAppLogin = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleWebAppLogin));
exports.getWebSession = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetWebSession));

exports._testables = {
  randomCode, hashPassword, verifyPassword, handleWebAppLogin, handleGetWebSession, generateWebAppCredentials,
  CODE_CHARSET, LOGIN_LENGTH, PASSWORD_LENGTH,
};
