const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { incrementDailyStat, logNotification } = require("./lib/dailyStats");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const {
  BONUS_COUPON_VALID_DAYS,
  computeIsoWeekKey,
  pickTopReferrers,
  generateLeaderboardBonusCouponCode,
} = require("./lib/referralLeaderboardBonus");

/**
 * REFERAL REYTINGINING "HAFTALIK G'OLIBLARI" MUKOFOTI.
 *
 * Maqsad: `sellers/{id}/referralWeeklyCounts/{weekKey}` hujjatida
 * (har bir muvaffaqiyatli referal uchun `functions/orders.js`
 * tomonidan real vaqtda oshirib boriladigan) o'sha HAFTA ichida ENG
 * KO'P do'st taklif qilgan TOP-3 mijozga, haftaning oxirida (Dushanba
 * ertalab, o'tgan haftaning yakunlari bo'yicha) avtomatik chegirma
 * promokodi + Telegram tabrik xabari yuboradi.
 *
 * NEGA ALOHIDA HAFTALIK HISOBLAGICH (mavjud, DOIMIY `referralCounts`
 * emas): agar mukofot doimiy jamlangan hisobga asoslansa, ERTA
 * boshlagan bitta mijoz HAR SAFAR g'olib chiqib qolar edi - bu
 * gamifikatsiya (haftama-hafta qayta faollashtirish) maqsadini
 * yo'qqa chiqaradi. Batafsil arxitektura izohi:
 * `functions/lib/referralLeaderboardBonus.js`.
 *
 * TAKRORLANMASLIK KAFOLATI: har bir (sotuvchi, hafta) juftligi uchun
 * FAQAT BIR marta mukofot beriladi - `referralWeeklyCounts/{weekKey}`
 * hujjatining o'ziga `bonusGranted: true` belgisi yoziladi (xuddi
 * boshqa vaqtli funksiyalardagi kabi, alohida "marker" kolleksiyasi
 * shart emas).
 *
 * SOZLAMA: sotuvchi ATAYLAB o'chirib qo'yishi mumkin
 * (`referralLeaderboardBonusEnabled: false`) - lekin bazaviy referal
 * dasturi kabi (pul xavfi past, sotuvchiga majburiy xarajat emas -
 * faqat bir martalik chegirma promokodi) standart bo'yicha YOQILGAN.
 */
