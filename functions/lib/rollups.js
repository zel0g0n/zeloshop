/**
 * Server-side rollup yordamchilari (analitika/CRM/P&L hisobotlari
 * uchun) — batafsil izoh: `functions/orderRollups.js`.
 *
 * Dashboard/P&L/CRM sahifalari ochilganda sotuvchining xom buyurtma
 * tarixini (potentsial minglab hujjat) to'liq yuklab, brauzerda qayta
 * hisoblash — buyurtmalar soni oshgan sari Firestore o'qish xarajati
 * va sahifa tezligi bo'yicha haqiqiy cheklovga aylanadi. Shu sabab bu
 * hisob-kitob buyurtma "delivered" holatiga o'tgan (yoki shu holatdan
 * chiqarilgan) paytda serverda bir marta amalga oshiriladi va ikkita
 * kichik yig'ma joyga yoziladi:
 *   1) `sellers/{id}/orderRollups/{YYYY-MM-DD}` — kunlik jami.
 *   2) `sellers/{id}/customers/{clientId}` — mijoz bo'yicha yig'ma.
 *
 * Bu fayl faqat sof hisoblash funksiyalarini o'z ichiga oladi
 * (Firestore/Admin SDK'ga bog'liq emas), shuning uchun to'g'ridan-
 * to'g'ri va tez sinovdan o'tkaziladi. Firestore o'qish/yozish/trigger
 * mantiqi — `orderRollups.js`da.
 */

const TASHKENT_TZ = "Asia/Tashkent";

/** Millisekundni "YYYY-MM-DD" (Toshkent vaqti) kun kalitiga aylantiradi. */
function dateKeyFromMillis(ms) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: TASHKENT_TZ });
}

/**
 * Buyurtma qatorlari uchun umumiy tannarxni hisoblaydi. Har bir
 * qator (`{id, quantity, costPrice?}`) — agar `costPrice` allaqachon
 * "suratga olingan" bo'lsa, O'SHA QOTGAN qiymatdan; aks holda
 * (eski, suratga olinmagan buyurtmalar) — berilgan `fallbackMap`
 * (mahsulot ID -> JORIY tannarx) orqali hisoblanadi.
 */
function computeOrderCogs(items, fallbackCostPriceMap = new Map()) {
  const list = Array.isArray(items) ? items : [];
  let cogs = 0;
  list.forEach((item) => {
    const hasSnapshot = item.costPrice !== undefined && item.costPrice !== null;
    const unitCost = hasSnapshot ? Number(item.costPrice) || 0 : Number(fallbackCostPriceMap.get(item.id)) || 0;
    cogs += unitCost * (Number(item.quantity) || 0);
  });
  return cogs;
}

/** `costPrice` suratga olinmagan qatorlarning mahsulot ID'larini topadi (fallback qidiruv uchun). */
function findMissingCostPriceIds(items) {
  const list = Array.isArray(items) ? items : [];
  const ids = new Set();
  list.forEach((item) => {
    if (item.costPrice === undefined || item.costPrice === null) ids.add(item.id);
  });
  return Array.from(ids);
}

/**
 * Kunlik yig'ma hujjatga (`orderRollups/{date}`) qo'llanadigan
 * INCREMENT qiymatlarini hisoblaydi. `sign`: +1 — buyurtma ENDIGINA
 * "delivered" bo'ldi; -1 — shu holatdan CHIQARILDI (bekor
 * qilish/qaytarish).
 */
function buildDailyRollupDelta(order, cogs, sign) {
  const revenue = (Number(order?.totalAmount) || 0) * sign;
  const cogsDelta = (Number(cogs) || 0) * sign;
  return { revenue, cogs: cogsDelta, deliveredCount: sign };
}

/**
 * Mijoz yig'ma hujjatining (`customers/{clientId}`) yangi holatini
 * hisoblaydi (mavjud holat + shu buyurtma). Sof funksiya.
 *
 * Bilinishi kerak bo'lgan chegara: agar buyurtma "delivered"dan
 * chiqarilsa (`sign = -1`), `lastOrderAtMs` ataylab o'zgartirilmaydi —
 * haqiqiy oldingi so'nggi buyurtma sanasini tiklash uchun mijozning
 * butun tarixini qayta skanerlash kerak bo'lardi, bu esa aynan ushbu
 * yig'ma yozuvni qurishdan maqsadga (qayta skanerlashdan qochish) zid
 * bo'lardi. Bu holat kam uchraydi (yetkazilgan buyurtmani bekor qilish
 * odatiy oqim emas) va ta'siri cheklangan: LTV va buyurtmalar soni har
 * doim to'g'ri qoladi, faqat "churn" segmenti bir muddat biroz eskiroq
 * sanaga asoslanishi mumkin.
 */
