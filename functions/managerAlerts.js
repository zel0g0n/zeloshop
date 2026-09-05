const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { incrementDailyStat } = require("./lib/dailyStats");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * SOTUVCHIGA (menejerga) PROAKTIV OGOHLANTIRISHLAR — 2026-09
 * punkt-royxati, "Advanced Automation" (Z-Biznes), 5-band.
 *
 * `functions/engagementReminders.js`dagi XARIDORGA yuboriladigan
 * eslatmalardan farqli o'laroq, bu ikkalasi ham SOTUVCHINING O'ZIGA
 * (platforma `BOT_TOKEN`i orqali, `notifications.js`dagi bilan bir
 * xil naqsh) yuboriladi — xaridorning shaxsiy boti bilan hech qanday
 * aloqasi yo'q.
 *
 * Ikkalasi ham STANDART HOLATDA O'CHIQ (opt-in), faqat
 * `aiCeoEnabled === true` sotuvchilar uchun (Z-Pro va undan yuqori) -
 * bu, mavjud AI CEO avtonom bildirishnomalari bilan bir xil
 * "ishonch zinapoyasi" (trust-ladder) tamoyili: Tier-1, o'zi hech
 * qanday moliyaviy/qaytarib bo'lmas harakat qilmaydi, faqat SOTUVCHIGA
 * xabar beradi - qaror hamon sotuvchining o'zida.
 */

// Kam zaxira - mavjud `products (sellerId ASC, stock ASC)` kompozit
// indeksidan foydalanadi (`aiCeoAgent.js`dagi `execGetLowStockProducts`
// bilan BIR XIL chegara va so'rov shakli - yangi indeks shart emas).
const LOW_STOCK_THRESHOLD = 5;
// Bir mahsulot uchun eslatma necha kunda BIR MARTA takrorlanishi
// mumkin (sotuvchi zaxirani to'ldirmagan bo'lsa ham) - har kuni
// bezovta qilmaslik uchun, lekin butunlay "unutib qo'yilmasligi" ham
// uchun.
const LOW_STOCK_REALERT_DAYS = 7;

// Buyurtma "eskirgan" deb hisoblanadigan chegara. MUHIM: bu HECH
// QANDAY va'da qilingan/hisoblangan yetkazib berish sanasiga (ETA)
// bog'liq EMAS - platformada bunday tizim yo'q (mavjud qoida:
// soxta ETA/tracking hech qachon ko'rsatilmaydi). Bu shunchaki
// "buyurtma N soatdan beri yakunlanmagan" - oddiy, haqiqiy, hech
// narsa o'ylab topilmagan signal.
const STALE_ORDER_HOURS = 48;
const MAX_LOW_STOCK_SELLERS_PER_RUN = 300;
const MAX_STALE_ORDERS_PER_RUN = 200;

const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;

/**
 * Bitta sotuvchi uchun kam zaxirali mahsulotlarni tekshiradi va,
 * agar bo'lsa, BITTA jamlangan (barcha mahsulot bitta xabarda)
 * Telegram xabari yuboradi. Sof funksiya EMAS (Firestore'ga bog'liq),
 * lekin test qilish uchun eksport qilinadi.
 */