const TASHKENT_TZ = "Asia/Tashkent";
// Bir hafta oldingi (haqiqatda "o'tgan, TUGAGAN hafta") ISO hafta
// kalitini olish uchun - funksiya Dushanba ertalab ishga tushganda,
// "joriy hafta" ENDI boshlangan bo'ladi, shuning uchun 7 kun orqaga
// qaytib, O'TGAN haftaning kalitini hisoblaymiz.
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Bitta g'olibga mukofot promokodini yaratadi va tabrik xabarini yuboradi. */
async function grantLeaderboardBonus(sellerId, seller, customBotToken, winner, weekKey) {
  const couponCode = generateLeaderboardBonusCouponCode();

  await db.collection("sellers").doc(sellerId).collection("coupons").doc(couponCode).set({
    code: couponCode,
    discountType: "percent",
    discountValue: winner.bonusPercent,
    expiresAt: new Date(Date.now() + BONUS_COUPON_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    isReferralLeaderboardBonus: true,
    rewardForClientId: winner.referrerId,
    referralLeaderboardWeekKey: weekKey,
    referralLeaderboardRank: winner.rank,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });

  const storeName = seller.storeName || "Do'kon";
  const text = `🏆 Tabriklaymiz! Siz shu hafta "${storeName}" do'konida ENG KO'P do'st taklif qilganlar reytingida ${winner.rank}-o'rinni egalladingiz!\n\nSizga ${winner.bonusPercent}% chegirma sovg'a qilinmoqda.\nPromokod: ${couponCode} (${BONUS_COUPON_VALID_DAYS} kun amal qiladi)`;

  await sendCustomerNotification(customBotToken, winner.referrerId, text);
  await incrementDailyStat(sellerId, "referralLeaderboardBonusesSent");
  await logNotification({
    sellerId,
    clientId: winner.referrerId,
    type: "referralLeaderboardBonus",
    title: "Referal reytingi mukofoti",
    message: text,
  });

  return couponCode;
}

/** Bitta sotuvchi uchun o'tgan haftaning g'oliblarini aniqlab, mukofot beradi (agar hali berilmagan bo'lsa). */
async function processSellerLeaderboardBonus(sellerDoc, weekKey) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;

  // Bazaviy referal dasturi o'chirilgan bo'lsa yoki mukofot ATAYLAB
  // o'chirilgan bo'lsa - o'tkazib yuboriladi. Ikkalasi ham standart
  // bo'yicha YOQILGAN (opt-out), faqat aniq `false` bo'lsa o'chadi.
  if (seller.referralProgramEnabled === false) return { granted: 0 };
  if (seller.referralLeaderboardBonusEnabled === false) return { granted: 0 };

  const weeklyRef = db.collection("sellers").doc(sellerId).collection("referralWeeklyCounts").doc(weekKey);
  const weeklySnap = await weeklyRef.get();
  if (!weeklySnap.exists) return { granted: 0 };

  const weeklyData = weeklySnap.data() || {};
  if (weeklyData.bonusGranted === true) return { granted: 0 }; // allaqachon berilgan - takror emas

  const winners = pickTopReferrers(weeklyData.counts);
  if (winners.length === 0) {
    await weeklyRef.set({ bonusGranted: true }, { merge: true });
    return { granted: 0 };
  }

  const customBotToken = await getSellerCustomBotToken(sellerId);
  let granted = 0;
  for (const winner of winners) {
    try {
      await grantLeaderboardBonus(sellerId, seller, customBotToken, winner, weekKey);
      granted += 1;
    } catch (err) {
      console.error(`Referal reytingi mukofoti xatosi (sotuvchi ${sellerId}, g'olib ${winner.referrerId}):`, err);
    }
  }

  // Muvaffaqiyatsiz urinishlar bo'lsa ham, BUTUN hafta uchun faqat
  // BIR marta urinilishi kerak - qayta-qayta urinish o'sha mijozlarga
  // takroriy promokod yuborib yuborishi mumkin edi.
  await weeklyRef.set({ bonusGranted: true, bonusGrantedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  return { granted };
}

/**
 * 2026-09 audit: `referralLeaderboardBonusEnabled` maydoni sotuvchida
 * UMUMAN YO'Q bo'lishi mumkin (standart bo'yicha yoqilgan - yuqoridagi
 * `processSellerLeaderboardBonus`dagi `=== false` tekshiruvi buni
 * to'g'ri hisobga oladi). LEKIN aynan shu sabab - maydon yo'qligi
 * "yoqilgan" degani - bu yerdagi asosiy cron so'rovini kelajakda
 * `where("referralLeaderboardBonusEnabled", "==", true)` bilan
 * OPTIMALLASHTIRISHNI (butun kolleksiyani o'qish o'rniga) XAVFLI
 * qiladi: Firestore'da `==`/`!=` operatorlari maydon UMUMAN yo'q
 * hujjatlarni "mos kelmadi" deb hisoblaydi - ya'ni bunday so'rov
 * standart (maydon yo'q) holatdagi BARCHA sotuvchilarni JIMGINA
 * chetlab o'tган bo'lardi (funksiya ularga umuman ishlamay qoladi,
 * hech qanday xato ko'rinmasdan).
 *
 * Bu funksiya - shu muammoni HAL QILISH uchun birinchi, xavfsiz qadam:
 * har bir haftalik ishga tushishda (qo'shimcha o'qish XARAJATISIZ -
 * sotuvchi hujjatlari allaqachon yuqorida `sellersSnap.get()` orqali
 * yuklab olingan), maydoni YO'Q sotuvchilarga ANIQ `true` qiymatini
 * yozib qo'yadi (mavjud, ATAYLAB `false` qilingan sozlamaga
 * TEGILMAYDI). Bir necha haftadan so'ng (yoki `createSeller.js`
 * orqali yaratilgan barcha YANGI sotuvchilarda maydon boshidanoq
 * mavjudligi tufayli tezroq) BARCHA sotuvchida bu maydon aniq
 * belgilangan bo'ladi - shundagina yuqoridagi `where()` optimallashuvi
 * xavfsiz bo'ladi. Bu QASDDAN HALI QO'LLANILMAGAN - chunki bu muhitda
 * (sandbox) production Firestore'ga ulanib, backfill haqiqatan
 * TUGAGANINI tasdiqlash IMKONI YO'Q (`firebase-tools` autentifikatsiya
 * talab qiladi) - "tekshirish imkoni bo'lmagan" holatda xavfli
 * so'rovni yoqish noto'g'ri bo'lardi.
 */
async function backfillMissingBonusFlag(sellersSnap) {
  const missingDocs = sellersSnap.docs.filter(
    (doc) => doc.data().referralLeaderboardBonusEnabled === undefined
  );
  if (missingDocs.length === 0) return 0;

  // Firestore to'plamli yozuv chegarasi - 500. 400talik xavfsiz
  // bo'laklarga bo'lib yozamiz (`adminSellerManagement.js`dagi bilan
  // bir xil naqsh).
  for (let i = 0; i < missingDocs.length; i += 400) {
    const batch = db.batch();
    missingDocs.slice(i, i + 400).forEach((doc) => {
      batch.set(doc.ref, { referralLeaderboardBonusEnabled: true }, { merge: true });
    });
    await batch.commit();
  }
  return missingDocs.length;
}

exports.sendReferralLeaderboardBonuses = onSchedule(
  {
    // Dushanba ertalab, boshqa haftalik/kunlik crondan (pricing
    // tavsiyasi - Dushanba 6:00, mahsulot tavsiyalari - har kuni 4:00)
    // keyinroq - resurs to'qnashuvidan qochish uchun.
    schedule: "0 7 * * 1",
    timeZone: TASHKENT_TZ,
    region: "asia-south1",
    secrets: [BOT_TOKEN, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const weekKey = computeIsoWeekKey(Date.now() - ONE_WEEK_MS);
    const sellersSnap = await db.collection("sellers").get();
    if (sellersSnap.empty) return;

    let backfilledCount = 0;
    try {
      backfilledCount = await backfillMissingBonusFlag(sellersSnap);
    } catch (err) {
      // Backfill - qo'shimcha, ORQAGA MOSLASHUVCHAN yaxshilash, asosiy
      // mukofot berish vazifasi emas. Bu yerda xato bo'lsa ham, pastdagi
      // haqiqiy mukofot berish davom etishi SHART.
      console.error("referralLeaderboardBonusEnabled maydonini backfill qilishda xatolik:", err);
    }

    const result = await processBatched(sellersSnap.docs, async (sellerDoc) => {
      await processSellerLeaderboardBonus(sellerDoc, weekKey);
    });

    console.log(`sendReferralLeaderboardBonuses (${weekKey}): ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli qayta ishlandi, ${result.failureCount} xato, ${backfilledCount} ta sotuvchida referralLeaderboardBonusEnabled maydoni backfill qilindi`);
  })
);

exports._testables = { grantLeaderboardBonus, processSellerLeaderboardBonus, backfillMissingBonusFlag, ONE_WEEK_MS };
