const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * MIJOZLARNING "DO'ST TAKLIF QILISH" REYTINGI (Leaderboard).
 *
 * MUHIM: bu — `functions/orders.js`dagi MAVJUD mijozdan-mijozga
 * referal dasturi (`sellers/{id}/referrals/{refereeId}` yozuvlari,
 * har biri muvaffaqiyatli - ya'ni birinchi buyurtmasini bergan -
 * taklifni bildiradi) USTIGA qurilgan qo'shimcha. (Bu ham
 * `functions/sellerReferrals.js`dagi SOTUVCHIDAN-SOTUVCHIGA taklif
 * dasturidan BUTUNLAY ALOHIDA - u yerdagi fayl nomi shunga ishora
 * qilib chalkashtirmasin.)
 *
 * TARIX (2026-09, #114 tuzatish): AVVAL bu funksiya `referrals` quyi
 * kolleksiyasining o'zidan, so'rov vaqtida, `REFERRAL_SCAN_LIMIT=500`
 * hujjatgacha O'QIB, xotirada hisoblar edi. Bu — do'konda 500 tadan
 * KO'P referal yozuvi to'planganda (`orderBy` YO'Q holda) noto'g'ri
 * natija berish xavfini tug'dirardi: Firestore qaytargan "birinchi
 * 500 ta" HAQIQIY eng ko'p taklif qilganlarni o'z ichiga olmasligi
 * mumkin edi.
 *
 * YANGI YECHIM: `functions/orders.js` endi HAR BIR muvaffaqiyatli
 * referal uchun `sellers/{sellerId}/referralCounts/{referrerId}`
 * hujjatidagi `count`ni ORTTIRIB boradi (running aggregate counter -
 * xuddi `sellerTrustStats`dagi kabi). Bu yerda esa faqat O'SHA
 * TAYYOR hisoblagichdan `orderBy("count","desc").limit(10)` bilan
 * TOP-10ni, va aniq o'rinni `.count()` AGREGATSIYA so'rovi bilan
 * (to'liq jadvalni o'qimasdan) olamiz.
 *
 * MAXFIYLIK: reytingda HECH QANDAY ism/telefon/ID ko'rsatilmaydi -
 * faqat o'rin (rank) va son. Xaridor faqat O'ZINING nechinchi
 * o'rinda ekanini biladi, boshqalarning shaxsini bilmaydi.
 */
const LEADERBOARD_SIZE = 10;

async function handleGetReferralLeaderboard(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const clientId = request.auth.uid;
  await checkRateLimit(`getReferralLeaderboard:${clientId}`, 5, 60);

  const { sellerId } = request.data || {};
  if (!sellerId) {
    throw new HttpsError("invalid-argument", "Sotuvchi ko'rsatilmagan.");
  }

  const countsCollection = db.collection("sellers").doc(String(sellerId)).collection("referralCounts");

  const [topSnap, myDoc] = await Promise.all([
    countsCollection.orderBy("count", "desc").limit(LEADERBOARD_SIZE).get(),
    countsCollection.doc(clientId).get(),
  ]);

  const leaderboard = [];
  topSnap.forEach((doc) => {
    const count = Number(doc.data()?.count) || 0;
    if (count <= 0) return;
    leaderboard.push({
      rank: leaderboard.length + 1,
      count,
      isYou: doc.id === clientId,
    });
  });

  const myCount = Number(myDoc.exists ? myDoc.data()?.count : 0) || 0;
  // Mening o'rnim: agar TOP-10 ichida bo'lsam - yuqoridagi ro'yxatdan
  // olinadi; aks holda, mendan KO'PROQ hisobga ega odamlar sonini
  // ANIQ (to'liq jadvalni o'qimasdan) `.count()` agregatsiya so'rovi
  // bilan bilib, o'sha songa 1 qo'shamiz. Hali birorta ham
  // muvaffaqiyatli taklifi yo'q bo'lsa - reytingda umuman yo'q,
  // `myRank: null`.
  let myRank = null;
  if (myCount > 0) {
    const inTopIndex = leaderboard.findIndex((entry) => entry.isYou);
    if (inTopIndex >= 0) {
      myRank = leaderboard[inTopIndex].rank;
    } else {
      const aheadSnap = await countsCollection.where("count", ">", myCount).count().get();
      myRank = (Number(aheadSnap.data()?.count) || 0) + 1;
    }
  }

  return { leaderboard, myRank, myCount };
}

exports.getReferralLeaderboard = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleGetReferralLeaderboard));
exports._testables = { handleGetReferralLeaderboard, LEADERBOARD_SIZE };
