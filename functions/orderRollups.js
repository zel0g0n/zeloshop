const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { withSentry, SENTRY_DSN, initSentry, Sentry } = require("./lib/sentry");
const {
  dateKeyFromMillis,
  computeOrderCogs,
  findMissingCostPriceIds,
  buildDailyRollupDelta,
  buildCustomerRollupState,
  computeLoyaltyEarnDelta,
} = require("./lib/rollups");

/**
 * PRODUCTION-DARAJADAGI ANALITIKA/CRM/P&L — SERVER-SIDE AGREGATSIYA.
 * Hisoblash mantig'i (sof funksiyalar) — `lib/rollups.js`da. Bu fayl
 * — Firestore bilan ISHLAYDIGAN qism: (1) buyurtma "delivered"
 * holatiga o'tganda/chiqarilganda ishga tushadigan trigger, (2)
 * ushbu tizim qurilishidan OLDIN yaratilgan sotuvchilarning MAVJUD
 * tarixini "orqaga hisoblab" to'ldiruvchi bir martalik migratsiya.
 */

const BATCH_SIZE = 500; // Firestore batch/query cheklovi.

/** `sellers/{id}/orderCosts/{orderId}` orqali suratga olingan tannarxni o'qiydi (yo'q bo'lsa - eski buyurtma). */
async function loadCostSnapshotItems(sellerId, orderId) {
  const snap = await db.collection("sellers").doc(sellerId).collection("orderCosts").doc(orderId).get();
  return snap.exists ? (snap.data().items || []) : null;
}

/** `costPrice`i suratga olinmagan (yoki umuman surat topilmagan) qatorlar uchun JORIY mahsulot tannarxini qidiradi. */
async function fetchFallbackCostPrices(items) {
  const missingIds = findMissingCostPriceIds(items);
  if (missingIds.length === 0) return new Map();
  const snaps = await Promise.all(missingIds.map((id) => db.collection("products").doc(id).get()));
  const map = new Map();
  snaps.forEach((snap, i) => {
    if (snap.exists) map.set(missingIds[i], Number(snap.data().costPrice) || 0);
  });
  return map;
}

/** Berilgan buyurtma uchun HAQIQIY tannarxni hisoblaydi (surat bor bo'lsa - undan, aks holda jamoiy mahsulot tannarxidan). */
async function resolveOrderCogs(order, orderId) {
  const costItems = await loadCostSnapshotItems(order.sellerId, orderId);
  const items = costItems || (Array.isArray(order.orders) ? order.orders.map((i) => ({ id: i.id, quantity: i.quantity })) : []);
  const fallbackMap = await fetchFallbackCostPrices(items);
  return computeOrderCogs(items, fallbackMap);
}