async function processSellerLowStockAlert(sellerDoc, botToken) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;
  if (seller.aiCeoEnabled !== true || seller.aiCeoLowStockAlertEnabled !== true) return;

  const productsSnap = await db.collection("products")
    .where("sellerId", "==", sellerId)
    .where("stock", ">", 0)
    .where("stock", "<=", LOW_STOCK_THRESHOLD)
    .orderBy("stock", "asc")
    .get();
  if (productsSnap.empty) return;

  const realertCutoffMs = Date.now() - LOW_STOCK_REALERT_DAYS * 24 * 60 * 60 * 1000;
  const dueProducts = productsSnap.docs.filter((doc) => {
    const alertedAtMs = doc.data().lowStockAlertedAt?.toMillis ? doc.data().lowStockAlertedAt.toMillis() : 0;
    return alertedAtMs < realertCutoffMs;
  });
  if (dueProducts.length === 0) return;

  const lines = dueProducts.slice(0, 10).map((doc) => {
    const p = doc.data();
    return `• ${p.name || "Mahsulot"} — ${p.stock} dona qoldi`;
  });
  const moreCount = dueProducts.length > 10 ? dueProducts.length - 10 : 0;

  let text = `Zaxira ogohlantirishi\n\nQuyidagi mahsulotlar tugab qolmoqda:\n\n${lines.join("\n")}`;
  if (moreCount > 0) text += `\n... va yana ${moreCount} ta mahsulot`;
  text += `\n\nOmborni to'ldirishni unutmang!`;

  await sendTelegramMessage(botToken, sellerId, text, {
    inlineKeyboard: [[{ text: "Mahsulotlarni ko'rish", web_app: { url: buildSellerAppLink("/seller/products") } }]],
  });

  const batch = db.batch();
  dueProducts.forEach((doc) => {
    batch.update(doc.ref, { lowStockAlertedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();

  await incrementDailyStat(sellerId, "lowStockAlertsSent");
}

exports.sendLowStockAlerts = onSchedule(
  {
    schedule: "0 9 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const botToken = BOT_TOKEN.value();
    const eligibleSellersSnap = await db.collection("sellers")
      .where("aiCeoEnabled", "==", true)
      .limit(MAX_LOW_STOCK_SELLERS_PER_RUN)
      .get();
    if (eligibleSellersSnap.empty) return;

    const result = await processBatched(eligibleSellersSnap.docs, async (sellerDoc) => {
      try {
        await processSellerLowStockAlert(sellerDoc, botToken);
      } catch (err) {
        console.error(`Kam zaxira ogohlantirishida xatolik (sotuvchi ${sellerDoc.id}):`, err);
      }
    });
    console.log(`sendLowStockAlerts: ${result.successCount}/${result.total} sotuvchi tekshirildi, ${result.failureCount} xato`);
  })
);

/**
 * "Eskirgan" (uzoq vaqt yakunlanmagan) buyurtmalar haqida sotuvchiga
 * ogohlantirish. `functions/engagementReminders.js`dagi kunlik-oyna
 * naqshidan farqli - bu yerda HAR BIR ishga tushirishda BARCHA hali
 * ogohlantirilmagan eskirgan buyurtmalar tekshiriladi (xavfsizlik
 * chegarasi bilan), chunki "eskirgan" holat vaqt o'tishi bilan davom
 * etadi (bitta kunlik oynaga sig'dirib bo'lmaydi).
 */
exports.sendStaleOrderAlerts = onSchedule(
  {
    schedule: "0 10 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const botToken = BOT_TOKEN.value();
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - STALE_ORDER_HOURS * 60 * 60 * 1000);

    const ordersSnap = await db.collection("orders")
      .where("status", "in", ["new", "processing", "shipped"])
      .where("createdAt", "<", cutoff)
      .limit(MAX_STALE_ORDERS_PER_RUN)
      .get();
    if (ordersSnap.empty) return;

    const dueOrders = ordersSnap.docs.filter((doc) => doc.data().staleOrderAlerted !== true);
    if (dueOrders.length === 0) return;

    const ordersBySeller = new Map();
    dueOrders.forEach((doc) => {
      const order = doc.data();
      if (!order.sellerId) return;
      if (!ordersBySeller.has(order.sellerId)) ordersBySeller.set(order.sellerId, []);
      ordersBySeller.get(order.sellerId).push(doc);
    });

    const result = await processBatched(Array.from(ordersBySeller.entries()), ([sellerId, orderDocs]) =>
      processStaleOrdersForSeller(sellerId, orderDocs, botToken)
    );
    console.log(`sendStaleOrderAlerts: ${result.successCount}/${result.total} sotuvchi guruhi tekshirildi, ${result.failureCount} xato`);
  })
);

/**
 * Bitta sotuvchi guruhi uchun: agar sotuvchi shu xususiyatni yoqqan
 * bo'lsa, jamlangan xabar yuboradi va buyurtmalarni belgilaydi. Sof
 * funksiya EMAS, lekin `sendStaleOrderAlerts`ning asosiy mantig'idan
 * ajratilgan - alohida test qilish uchun.
 */
async function processStaleOrdersForSeller(sellerId, orderDocs, botToken) {
  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  const seller = sellerSnap.exists ? sellerSnap.data() : {};
  if (seller.aiCeoEnabled !== true || seller.aiCeoStaleOrderAlertEnabled !== true) return;

  const statusLabel = { new: "yangi", processing: "tayyorlanmoqda", shipped: "yo'lda" };
  const lines = orderDocs.slice(0, 10).map((doc) => {
    const o = doc.data();
    const hoursOpen = Math.floor((Date.now() - (o.createdAt?.toMillis ? o.createdAt.toMillis() : Date.now())) / (60 * 60 * 1000));
    return `• #${doc.id.slice(0, 6)} — ${formatMoney(o.totalAmount)} (${statusLabel[o.status] || o.status}, ${hoursOpen} soatdan beri)`;
  });
  const moreCount = orderDocs.length > 10 ? orderDocs.length - 10 : 0;

  let text = `Diqqat: ${orderDocs.length} ta buyurtma ${STALE_ORDER_HOURS} soatdan ko'proq vaqtdan beri yakunlanmagan\n\n${lines.join("\n")}`;
  if (moreCount > 0) text += `\n... va yana ${moreCount} ta buyurtma`;
  text += `\n\nHolatini tekshirib, xaridor bilan bog'lanishni unutmang.`;

  await sendTelegramMessage(botToken, sellerId, text, {
    inlineKeyboard: [[{ text: "Buyurtmalarni ko'rish", web_app: { url: buildSellerAppLink("/seller/orders") } }]],
  });

  const batch = db.batch();
  orderDocs.forEach((doc) => batch.update(doc.ref, { staleOrderAlerted: true }));
  await batch.commit();

  await incrementDailyStat(sellerId, "staleOrderAlertsSent");
}

exports._testables = { processSellerLowStockAlert, processStaleOrdersForSeller };
