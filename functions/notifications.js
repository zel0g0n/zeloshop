const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN, STAFF_BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { buildStaffNewOrderMessage, buildStaffOrderNotifyKeyboard } = require("./staff");
const { checkRateLimit } = require("./lib/rateLimit");
const { resolveActingSellerContext } = require("./lib/staffAccess");
const { trackCrmMessageRecipients, logNotification } = require("./lib/dailyStats");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { enqueueRetry } = require("./lib/notificationRetryQueue");
const { withSentry, SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");
const { formatDeliverySlotAbsolute } = require("./lib/deliverySlots");
const { normalizeTariffPlan } = require("./lib/tariffs");

/**
 * CRM Hub'dagi "Yuborish" tugmasi chaqiradigan funksiya — Telegram
 * xabarini yuboradi. `targetClientIds` server tomonida ushbu
 * sotuvchining haqiqiy buyurtma tarixiga qarshi tekshiriladi (botni
 * ixtiyoriy Telegram ID'larga spam yuborish vositasi sifatida
 * suiiste'mol qilinishining oldini olish uchun).
 *
 * Ichki mantiq alohida funksiyaga ajratilgan — shunda uni `onCall`
 * o'rovisiz, to'g'ridan-to'g'ri sinov (test) fayllaridan chaqirish
 * mumkin.
 *
 * 2026-09 punkt-royxati, 2-band ("Advanced Team & RBAC"): endi bu
 * funksiyani HAQIQIY do'kon egasi EMAS, balki `manageCustomers`
 * ruxsatiga ega FAOL xodim (masalan "Marketing menejeri" roli) ham
 * chaqira oladi — `resolveActingSellerContext` orqali. MUHIM
 * XAVFSIZLIK TUZATISHI: ILGARI `sellerId` to'g'ridan-to'g'ri
 * so'rov ma'lumotidan (`request.data.sellerId`) olinib, faqat
 * `request.auth.uid === sellerId` tekshirilardi — bu, chaqiruvchi
 * ID'sidan BOSHQA HAR QANDAY `sellerId` yuborishga urinishni
 * to'sar edi, lekin printsipial jihatdan mijoz tomonidan yuborilgan
 * identifikatorga ishonish edi. Endi `sellerId` HECH QACHON
 * `request.data`dan olinmaydi — u FAQAT chaqiruvchining haqiqiy
 * identifikatoridan (`resolveActingSellerContext`) hosil bo'ladi.
 */
async function handleSendCrmNotification(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  // So'rovlarni chegaralash: bir soatda 10 tadan ortiq ommaviy
  // xabar yuborilishiga yo'l qo'yilmaydi — bu Telegram'ning o'z
  // spam-qarshi cheklovlariga (bot bloklanishi xavfi) tushib
  // qolishning oldini oladi.
  await checkRateLimit(`sendCrmNotification:${request.auth.uid}`, 10, 3600);

  const { sellerId } = await resolveActingSellerContext(db, request.auth.uid, "manageCustomers");

  const { targetClientIds, title, message, bannerImageUrl, buttonText, buttonUrl, couponCode } = request.data || {};

  if (!title?.trim() || !message?.trim()) {
    throw new HttpsError("invalid-argument", "Sarlavha va matn kiritilishi shart.");
  }
  if (!Array.isArray(targetClientIds) || targetClientIds.length === 0) {
    throw new HttpsError("invalid-argument", "Tanlangan auditoriyada mijoz topilmadi.");
  }

  const firestore = admin.firestore();

  // CRM xabarlari mijozlarga ketadi, shuning uchun avval sotuvchining
  // shaxsiy boti orqali yuboriladi (batafsil izoh: `lib/customerNotify.js`)
  // — sotuvchi o'zi CRM Hub'da "Yuborish"ni bosgan xabar, o'z
  // mijozlariga shaxsiy botidan kelishi eng mantiqiy holat. Platforma
  // boti faqat zaxira sifatida ishlatiladi (sotuvchi hali shaxsiy bot
  // ulamagan, yoki muayyan mijoz o'sha botni hali ishga tushirmagan
  // holatlar uchun).
  const customBotToken = await getSellerCustomBotToken(sellerId);

  let text = `*${title.trim()}*\n\n${message.trim()}`;
  if (couponCode) {
    text += `\n\nPromokod: \`${couponCode}\``;
  }

  // `targetClientIds` frontenddan kelgan ro'yxatga ko'r-ko'rona
  // ishonilmaydi — har bir ID ushbu sotuvchining haqiqiy buyurtma
  // tarixida borligi tekshiriladi, botni ixtiyoriy Telegram ID'larga
  // spam yuborish vositasi sifatida suiiste'mol qilinishining oldini
  // olish uchun.
  const verifiedIds = new Set();
  const CHUNK_SIZE = 30; // Firestore "in" so'rovi cheklovi

  for (let i = 0; i < targetClientIds.length; i += CHUNK_SIZE) {
    const chunk = targetClientIds.slice(i, i + CHUNK_SIZE);
    const ordersSnap = await firestore.collection("orders")
      .where("sellerId", "==", sellerId)
      .where("clientId", "in", chunk)
      .get();
    ordersSnap.forEach((doc) => verifiedIds.add(doc.data().clientId));
  }

  const safeClientIds = targetClientIds.filter((id) => verifiedIds.has(id));
  const clientResults = await Promise.all(
    safeClientIds.map((id) => sendCustomerNotification(customBotToken, id, text, { bannerImageUrl, buttonText, buttonUrl }))
  );

  // Kimlarga xabar yuborilganini kuzatamiz - AI CEO kunlik
  // hisobotida "necha kishi sotib oldi" (konversiya)ni hisoblash
  // uchun kerak.
  const successfullyMessagedIds = safeClientIds.filter((id, i) => clientResults[i]?.ok);
  await trackCrmMessageRecipients(sellerId, successfullyMessagedIds);

  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band "eng yaxshi marketing
  // kampaniyasi" ko'rsatkichi): har bir yuborilgan CRM xabarini
  // ALOHIDA kampaniya yozuvi sifatida saqlaymiz. Buning atrofidagi
  // ATAYLAB HALOL cheklov: DAROMAD ATRIBUTSIYASI (bu kampaniya orqali
  // qancha sotuv bo'ldi) faqat `couponCode` BERILGAN kampaniyalar
  // uchun HISOBLASH MUMKIN (frontend keyinchalik
  // `order.appliedCoupon.code === campaign.couponCode` orqali mos
  // keladi) - promokodsiz yuborilgan xabar uchun qaysi keyingi
  // xariddan aynan SHU xabar sabab bo'lganini ANIQLASH IMKONSIZ,
  // shuning uchun bunday kampaniyalar UI'da "atributsiya mavjud emas"
  // deb ochiq belgilanadi, HECH QACHON soxta/taxminiy daromad
  // o'ylab topilmaydi. Bu yozuv - FAQAT statistika uchun, xabarning
  // o'zi yuqorida (Telegram orqali) allaqachon yuborilgan - shuning
  // uchun bu yozuv muvaffaqiyatsiz bo'lsa ham (try/catch), asosiy
  // funksiya natijasiga ta'sir qilmaydi.
  try {
    await firestore.collection("sellers").doc(sellerId).collection("campaigns").add({
      title: title.trim(),
      message: message.trim(),
      audienceCount: safeClientIds.length,
      couponCode: couponCode || null,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(`CRM kampaniya yozuvini saqlashda xatolik (${sellerId}):`, err);
  }

  // Har bir xaridor uchun, xabar haqiqatan yetkazilgan-
  // yetkazilmaganini (Telegram'ning o'z javobiga qarab) jurnalga
  // yozamiz - diagnostika uchun foydali. Agar yetkazilmagan bo'lsa,
  // Telegram bergan aniq sababni ham saqlaymiz - "mijoz botni hali
  // ishga tushirmagan" (chat not found) kabi haqiqiy sabablarni
  // keyinroq aniqlash imkonini beradi.
  await Promise.all(
    safeClientIds.map((id, i) => logNotification({
      sellerId,
      clientId: id,
      type: "crmBroadcast",
      title: title.trim(),
      message: clientResults[i]?.ok ? message.trim() : `${message.trim()}\n\n[Yetkazilmadi: ${clientResults[i]?.description || clientResults[i]?.error || "noma'lum sabab"}]`,
      delivered: Boolean(clientResults[i]?.ok),
    }))
  );

  return {
    clientsSent: clientResults.filter((r) => r.ok).length,
    clientsTotal: clientResults.length,
  };
}

exports.sendCrmNotification = onCall(
  { secrets: [BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  withSentry(handleSendCrmNotification)
);

exports._testables = { handleSendCrmNotification, notifyStaffOfNewOrder, buildSellerNewOrderMessage };

/**
 * "Xodimlar" (Staff): buyurtmalarni boshqarish huquqiga
 * (`permissions.manageOrders`) ega, FAOL xodimlarga, xodim boti
 * orqali, bitta bosishli "Qabul qilish" tugmasi bilan yuboriladi —
 * sotuvchining O'ZINING bildirishnoma sozlamasidan (`notifyNewOrder`)
 * MUSTAQIL ravishda (bu ikki alohida sozlama). Alohida, sinov
 * qilinadigan funksiyaga ajratilgan — `onNewOrderNotifySeller`
 * (Firestore trigger) buni chaqiradi, lekin trigger'ning o'zini
 * to'g'ridan-to'g'ri sinash qiyin (Admin SDK event obyekti kerak),
 * shuning uchun asosiy mantiq shu yerda, alohida sinaladi.
 */
async function notifyStaffOfNewOrder(order, orderId) {
  const staffSnap = await admin.firestore()
    .collection("staff")
    .where("sellerId", "==", order.sellerId)
    .where("status", "==", "active")
    .get();
  const eligibleStaff = staffSnap.docs.filter((d) => d.data().permissions?.manageOrders === true);
  if (eligibleStaff.length === 0) return;

  const staffText = buildStaffNewOrderMessage(order);
  const inlineKeyboard = buildStaffOrderNotifyKeyboard(orderId);
  await Promise.all(
    eligibleStaff.map((d) =>
      sendTelegramMessage(STAFF_BOT_TOKEN.value(), d.id, staffText, { inlineKeyboard }).catch((err) => {
        console.error(`Xodimga (${d.id}) yangi buyurtma xabarini yuborishda xatolik:`, err);
      })
    )
  );
}

/**
 * Sof funksiya — sotuvchiga yangi buyurtma haqida yuboriladigan
 * TO'LIQ, FAKTLI matn (2026-09 punkt-royxati, 4/6-band talabi: aniq,
 * tushunarli, mos icon/emoji bilan, xom/nomalum ID ko'rsatmasdan —
 * shuning uchun ichki Firestore hujjat ID'si emas, `orderNumber`
 * ko'rsatiladi).
 */
function buildSellerNewOrderMessage(order) {
  const items = Array.isArray(order.orders) ? order.orders : [];
  const itemLines = items
    .slice(0, 10)
    .map((it) => `• ${it.name || "Mahsulot"} × ${it.quantity || 1} — ${Number((it.price || 0) * (it.quantity || 1)).toLocaleString()} so'm`)
    .join("\n");
  const moreCount = items.length > 10 ? items.length - 10 : 0;
  const deliveryFee = Number(order.deliveryZone?.price || 0);

  return [
    "🆕 *Yangi buyurtma tushdi!*",
    `🧾 Buyurtma №${order.orderNumber || "-"}`,
    "",
    `👤 Mijoz: ${order.customer?.fullName || "Noma'lum"}`,
    `📞 Tel: ${order.customer?.phone || "—"}`,
    order.customer?.address ? `📍 Manzil: ${order.customer.address}` : null,
    "",
    "🛒 Mahsulotlar:",
    itemLines || "—",
    moreCount > 0 ? `… va yana ${moreCount} ta mahsulot` : null,
    "",
    order.appliedCoupon?.code ? `🏷 Promokod: ${order.appliedCoupon.code} (-${Number(order.appliedCoupon.discountAmount || 0).toLocaleString()} so'm)` : null,
    deliveryFee > 0 ? `🚚 Yetkazib berish: ${deliveryFee.toLocaleString()} so'm` : null,
    order.deliveryTimeSlot ? `⏰ Kelishilgan vaqt: ${formatDeliverySlotAbsolute({ startMs: order.deliveryTimeSlot.start, endMs: order.deliveryTimeSlot.end })}` : null,
    `💰 Jami: *${Number(order.totalAmount || 0).toLocaleString()} so'm*`,
    "",
    "👇 Buyurtmani ko'rish uchun pastdagi tugmani bosing.",
  ].filter(Boolean).join("\n");
}

/**
 * Yangi buyurtma kelganda sotuvchiga HAQIQIY Telegram xabari
 * yuboriladi (agar `notifyNewOrder` sozlamasi yoqilgan bo'lsa —
 * standart holatda yoqilgan hisoblanadi), va, mustaqil ravishda,
 * `permissions.manageOrders` huquqiga ega xodimlarga ham
 * (`notifyStaffOfNewOrder`).
 */
exports.onNewOrderNotifySeller = onDocumentCreated(
  { document: "orders/{orderId}", secrets: [BOT_TOKEN, STAFF_BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  async (event) => {
    const order = event.data.data();
    if (!order?.sellerId) return;
    const orderId = event.params.orderId;

    // Agar buyurtmada promokod ishlatilgan bo'lsa, uning
    // `usedCount`ini shu yerda (Admin SDK orqali) oshiramiz.
    if (order.appliedCoupon?.code) {
      try {
        const couponRef = admin.firestore()
          .collection("sellers").doc(order.sellerId)
          .collection("coupons").doc(order.appliedCoupon.code);
        await couponRef.update({ usedCount: admin.firestore.FieldValue.increment(1) });
      } catch (err) {
        console.error("Promokod hisoblagichini yangilashda xatolik:", err);
        initSentry();
        Sentry.captureException(err, { extra: { orderId } });
      }
    }

    try {
      const sellerSnap = await admin.firestore().collection("sellers").doc(order.sellerId).get();
      const seller = sellerSnap.data();
      // MUHIM TUZATISH: OLDIN bu yerda `return` ishlatilgan edi -
      // sotuvchi o'zining shaxsiy bildirishnoma sozlamasini
      // o'chirgan (yoki hujjati topilmagan) bo'lsa, bu PASTDAGI
      // xodimlarga xabar yuborish bosqichini HAM (butun funksiya
      // to'xtab qolgani uchun) UMUMAN ishga tushirmas edi - bu ikki
      // MUSTAQIL sozlama (sotuvchining o'zi VA uning xodimlari)
      // bo'lgani uchun noto'g'ri edi. Endi shartli blok orqali FAQAT
      // sotuvchiga xabar yuborish o'tkazib yuboriladi, funksiya esa
      // pastga, xodimlarga xabar yuborishga davom etadi.
      if (seller && seller.notifyNewOrder !== false) { // standart holatda yoqilgan
        const text = buildSellerNewOrderMessage(order);
        const inlineKeyboard = [[{ text: "📋 Buyurtmalarni ochish", web_app: { url: buildSellerAppLink("/seller/orders") } }]];
        const result = await sendTelegramMessage(BOT_TOKEN.value(), order.sellerId, text, { inlineKeyboard });
        // 4-BOT EKOTIZIM AUDITI (P2) — "yangi buyurtma" sotuvchi uchun
        // ENG muhim bildirishnoma (batafsil: `lib/notificationRetryQueue.js`).
        // Ichki qayta urinishlar (429/5xx) tugagandan keyin ham
        // muvaffaqiyatsiz bo'lsa, keyinroq qayta urinish uchun navbatga
        // qo'shiladi — buyurtmaning o'zi allaqachon saqlangan, faqat
        // Telegram xabari yo'qolib qolmasligi kerak.
        if (!result?.ok) {
          await enqueueRetry({
            kind: "sellerMessage",
            payload: { chatId: order.sellerId, text, options: { inlineKeyboard } },
            reason: result?.description || result?.error || "noma'lum sabab",
          });
        }
      }
    } catch (err) {
      console.error("Yangi buyurtma bildirishnomasida xatolik:", err);
      initSentry();
      Sentry.captureException(err, { extra: { orderId } });
    }

    try {
      await notifyStaffOfNewOrder(order, orderId);
    } catch (err) {
      console.error("Xodimlarga yangi buyurtma bildirishnomasida xatolik:", err);
      initSentry();
      Sentry.captureException(err, { extra: { orderId } });
    }
  }
);

/**
 * Mahsulot stogi kritik darajaga (3 tagacha) tushganda sotuvchiga
 * HAQIQIY ogohlantirish yuboriladi.
 */
exports.onLowStockNotifySeller = onDocumentUpdated(
  { document: "products/{productId}", secrets: [BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after?.sellerId) return;

    const beforeStock = Number(before?.stock ?? 999);
    const afterStock = Number(after?.stock ?? 0);

    // Faqat stok ENDIGINA kritik chegaradan (3) o'tganda yuboriladi.
    if (afterStock > 3 || beforeStock <= 3) return;

    try {
      const sellerSnap = await admin.firestore().collection("sellers").doc(after.sellerId).get();
      const seller = sellerSnap.data();
      if (!seller || seller.notifyLowStock === false) return;

      const text = [
        "⚠️ *Omborda tovar kamaymoqda*",
        "",
        `📦 ${after.name}`,
        `🔻 Atigi ${afterStock} ta qoldi`,
        "",
        "Vaqtida to'ldirib qo'ying.",
      ].join("\n");
      await sendTelegramMessage(BOT_TOKEN.value(), after.sellerId, text);
    } catch (err) {
      console.error("Kam qolgan tovar bildirishnomasida xatolik:", err);
      initSentry();
      Sentry.captureException(err, { extra: { productId: event.params?.productId } });
    }
  }
);

/**
 * Kunlik P&L hisoboti — har kuni soat 21:00da (Toshkent vaqti),
 * `notifyDailyReport` yoqilgan har bir sotuvchiga o'sha kunning
 * buyurtmalari/tushumi/taxminiy sof foydasi haqida xabar yuboradi.
 *
 * Hisob-kitob "bugun berilgan" (createdAt) bo'yicha amalga oshiriladi,
 * "bugun yetkazilgan" bo'yicha emas — alohida "yetkazilgan sana"
 * maydoni saqlanmaydi. Sof foyda faqat mahsulot tannarxini hisobga
 * oladi — OPEX/marketing xarajatlari (P&L Dashboard'da qo'lda
 * kiritiladigan) bu yerga kiritilmagan, bu xabar matnida ochiq
 * aytiladi.
 */
exports.sendDailyPnLReport = onSchedule(
  {
    schedule: "0 21 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const firestore = admin.firestore();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTimestamp = admin.firestore.Timestamp.fromDate(dayStart);

    const sellersSnap = await firestore.collection("sellers").get();

    // Sotuvchilar orasida umumiy o'zgaruvchan holat yo'q (har biri
    // faqat o'z buyurtmalari/mahsulotlarini o'qiydi va o'ziga xabar
    // yuboradi), shuning uchun oddiy PARALEL guruhlash yetarli.
    const result = await processBatched(sellersSnap.docs, async (sellerDoc) => {
      const seller = sellerDoc.data();
      if (seller.notifyDailyReport === false) return;
      const sellerId = sellerDoc.id;

      try {
        const ordersSnap = await firestore.collection("orders")
          .where("sellerId", "==", sellerId)
          .where("createdAt", ">=", dayStartTimestamp)
          .get();

        const todaysOrders = ordersSnap.docs.map((d) => d.data());
        if (todaysOrders.length === 0) return; // hech narsa bo'lmasa, xabar yuborilmaydi

        const deliveredToday = todaysOrders.filter((o) => o.status === "delivered");
        const revenue = deliveredToday.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

        const productsSnap = await firestore.collection("products").where("sellerId", "==", sellerId).get();
        const costPriceMap = new Map();
        productsSnap.forEach((p) => costPriceMap.set(p.id, Number(p.data().costPrice) || 0));

        let cogs = 0;
        deliveredToday.forEach((order) => {
          (order.orders || []).forEach((item) => {
            cogs += (costPriceMap.get(item.id) || 0) * (Number(item.quantity) || 0);
          });
        });

        const netProfit = revenue - cogs;

        const text = [
          "📊 *Kunlik hisobot*",
          "",
          `🧾 Bugungi buyurtmalar: ${todaysOrders.length} ta`,
          `✅ Yetkazilganlar: ${deliveredToday.length} ta`,
          `💰 Tushum: ${revenue.toLocaleString()} so'm`,
          `📈 Taxminiy sof foyda: ${netProfit.toLocaleString()} so'm`,
          "",
          "_Faqat mahsulot tannarxi hisobga olindi — OPEX/marketing xarajatlari kirmagan, ularni \"Foyda-Zarar\" bo'limida ko'ring._",
        ].join("\n");
        await sendTelegramMessage(BOT_TOKEN.value(), sellerId, text);
      } catch (err) {
        console.error(`Kunlik hisobot xatosi (sotuvchi ${sellerId}):`, err);
        throw err;
      }
    });
    console.log(`sendDailyPnLReport: ${result.successCount}/${result.total} sotuvchi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

/**
 * Sotuvchidan platforma adminlariga Telegram xabari yuboradi —
 * "Qo'llab-quvvatlash" (savol/muammo) va "To'lovlar va Tariflar"
 * (Pro/Biznes'ga qiziqish bildirish) sahifalari shu bitta, umumiy
 * mexanizmdan foydalanadi.
 *
 * Admin ID(lar)i kodda qattiq yozilmagan — `admins` kolleksiyasidan
 * dinamik o'qiladi, shuning uchun kelajakda yangi admin qo'shilsa
 * (Firebase Console orqali), bu funksiya avtomatik o'sha(lar)ga ham
 * xabar yubora boshlaydi.
 *
 * TARIF ALMASHTIRISH SO'ROVLARI (2026-09): ILGARI bu funksiya FAQAT
 * Telegram xabari yuborardi — Firestore'ga hech narsa yozilmasdi,
 * ya'ni admin panelida "kelib tushgan so'rovlar" degan hech qanday
 * ro'yxat yo'q edi (adminlar buni Telegram DM orqaligina ko'rar edi,
 * javob berish/kuzatish esa butunlay qo'lda edi). Endi `category ===
 * "pro-interest"` VA `requestedPlan` haqiqiy tarif ("pro"/"biznes")
 * bo'lsa, xabar bilan BIRGA `tariffRequests` kolleksiyasiga ham
 * yoziladi — admin panelidagi "Tarif so'rovlari" bo'limi shu yerdan
 * o'qiydi (`AdminTariffRequestsPage.jsx`, `resolveTariffRequest.js`).
 * Telegram xabari ZAXIRA/tezkor bildirishnoma sifatida ham qolaveradi
 * — ikkalasi bir-birini almashtirmaydi, to'ldiradi.
 */
async function handleContactAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  // So'rovlarni chegaralash: bir soatda 5 tadan ortiq xabar
  // yuborilishiga yo'l qo'yilmaydi — adminni spam bilan bosib
  // yuborishning oldini oladi.
  await checkRateLimit(`contactAdmin:${request.auth.uid}`, 5, 3600);

  const { subject, message, category, requestedPlan } = request.data || {};
  if (!message?.trim()) {
    throw new HttpsError("invalid-argument", "Xabar matni kiritilishi shart.");
  }

  const firestore = admin.firestore();
  const uid = request.auth.uid;

  // Kim yuborayotganini aniqlashtirish uchun (adminga qulay bo'lishi
  // uchun) — do'kon nomi va telefonini olishga harakat qilamiz,
  // lekin topilmasa ham xabar baribir yuboriladi.
  //
  // MUHIM TUZATISH (2026-09 punkt-royxati, 6-band — "hech qanday xom
  // ID ko'rsatilmasin"): ILGARI, sotuvchi hujjati topilmasa (yoki
  // telefon raqami bo'lmasa), xom Telegram UID (`request.auth.uid`,
  // masalan "5847213690" kabi ma'nosiz raqam) TO'G'RIDAN-TO'G'RI
  // adminga yuborilgan xabar matnida ko'rinardi. Endi bunday holatda
  // shunchaki umumiy "Noma'lum foydalanuvchi" yorlig'i ishlatiladi -
  // hech qachon xom ID ko'rsatilmaydi.
  let senderLabel = "Noma'lum foydalanuvchi";
  let sellerData = null;
  try {
    const sellerSnap = await firestore.collection("sellers").doc(uid).get();
    if (sellerSnap.exists) {
      sellerData = sellerSnap.data();
      senderLabel = sellerData.phone
        ? `${sellerData.storeName || "Noma'lum do'kon"} (${sellerData.phone})`
        : (sellerData.storeName || "Noma'lum do'kon");
    }
  } catch (err) {
    console.error("Yuboruvchi ma'lumotini olishda xatolik:", err);
  }

  const adminsSnap = await firestore.collection("admins").get();
  if (adminsSnap.empty) {
    throw new HttpsError("internal", "Hozircha faol admin topilmadi. Birozdan so'ng qayta urinib ko'ring.");
  }

  const categoryLabel = category === "pro-interest" ? "💎 Tarifga qiziqish" : "🆘 Qo'llab-quvvatlash";
  const text = [
    `📩 *${categoryLabel}*`,
    "",
    `👤 Kimdan: ${senderLabel}`,
    subject ? `📝 Mavzu: ${subject}` : null,
    "",
    message.trim(),
  ].filter((line) => line !== null).join("\n");

  const token = BOT_TOKEN.value();
  const results = await Promise.all(
    adminsSnap.docs.map((doc) => sendTelegramMessage(token, doc.id, text))
  );

  // Tarif so'rovini Firestore'ga yozib qo'yamiz — shunda admin panelida
  // KO'RINADIGAN, KUZATILADIGAN yozuv bo'ladi (faqat Telegram xabari
  // emas). Faqat "pro-interest" kategoriyasi VA haqiqiy tarif nomi
  // ko'rsatilgan hollarda (qo'llab-quvvatlash so'rovlari uchun EMAS).
  if (category === "pro-interest" && (requestedPlan === "pro" || requestedPlan === "biznes")) {
    try {
      await firestore.collection("tariffRequests").add({
        sellerId: uid,
        storeName: sellerData?.storeName || null,
        phone: sellerData?.phone || null,
        requestedPlan,
        currentPlan: normalizeTariffPlan(sellerData?.tariffPlan),
        message: message.trim(),
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null,
      });
    } catch (err) {
      // Firestore yozuvi muvaffaqiyatsiz bo'lsa ham, Telegram xabari
      // allaqachon ketgan — foydalanuvchiga xato ko'rsatmaymiz, faqat
      // log qoldiramiz (admin panelidagi ro'yxat kambag'alroq bo'ladi,
      // lekin admin Telegramdan baribir xabardor bo'ladi).
      console.error("Tarif so'rovini yozishda xatolik:", err);
    }
  }

  return { sent: results.some((r) => r.ok) };
}

exports.contactAdmin = onCall(
  { secrets: [BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  withSentry(handleContactAdmin)
);

// `exports._testables` faylning boshida (124-qatorda) bir marta
// belgilangan — bu yerda FAQAT shu funksiyani unga QO'SHAMIZ (qayta
// yozib, avvalgi uchtasini o'chirib qo'ymaslik uchun).
Object.assign(exports._testables, { handleContactAdmin });
