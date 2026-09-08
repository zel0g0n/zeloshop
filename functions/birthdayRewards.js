const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { incrementDailyStat, logNotification } = require("./lib/dailyStats");
const { processBatched } = require("./lib/batchProcess");
const { getEffectiveTariffPlan } = require("./lib/tariffs");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * TUG'ILGAN KUN AVTOMATIK CHEGIRMASI.
 *
 * Maqsad: mijozning tug'ilgan kunida, agar u ILGARI shu sotuvchidan
 * xarid qilgan bo'lsa (haqiqiy mijoz, tasodifiy tashrif emas),
 * sotuvchi ATAYLAB yoqqan bo'lsa - bir martalik chegirma promokodi va
 * Telegram orqali tabrik xabari avtomatik yuboriladi.
 *
 * ARXITEKTURA QARORI (mijozning tug'ilgan kuni QAYERDA saqlanadi):
 * `birthDate`/`birthdayMonthDay` global `clients/{clientId}` hujjatida
 * saqlanadi (mijoz o'zi `EditProfile.jsx` orqali kiritadi) - BIR
 * MARTA, barcha do'konlar uchun umumiy. `birthdayMonthDay` ("MM-DD")
 * alohida maydon sifatida saqlanadi, chunki Firestore sana
 * qatorining faqat oy-kun qismi bo'yicha to'g'ridan-to'g'ri so'rov
 * qila olmaydi.
 *
 * QAYSI SOTUVCHI(LAR)GA tegishli ekanini bilish uchun -
 * `clients/{clientId}.linkedSellerIds` massivi ishlatiladi (har safar
 * mijoz biror sotuvchidan buyurtma berganda, `functions/orders.js`
 * shu ro'yxatga sotuvchi ID'sini qo'shadi). Bu, HAR BIR sotuvchini
 * HAR BIR tug'ilgan kunlik mijoz uchun alohida tekshirishning oldini
 * oladi - so'rov faqat "bugun tug'ilgan kuni bo'lgan" kichik mijozlar
 * to'plami ustida ishlaydi.
 *
 * TAKRORLANMASLIK KAFOLATI: har bir (sotuvchi, mijoz) juftligi uchun
 * bir yilda FAQAT BIR marta mukofot beriladi - buni maxsus
 * hisoblagich EMAS, balki mavjud `sellers/{id}/coupons` kolleksiyasi
 * o'zi ta'minlaydi (`isBirthdayReward: true` + `birthdayYear`
 * maydonlari bilan qidiriladi) - xuddi referal/savat mukofotlari
 * qanday kuzatilishi bilan bir xil naqsh.
 *
 * VIP TUG'ILGAN KUN BONUSI (2026-09, "katta bizneslar uchun"
 * ro'yxati, 2-guruh): standart tug'ilgan kun chegirmasi BARCHA tarifda
 * bepul ishlaydi (yuqorida). Z-Biznes sotuvchisi ESA, alohida
 * yoqilsa (`vipBirthdayBonusEnabled`), VIP mijozlar (`ltv >=
 * VIP_THRESHOLD` — `sellers/{id}/customers/{clientId}.ltv`dan, xuddi
 * `automationRules.js`/`lib/customerIntelligence.js`dagi bilan BIR
 * XIL chegara) uchun ODATDAGIDAN KATTAROQ, alohida foiz
 * (`vipBirthdayDiscountPercent`) bera oladi — bitta xarid tarixi
 * bo'lgan mijoz ikkalasini BIRDAN olmaydi (bitta kupon, kattaroq
 * foiz bilan). Qo'shimcha `customers` o'qishi FAQAT sotuvchi buni
 * ONGLI yoqqanda amalga oshadi (samaradorlik uchun).
 */
const TASHKENT_TZ = "Asia/Tashkent";
const DEFAULT_BIRTHDAY_DISCOUNT_PERCENT = 10;
const DEFAULT_VIP_BIRTHDAY_DISCOUNT_PERCENT = 20;
const VIP_THRESHOLD = 500_000;
const BIRTHDAY_COUPON_VALID_DAYS = 7;

/** "Bugun" (Toshkent vaqti bo'yicha) oy-kunini "MM-DD" formatida qaytaradi. */
function computeTodayMonthDay(nowMs = Date.now()) {
  return new Date(nowMs).toLocaleDateString("en-CA", { timeZone: TASHKENT_TZ }).slice(5);
}

/** Joriy yilni (Toshkent vaqti bo'yicha) qaytaradi - "bir yilda bir marta" tekshiruvi uchun. */
function computeCurrentYear(nowMs = Date.now()) {
  return Number(new Date(nowMs).toLocaleDateString("en-CA", { timeZone: TASHKENT_TZ }).slice(0, 4));
}

function generateBirthdayCouponCode() {
  return `BDAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Shu (sotuvchi, mijoz) juftligiga BERILGAN YILDA allaqachon tug'ilgan
 * kun mukofoti berilganmi - tekshiradi. Ikkita TENGLIK filtri
 * (`rewardForClientId`, `isBirthdayReward`) - Firestore'da bunga
 * qo'shimcha kompozit indeks shart emas; yil bo'yicha yakuniy filtr
 * (kichik natija to'plamida) shu yerda, JavaScript'da qilinadi.
 */
async function hasBirthdayRewardThisYear(sellerId, clientId, year) {
  const snap = await db
    .collection("sellers")
    .doc(sellerId)
    .collection("coupons")
    .where("rewardForClientId", "==", clientId)
    .where("isBirthdayReward", "==", true)
    .get();
  return snap.docs.some((d) => Number(d.data().birthdayYear) === year);
}

/**
 * Shu (sotuvchi, mijoz) juftligi uchun QO'LLANILADIGAN foizni
 * hisoblaydi — VIP bonus sharti bajarilsa (Biznes tarif + sotuvchi
 * ONGLI yoqqan + mijoz haqiqatan VIP), kattaroq VIP foizi, aks holda
 * sotuvchining oddiy tug'ilgan kun foizi (yoki standart 10%).
 */
async function resolveBirthdayDiscountPercent(sellerId, clientId, seller) {
  const standardPercent = Number(seller.birthdayDiscountPercent) > 0 ? Number(seller.birthdayDiscountPercent) : DEFAULT_BIRTHDAY_DISCOUNT_PERCENT;
  if (seller.vipBirthdayBonusEnabled !== true || getEffectiveTariffPlan(seller) !== "biznes") {
    return standardPercent;
  }
  const customerSnap = await db.collection("sellers").doc(sellerId).collection("customers").doc(clientId).get();
  const ltv = customerSnap.exists ? Number(customerSnap.data().ltv) || 0 : 0;
  if (ltv < VIP_THRESHOLD) return standardPercent;
  return Number(seller.vipBirthdayDiscountPercent) > 0 ? Number(seller.vipBirthdayDiscountPercent) : DEFAULT_VIP_BIRTHDAY_DISCOUNT_PERCENT;
}

/** Bitta (sotuvchi, mijoz) juftligiga mukofot promokodini yaratadi va tabrik xabarini yuboradi. */
async function grantBirthdayReward(sellerId, clientId, seller, customBotToken, year) {
  const percent = await resolveBirthdayDiscountPercent(sellerId, clientId, seller);
  const couponCode = generateBirthdayCouponCode();

  await db.collection("sellers").doc(sellerId).collection("coupons").doc(couponCode).set({
    code: couponCode,
    discountType: "percent",
    discountValue: percent,
    expiresAt: new Date(Date.now() + BIRTHDAY_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    isBirthdayReward: true,
    rewardForClientId: clientId,
    birthdayYear: year,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });

  const storeName = seller.storeName || "Do'kon";
  const text = `🎉 Tug'ilgan kuningiz muborak!\n\n${storeName} sizga ${percent}% chegirma sovg'a qilmoqda!\nPromokod: ${couponCode} (${BIRTHDAY_COUPON_VALID_DAYS} kun amal qiladi)`;

  await sendCustomerNotification(customBotToken, clientId, text);
  await incrementDailyStat(sellerId, "birthdayRewardsSent");
  await logNotification({
    sellerId,
    clientId,
    type: "birthdayReward",
    title: "Tug'ilgan kun chegirmasi",
    message: text,
  });

  return couponCode;
}

exports.sendBirthdayRewards = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: TASHKENT_TZ,
    region: "asia-south1",
    secrets: [BOT_TOKEN, SENTRY_DSN],
    // Ko'p sonli tug'ilgan kunli mijoz/sotuvchi juftligi bo'lsa ham
    // standart 60s timeout'dan oshib ketmasligi uchun - xuddi
    // `carts.js`/`engagementReminders.js`dagi bilan bir xil zaxira.
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const nowMs = Date.now();
    const todayMonthDay = computeTodayMonthDay(nowMs);
    const year = computeCurrentYear(nowMs);

    const clientsSnap = await db.collection("clients").where("birthdayMonthDay", "==", todayMonthDay).get();
    if (clientsSnap.empty) return;

    // Faqat KAMIDA BITTA sotuvchidan xarid qilgan (ya'ni haqiqiy,
    // tekshirilgan mijoz-sotuvchi bog'lanishi bor) mijozlar ko'rib
    // chiqiladi - hali hech qayerdan buyurtma bermagan, shunchaki
    // profilida tug'ilgan kunini kiritgan foydalanuvchiga hech qanday
    // sotuvchi mukofot berish uchun asos yo'q.
    const eligibleClients = clientsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => Array.isArray(c.linkedSellerIds) && c.linkedSellerIds.length > 0);

    if (eligibleClients.length === 0) return;

    const result = await processBatched(eligibleClients, async (client) => {
      for (const sellerId of client.linkedSellerIds) {
        try {
          const sellerSnap = await db.collection("sellers").doc(sellerId).get();
          if (!sellerSnap.exists) continue;
          const seller = sellerSnap.data();

          // Sotuvchi bu funksiyani ATAYLAB YOQISHI kerak - referal
          // dasturidan farqli o'laroq, bu HAQIQIY pul chegirmasi,
          // shuning uchun ongli ravishda yoqilishi kerak (xuddi
          // sodiqlik dasturi bilan bir xil falsafa).
          if (seller.birthdayDiscountEnabled !== true) continue;

          const alreadyRewarded = await hasBirthdayRewardThisYear(sellerId, client.id, year);
          if (alreadyRewarded) continue;

          const customBotToken = await getSellerCustomBotToken(sellerId);
          await grantBirthdayReward(sellerId, client.id, seller, customBotToken, year);
        } catch (err) {
          console.error(`Tug'ilgan kun chegirmasi xatosi (mijoz ${client.id}, sotuvchi ${sellerId}):`, err);
        }
      }
    });

    console.log(`sendBirthdayRewards: ${result.successCount}/${result.total} mijoz muvaffaqiyatli qayta ishlandi, ${result.failureCount} xato`);
  })
);

exports._testables = {
  computeTodayMonthDay,
  computeCurrentYear,
  generateBirthdayCouponCode,
  hasBirthdayRewardThisYear,
  resolveBirthdayDiscountPercent,
  grantBirthdayReward,
};
