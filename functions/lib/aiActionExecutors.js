const { admin, db } = require("./admin");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./customerNotify");
const { trackCrmMessageRecipients, logNotification } = require("./dailyStats");

/**
 * AI CEO — YANGI harakat turlari uchun HAQIQIY ijro mantig'i.
 *
 * ZeloShop — AI Business Operating System master prompti (E/G-bo'lim):
 * `functions/lib/aiApprovalEngine.js`ning `approveAction`i har bir
 * `actionType` uchun mos ijro funksiyasini `executors` xaritasidan
 * (dependency injection) oladi — bu fayl aynan o'sha funksiyalarni
 * beradi. `crmCampaign` uchun ijro (`executeCrmCampaignSend`) ATAYLAB
 * shu yerga KO'CHIRILMAGAN — u `telegramApproval.js`da, ISHLAB TURGAN
 * holicha qoladi (keraksiz kod harakatini oldini olish); bu fayl FAQAT
 * YANGI `adCampaign` turi uchun.
 *
 * MUHIM (halollik chegarasi): boshqa "best-effort" yordamchi
 * funksiyalardan (masalan `aiCeoAutoDiscount.js`) FARQLI o'laroq, bu
 * yerda promokod yaratish XATO YUTMAYDI (try/catch bilan
 * yashirilmaydi) — chunki bu endi rasmiy tasdiqlangan harakatning
 * ASOSIY natijasi (ixtiyoriy "bonus" emas): agar promokod
 * yaratilmasa, harakat HAQIQATDA muvaffaqiyatsiz bo'lgan va
 * `aiApprovalEngine.js` buni to'g'ri `FAILED_FINAL` holatiga
 * o'tkazishi, sotuvchiga xato ko'rsatishi kerak.
 */

// Promokod amal qilish muddati — `aiCeoAutoDiscount.js`dagi 7 kunlik
// "qaytarish" mukofotidan FARQLI, mustaqil tanlangan qiymat: bu keng
// qamrovli reklama kampaniyasi (bitta mijoz uchun emas), shuning uchun
// biroz uzoqroq muddat — mijozlarning aksariyati birinchi hafta ichida
// ko'rmasligi mumkinligini hisobga oladi.
const AD_CAMPAIGN_COUPON_EXPIRY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function generateAdCampaignCouponCode() {
  return `AKSIYA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * YANGI: "AI CEO'dan so'rang" chatidan (yoki kelajakda boshqa
 * manbadan) taklif qilingan, sotuvchi TASDIQLAGAN reklama
 * kampaniyasini ijro etadi — haqiqiy, bir martalik promokod yaratadi
 * (`sellers/{sellerId}/coupons`, `aiCeoAutoDiscount.js` bilan BIR XIL
 * hujjat sxemasi) va uni CRM broadcast orqali `targetClientIds`ga
 * yetkazadi.
 *
 * Promokod HAR DOIM shu yerda, ijro vaqtida yaratiladi — AI taklif
 * bosqichida promokodni "o'ylab topmaydi" (hallyutsinatsiya xavfi
 * yo'q, `aiCeoAutoDiscount.js`dagi 5-band bilan bir xil tamoyil).
 * Shuning uchun xabar matni ham shu yerda, HAQIQIY kod bilan qayta
 * tuziladi — `payload.message`da (agar bo'lsa) ko'rsatilgan har qanday
 * o'rinbosar kod emas, balki ANIQ shu ijrodagi kod ishlatiladi.
 *
 * @param {object} ctx
 * @param {string} ctx.sellerId
 * @param {object} ctx.payload - tasdiqlangan `aiCeoPendingActions` hujjati
 *   (segment/tag/budget/discountPercent/title/message/targetClientIds/dateId)
 * @returns {Promise<{sent:number, total:number, couponCode:string, discountPercent:number}>}
 */
async function executeAdCampaign({ sellerId, payload }) {
  const targetClientIds = payload.targetClientIds || [];
  const discountPercent = payload.discountPercent;

  // 1) Haqiqiy, bir martalik promokod — XATO bo'lsa YUTILMAYDI (fayl
  // boshidagi izohga qarang): bu harakatning ASOSIY natijasi.
  const code = generateAdCampaignCouponCode();
  const expiresAtMs = Date.now() + AD_CAMPAIGN_COUPON_EXPIRY_DAYS * DAY_MS;
  await db.collection("sellers").doc(sellerId).collection("coupons").doc(code).set({
    code,
    discountType: "percent",
    discountValue: discountPercent,
    expiresAt: new Date(expiresAtMs).toISOString(),
    // Har bir maqsad mijoz ko'pi bilan bir marta ishlatishi mumkin -
    // umumiy limit yuborilgan mijozlar soniga teng (nazoratsiz
    // ko'p martalik foydalanishning oldini oladi, lekin har bir
    // haqiqiy qabul qiluvchiga yetarli).
    usageLimit: targetClientIds.length,
    usedCount: 0,
    isActive: true,
    isAiCeoAdCampaignReward: true,
    sourceSegment: payload.segment || null,
    sourceTag: payload.tag || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });

  // 2) CRM broadcast — `telegramApproval.js`dagi `executeCrmCampaignSend`
  // bilan BIR XIL yetkazish mantig'i (sotuvchining shaxsiy boti,
  // keyin zaxira sifatida platforma boti), lekin xabar matniga ANIQ
  // shu ijrodagi promokod qatori qo'shiladi.
  const couponLine = `\n\n🎁 Promokod: *${code}* (-${discountPercent}%)`;
  const text = `*${payload.title}*\n\n${payload.message}${couponLine}`;
  const customBotToken = await getSellerCustomBotToken(sellerId);
  const results = await Promise.all(targetClientIds.map((id) => sendCustomerNotification(customBotToken, id, text)));
  const successfulIds = targetClientIds.filter((id, i) => results[i]?.ok);

  await trackCrmMessageRecipients(sellerId, successfulIds);
  await Promise.all(successfulIds.map((id) => logNotification({
    sellerId, clientId: id, type: "aiCeoAdCampaign", title: payload.title, message: text, delivered: true,
  })));

  return { sent: successfulIds.length, total: targetClientIds.length, couponCode: code, discountPercent };
}

module.exports = { executeAdCampaign, AD_CAMPAIGN_COUPON_EXPIRY_DAYS };
