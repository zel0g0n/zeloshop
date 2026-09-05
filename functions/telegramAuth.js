const crypto = require("crypto");
const { db } = require("./lib/admin");

// 2026-09 audit (P2 — Telegram initData REPLAY himoyasi): imzo
// (`hash`) tekshiruvining o'zi initData'ning SOXTALASHTIRILMAGANLIGINI
// isbotlaydi, lekin uni QAYTA ISHLATISHNING (replay) OLDINI olmaydi —
// agar biror kimsa (masalan zararli brauzer kengaytmasi, tarmoq
// trafigini kuzatish, yoki tasodifan ulashilgan ekran yozuvi orqali)
// haqiqiy, TO'G'RI imzolangan `initData` qatorini qo'lga kiritsa, u
// buni `maxAgeSeconds` (standart 24 soat) davomida ISTALGAN vaqt,
// ISTALGAN qurilmadan qayta yuborib, o'sha foydalanuvchi nomidan
// yangi sessiya (custom auth token) ola olardi — Telegram bu holatni
// o'zi oldini olmaydi (imzoda "bir martalik" belgi/nonce yo'q).
//
// YECHIM: har bir MUVAFFAQIYATLI (imzosi to'g'ri, muddati o'tmagan)
// initData'ning `hash`i Firestore orqali TRANZAKSION ravishda
// qayd etiladi — xuddi `lib/webhookDedup.js`dagi `isDuplicateUpdate`
// bilan bir xil naqsh (bir xil "processedAt" maydon nomi — shu orqali
// `webhookMaintenance.js`dagi UMUMIY tozalash funksiyasi bu yerga ham
// qo'llaniladi). ODDIY BLOKLASH o'rniga (bu tabiiy holatlarni —
// tarmoq uzilib ketib frontend qayta so'rov yuborishi, yoki bir nechta
// oyna/tab — buzardi), qisqa muddat ichidagi bir nechta urinishga
// BAG'RIKENGLIK beriladi (`REPLAY_MAX_USES` marta, `REPLAY_RETRY_WINDOW_MS`
// oralig'ida) — shu chegaradan tashqarida esa rad etiladi. Bu haqiqiy
// xavf oynasini 24 soatdan besh daqiqagacha (odatiy holatda) qisqartiradi.
//
// "FAIL OPEN" (ATAYLAB, `webhookDedup.js`dagi bilan BIR XIL falsafa):
// bu — ASOSIY emas, QO'SHIMCHA (ikkinchi qatlam) himoya — asosiy
// himoya (HMAC imzo + muddat tekshiruvi) BU YERGA YETIB KELGUNCHA
// ALLAQACHON o'tgan bo'ladi. Agar Firestore vaqtincha ishlamasa, bu
// qo'shimcha tekshiruvni o'tkazib yuborish (haqiqiy foydalanuvchini
// bloklab qo'yishdan ko'ra) xavfsizroq tanlov.
const REPLAY_GUARD_COLLECTION = "telegramAuthReplayGuard";
const REPLAY_RETRY_WINDOW_MS = 5 * 60 * 1000; // 5 daqiqa
const REPLAY_MAX_USES = 5;
const TELEGRAM_AUTH_REPLAY_SENTINEL = "__TELEGRAM_AUTH_REPLAY_DETECTED__";

async function checkTelegramAuthReplay(hash) {
  if (!hash) return;
  const ref = db.collection(REPLAY_GUARD_COLLECTION).doc(hash);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const nowMs = Date.now();

      if (!snap.exists) {
        tx.set(ref, { processedAt: nowMs, firstSeenAtMs: nowMs, useCount: 1 });
        return;
      }

      const data = snap.data() || {};
      const withinRetryWindow = nowMs - (Number(data.firstSeenAtMs) || 0) <= REPLAY_RETRY_WINDOW_MS;
      const underUseLimit = (Number(data.useCount) || 0) < REPLAY_MAX_USES;
      if (withinRetryWindow && underUseLimit) {
        tx.update(ref, { useCount: (Number(data.useCount) || 0) + 1 });
        return;
      }

      throw new Error(TELEGRAM_AUTH_REPLAY_SENTINEL);
    });
  } catch (err) {
    if (err.message === TELEGRAM_AUTH_REPLAY_SENTINEL) {
      throw new Error("Bu initData allaqachon ishlatilgan (replay aniqlandi) — Mini App'ni qayta oching.", { cause: err });
    }
    console.error("Telegram auth replay-guard tekshiruvida kutilmagan xatolik (fail-open, davom etiladi):", err);
  }
}

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
async function verifyTelegramInitData(initData, botToken, maxAgeSeconds = 86400) {
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

  // Imzo va muddat TASDIQLANGANDAN keyingina replay tekshiruvi —
  // yuqoridagi izohga qarang.
  await checkTelegramAuthReplay(hash);

  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  const startParam = params.get("start_param") || null;

  return { user, startParam, authDate };
}

/**
 * `start_param`ni, imzoni TEKSHIRMASDAN, tezkor o'qiydi.
 *
 * MUHIM XAVFSIZLIK IZOHI: bu funksiya qaytargan qiymatga ISHONIB
 * BO'LMAYDI — u faqat "qaysi sotuvchining shaxsiy bot tokenini SINAB
 * ko'rish kerak" degan TAXMINni tanlash uchun ishlatiladi. Haqiqiy
 * xavfsizlik chegarasi — bu TAXMIN asosida tanlangan token bilan
 * keyin bajariladigan TO'LIQ HMAC tekshiruvi (`verifyTelegramInitData`)
 * — agar kimdir shu maydonni soxtalashtirsa, tanlangan (noto'g'ri)
 * token bilan imzo mos kelmaydi, va so'rov baribir rad etiladi.
 */
function peekStartParamUnsafe(initData) {
  try {
    const params = new URLSearchParams(initData || "");
    return params.get("start_param") || null;
  } catch {
    return null;
  }
}

module.exports = {
  verifyTelegramInitData,
  peekStartParamUnsafe,
  _testables: { checkTelegramAuthReplay, REPLAY_GUARD_COLLECTION, REPLAY_MAX_USES, REPLAY_RETRY_WINDOW_MS },
};
