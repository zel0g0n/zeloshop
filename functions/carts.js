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
 * Tashlab ketilgan savat eslatmasi — 4 BOSQICHLI ketma-ketlik.
 *
 * Maqsad: xaridor mahsulotlarni savatga qo'shib, lekin buyurtma
 * bermay ketgan holatlarni qaytarib sotuvga aylantirish.
 *
 * MUHIM O'ZGARISH (2026-09): OLDIN faqat BITTA xabar (2 soatdan keyin)
 * yuborilardi. Sanoat tajribasi (ko'p bosqichli "abandoned cart"
 * ketma-ketligi) shuni ko'rsatadiki, bosqichma-bosqich, turli
 * vaqtda/ohangda yuborilgan xabarlar yagona xabardan sezilarli
 * yaxshiroq natija beradi - shuning uchun endi TO'RTTA aniq bosqich
 * bor, HAR BIRI o'zining vaqti va matni bilan:
 *   1-bosqich (~45 daqiqa): oddiy, iliq eslatma (AI CEO shaxsiylash-
 *      tirishi shu yerda, avvalgidek).
 *   2-bosqich (~5 soat): ikkinchi, sodda "hali ham kutyapmiz" eslatmasi
 *      (xarajatni nazorat qilish uchun AI ISHLATILMAYDI - faqat 1-marta,
 *      1-bosqichda ishlatiladi).
 *   3-bosqich (~24 soat): agar sotuvchi "qaytarish chegirmasi"ni
 *      yoqqan bo'lsa - HAQIQIY, bir martalik promokod SHU YERDA
 *      beriladi (avval 1-bosqichda berilardi - endi CHIN xarid
 *      niyatini birinchi ikki bosqichda, chegirmasiz sinab ko'rish
 *      uchun kechiktirilgan - bu marjani himoya qiladigan, standart
 *      amaliyot).
 *   4-bosqich (~60 soat/2.5 kun): oxirgi, bosimsiz, "agar fikringiz
 *      o'zgargan bo'lsa muammo emas" ohangidagi eslatma - shundan
 *      keyin savat holati "reminded"ga o'tadi (tsikl yakunlanadi).
 *
 * Har bir bosqich mos vaqt oralig'i o'tgach, VA oldingi bosqich(lar)
 * allaqachon yuborilgan bo'lsagina yuboriladi (`reminderStage`,
 * `reminderStageAnchorAt` maydonlari orqali kuzatiladi - pastga
 * qarang). Agar mijoz savatni qaytadan o'zgartirsa (`syncCart.js`
 * `status`ni "active"ga va `updatedAt`ni yangilaydi), bu YANGI
 * "abandonment epizodi" hisoblanadi va bosqichlar 1-dan qayta
 * boshlanadi - `reminderStageAnchorAt` bilan joriy `updatedAt`
 * solishtirib aniqlanadi.
 *
 * Firestore so'rovi ENG KICHIK bosqich chegarasi (1-bosqich, 45
 * daqiqa) bo'yicha filtrlaydi - bu, kamida shuncha eski BARCHA faol
 * savatlarni qamrab oladi (2, 3, 4-bosqichga loyiq, undan ESKIROQ
 * savatlar ham shu shart bilan qaytadi); ANIQ QAYSI bosqich
 * yuborilishi kerakligi xotirada (in-memory) hisoblanadi.
 */
const STAGE_THRESHOLD_MINUTES = { 1: 45, 2: 5 * 60, 3: 24 * 60, 4: 60 * 60 };
const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;

