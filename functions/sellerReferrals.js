const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage } = require("./lib/helpers");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");

/**
 * SOTUVCHIDAN-SOTUVCHIGA TAKLIF QILISH DASTURI ("O'sish" mexanizmi).
 *
 * Bu — mavjud, mijozdan-mijozga referal dasturidan (`orders.js`dagi
 * chegirma+kupon mexanizmi) BUTUNLAY ALOHIDA tizim: bu yerda sotuvchi
 * BOSHQA SOTUVCHINI taklif qiladi (yangi do'kon ochishga), pul emas,
 * balki AI CEO (Pro) funksiyasiga VAQTINCHA bepul kirish beriladi.
 *
 * OQIM (FOYDALANUVCHI TALABI BILAN v2'da qayta ko'rib chiqildi - endi
 * "obuna to'lovi tasdiqlanishi" asosiy signal, oddiy mahsulot
 * qo'shish EMAS):
 *  1. Sotuvchi A o'z "taklif havolasi"ni oladi (`src/utils/
 *     shareLink.js`dagi `buildSellerInviteLink`) va ulashadi.
 *  2. Yangi odam B shu havola orqali ilovani ochadi - `parseStartParam`
 *     buni oddiy "sellerId" EMAS, balki `sellerInviterId` sifatida
 *     taniydi (`lib/helpers.js`), shuning uchun B ODATDAGI "do'kon
 *     yaratish" oqimiga tushadi (A ning do'koni sifatida EMAS).
 *  3. B do'konini yaratgach (`createSeller`), frontend darhol shu
 *     fayldagi `recordSellerReferral`ni chaqiradi - bu B ning
 *     hujjatiga "kim taklif qilgan"ligini yozadi va A ning
 *     `sellerReferrals` jurnaliga "signed_up" holatida yozuv qo'shadi.
 *  4. B haqiqiy PULLIK "Pro" (AI CEO) obunasini sotib olib, TO'LOVI
 *     TASDIQLANGANDA - HOZIRCHA platformada markazlashtirilgan to'lov
 *     tizimi yo'qligi sababli (`TariffsPage.jsx`), bu tasdiqlash HALI
 *     HAM admin tomonidan, to'lov ilova TASHQARISIDA (masalan bank
 *     o'tkazmasi) kelishilgandan keyin, ADMIN PANEL orqali QO'LDA
 *     bosiladi (`setSellerTariffPlan.js` - bu ALLAQACHON mavjud,
 *     BOSHQA hech narsaga tegilmagan mexanizm). Shu QO'LDA
 *     tasdiqlashning aynan O'ZI - butun platformadagi "haqiqiy to'lov
 *     tasdiqlangani" haqidagi YAGONA signal - shuning uchun quyidagi
 *     `onDocumentUpdated` trigger aynan shu voqeani "kuzatib turadi":
 *     agar B avval referal orqali kelgan bo'lsa VA admin B UCHUN
 *     `aiCeoEnabled`ni (referal-sinov EMAS, balki HAQIQIY, doimiy
 *     mukofot sifatida) yoqsa, bu B ning "obunasi tasdiqlandi" deb
 *     hisoblanadi.
 *  5. A ning UMUMIY tasdiqlangan obunali takliflari soni HAR SAFAR
 *     birlashtirib boriladi. Har 3 ta (`REFERRALS_NEEDED_FOR_REWARD`)
 *     tasdiqlangan taklifdan so'ng, A ga ${REFERRAL_REWARD_DAYS} kunlik
 *     bepul AI CEO (Pro) beriladi - ya'ni bitta emas, KAMIDA UCHTA
 *     sotuvchini taklif qilib, ularning HAR BIRI haqiqiy obunaga ega
 *     bo'lishi kerak.
 *  6. Har kecha ishlaydigan `expireSellerReferralTrials` — muddati
 *     tugagan VAQTINCHA kirishlarni avtomatik o'chiradi (agar sotuvchi
 *     ADMIN tomonidan TO'G'RIDAN-TO'G'RI, o'z hisobi uchun doimiy
 *     yoqilgan bo'lsa, bu yerga tegilmaydi - pastdagi izohga qarang).
 */