/** Kunlik hujjatga (`orderRollups/{date}`) daromad/tannarx/yetkazilgan-son INCREMENT'ini qo'llaydi. */
async function applyDailyRollupDelta(sellerId, dateKey, delta) {
  const ref = db.collection("sellers").doc(sellerId).collection("orderRollups").doc(dateKey);
  await ref.set(
    {
      revenue: admin.firestore.FieldValue.increment(delta.revenue),
      cogs: admin.firestore.FieldValue.increment(delta.cogs),
      deliveredCount: admin.firestore.FieldValue.increment(delta.deliveredCount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // SOTUVCHI ISHONCH TIZIMI (Trust Badges, v39.13): sotuvchi hujjatining
  // o'zida ("umr bo'yi" jami) muvaffaqiyatli yetkazilgan buyurtmalar
  // sonini ham saqlaymiz - shu orqali `Header.jsx`/`StoreInfoPage.jsx`
  // haqiqiy nishon ko'rsatish uchun `orderRollups` quyi kolleksiyasining
  // BARCHA kunlik hujjatlarini yig'ib chiqishga (qimmat so'rov)
  // muhtoj bo'lmaydi - bitta arzon `increment()`. `delta.deliveredCount`
  // — bu funksiyaning o'zi (+1/-1) hisoblab beradi, shuning uchun
  // qo'shimcha hisob-kitob shart emas.
  //
  // ALOHIDA try/catch: bu — FAQAT ko'rsatkich (badge) uchun yordamchi
  // yozuv, asosiy kunlik rollup (yuqorida, allaqachon muvaffaqiyatli
  // yozilgan) VA undan keyin keladigan mijoz yig'ma yozuvi
  // (`applyCustomerRollup`) bunga bog'liq bo'lmasligi kerak.
  try {
    await db.collection("sellers").doc(sellerId).set(
      { trustStats: { completedOrders: admin.firestore.FieldValue.increment(delta.deliveredCount) } },
      { merge: true }
    );
  } catch (err) {
    console.error(`Sotuvchi ishonch ko'rsatkichini (completedOrders) yangilashda xatolik (${sellerId}):`, err);
  }
}

/**
 * Mijoz yig'ma hujjatini (`customers/{clientId}`) TRANZAKSIYA ichida,
 * izchil ravishda yangilaydi - shu bilan bir qatorda SODIQLIK
 * DASTURI ("Bonus hisobi") balansini ham (agar sotuvchida yoqilgan
 * bo'lsa) yangilaydi (batafsil izoh: `lib/rollups.js`dagi
 * `computeLoyaltyEarnDelta`). `seller` - sotuvchi hujjati, faqat
 * bonus foizi/yoqilganligini o'qish uchun (`applyRollupsForOrder`da
 * bir marta o'qib, shu yerga uzatiladi - har bir mijoz uchun qayta
 * o'qilmaydi).
 */
async function applyCustomerRollup(sellerId, order, sign, seller) {
  if (!order.clientId) return { isNewCustomer: false };
  const ref = db.collection("sellers").doc(sellerId).collection("customers").doc(order.clientId);
  const loyaltyDelta = computeLoyaltyEarnDelta(seller, order, sign);
  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band): tranzaksiya ichida
  // hisoblangan `next.isNewCustomer`ni tashqariga (chaqiruvchiga)
  // qaytaramiz - `applyRollupsForOrder` buni kunlik
  // `newCustomersCount` hisoblagichiga qo'shish uchun ishlatadi.
  // `let` - chunki tranzaksiya qayta urinishi (retry) mumkin, har
  // safar QAYTA yoziladi (eskisi ustiga qo'shilmaydi).
  let isNewCustomer = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = buildCustomerRollupState(snap.exists ? snap.data() : null, order, sign);
    isNewCustomer = next.isNewCustomer;
    if (next.removed) {
      tx.delete(ref);
      return;
    }
    const currentBonusBalance = snap.exists ? Number(snap.data().bonusBalance) || 0 : 0;
    tx.set(ref, {
      ltv: next.ltv,
      orderCount: next.orderCount,
      lastOrderAtMs: next.lastOrderAtMs,
      firstOrderAtMs: next.firstOrderAtMs,
      fullName: next.fullName,
      phone: next.phone,
      bonusBalance: currentBonusBalance + loyaltyDelta,
      couponOrderCount: next.couponOrderCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { isNewCustomer };
}

/** Buyurtma "delivered"ga o'tganda/chiqarilganda — ikkala yig'ma joyni ham yangilaydi. */
async function applyRollupsForOrder(order, orderId, sign) {
  if (!order?.sellerId) return;
  const createdAtMs = order.createdAt?.toMillis ? order.createdAt.toMillis() : Number(order.createdAtMs) || Date.now();
  const dateKey = dateKeyFromMillis(createdAtMs);

  const cogs = await resolveOrderCogs(order, orderId);
  const delta = buildDailyRollupDelta(order, cogs, sign);
  await applyDailyRollupDelta(order.sellerId, dateKey, delta);

  // Sodiqlik dasturi sozlamasini (`loyaltyEnabled`/`loyaltyEarnPercent`)
  // o'qish uchun - `computeLoyaltyEarnDelta` shu ma'lumotga muhtoj.
  const sellerSnap = await db.collection("sellers").doc(order.sellerId).get();
  const seller = sellerSnap.exists ? sellerSnap.data() : {};
  const { isNewCustomer } = await applyCustomerRollup(order.sellerId, { ...order, createdAtMs }, sign, seller);

  // BIZNES BUYRUQ MARKAZI (2026-09, 3-band "mijoz jalb qilish"
  // tendentsiyasi): agar bu buyurtma mijozning ENG BIRINCHI (haqiqatan
  // yangi) yozuvini yaratgan bo'lsa, o'sha KUNning yig'ma hujjatiga
  // alohida hisoblagichni oshiramiz. Bu - `applyDailyRollupDelta`dan
  // ATAYLAB alohida yozuv: `isNewCustomer` faqat mijoz yig'ma
  // tranzaksiyasi (yuqorida) muvaffaqiyatli tugagach ma'lum bo'ladi.
  if (isNewCustomer) {
    await db.collection("sellers").doc(order.sellerId).collection("orderRollups").doc(dateKey).set(
      { newCustomersCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
}

/** Yangi buyurtma yaratilganda — kunlik "yaratilgan buyurtmalar" (faoliyat ko'rsatkichi, holatidan qat'i nazar) sanog'ini oshiradi. */
async function incrementOrdersCreatedCount(order) {
  if (!order?.sellerId) return;
  const createdAtMs = order.createdAt?.toMillis ? order.createdAt.toMillis() : Date.now();
  const dateKey = dateKeyFromMillis(createdAtMs);
  const ref = db.collection("sellers").doc(order.sellerId).collection("orderRollups").doc(dateKey);
  await ref.set(
    { ordersCreatedCount: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

async function handleOrderRollupWrite(event) {
  const beforeSnap = event.data?.before;
  const afterSnap = event.data?.after;
  const before = beforeSnap?.exists ? beforeSnap.data() : null;
  const after = afterSnap?.exists ? afterSnap.data() : null;
  const orderId = event.params?.orderId;

  if (!after) return; // O'chirish - `firestore.rules` bo'yicha mumkin emas, xavfsizlik uchun qo'shildi.

  if (!before) {
    await incrementOrdersCreatedCount(after);
  }

  const wasDelivered = before?.status === "delivered";
  const isDelivered = after.status === "delivered";
  if (wasDelivered === isDelivered) return; // Bu YOZUV rollup'larga tegishli o'tish emas.

  try {
    await applyRollupsForOrder(after, orderId, isDelivered ? 1 : -1);
  } catch (err) {
    // MUHIM: agar rollup yangilanishi muvaffaqiyatsiz bo'lsa ham, bu
    // BUYURTMANING O'ZIGA (allaqachon muvaffaqiyatli yozilgan) ta'sir
    // qilmasligi kerak - fon jarayoni, faqat log yoziladi. (Doimiy
    // nomuvofiqlik xavfini kamaytirish uchun - `backfillSellerRollups`
    // istalgan vaqt qayta ishga tushirilib, hammasini qayta hisoblab
    // to'g'irlab qo'yishi mumkin.)
    console.error(`Rollup yangilashda xatolik (buyurtma ${orderId}):`, err);
    initSentry();
    Sentry.captureException(err, { extra: { orderId } });
  }
}

exports.onOrderWriteUpdateRollups = onDocumentWritten(
  { document: "orders/{orderId}", region: "asia-south1", secrets: [SENTRY_DSN] },
  handleOrderRollupWrite
);

/**
 * BIR MARTALIK MIGRATSIYA: yangi rollup tizimi qurilishidan OLDIN
 * yaratilgan sotuvchilarning MAVJUD buyurtma tarixini
 * `orderRollups`/`customers` yig'ma kolleksiyalariga "orqaga
 * hisoblab" to'ldiradi.
 *
 * IDEMPOTENT: necha marta chaqirilsa ham natija BIR XIL (mavjud
 * yig'ma hujjatlar ustiga QO'SHILMAYDI - to'liq QAYTA HISOBLANIB,
 * ustidan YOZILADI) - xavfsiz qayta ishga tushirish mumkin (masalan
 * hisoblash mantig'ida keyinroq xato topilib, tuzatilganda).
 *
 * OCHIQ CHEGARA: bu migratsiya paytida `orderCosts` suratlari HALI
 * mavjud emas (bu - yangi funksiya, faqat SHU o'zgarishdan keyingi
 * buyurtmalar uchun yaratiladi) - shuning uchun eski buyurtmalar
 * uchun COGS HAR DOIM JORIY mahsulot tannarxidan hisoblanadi. Bu -
 * REGRESSIYA EMAS: hozirgi (client-side) Dashboard/P&L ham AYNAN
 * shu (joriy tannarx) usulini ishlatadi - migratsiya faqat hisoblash
 * joyini (brauzerdan serverga) ko'chiradi, natijani o'zgartirmaydi.
 */
async function handleBackfillSellerRollups(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { sellerId } = request.data || {};
  if (request.auth.uid !== String(sellerId)) {
    throw new HttpsError("permission-denied", "Faqat o'z do'koningiz uchun ishga tushirishingiz mumkin.");
  }
  await checkRateLimit(`backfillSellerRollups:${sellerId}`, 3, 3600);

  const productsSnap = await db.collection("products").where("sellerId", "==", sellerId).get();
  const costPriceMap = new Map();
  productsSnap.forEach((doc) => costPriceMap.set(doc.id, Number(doc.data().costPrice) || 0));

  const dailyMap = new Map(); // dateKey -> {revenue, cogs, deliveredCount, ordersCreatedCount}
  const customerMap = new Map(); // clientId -> {ltv, orderCount, lastOrderAtMs, fullName, phone}
  let ordersProcessed = 0;
  let lastDoc = null;

  for (;;) {
    let query = db.collection("orders").where("sellerId", "==", sellerId).orderBy("createdAt", "asc").limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    snap.docs.forEach((doc) => {
      const order = doc.data();
      const createdAtMs = order.createdAt?.toMillis ? order.createdAt.toMillis() : Date.now();
      const dateKey = dateKeyFromMillis(createdAtMs);

      const dayEntry = dailyMap.get(dateKey) || { revenue: 0, cogs: 0, deliveredCount: 0, ordersCreatedCount: 0, newCustomersCount: 0 };
      dayEntry.ordersCreatedCount += 1;

      if (order.status === "delivered") {
        const items = Array.isArray(order.orders) ? order.orders.map((i) => ({ id: i.id, quantity: i.quantity })) : [];
        const cogs = computeOrderCogs(items, costPriceMap);
        dayEntry.revenue += Number(order.totalAmount) || 0;
        dayEntry.cogs += cogs;
        dayEntry.deliveredCount += 1;

        if (order.clientId) {
          const existing = customerMap.get(order.clientId) || null;
          const nextCustomerState = buildCustomerRollupState(existing, { ...order, createdAtMs }, 1);
          customerMap.set(order.clientId, nextCustomerState);
          // Buyurtmalar `orderBy("createdAt","asc")` bo'yicha ketma-ket
          // qayta ishlanayotgani uchun, `isNewCustomer` shu yerda ANIQ
          // mijozning haqiqiy birinchi (butun tarixdagi) buyurtmasini
          // bildiradi - jonli trigger'dagi bilan bir xil mantiq, faqat
          // butun tarix ustida qayta o'ynatilmoqda.
          if (nextCustomerState.isNewCustomer) dayEntry.newCustomersCount += 1;
        }
      }
      dailyMap.set(dateKey, dayEntry);
      ordersProcessed += 1;
    });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  const writes = [];
  dailyMap.forEach((value, dateKey) => {
    writes.push([
      db.collection("sellers").doc(sellerId).collection("orderRollups").doc(dateKey),
      {
        revenue: value.revenue,
        cogs: value.cogs,
        deliveredCount: value.deliveredCount,
        ordersCreatedCount: value.ordersCreatedCount,
        newCustomersCount: value.newCustomersCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ]);
  });
  customerMap.forEach((value, clientId) => {
    if (value.removed) return;
    writes.push([
      db.collection("sellers").doc(sellerId).collection("customers").doc(clientId),
      {
        ltv: value.ltv,
        orderCount: value.orderCount,
        lastOrderAtMs: value.lastOrderAtMs,
        // `orders` so'rovi `orderBy("createdAt","asc")` bo'yicha
        // ketma-ket o'qilgani uchun, bu yerda `firstOrderAtMs` HAR
        // DOIM to'g'ri (mijozning haqiqiy birinchi buyurtmasi) -
        // yuqoridagi jonli trigger'dagi (`applyCustomerRollup`)
        // "noma'lum bo'lsa yozmaymiz" cheklovi bu yerga tegishli EMAS,
        // chunki bu yerda butun tarix haqiqatan ham qayta ko'rib
        // chiqiladi.
        firstOrderAtMs: value.firstOrderAtMs,
        fullName: value.fullName,
        phone: value.phone,
        couponOrderCount: value.couponOrderCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    ]);
  });

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_SIZE).forEach(([ref, data]) => batch.set(ref, data, { merge: false }));
    await batch.commit();
  }

  // MUHIM: bayroqni FIRESTORE'GA (sotuvchi hujjatining o'ziga)
  // yozamiz - FAQAT frontend'ning vaqtinchalik sessiya keshiga
  // (`patchStore`) EMAS. Aks holda, sahifa yangilanganda (yoki yangi
  // sessiyada) bu bayroq YO'QOLIB, migratsiya HAR SAFAR qayta ishga
  // tushishi mumkin edi (bu funksiya IDEMPOTENT bo'lsa ham,
  // cheklovsiz takrorlanishi kerak emas - soatiga 3 martalik
  // so'rovlarni cheklash shu bilan bog'liq).
  await db.collection("sellers").doc(sellerId).set(
    { rollupsBackfilledAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { ordersProcessed, daysProcessed: dailyMap.size, customersProcessed: customerMap.size };
}

exports.backfillSellerRollups = onCall({ region: "asia-south1", timeoutSeconds: 300, secrets: [SENTRY_DSN] }, withSentry(handleBackfillSellerRollups));

exports._testables = {
  handleOrderRollupWrite,
  applyRollupsForOrder,
  incrementOrdersCreatedCount,
  handleBackfillSellerRollups,
  resolveOrderCogs,
};
