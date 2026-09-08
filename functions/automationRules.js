const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { incrementDailyStat } = require("./lib/dailyStats");
const { processBatched } = require("./lib/batchProcess");
const { getEffectiveTariffPlan } = require("./lib/tariffs");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * ADVANCED AUTOMATION (Z-Biznes, 2026-09 punkt-royxati, 5-band) —
 * sotuvchi O'ZI quradigan WHEN -> IF -> THEN avtomatlashtirish
 * qoidalari.
 *
 * MUHIM FARQ — bu fayl MAVJUD, FIKSATSIYALANGAN (fixed-threshold)
 * tizimlarni ALMASHTIRMAYDI: `engagementReminders.js`dagi
 * `sendRepurchaseReminders` (30 kunlik, segmentga bog'liq EMAS),
 * `managerAlerts.js`dagi `sendLowStockAlerts` (stock<=5 qattiq
 * kodlangan) va `sendStaleOrderAlerts` (48 soat qattiq kodlangan) —
 * ULAR BARCHA sotuvchiga (Z-Pro'dan boshlab) BEPUL, standart ishlab
 * turadigan xavfsizlik tarmog'i sifatida O'ZGARISHSIZ qoladi. Bu
 * fayl esa ULARGA QO'SHIMCHA — Biznes tarifidagi sotuvchiga O'Z
 * chegaralarini (masalan "30 kun EMAS, 45 kun", "FAQAT VIP mijozlar
 * uchun"), O'Z xabar matnini va O'Z trigger+harakat kombinatsiyasini
 * belgilash imkonini beradi.
 *
 * SXEMA: `sellers/{sellerId}/automationRules/{ruleId}`:
 *   {
 *     name: string,
 *     triggerType: "customer_inactive" | "order_undelivered" | "low_stock" |
 *                  "slow_moving_product" | "courier_delay",
 *     triggerParams: { days?, segment?, hours?, threshold? },
 *     actionType: "notify_customer_telegram" | "alert_manager" | "apply_discount",
 *     actionParams: { message?, discountPercent?, durationDays? },
 *     isActive: boolean,
 *     createdAtMs, updatedAtMs,
 *     stats: { firedCount, lastFiredAtMs },
 *   }
 * 2026-09 KENGAYTMA ("katta bizneslar uchun" ro'yxati, 2-guruh):
 * `slow_moving_product` (mahsulot `products.lastSoldAtMs`dan beri
 * uzoq sotilmagan) + `apply_discount` (FAQAT shu trigger bilan mos —
 * mahsulotga avtomatik vaqtinchalik chegirma qo'yadi, xuddi
 * `setDiscountPrice.js` yozadigan maydonlar orqali) va
 * `courier_delay` (buyurtma `courierAssignedAtMs`dan beri uzoq
 * yetkazilmagan, `alert_manager` bilan ishlatiladi) qo'shildi.
 * Klient (frontend) TO'G'RIDAN-TO'G'RI yozadi (`sellers/{id}/coupons`
 * bilan BIR XIL naqsh — murakkab CRUD onCall funksiyalar shart emas)
 * — `firestore.rules` egalik + Biznes tarifini va asosiy shaklni
 * tekshiradi. IJRO esa BUTUNLAY server tomonida, shu fayldagi
 * `runAutomationRules` cron orqali.
 *
 * IKKI MARTA XABAR YUBORMASLIK: har bir qoida o'zining
 * `firedFor/{entityId}` quyi kolleksiyasida (sof Cloud Function
 * boshqaruvida, klient UMUMAN murojaat qilmaydi) so'nggi ishga
 * tushirilgan vaqtni saqlaydi — trigger turiga qarab FARQLI "sovish"
 * (cooldown) muddati bilan (`cooldownMsForRule`).
 *
 * XAVFSIZLIK CHEGARALARI (barcha mavjud crondagi kabi naqsh):
 * so'rovlar `MAX_MATCHES_PER_RULE` bilan cheklangan, xaridorga
 * shaxsiy xabar yuborish `MAX_CUSTOMER_MESSAGES_PER_RULE_RUN` bilan
 * cheklangan — juda katta mijozlar/buyurtmalar bazasida bitta ishga
 * tushirishda BARCHA mos nomzod emas, ENG KO'PI BILAN shu sondagilar
 * qayta ishlanadi (qolganlari keyingi soatlik yugurishda davom etadi).
 */

const TRIGGER_TYPES = ["customer_inactive", "order_undelivered", "low_stock", "slow_moving_product", "courier_delay"];
const ACTION_TYPES = ["notify_customer_telegram", "alert_manager", "apply_discount"];
// `src/constants/orderStatus.js`dagi `CAN_CANCEL_STATUSES` bilan BIR
// XIL — "hali ochiq/yakunlanmagan" holatlar.
const OPEN_ORDER_STATUSES = ["new", "processing", "shipped"];
// `src/utils/customerSegments.js`/`lib/customerIntelligence.js` bilan
// BIR XIL qiymat — "VIP" tushunchasi platformada bir xil ma'noni
// anglatishi kerak.
const VIP_THRESHOLD = 500_000;

const MAX_SELLERS_PER_RUN = 300;
const MAX_RULES_PER_SELLER = 50;
// Bitta so'rovda o'qiladigan nomzod hujjatlar xavfsizlik chegarasi —
// `execGetLowStockProducts`/`execGetTrendingProducts`dagi kabi naqsh
// (mavjud kompozit indekslardan foydalanadi, batafsil izoh pastda
// har bir `find*Matches` funksiyasida).
const MAX_MATCHES_PER_RULE = 200;
// Bitta ishga tushirishda nechta XARIDORGA shaxsiy Telegram xabari
// yuborilishi mumkin — nazoratsiz xabar oqimining oldini olish uchun.
const MAX_CUSTOMER_MESSAGES_PER_RULE_RUN = 50;
// `managerAlerts.js`dagi `LOW_STOCK_REALERT_DAYS` bilan BIR XIL
// qiymat/g'oya — bir mahsulot uchun eslatma necha kunda bir marta
// takrorlanishi mumkin.
const LOW_STOCK_COOLDOWN_DAYS = 7;

const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;

/**
 * Sotuvchi yozgan xabar shabloni ichidagi `{ism}` o'rniga mijozning
 * ismini (to'liq ismning BIRINCHI so'zi) qo'yadi — HAQIQIY, oddiy
 * shaxsiylashtirish (mock EMAS). Ism topilmasa, xushmuomala umumiy
 * murojaat bilan almashtiriladi.
 */
function personalizeMessage(template, fullName) {
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";
  return String(template || "").split("{ism}").join(firstName || "Hurmatli mijoz");
}

function clampNumber(value, fallback, min, max) {
  const n = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  return Math.min(Math.max(n, min), max);
}

// ---------------------------------------------------------------------
// TRIGGER BAHOLOVCHILARI — har biri bitta (sotuvchi, qoida) jufti
// uchun mos keluvchi "nomzod" obyektlar ro'yxatini qaytaradi. Har
// birining Firestore so'rovi MAVJUD kompozit indeksdan foydalanadi
// (yangi indeks joylashtirish/kutish shart emas):
//   - customer_inactive: bitta maydonli tengsizlik (`lastOrderAtMs`)
//     — avtomatik yagona-maydon indeksi, kompozit shart emas.
//   - order_undelivered: `orders (sellerId ASC, status ASC)` —
//     `execGetLowStockProducts` yaqinidagi qatorlar bilan bir xil,
//     ALLAQACHON mavjud (masalan `pricingSuggestions.js`da ham
//     ishlatiladi).
//   - low_stock: `products (sellerId ASC, stock ASC)` —
//     `managerAlerts.js`dagi `sendLowStockAlerts` bilan BIR XIL,
//     ALLAQACHON mavjud.
// ---------------------------------------------------------------------

async function findCustomerInactiveMatches(sellerId, triggerParams) {
  const days = clampNumber(triggerParams?.days, 30, 1, 365);
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const snap = await db.collection("sellers").doc(sellerId).collection("customers")
    .where("lastOrderAtMs", "<", cutoffMs)
    .limit(MAX_MATCHES_PER_RULE)
    .get();
  const wantsVipOnly = triggerParams?.segment === "vip";
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => !wantsVipOnly || (Number(c.ltv) || 0) >= VIP_THRESHOLD)
    .map((c) => ({ entityId: c.id, clientId: c.id, fullName: c.fullName || "" }));
}

async function findOrderUndeliveredMatches(sellerId, triggerParams) {
  const hours = clampNumber(triggerParams?.hours, 72, 1, 720);
  const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
  const snap = await db.collection("orders")
    .where("sellerId", "==", sellerId)
    .where("status", "in", OPEN_ORDER_STATUSES)
    .limit(MAX_MATCHES_PER_RULE)
    .get();
  return snap.docs
    .map((d) => {
      const o = d.data();
      const createdAtMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : 0;
      return { id: d.id, createdAtMs, totalAmount: Number(o.totalAmount) || 0 };
    })
    .filter((o) => o.createdAtMs > 0 && o.createdAtMs < cutoffMs)
    .map((o) => ({ entityId: o.id, totalAmount: o.totalAmount, createdAtMs: o.createdAtMs }));
}

async function findLowStockMatches(sellerId, triggerParams) {
  const threshold = clampNumber(triggerParams?.threshold, 5, 1, 1000);
  const snap = await db.collection("products")
    .where("sellerId", "==", sellerId)
    .where("stock", ">", 0)
    .where("stock", "<=", threshold)
    .orderBy("stock", "asc")
    .limit(MAX_MATCHES_PER_RULE)
    .get();
  return snap.docs.map((d) => ({ entityId: d.id, name: d.data().name || "Mahsulot", stock: Number(d.data().stock) || 0 }));
}

/**
 * `slow_moving_product` — mahsulot `lastSoldAtMs`dan beri (yaratilgan
 * paytdan yoki so'nggi sotilgan paytdan, `orders.js`dagi izohga
 * qarang) berilgan kundan ko'proq vaqt sotilmagan bo'lsa mos keladi.
 * Bitta maydonli tengsizlik (`sellerId ASC, lastSoldAtMs ASC` kompozit
 * indeks, `firestore.indexes.json`) — qolgan shartlar (zaxira bor,
 * hali qo'lda chegirma qo'yilmagan) kichik natija to'plamida JS'da
 * filtrlanadi (`findCustomerInactiveMatches`dagi VIP filtri bilan BIR
 * XIL naqsh).
 */
async function findSlowMovingProductMatches(sellerId, triggerParams) {
  const days = clampNumber(triggerParams?.days, 30, 7, 180);
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const snap = await db.collection("products")
    .where("sellerId", "==", sellerId)
    .where("lastSoldAtMs", "<", cutoffMs)
    .limit(MAX_MATCHES_PER_RULE)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => (Number(p.stock) || 0) > 0 && p.discountPrice == null)
    .map((p) => ({
      entityId: p.id,
      name: p.name || "Mahsulot",
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0,
      lastSoldAtMs: Number(p.lastSoldAtMs) || 0,
    }));
}

/**
 * `courier_delay` — buyurtma kuryerga biriktirilgan
 * (`courierAssignedAtMs`, `couriers.js`dagi `assignOrderToCourier`)
 * paytdan beri berilgan soatdan ko'proq vaqt hali "assigned"/
 * "picked_up" holatida (ya'ni yetkazib bo'linmagan) bo'lsa mos keladi.
 * `order_undelivered`dan FARQI: bu yerda hisob buyurtma
 * YARATILGANIDAN emas, kuryerga BIRIKTIRILGANIDAN boshlanadi — real
 * "kuryer kechikyapti" muammosini aniqlaydi (`orders (sellerId ASC,
 * courierDeliveryStatus ASC)` kompozit indeks — `order_undelivered`
 * uchun mavjud `sellerId+status` bilan BIR XIL naqsh).
 */
async function findCourierDelayMatches(sellerId, triggerParams) {
  const hours = clampNumber(triggerParams?.hours, 3, 1, 72);
  const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
  const snap = await db.collection("orders")
    .where("sellerId", "==", sellerId)
    .where("courierDeliveryStatus", "in", ["assigned", "picked_up"])
    .limit(MAX_MATCHES_PER_RULE)
    .get();
  return snap.docs
    .map((d) => {
      const o = d.data();
      return { id: d.id, courierAssignedAtMs: Number(o.courierAssignedAtMs) || 0, courierName: o.courierName || "" };
    })
    .filter((o) => o.courierAssignedAtMs > 0 && o.courierAssignedAtMs < cutoffMs)
    .map((o) => ({ entityId: o.id, courierName: o.courierName, courierAssignedAtMs: o.courierAssignedAtMs }));
}

const TRIGGER_FINDERS = {
  customer_inactive: findCustomerInactiveMatches,
  order_undelivered: findOrderUndeliveredMatches,
  low_stock: findLowStockMatches,
  slow_moving_product: findSlowMovingProductMatches,
  courier_delay: findCourierDelayMatches,
};

// ---------------------------------------------------------------------
// COOLDOWN ("sovish") — `firedFor/{entityId}` quyi kolleksiyasi
// orqali, trigger turiga qarab FARQLI muddat bilan.
// ---------------------------------------------------------------------

function cooldownMsForRule(rule) {
  if (rule.triggerType === "customer_inactive") {
    // Xuddi trigger chegarasining O'ZI (masalan 30 kun) — mijoz
    // "faolsiz" deb qayta belgilanmaguncha (ya'ni yana shuncha kun
    // o'tmaguncha) qayta xabar yuborilmaydi.
    return clampNumber(rule.triggerParams?.days, 30, 1, 365) * 24 * 60 * 60 * 1000;
  }
  if (rule.triggerType === "low_stock") {
    return LOW_STOCK_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  }
  if (rule.triggerType === "slow_moving_product") {
    // Agar harakat aksiya qo'yish bo'lsa - aksiya MUDDATI tugagunча
    // qayta ishlov berilmaydi (aks holda amaldagi chegirma muddati
    // tugashidan oldin yana "yangilanib", cheksiz uzayib ketardi).
    if (rule.actionType === "apply_discount") {
      return clampNumber(rule.actionParams?.durationDays, 14, 1, 90) * 24 * 60 * 60 * 1000;
    }
    return clampNumber(rule.triggerParams?.days, 30, 7, 180) * 24 * 60 * 60 * 1000;
  }
  // order_undelivered / courier_delay - bitta buyurtma uchun BIR
  // MARTA (buyurtma vaqt o'tishi bilan albatta boshqa holatga o'tadi
  // yoki yetkaziladi - `staleOrderAlerted` bayrog'i bilan bir xil
  // g'oya).
  return Infinity;
}

async function filterDueMatches(ruleRef, rule, matches) {
  if (matches.length === 0) return [];
  const cooldownMs = cooldownMsForRule(rule);
  const now = Date.now();
  const snaps = await Promise.all(matches.map((m) => ruleRef.collection("firedFor").doc(m.entityId).get()));
  return matches.filter((m, idx) => {
    const snap = snaps[idx];
    if (!snap.exists) return true;
    const firedAtMs = Number(snap.data().firedAtMs) || 0;
    return now - firedAtMs >= cooldownMs;
  });
}

async function markFired(ruleRef, entityIds) {
  if (entityIds.length === 0) return;
  const batch = db.batch();
  const now = Date.now();
  entityIds.forEach((id) => {
    batch.set(ruleRef.collection("firedFor").doc(id), { firedAtMs: now }, { merge: true });
  });
  await batch.commit();
}

// ---------------------------------------------------------------------
// HARAKAT (ACTION) BAJARUVCHILARI.
// ---------------------------------------------------------------------

/**
 * `notify_customer_telegram` — FAQAT `customer_inactive` trigger
 * bilan mos keladi (faqat shu holatda `clientId` mavjud). Xaridorga
 * sotuvchining O'Z boti orqali (bo'lmasa, platforma boti orqali)
 * shaxsiy, `{ism}` bilan moslashtirilgan xabar yuboradi.
 */
async function runNotifyCustomerAction(sellerId, rule, matches) {
  const toSend = matches.slice(0, MAX_CUSTOMER_MESSAGES_PER_RULE_RUN);
  const customBotToken = await getSellerCustomBotToken(sellerId);
  const template = rule.actionParams?.message || "Sizni sog'indik! Qaytib xarid qiling.";
  const firedEntityIds = [];
  for (const m of toSend) {
    const text = personalizeMessage(template, m.fullName);
    try {
      await sendCustomerNotification(customBotToken, m.clientId, text);
      firedEntityIds.push(m.entityId);
    } catch (err) {
      console.error(`Avtomatlashtirish: mijozga xabar yuborishda xatolik (sotuvchi ${sellerId}, mijoz ${m.clientId}):`, err);
    }
  }
  return { firedEntityIds, sentCount: firedEntityIds.length };
}

/**
 * `apply_discount` — FAQAT `slow_moving_product` trigger bilan mos
 * keladi (`processAutomationRule`dagi juftlik tekshiruvi). Mos
 * kelgan (uzoq sotilmagan, hali qo'lda chegirma qo'yilmagan)
 * mahsulotlarga avtomatik vaqtinchalik chegirma qo'yadi — xuddi
 * `setDiscountPrice.js`/`CreatePromotionPage.jsx` yozadigan
 * MAYDONLARNING O'ZI (`discountPrice`, `discountExpiresAt`) orqali,
 * shuning uchun `functions/products.js`dagi
 * `onProductWriteUpdateDiscountCounter` trigger avtomatik ishga
 * tushib, `activeDiscountCount` hisoblagichini ham to'g'ri yuritadi
 * (Biznes'da bu limit cheksiz bo'lsa ham, hisoblagichning o'zi
 * to'g'ri qolishi kerak).
 */
async function runApplyDiscountAction(sellerId, rule, matches) {
  const percent = clampNumber(rule.actionParams?.discountPercent, 15, 5, 70);
  const durationDays = clampNumber(rule.actionParams?.durationDays, 14, 1, 90);
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  const toApply = matches.slice(0, MAX_MATCHES_PER_RULE);
  const batch = db.batch();
  const firedEntityIds = [];
  for (const m of toApply) {
    if (!(Number(m.price) > 0)) continue; // Narxsiz mahsulotga foizli chegirma hisoblab bo'lmaydi.
    const discountPrice = Math.max(1, Math.round(m.price * (1 - percent / 100)));
    batch.set(
      db.collection("products").doc(m.entityId),
      { discountPrice, discountExpiresAt: expiresAt, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    firedEntityIds.push(m.entityId);
  }
  if (firedEntityIds.length > 0) await batch.commit();
  return { firedEntityIds, sentCount: firedEntityIds.length };
}

/**
 * `alert_manager` — trigger turidan qat'i nazar, sotuvchining O'ZIGA
 * (platforma boti orqali, `managerAlerts.js` bilan bir xil naqsh)
 * BITTA jamlangan xabar yuboradi.
 */
async function runAlertManagerAction(sellerId, rule, matches, botToken) {
  const lines = matches.slice(0, 10).map((m) => {
    if (rule.triggerType === "low_stock") return `• ${m.name} — ${m.stock} dona qoldi`;
    if (rule.triggerType === "order_undelivered") return `• #${m.entityId.slice(0, 6)} — ${formatMoney(m.totalAmount)}`;
    if (rule.triggerType === "slow_moving_product") return `• ${m.name} — ${Math.round((Date.now() - m.lastSoldAtMs) / (24 * 60 * 60 * 1000))} kundan beri sotilmagan`;
    if (rule.triggerType === "courier_delay") return `• #${m.entityId.slice(0, 6)} — kuryer: ${m.courierName || "noma'lum"}`;
    return `• ${m.fullName || "Mijoz"}`;
  });
  const moreCount = matches.length > 10 ? matches.length - 10 : 0;
  const customText = rule.actionParams?.message ? `${rule.actionParams.message}\n\n` : "";
  let text = `Avtomatlashtirish: "${rule.name || "Qoida"}"\n\n${customText}${lines.join("\n")}`;
  if (moreCount > 0) text += `\n... va yana ${moreCount} ta`;

  const pageByTrigger = {
    low_stock: "/seller/products",
    order_undelivered: "/seller/orders",
    customer_inactive: "/seller/crm",
    slow_moving_product: "/seller/products",
    courier_delay: "/seller/orders",
  };
  await sendTelegramMessage(botToken, sellerId, text, {
    inlineKeyboard: [[{ text: "Ko'rish", web_app: { url: buildSellerAppLink(pageByTrigger[rule.triggerType] || "/seller") } }]],
  });
  return { firedEntityIds: matches.map((m) => m.entityId), sentCount: 1 };
}

// ---------------------------------------------------------------------
// ASOSIY ISHGA TUSHIRISH MANTIG'I.
// ---------------------------------------------------------------------

async function processAutomationRule(sellerId, ruleDoc, botToken) {
  const rule = ruleDoc.data();
  if (rule.isActive !== true) return;
  if (!TRIGGER_TYPES.includes(rule.triggerType) || !ACTION_TYPES.includes(rule.actionType)) return;
  // `notify_customer_telegram` FAQAT `customer_inactive`, `apply_discount`
  // FAQAT `slow_moving_product` bilan mos - noto'g'ri (masalan
  // `firestore.rules`ni chetlab o'tishga urinish natijasida yozilgan)
  // kombinatsiya JIM tarzda o'tkazib yuboriladi.
  if (rule.actionType === "notify_customer_telegram" && rule.triggerType !== "customer_inactive") return;
  if (rule.actionType === "apply_discount" && rule.triggerType !== "slow_moving_product") return;

  const finder = TRIGGER_FINDERS[rule.triggerType];
  const allMatches = await finder(sellerId, rule.triggerParams || {});
  if (allMatches.length === 0) return;

  const dueMatches = await filterDueMatches(ruleDoc.ref, rule, allMatches);
  if (dueMatches.length === 0) return;

  const { firedEntityIds, sentCount } = rule.actionType === "notify_customer_telegram"
    ? await runNotifyCustomerAction(sellerId, rule, dueMatches)
    : rule.actionType === "apply_discount"
      ? await runApplyDiscountAction(sellerId, rule, dueMatches)
      : await runAlertManagerAction(sellerId, rule, dueMatches, botToken);

  await markFired(ruleDoc.ref, firedEntityIds);
  if (sentCount > 0) {
    await ruleDoc.ref.set(
      { stats: { firedCount: admin.firestore.FieldValue.increment(sentCount), lastFiredAtMs: Date.now() } },
      { merge: true }
    );
    await incrementDailyStat(sellerId, "automationRulesFired");
  }
}

async function processSellerAutomationRules(sellerDoc, botToken) {
  const seller = sellerDoc.data();
  const sellerId = sellerDoc.id;
  // XAVFSIZLIK: sotuvchi Biznes tarifidan pasayganda (yoki sinovi
  // tugaganda) HAM eski qoidalar bazada `isActive:true` qolgan
  // bo'lishi mumkin — `firestore.rules`dagi yaratish/tahrirlash
  // cheklovi YETARLI EMAS (u faqat YOZISH paytida tekshiradi, keyingi
  // CRON ishga tushishlarida EMAS) — shuning uchun bu yerda YANA bir
  // marta samarali tarif tekshiriladi.
  if (getEffectiveTariffPlan(seller) !== "biznes") return;

  const rulesSnap = await db.collection("sellers").doc(sellerId).collection("automationRules")
    .where("isActive", "==", true)
    .limit(MAX_RULES_PER_SELLER)
    .get();
  if (rulesSnap.empty) return;

  // Bitta sotuvchining qoidalari KETMA-KET bajariladi (soddalik va
  // aniq xato-kuzatuv uchun — sotuvchida odatda bir nechta qoida
  // bo'ladi, bu operatsiyalar arzon).
  for (const ruleDoc of rulesSnap.docs) {
    try {
      await processAutomationRule(sellerId, ruleDoc, botToken);
    } catch (err) {
      console.error(`Avtomatlashtirish qoidasini bajarishda xatolik (sotuvchi ${sellerId}, qoida ${ruleDoc.id}):`, err);
    }
  }
}

exports.runAutomationRules = onSchedule(
  {
    schedule: "every 60 minutes", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN],
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const botToken = BOT_TOKEN.value();
    // `automationRuleActiveCount` hisoblagichi (pastdagi
    // `onAutomationRuleWriteUpdateCount` orqali yuritiladi) —
    // `coupons.js`dagi `couponCount` bilan BIR XIL g'oya: Firestore
    // kolleksiya bo'yicha "nechta faol qoida bor" so'rovini bajara
    // olmaydi, shuning uchun cron BU hisoblagich orqali qaysi
    // sotuvchilarni tekshirish kerakligini ARZON biladi (bitta
    // maydonli tengsizlik so'rovi — avtomatik indekslangan, kompozit
    // shart emas).
    const sellersSnap = await db.collection("sellers")
      .where("automationRuleActiveCount", ">", 0)
      .limit(MAX_SELLERS_PER_RUN)
      .get();
    if (sellersSnap.empty) return;

    const result = await processBatched(sellersSnap.docs, (sellerDoc) => processSellerAutomationRules(sellerDoc, botToken));
    console.log(`runAutomationRules: ${result.successCount}/${result.total} sotuvchi tekshirildi, ${result.failureCount} xato`);
  })
);

/**
 * `sellers.automationRuleActiveCount` hisoblagichi — `coupons.js`dagi
 * `onCouponWriteUpdateCount` bilan BIR XIL naqsh (`isActive` holati
 * O'ZGARGANDA — yaratilganda/o'chirilganda/faollashtirilganda/
 * faolsizlantirilganda — mos +1/-1).
 */
async function handleAutomationRuleWrite(event) {
  const sellerId = event.params.sellerId;
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;

  const wasActive = before?.isActive === true;
  const isActiveNow = after?.isActive === true;

  let delta = 0;
  if (!wasActive && isActiveNow) delta = 1; // yaratildi (faol) yoki faollashtirildi
  else if (wasActive && !isActiveNow) delta = -1; // o'chirildi yoki faolsizlantirildi

  if (delta === 0) return;

  await db.collection("sellers").doc(sellerId).set(
    { automationRuleActiveCount: admin.firestore.FieldValue.increment(delta) },
    { merge: true }
  );
}

exports.onAutomationRuleWriteUpdateCount = onDocumentWritten(
  { document: "sellers/{sellerId}/automationRules/{ruleId}", region: "asia-south1", secrets: [SENTRY_DSN] },
  withSentry(handleAutomationRuleWrite)
);

exports._testables = {
  TRIGGER_TYPES,
  ACTION_TYPES,
  personalizeMessage,
  clampNumber,
  findCustomerInactiveMatches,
  findOrderUndeliveredMatches,
  findLowStockMatches,
  findSlowMovingProductMatches,
  findCourierDelayMatches,
  cooldownMsForRule,
  filterDueMatches,
  markFired,
  runNotifyCustomerAction,
  runApplyDiscountAction,
  runAlertManagerAction,
  processAutomationRule,
  processSellerAutomationRules,
  handleAutomationRuleWrite,
};