// Necha ta HAQIQIY (to'lovi tasdiqlangan) taklif qilingan sotuvchi
// kerakligi - taklif qiluvchi bepul Pro mukofotiga ega bo'lishi uchun.
const REFERRALS_NEEDED_FOR_REWARD = 3;
// Har safar shu chegaraga (yoki uning karralisiga) yetilganda beriladigan
// AI CEO bepul foydalanish muddati.
const REFERRAL_REWARD_DAYS = 30;
// Xavfsizlik chegarasi: bitta sotuvchi cheksiz miqdorda mukofot ola
// olmasligi kerak - shuning uchun umr bo'yi mukofotlar soni
// chegaralangan. Bundan keyingi tasdiqlangan takliflar baribir
// RO'YXATGA OLINADI (statistikada ko'rinadi), faqat qo'shimcha bepul
// kun berilmaydi.
const MAX_REWARDED_REFERRALS_PER_SELLER = 20;

/**
 * Yangi sotuvchi do'kon yaratgandan darhol so'ng chaqiriladi (agar u
 * taklif havolasi orqali kelgan bo'lsa). Ikkita yozuvni amalga
 * oshiradi: (a) yangi sotuvchining o'z hujjatida "kim taklif
 * qilgan"ligini belgilaydi, (b) taklif qiluvchining jurnaliga
 * "ro'yxatdan o'tdi" yozuvini qo'shadi.
 *
 * XAVFSIZLIK: bu FAQAT yangi yaratilgan, hali HECH QANDAY referal
 * ma'lumoti yo'q sotuvchi hujjati uchun ishlaydi (bir marta yozilgach,
 * o'zgarmaydi) - shuning uchun ikki marta chaqirilsa ham (masalan
 * tarmoq xatosi tufayli frontend qayta urinsa), natija o'zgarmaydi.
 */
async function handleRecordSellerReferral(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bu funksiyani ishlatish uchun tizimga kirgan bo'lishingiz kerak.");
  }

  const uid = request.auth.uid;
  const { referrerSellerId } = request.data || {};
  const referrerId = String(referrerSellerId || "").trim();

  if (!referrerId) {
    throw new HttpsError("invalid-argument", "Taklif qiluvchi ID ko'rsatilmagan.");
  }
  if (referrerId === uid) {
    throw new HttpsError("invalid-argument", "O'zingizni taklif qila olmaysiz.");
  }

  const [ownSnap, referrerSnap] = await Promise.all([
    db.collection("sellers").doc(uid).get(),
    db.collection("sellers").doc(referrerId).get(),
  ]);

  if (!ownSnap.exists) {
    throw new HttpsError("failed-precondition", "Avval do'koningizni yarating.");
  }
  if (!referrerSnap.exists) {
    // Taklif qiluvchi hujjati topilmadi (masalan o'chirilgan) - jim
    // qaytamiz, chunki bu yangi sotuvchining o'z do'kon yaratish
    // jarayonini TO'XTATMASLIGI kerak (referal — qo'shimcha bonus,
    // asosiy oqim emas).
    return { recorded: false };
  }

  // Idempotentlik: agar bu sotuvchi allaqachon (masalan qayta
  // urinishdan) referal bilan belgilangan bo'lsa, qayta yozmaymiz.
  if (ownSnap.data()?.referredBySellerId) {
    return { recorded: false, alreadyRecorded: true };
  }

  const referredStoreName = ownSnap.data()?.storeName || null;

  await Promise.all([
    db.collection("sellers").doc(uid).update({
      referredBySellerId: referrerId,
    }),
    db.collection("sellers").doc(referrerId).collection("sellerReferrals").doc(uid).set({
      referredSellerId: uid,
      referredStoreName,
      status: "signed_up",
      signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
  ]);

  return { recorded: true };
}

exports.recordSellerReferral = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleRecordSellerReferral));

/**
 * Taklif qilingan sotuvchining PULLIK Pro obunasi TASDIQLANGANDA
 * (ya'ni admin uning `aiCeoEnabled`ni HAQIQIY, referal-sinov EMAS
 * mukofot sifatida yoqqanda) chaqiriladi - `sellers/{sellerId}`
 * hujjati o'zgarganda ishlaydigan Firestore trigger orqali.
 *
 * Nega bu yerda "haqiqiy to'lov" deb ADMIN QO'LDA yoqqan holatini
 * tekshiramiz: platformada hali markazlashtirilgan to'lov tizimi yo'q
 * (`TariffsPage.jsx`), shuning uchun "obuna to'lovi tasdiqlandi"
 * degan HAQIQIY, ishonchli signal FAQAT shu QO'LDA tasdiqlash
 * bosqichida (`setSellerTariffPlan.js`) mavjud - u orqali `aiCeoEnabled`
 * `aiCeoGrantedViaReferral` bayrog'isiz `true`ga o'rnatiladi
 * (referal-sinov O'ZI ham `aiCeoEnabled:true` yozadi, lekin ALBATTA
 * `aiCeoGrantedViaReferral:true` bilan birga - shu farq orqali ikkalasi
 * bir-biridan ANIQ ajratiladi, referal-sinovning o'zi ikkinchi
 * darajali "zanjir" hisoblanmaydi).
 */
