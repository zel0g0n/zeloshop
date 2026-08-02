const crypto = require("crypto");

/**
 * Telegram Mini App `initData` ni tekshiradi.
 *
 * Bu — butun auth tizimining "yuragi": faqat shu funksiya orqali
 * frontend'dan kelgan "men shu foydalanuvchiman" degan da'voni
 * ISHONCH BILAN tasdiqlash mumkin. Frontend'dagi
 * `window.Telegram.WebApp.initDataUnsafe` — nomidan ko'rinib turibdiki
 * ISHONIB BO'LMAYDIGAN (unsafe) ma'lumot: uni brauzer konsolidan
 * istalgan odam o'zgartira oladi. `initData` (xom qator, hash bilan)
 * esa Telegram tomonidan bot tokeningiz bilan raqamli imzolangan —
 * shu tufayli faqat SIZNING bot tokeningizni bilgan kimsa (ya'ni faqat
 * Telegram serverlari) uni to'g'ri imzolay oladi.
 *
 * Rasmiy algoritm (Telegram hujjatlariga muvofiq):
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * @param {string} initData - `window.Telegram.WebApp.initData` (xom qator)
 * @param {string} botToken - Cloud Functions secret sifatida saqlangan token
 * @param {number} maxAgeSeconds - initData necha soniyagacha "yangi" hisoblanadi
 * @returns {{ user: object|null, startParam: string|null, authDate: number }}
 * @throws {Error} imzo noto'g'ri yoki ma'lumot eskirgan bo'lsa
 */
function verifyTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
  if (!initData || typeof initData !== "string") {
    throw new Error("initData bo'sh yoki noto'g'ri formatda.");
  }
  // OLDIN: botToken tozalanmasdan ishlatilardi. Terminalda tokenni
  // qo'lda kiritganda (ayniqsa Windows/Git Bash'da) oxiriga bilinmas
  // bo'sh joy yoki qator ko'chirish belgisi qo'shilib qolishi juda
  // keng tarqalgan xato — bu esa imzoni noto'g'ri qilib qo'yadi.
  botToken = (botToken || "").trim();
  if (!botToken) {
    throw new Error("Bot tokeni sozlanmagan (BOT_TOKEN secret topilmadi).");
  }
  // Xavfsiz diagnostika: TOKENNING O'ZI emas, faqat uzunligi va
  // formatga mosligi logga yoziladi — shu orqali "token butunlay
  // noto'g'ri kiritilganmi" ekanini oshkor qilmasdan tekshirish mumkin.
  console.log(
    `BOT_TOKEN diagnostikasi: uzunligi=${botToken.length}, ":" bormi=${botToken.includes(":")}`
  );

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("initData ichida hash topilmadi — soxta so'rov bo'lishi mumkin.");
  }
  params.delete("hash");

  // Qolgan barcha juftliklarni alifbo tartibida "key=value" qilib,
  // \n bilan birlashtiramiz (Telegram talab qiladigan format).
  const dataCheckArr = [];
  for (const [key, value] of params.entries()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  // secret_key = HMAC_SHA256(key="WebAppData", data=botToken)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  // hash_check = HMAC_SHA256(key=secret_key, data=dataCheckString)
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // Doimiy vaqtli taqqoslash (timing-attack'dan himoya)
  const hashBuf = Buffer.from(hash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  const isValid =
    hashBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(hashBuf, computedBuf);

  if (!isValid) {
    throw new Error("initData imzosi noto'g'ri — soxtalashtirilgan bo'lishi mumkin.");
  }

  const authDate = Number(params.get("auth_date")) || 0;
  const ageSeconds = Date.now() / 1000 - authDate;
  if (!authDate || ageSeconds > maxAgeSeconds || ageSeconds < -60) {
    throw new Error("initData eskirgan — foydalanuvchi Mini App'ni qayta ochishi kerak.");
  }

  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const startParam = params.get("start_param") || null;

  return { user, startParam, authDate };
}

module.exports = { verifyTelegramInitData };