function generateRecoveryCouponCode() {
  return `QAYT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Joriy vaqt va savat holatidan qaysi bosqich (1-4) yuborilishi
 * kerakligini aniqlaydi, yoki hali hech biri yetilmagan bo'lsa `0`.
 * Sof funksiya - testlash uchun alohida eksport qilinadi.
 *
 * @param {{updatedAtMs: number, reminderStage: number, reminderStageAnchorMs: number|null}} cartState
 * @param {number} nowMs
 * @returns {number} 0 (hali yo'q) yoki 1-4
 */
function computeDueCartStage({ updatedAtMs, reminderStage, reminderStageAnchorMs }, nowMs) {
  // Anchor joriy `updatedAt`ga mos kelmasa - bu YANGI epizod (mijoz
  // savatni qayta o'zgartirgan), bosqich 0dan boshlanadi.
  const sameEpisode = reminderStageAnchorMs !== null && reminderStageAnchorMs === updatedAtMs;
  const currentStage = sameEpisode ? (reminderStage || 0) : 0;
  const elapsedMinutes = (nowMs - updatedAtMs) / 60000;

  // Eng YUQORI yetilgan bosqichni tanlaymiz (agar biror sabab bilan
  // cron bir necha bosqichni "o'tkazib yuborgan" bo'lsa ham, faqat
  // BITTA, eng so'nggi mos xabar yuboriladi - ketma-ket portlash yo'q).
  for (const stage of [4, 3, 2, 1]) {
    if (elapsedMinutes >= STAGE_THRESHOLD_MINUTES[stage] && currentStage < stage) {
      return stage;
    }
  }
  return 0;
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
    // Eng KICHIK bosqich chegarasi bo'yicha filtrlaymiz (45 daqiqa) -
    // shu yoshdagi va undan ESKIROQ barcha faol savatlarni qamrab
    // oladi; qaysi bosqich TO'G'RI ekanini pastda, xotirada aniqlaymiz.
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - STAGE_THRESHOLD_MINUTES[1] * 60 * 1000);

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
    const now = Date.now();
    const cartsBySeller = new Map();
    cartsSnap.docs.forEach((cartDoc) => {
      const cart = cartDoc.data();
      if (!cart.sellerId || !cart.clientId || !Array.isArray(cart.items) || cart.items.length === 0) return;

      const updatedAtMs = cart.updatedAt?.toMillis ? cart.updatedAt.toMillis() : Number(cart.updatedAt) || 0;
      const reminderStageAnchorMs = cart.reminderStageAnchorAt?.toMillis
        ? cart.reminderStageAnchorAt.toMillis()
        : (typeof cart.reminderStageAnchorAt === "number" ? cart.reminderStageAnchorAt : null);
      const dueStage = computeDueCartStage(
        { updatedAtMs, reminderStage: cart.reminderStage || 0, reminderStageAnchorMs },
        now
      );
      if (dueStage === 0) return; // hali navbatdagi bosqich vaqti kelmagan

      if (!cartsBySeller.has(cart.sellerId)) cartsBySeller.set(cart.sellerId, []);
      cartsBySeller.get(cart.sellerId).push({ cartDoc, dueStage, cartUpdatedAtRaw: cart.updatedAt });
    });

    if (cartsBySeller.size === 0) return;

    const result = await processBatched(Array.from(cartsBySeller.entries()), async ([sellerId, cartEntries]) => {
      // Mijozga xabar avval sotuvchining shaxsiy boti orqali
      // yuboriladi (xaridor zeloshop haqida bilishi shart emas - u
      // sotuvchining o'z boti bilan ishlaydi), platforma boti faqat
      // zaxira sifatida ishlatiladi (batafsil izoh: `lib/customerNotify.js`).
      const sellerSnap = await db.collection("sellers").doc(sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      const customBotToken = await getSellerCustomBotToken(sellerId);

      for (const { cartDoc, dueStage, cartUpdatedAtRaw } of cartEntries) {
        const cart = cartDoc.data();
        try {
          // Sotuvchi bu funksiyani ATAYLAB o'chirib qo'ygan bo'lishi
          // mumkin (masalan, mijozlarni ortiqcha xabar bilan
          // charchatishni xohlamasa).
          if (seller.cartReminderEnabled === false) continue;

          const itemsList = cart.items.slice(0, 5).map((i) => `• ${i.name} x${i.quantity}`).join("\n");
          const moreCount = cart.items.length > 5 ? cart.items.length - 5 : 0;
          const total = cart.items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);

          // Har bir bosqichning O'Z, aniq ohangi bor (batafsil izoh -
          // funksiya boshidagi katta izohda). Faqat 1-BOSQICHDA AI CEO
          // shaxsiylashtirishi ishlatiladi (xarajatni nazorat qilish
          // uchun - qolgan 3 bosqich deterministik).
          let introText;
          let aiGenerated = false;
          if (dueStage === 1) {
            introText = "Savatingizda mahsulotlar kutmoqda!";
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
          } else if (dueStage === 2) {
            introText = "Hali xarid qilishni yakunlamadingiz. Savatingiz sizni kutmoqda:";
          } else if (dueStage === 3) {
            introText = "Hali ham fikringiz o'zgarmadimi? Buyurtmangizni yakunlash uchun bir necha soniya kifoya:";
          } else {
            introText = "Bu — savatingiz haqida oxirgi eslatmamiz. Fikringiz o'zgargan bo'lsa muammo emas, istalgan payt qaytib kelishingiz mumkin:";
          }

          let text = `${introText}\n\n${itemsList}`;
          if (moreCount > 0) text += `\n... va yana ${moreCount} ta mahsulot`;
          text += `\n\nJami: ${formatMoney(total)}`;

          // Sotuvchi "qaytarish chegirmasi"ni yoqqan bo'lsa, bir
          // martalik promokod FAQAT 3-BOSQICHDA beriladi (avval 1-
          // bosqichda berilardi - endi chegirmasiz 2 ta urinishdan
          // keyin, marjani himoya qilish uchun kechiktirilgan).
          const recoveryPercent = Number(seller.cartReminderDiscountPercent) || 0;
          if (dueStage === 3 && recoveryPercent > 0) {
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
            // Kelajakda "qaysi bosqich ko'proq xarid keltirdi" real
            // tahlili uchun (batafsil izoh: `engagementReminders.js`dagi
            // xuddi shu naqsh).
            meta: { stage: dueStage },
          });

          // 4-bosqichdan keyin tsikl YAKUNLANADI ("reminded" - bu
          // savat uchun boshqa eslatma yuborilmaydi, mijoz uni qayta
          // o'zgartirmaguncha). 1-3-bosqichlarda savat "active"
          // holatida qoladi - keyingi bosqich keyinroq tekshiriladi.
          await cartDoc.ref.update({
            status: dueStage === 4 ? "reminded" : "active",
            reminderStage: dueStage,
            // Joriy `updatedAt`ga "yopishtirib qo'yamiz" - shu orqali
            // keyingi yugurishda "bu HALI HAM O'SHA epizodmi" ekanini
            // aniqlaymiz (mijoz savatni qayta o'zgartirsa, `updatedAt`
            // o'zgaradi va bu qiymat endi mos kelmay qoladi - yangi
            // epizod sifatida qaraladi).
            reminderStageAnchorAt: cartUpdatedAtRaw,
            lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          console.error(`Tashlab ketilgan savat eslatmasi xatosi (${cartDoc.id}):`, err);
        }
      }
    });
    console.log(`sendAbandonedCartReminders: ${result.successCount}/${result.total} sotuvchi guruhi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

exports._testables = { computeDueCartStage, STAGE_THRESHOLD_MINUTES };