async function handleSellerAiCeoAccessChanged(event) {
  try {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const sellerId = event.params.sellerId;
    const referrerId = after.referredBySellerId;

    // Referal orqali kelmagan sotuvchilar uchun bu yerda umuman ish yo'q.
    if (!referrerId) return;

    // Faqat `false/mavjud emas -> true` O'TISHI qiziqtiradi - boshqa har
    // qanday o'zgarish (masalan admin Pro'ni o'chirsa) e'tiborga
    // olinmaydi.
    const turnedOn = before.aiCeoEnabled !== true && after.aiCeoEnabled === true;
    if (!turnedOn) return;

    // MUHIM: referal-sinov mukofoti (shu funksiyaning pastki qismi,
    // referrerga aiCeoEnabled beradigan joy) O'ZI ham
    // `aiCeoEnabled:true` yozadi - lekin ALBATTA
    // `aiCeoGrantedViaReferral:true` bilan birga. Bu FAQAT admin
    // tomonidan QO'LDA, HAQIQIY (pullik) obuna sifatida yoqilgan
    // holatni tutishi kerak.
    if (after.aiCeoGrantedViaReferral === true) return;

    // Idempotentlik: bu taklif uchun to'lov ALLAQACHON hisobga
    // olingan bo'lsa (masalan admin keyinroq Pro'ni o'chirib, qayta
    // yoqsa), qayta hisoblanmaydi.
    if (after.referralPaidConfirmed === true) return;

    const sellerRef = db.collection("sellers").doc(sellerId);
    const referrerRef = db.collection("sellers").doc(referrerId);
    const referralLogRef = referrerRef.collection("sellerReferrals").doc(sellerId);

    const referrerSnap = await referrerRef.get();
    if (!referrerSnap.exists) return;

    await Promise.all([
      sellerRef.update({
        referralPaidConfirmed: true,
        referralPaidConfirmedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
      referralLogRef.set(
        {
          status: "subscribed",
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    const referrer = referrerSnap.data();
    const confirmedSoFar = (Number(referrer.sellerReferralPaidCount) || 0) + 1;

    // Har `REFERRALS_NEEDED_FOR_REWARD` (3) tasdiqlangan taklifdan
    // so'nggina mukofot beriladi - oraliq (masalan 1-chi yoki 2-chi)
    // tasdiqlangan taklif faqat hisoblanadi, mukofot bermaydi.
    const reachedRewardThreshold = confirmedSoFar % REFERRALS_NEEDED_FOR_REWARD === 0;
    const rewardsSoFar = Number(referrer.sellerReferralRewardsCount) || 0;
    const capReached = rewardsSoFar >= MAX_REWARDED_REFERRALS_PER_SELLER;

    if (!reachedRewardThreshold) {
      await referrerRef.update({ sellerReferralPaidCount: admin.firestore.FieldValue.increment(1) });
      return;
    }

    if (capReached) {
      await referrerRef.update({ sellerReferralPaidCount: admin.firestore.FieldValue.increment(1) });
      return;
    }

    // Mukofot muddatini hisoblash: agar sotuvchida ALLAQACHON faol
    // (referal orqali berilgan) muddat bo'lsa, YANGI kunlar O'SHA
    // muddatga QO'SHILADI (stacking) - keyingi mukofot birinchisining
    // ustiga "uzaytiradi", uni bekor qilmaydi. Agar muddat allaqachon
    // o'tib ketgan bo'lsa (yoki umuman bo'lmasa), hisoblash HOZIRDAN
    // boshlanadi.
    const now = Date.now();
    const currentExpiryMs = referrer.aiCeoTrialExpiresAt?.toMillis?.() || 0;
    const baseMs = currentExpiryMs > now ? currentExpiryMs : now;
    const newExpiryMs = baseMs + REFERRAL_REWARD_DAYS * 24 * 60 * 60 * 1000;

    await referrerRef.update({
      aiCeoEnabled: true,
      // MUHIM: bu bayroq — `expireSellerReferralTrials` ENDI shu
      // hisobga "tegishi mumkin"ligini bildiradi. Agar admin
      // `aiCeoEnabled`ni QO'LDA (doimiy) yoqqan bo'lsa, bu bayroq
      // `false`/mavjud emas bo'lib qoladi - sweep funksiyasi bunday
      // hisoblarga umuman tegmaydi.
      aiCeoGrantedViaReferral: true,
      aiCeoTrialExpiresAt: admin.firestore.Timestamp.fromMillis(newExpiryMs),
      sellerReferralPaidCount: admin.firestore.FieldValue.increment(1),
      sellerReferralRewardsCount: admin.firestore.FieldValue.increment(1),
    });

    try {
      await sendTelegramMessage(
        BOT_TOKEN.value(),
        referrerId,
        `🎉 Tabriklaymiz! Siz taklif qilgan ${REFERRALS_NEEDED_FOR_REWARD} ta sotuvchi Pro obunasini tasdiqladi.\n\nSiz ${REFERRAL_REWARD_DAYS} kunlik AI CEO (Pro) bepul kirish oldingiz!`
      );
    } catch (err) {
      console.error(`Referal mukofoti haqida xabar yuborishda xatolik (${referrerId}):`, err);
      initSentry();
      Sentry.captureException(err, { extra: { referrerId } });
    }
  } catch (err) {
    console.error("Referal to'lov tasdiqlashni qayta ishlashda xatolik:", err);
    initSentry();
    Sentry.captureException(err);
  }
}

exports.onSellerAiCeoAccessChanged = onDocumentUpdated(
  { document: "sellers/{sellerId}", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] },
  handleSellerAiCeoAccessChanged
);

/**
 * Har kecha ishlaydi: referal orqali berilgan, muddati tugagan
 * VAQTINCHA AI CEO kirishlarini o'chiradi.
 *
 * MUHIM: faqat `aiCeoGrantedViaReferral === true` bo'lgan hisoblarga
 * tegadi - bu, admin panel orqali QO'LDA, doimiy ravishda yoqilgan
 * (`setSellerTariffPlan.js`) hisoblarni BUTUNLAY chetlab o'tadi,
 * chunki ular uchun `aiCeoGrantedViaReferral` maydoni umuman
 * yozilmagan.
 */
exports.expireSellerReferralTrials = onSchedule(
  {
    schedule: "0 3 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const now = admin.firestore.Timestamp.now();
    // Xavfsizlik chegarasi: bir yugurishda ko'pi bilan shuncha hisobni
    // qayta ishlaydi - qolganlari ertangi yugurishda davom etadi.
    const MAX_PER_RUN = 200;

    const expiredSnap = await db.collection("sellers")
      .where("aiCeoGrantedViaReferral", "==", true)
      .where("aiCeoTrialExpiresAt", "<=", now)
      .limit(MAX_PER_RUN)
      .get();

    // Hisoblar orasida umumiy o'zgaruvchan holat yo'q (har biri o'z
    // hujjatini yangilaydi va o'ziga xabar yuboradi), shuning uchun
    // oddiy PARALEL guruhlash yetarli.
    const result = await processBatched(expiredSnap.docs, async (doc) => {
      try {
        await doc.ref.update({
          aiCeoEnabled: false,
          aiCeoGrantedViaReferral: false,
        });
        await sendTelegramMessage(
          BOT_TOKEN.value(),
          doc.id,
          [
            "⏳ *AI CEO (Pro) bepul sinov muddati tugadi*",
            "",
            "Yana faollashtirish uchun yangi sotuvchi taklif qiling yoki tarif rejalari bilan tanishing.",
          ].join("\n")
        ).catch(() => {});
      } catch (err) {
        console.error(`AI CEO sinov muddatini tugatishda xatolik (${doc.id}):`, err);
        throw err;
      }
    });
    console.log(`expireSellerReferralTrials: ${result.successCount}/${result.total} hisob muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

exports._testables = { handleRecordSellerReferral, handleSellerAiCeoAccessChanged };
