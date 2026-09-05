const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY } = require("./lib/admin");
const { incrementDailyStat, logNotification } = require("./lib/dailyStats");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
// AI CEO premium sotuvchilar uchun xabarning kirish qismini
// shaxsiylashtirib yozadi - batafsil izoh va xavfsizlik naqshi
// `aiCeo.js`dagi `craftCartRecoveryMessage` ustida.
const { craftCartRecoveryMessage } = require("./aiCeo");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Tashlab ketilgan savat eslatmasi.
 *
 * Maqsad: xaridor mahsulotlarni savatga qo'shib, lekin buyurtma
 * bermay ketgan holatlarni qaytarib sotuvga aylantirish.
 *
 * Ishlash tartibi: har 30 daqiqada "faol" (status="active") va
 * so'nggi 2 soatdan beri o'zgarmagan savatlarni qidiradi, egalariga
 * Telegram orqali eslatma yuboradi (ixtiyoriy ravishda bir martalik
 * "qaytarish" chegirmasi bilan birga), va holatni "reminded"ga
 * o'zgartiradi - shu savat uchun ikkinchi marta eslatma yuborilmaydi.
 * Agar mijoz qaytib savatni yana o'zgartirsa, `syncCart.js` uni yana
 * "active"ga qaytaradi va jarayon qaytadan boshlanadi.
 *
 * Firestore so'rovi (`.where("status","==","active")
 * .where("updatedAt","<=",cutoff)`) natijada qaytgan hujjatlar soni
 * qancha bo'lishidan qat'i nazar bitta so'rov sifatida bajariladi.
 */
const CART_ABANDON_HOURS = 2;
const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;

function generateRecoveryCouponCode() {
  return `QAYT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

exports.sendAbandonedCartReminders = onSchedule(
  {
    schedule: "every 30 minutes", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - CART_ABANDON_HOURS * 60 * 60 * 1000);

    const cartsSnap = await db.collection("carts")
      .where("status", "==", "active")
      .where("updatedAt", "<=", cutoff)
      .get();

    if (cartsSnap.empty) return;

    // Elementlarni AVVAL sotuvchi bo'yicha guruhlaymiz: GURUH ICHIDA
    // (bir xil sotuvchining savatlari) ketma-ket ishlanadi - sotuvchi
    // ma'lumoti/bot tokeni bir marta o'qiladi, xuddi avvalgidek.
    // GURUHLAR orasida (turli sotuvchilar) esa PARALEL ishlov
    // beriladi - bu xavfsiz, chunki turli sotuvchilar orasida umumiy
    // o'zgaruvchan holat yo'q (batafsil izoh: `lib/batchProcess.js`).
    const cartsBySeller = new Map();
    cartsSnap.docs.forEach((cartDoc) => {
      const cart = cartDoc.data();
      if (!cart.sellerId || !cart.clientId || !Array.isArray(cart.items) || cart.items.length === 0) return;
      if (!cartsBySeller.has(cart.sellerId)) cartsBySeller.set(cart.sellerId, []);
      cartsBySeller.get(cart.sellerId).push(cartDoc);
    });

    const result = await processBatched(Array.from(cartsBySeller.entries()), async ([sellerId, cartDocs]) => {
      // Mijozga xabar avval sotuvchining shaxsiy boti orqali
      // yuboriladi (xaridor zeloshop haqida bilishi shart emas - u
      // sotuvchining o'z boti bilan ishlaydi), platforma boti faqat
      // zaxira sifatida ishlatiladi (batafsil izoh: `lib/customerNotify.js`).
      const sellerSnap = await db.collection("sellers").doc(sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      const customBotToken = await getSellerCustomBotToken(sellerId);

      for (const cartDoc of cartDocs) {
        const cart = cartDoc.data();
        try {
          // Sotuvchi bu funksiyani ATAYLAB o'chirib qo'ygan bo'lishi
          // mumkin (masalan, mijozlarni ortiqcha xabar bilan
          // charchatishni xohlamasa).
          if (seller.cartReminderEnabled === false) continue;

          const itemsList = cart.items.slice(0, 5).map((i) => `• ${i.name} x${i.quantity}`).join("\n");
          const moreCount = cart.items.length > 5 ? cart.items.length - 5 : 0;
          const total = cart.items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);

          // Kirish qatori faqat `aiCeoEnabled === true` sotuvchilar
          // uchun AI orqali yoziladi - `generateSocialPost`dagi bilan
          // bir xil premium tekshiruvi ishlatiladi, alohida opt-in
          // toggle talab qilinmaydi.
          //
          // Xavfsizlik uchun `itemsList`/`total`/promokod AI ishlatilsa
          // ham, ishlatilmasa ham shu yerda deterministik ravishda
          // qo'shiladi - AI'ga narx/summa hech qachon berilmaydi va AI
          // matniga aralashtirilmaydi, chunki moliyaviy tafsilotlarni AI
          // o'ylab topmasligi kerak.
          let introText = "Savatingizda mahsulotlar kutmoqda!";
          let aiGenerated = false;
          if (seller.aiCeoEnabled === true) {
            try {
              const itemNames = cart.items.slice(0, 5).map((i) => i.name);
              const aiText = await craftCartRecoveryMessage({ itemNames, storeName: seller.storeName });
              if (aiText) {
                introText = aiText;
                aiGenerated = true;
              }
            } catch (aiErr) {
              // AI xato bersa jim qolamiz, oddiy shablon bilan davom
              // etamiz - eslatma yuborilishi AI xatosiga bog'liq
              // bo'lmasligi kerak.
              console.error(`AI savat eslatmasi yaratib bo'lmadi (${cartDoc.id}), oddiy shablon ishlatiladi:`, aiErr);
            }
          }

          let text = `${introText}\n\n${itemsList}`;
          if (moreCount > 0) text += `\n... va yana ${moreCount} ta mahsulot`;
          text += `\n\nJami: ${formatMoney(total)}`;

          // Sotuvchi "qaytarish chegirmasi"ni yoqqan bo'lsa, bir
          // martalik promokod yaratamiz - referal dasturidagi bilan bir
          // xil naqsh ishlatiladi.
          const recoveryPercent = Number(seller.cartReminderDiscountPercent) || 0;
          if (recoveryPercent > 0) {
            const couponCode = generateRecoveryCouponCode();
            await db.collection("sellers").doc(cart.sellerId).collection("coupons").doc(couponCode).set({
              code: couponCode,
              discountType: "percent",
              discountValue: recoveryPercent,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 soat amal qiladi - shoshilinchlik yaratadi
              usageLimit: 1,
              usedCount: 0,
              isActive: true,
              isCartRecoveryReward: true,
              rewardForClientId: cart.clientId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAtMs: Date.now(),
            });
            text += `\n\nBuyurtmangizni ${recoveryPercent}% chegirma bilan yakunlang!\nPromokod: ${couponCode} (24 soat amal qiladi)`;
          }

          await sendCustomerNotification(customBotToken, cart.clientId, text);
          await incrementDailyStat(cart.sellerId, "cartRemindersSent");
          if (aiGenerated) {
            await incrementDailyStat(cart.sellerId, "aiCeoAutoCartSent");
          }
          await logNotification({
            sellerId: cart.sellerId, clientId: cart.clientId, type: "cartReminder",
            title: "Savat eslatmasi", message: text,
          });

          await cartDoc.ref.update({
            status: "reminded",
            reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          console.error(`Tashlab ketilgan savat eslatmasi xatosi (${cartDoc.id}):`, err);
        }
      }
    });
    console.log(`sendAbandonedCartReminders: ${result.successCount}/${result.total} sotuvchi guruhi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);