function buildCustomerRollupState(existing, order, sign) {
  const amount = Number(order?.totalAmount) || 0;
  const createdAtMs = Number(order?.createdAtMs) || 0;

  const newLtv = Math.max(0, (Number(existing?.ltv) || 0) + amount * sign);
  const newOrderCount = Math.max(0, (Number(existing?.orderCount) || 0) + sign);
  const newLastOrderAtMs = sign > 0
    ? Math.max(Number(existing?.lastOrderAtMs) || 0, createdAtMs)
    : (existing?.lastOrderAtMs ?? null);

  // CAC (mijoz jalb qilish narxi) hisob-kitobi uchun (P&L paneli, 2026-09
  // punkt-royxati, 3-band): mijozning ENG BIRINCHI xaridi qachon
  // bo'lganini bir marta "suratga olib" qo'yamiz. FAQAT mijoz yig'ma
  // yozuvi HALI UMUMAN mavjud bo'lmasa (`existing` — null, ya'ni bu
  // ANIQ uning birinchi buyurtmasi) yoziladi. Agar mijoz allaqachon
  // mavjud (oldingi buyurtmasi bor), lekin `firstOrderAtMs`i hali
  // yo'q bo'lsa (bu funksiya qurilishidan OLDINGI/migratsiyadan
  // oldingi mijoz) — bu YANGI buyurtma sanasini "birinchi xarid"
  // sifatida YOZIB QO'YISH NOTO'G'RI bo'lardi (u aslida ancha oldin
  // jalb qilingan, sanasi noma'lum xolos) - shuning uchun bunday
  // holatda maydon ATAYLAB bo'sh qoldiriladi (soxta sana o'ylab
  // topilmaydi). Bu REGRESSIYA EMAS - `backfillSellerRollups` haqiqiy
  // buyurtma tarixidan to'g'ri tiklaydi.
  const isBrandNewCustomerRecord = !existing;
  const existingFirstOrderAtMs = Number(existing?.firstOrderAtMs) || 0;
  const newFirstOrderAtMs = existingFirstOrderAtMs > 0
    ? existingFirstOrderAtMs
    : (isBrandNewCustomerRecord && sign > 0 ? createdAtMs : 0);

  // BIZNES BUYRUQ MARKAZI ("mijoz jalb qilish" tendentsiyasi, 2026-09):
  // ushbu buyurtma mijozning ENG BIRINCHI (haqiqatan yangi) yozuvini
  // yaratayotganini bildiradi - `orderRollups.js` buni kunlik
  // `newCustomersCount` hisoblagichiga qo'shish uchun ishlatadi. FAQAT
  // yig'ma yozuv HALI UMUMAN mavjud bo'lmagan (`isBrandNewCustomerRecord`)
  // VA bu "qo'shish" (sign>0) hodisasi bo'lsa `true` - "delivered"dan
  // chiqarish (sign<0) hech qachon "yangi mijoz" hisoblanmaydi.
  const isNewCustomer = isBrandNewCustomerRecord && sign > 0;

  // MIJOZLAR RAZVEDKASI ("discount_hunter" belgisi, 2026-09 punkt-
  // royxati 9-band): mijozning necha buyurtmasi PROMOKOD bilan
  // qilinganini hisoblaydi (`order.appliedCoupon.code` mavjudligi
  // bo'yicha, batafsil izoh: `functions/orders.js`). `newOrderCount`
  // bilan bir xil "delta" mantig'i - faqat mos shartli (promokod
  // bo'lsagina qo'shiladi/ayiriladi).
  const hasCoupon = Boolean(order?.appliedCoupon?.code);
  const newCouponOrderCount = Math.max(0, (Number(existing?.couponOrderCount) || 0) + (hasCoupon ? sign : 0));

  return {
    removed: newOrderCount <= 0,
    ltv: newLtv,
    orderCount: newOrderCount,
    lastOrderAtMs: newLastOrderAtMs,
    firstOrderAtMs: newFirstOrderAtMs > 0 ? newFirstOrderAtMs : null,
    fullName: order?.customer?.fullName || existing?.fullName || "",
    phone: order?.customer?.phone || existing?.phone || "",
    isNewCustomer,
    couponOrderCount: newCouponOrderCount,
  };
}

/**
 * SODIQLIK DASTURI ("Bonus hisobi"): buyurtma "delivered" bo'lganda
 * (yoki shu holatdan chiqarilganda, `sign=-1` bilan teskarisiga)
 * mijozning bonus balansiga qo'shiladigan/ayiriladigan miqdorni
 * hisoblaydi. Sof funksiya - Firestore yozuvi `orderRollups.js`da.
 *
 * `order.loyaltyBonusEarnBase` — buyurtma YARATILGAN paytda
 * (`functions/orders.js`dagi `handleCreateOrder` tranzaksiyasida)
 * allaqachon hisoblab, buyurtma hujjatining o'ziga yozib qo'yilgan
 * "sof" summa (chegirmalar VA bonus sarfidan keyin, lekin yetkazib
 * berish narxisiz - bonus faqat mahsulot puliga beriladi, yetkazib
 * berish xarajatiga emas). Bu yerda QAYTA hisoblanmaydi - shu orqali
 * chegirma/promokod/referal/bonus mantig'i BITTA joyda (orders.js)
 * qoladi, ikki marta yozilmaydi.
 *
 * Eski (bu funksiya qurilishidan OLDINGI) buyurtmalarda bu maydon
 * yo'q - ular uchun 0 qaytariladi (bonus berilmaydi), bu REGRESSIYA
 * EMAS: ular yaratilganda sodiqlik dasturi umuman mavjud emas edi.
 */
function computeLoyaltyEarnDelta(seller, order, sign) {
  if (!seller?.loyaltyEnabled) return 0;
  const earnPercent = Number(seller?.loyaltyEarnPercent) > 0 ? Number(seller.loyaltyEarnPercent) : 0;
  if (earnPercent <= 0) return 0;
  const earnBase = Number(order?.loyaltyBonusEarnBase) || 0;
  if (earnBase <= 0) return 0;
  return Math.round((earnBase * earnPercent) / 100) * sign;
}

module.exports = {
  TASHKENT_TZ,
  dateKeyFromMillis,
  computeOrderCogs,
  findMissingCostPriceIds,
  buildDailyRollupDelta,
  buildCustomerRollupState,
  computeLoyaltyEarnDelta,
};
