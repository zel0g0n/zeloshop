const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, BOT_TOKEN, COURIER_BOT_TOKEN } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const {
  sendTelegramMessage, buildDeepLink,
  sendTelegramLiveLocation, editTelegramLiveLocation, stopTelegramLiveLocation,
} = require("./lib/helpers");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { resolveActingSellerContext } = require("./lib/staffAccess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Kuryer tizimi.
 *
 * Sotuvchi haqiqiy kuryerlar qo'sha oladi (`createCourierInvite`
 * orqali taklif havolasi yaratiladi, kuryer botga `/start <token>`
 * bilan ulanadi — `courierBot.js`ga qarang), va buyurtmani ulardan
 * biriga topshira oladi (`assignOrderToCourier`) — shu zahoti
 * kuryerga, alohida "Kuryer boti" orqali, buyurtma tafsilotlari +
 * amal tugmalari (Yo'lga chiqdim/Yetkazildi/Yetkaza olmadim)
 * yuboriladi.
 *
 * Arxitektura qarori: kuryer hech qachon `orders/{orderId}`ni
 * to'g'ridan-to'g'ri Firestore SDK orqali yozmaydi — bu yerdagi
 * `applyCourierOrderAction()` (Admin SDK) orqali, faqat shu ikkita
 * yo'l bilan chaqiriladi: (1) Mini App'dan —
 * `updateCourierOrderStatus` onCall, (2) botning o'zidagi inline
 * tugmalardan — `courierBot.js`ning callback_query yo'riqchisi orqali,
 * to'g'ridan-to'g'ri (onCall'siz). Shu orqali `firestore.rules`ga
 * yangi yozish huquqi qo'shilmaydi (faqat kuryer o'ziga biriktirilgan
 * buyurtmalarni o'qishi uchun bitta qo'shimcha shart qo'shilgan —
 * `firestore.rules`ga qarang), butun ishonch chegarasi shu ikkita
 * Cloud Function ichida qoladi.
 */

// `src/config/courierTelegram.js`dagi BOT_USERNAME bilan bir xil
// bo'lib qolishi shart (loyihada allaqachon o'rnatilgan
// "frontend+backend duplikatsiyasi" naqshi). `staff.js`dagi
// `STAFF_BOT_USERNAME` bilan BIR XIL naqsh (4-BOT EKOTIZIM AUDITI,
// P2-band) — `COURIER_BOT_USERNAME` muhit o'zgaruvchisi bo'lsa, bot
// username'ini kod o'zgartirmasdan, faqat `.env.<loyiha-id>` fayli
// orqali yangilash mumkin.
const COURIER_BOT_USERNAME = process.env.COURIER_BOT_USERNAME || "zeloshop_kuryer_bot";

// "declined" — kuryer hali boshlamagan ("assigned") holatdagi
// topshiriqni rad etadi; "Yetkaza olmadim" esa faqat allaqachon
// boshlangan ("picked_up") yetkazma uchun - ular semantik jihatdan
// boshqa-boshqa narsa: "declined" = hali yo'lga chiqmasdan turib rad
// etish, "failed" = yo'lda urinib ko'rib, muvaffaqiyatsiz tugatish.
//
// Mijozga yuboriladigan Telegram nativ jonli joylashuv
// pufakchasining davomiyligi — 6 soat (bitta yetkazma uchun katta
// zaxira bilan yetarli). Yetkazma "delivered"/"failed"ga o'tganda
// aniq to'xtatiladi (`applyCourierOrderAction`ga qarang), shuning
// uchun bu son shunchaki "yetarlicha uzun" bo'lsa kifoya.
const LIVE_LOCATION_PERIOD_SECONDS = 6 * 60 * 60;

const COURIER_ACTIONS = ["picked_up", "delivered", "failed", "declined"];
const COURIER_ACTION_LABELS = {
  picked_up: "🚴 Yo'lga chiqdi",
  delivered: "✅ Yetkazildi",
  failed: "❌ Yetkazib bo'lmadi",
  declined: "❌ Bekor qilindi",
};

/**
 * Sof funksiya — taklif tokenidan kuryer botiga ulanadigan havolani
 * yasaydi. Oddiy bot buyrug'i (`/start <token>`) - Mini App emas,
 * shuning uchun HMAC/`startapp` kodlashi shart emas (referal
 * havolasidan farqli, `functions/lib/helpers.js`dagi `buildDeepLink`ga
 * qarang) - token to'g'ridan-to'g'ri, oddiy matn sifatida keladi.
 */
function buildCourierInviteLink(token) {
  return `https://t.me/${COURIER_BOT_USERNAME}?start=${token}`;
}

/**
 * Sof funksiya — kuryerga yuboriladigan "yangi yetkazma" xabarining
 * matnini tuzadi. Naqd to'lov (`cod`) bo'lsa, kuryerga alohida
 * ogohlantirish qo'shiladi — mijozdan pul yig'ish kerakligini
 * unutmasligi uchun.
 *
 * MUHIM TUZATISH (2026-09 punkt-royxati, 6-band — "hech qanday xom ID
 * ko'rsatilmasin"): ILGARI bu yerda `orderId.slice(-6).toUpperCase()`
 * ishlatilardi — bu Firestore hujjat ID'sining oddiy KESIMI, HAQIQIY
 * buyurtma raqami emas (masalan "K7X9M2" kabi tasodifiy-ko'rinishdagi
 * belgilar, sotuvchining "Buyurtmalar" sahifasidagi #128 bilan
 * HECH QANDAY bog'liqligi yo'q). Endi sotuvchiga yuborilgan xabar
 * bilan BIR XIL (`notifications.js`/`staff.js`dagi bilan mos)
 * `order.orderNumber`dan foydalaniladi.
 */
function buildCourierAssignmentMessage(order) {
  const customer = order.customer || {};
  const items = order.orders || [];
  const itemsList = items.map((item) => `• ${item.name} x${item.quantity}`).join("\n");
  const paymentTypes = Array.isArray(customer.paymentTypes) && customer.paymentTypes.length > 0
    ? customer.paymentTypes
    : ["prepay"];
  const paymentNote = paymentTypes.includes("cod")
    ? `💵 *Naqd to'lov* — mijozdan ${Number(order.totalAmount || 0).toLocaleString()} so'm yig'ib oling!`
    : "✅ Oldindan to'langan.";

  return [
    `📦 *Yangi yetkazma* №${order.orderNumber || "-"}`,
    "",
    `👤 ${customer.fullName || "Noma'lum mijoz"}`,
    `📞 ${customer.phone || "—"}`,
    `📍 ${customer.address || "—"}`,
    "",
    itemsList || "—",
    "",
    `💰 Jami: ${Number(order.totalAmount || 0).toLocaleString()} so'm`,
    paymentNote,
  ].join("\n");
}

/**
 * Sof funksiya — kuryerga yuboriladigan xabar ostidagi amal
 * tugmalarini yasaydi. `callback_data` formati: "cor:<amal>:<orderId>"
 * — `telegramApproval.js`dagi "a:vip:2026-08-23" naqshiga o'xshash.
 *
 * Ikki bosqichli: `stage` — "assigned" (hali boshlanmagan, standart)
 * bo'lsa "Boshladim"/"Bekor qilish", yoki "picked_up" (allaqachon
 * yo'lda) bo'lsa "Yetkazildi"/"Yetkaza olmadim". Bot xabari
 * (`courierBot.js`) kuryer "Boshladim"ni bosgach, shu ikkinchi
 * to'plamga almashtiriladi (`editTelegramMessageText` orqali) -
 * Mini App'dagi bir xil ikki bosqichli naqsh bilan mos.
 */
function buildCourierActionKeyboard(orderId, stage = "assigned") {
  if (stage === "picked_up") {
    return [
      [{ text: "✅ Yetkazildi", callback_data: `cor:delivered:${orderId}` }],
      [{ text: "❌ Yetkaza olmadim", callback_data: `cor:failed:${orderId}` }],
    ];
  }
  return [
    [{ text: "🚀 Boshladim", callback_data: `cor:picked_up:${orderId}` }],
    [{ text: "❌ Bekor qilish", callback_data: `cor:declined:${orderId}` }],
  ];
}

/**
 * Kuryer "Boshladim" (picked_up) bosgach, mijozga avtomatik (sotuvchi
 * aralashuvisiz) yuboriladigan, kuryerni jonli kuzatib borish
 * havolasi. `buildDeepLink` boshqa joylarda (masalan botning
 * "Buyurtmalarni ko'rish" tugmasi) ham ishlatiladigan mexanizm: mijoz
 * bu havolani bosganda, Mini App ichki yo'lga
 * (`/orders/{orderId}/track`) to'g'ridan-to'g'ri ochiladi, har doim
 * "mijoz" sifatida (hatto boshqa joyda sotuvchi bo'lsa ham) - shuning
 * uchun alohida autentifikatsiya mexanizmi (masalan token/HMAC)
 * qurishga hojat yo'q: mijoz o'zining odatiy sessiyasi bilan kiradi,
 * va `firestore.rules`dagi `orders/{orderId}` o'qish qoidasi
 * allaqachon `clientId==auth.uid` shartini o'z ichiga oladi (mijoz
 * allaqachon "Buyurtmalarim" bo'limida o'z buyurtmalarini shu qoida
 * orqali ko'radi).
 *
 * Bu xabar mijozga ketadi, shuning uchun avval sotuvchining shaxsiy
 * boti orqali yuboriladi (batafsil izoh: `lib/customerNotify.js`).
 * Havolaning o'zi (`trackingLink`) baribir har doim platforma
 * botining Mini App'ini ochadi (`buildDeepLink` — faqat
 * `zeloshop_bot`da Mini App ro'yxatdan o'tgan, boshqa botlarda
 * "/newapp" qadamisiz bu texnik jihatdan mumkin emas) - bu mijoz
 * uchun ko'rinmaydigan, ichki detal: u shunchaki xabarni sotuvchining
 * o'z botidan ko'radi va tugmani bosadi, xolos.
 */
async function sendCourierTrackingLinkToClient(order, orderId) {
  if (!order.clientId) return;
  const trackingLink = buildDeepLink(order.sellerId, `/orders/${orderId}/track`);
  if (!trackingLink) return;
  // Xom Firestore ID kesimisi o'rniga, sotuvchi/xodim ko'radigan bilan
  // BIR XIL `orderNumber` (2026-09 punkt-royxati, 6-band).
  const orderLabel = order.orderNumber ? `№${order.orderNumber}` : "";
  const customBotToken = await getSellerCustomBotToken(order.sellerId);
  await sendCustomerNotification(
    customBotToken,
    order.clientId,
    `🚴 Buyurtmangiz${orderLabel ? ` ${orderLabel}` : ""} yo'lda! Kuryerni jonli kuzatib borishingiz mumkin.`,
    { buttonText: "📍 Kuryerni kuzatish", buttonUrl: trackingLink }
  );
}

/**
 * Kuryer buyurtma holatini yangilaganda bajariladigan asosiy mantiq —
 * Mini App (`updateCourierOrderStatus`) va bot inline tugmalari
 * (`courierBot.js`) ikkalasi ham shu funksiyani chaqiradi (kod
 * duplikatsiyasiga yo'l qo'ymaslik uchun).
 *
 * `courierId` chaqiruvchi tomonidan tasdiqlangan (Mini App'da
 * Firebase custom token uid'i, botda Telegram `from.id`si) qiymat,
 * ishonchli. Bu yerda faqat shu buyurtma haqiqatan shu kuryerga
 * biriktirilganligi tekshiriladi.
 */
async function applyCourierOrderAction({ courierId, orderId, action }) {
  if (!COURIER_ACTIONS.includes(action)) {
    throw new HttpsError("invalid-argument", "Noma'lum amal.");
  }
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si berilmagan.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (String(order.courierId || "") !== String(courierId)) {
    throw new HttpsError("permission-denied", "Bu buyurtma sizga biriktirilmagan.");
  }

  // "declined" — kuryer hali yo'lga chiqmagan ("assigned") holatdagi
  // topshiriqdan o'zini olib tashlaydi. Boshlangan ("picked_up")
  // yetkazmani orqaga qaytarib bo'lmaydi (o'sha holat uchun "failed"
  // ishlatiladi - buyurtma allaqachon sotuvchi/mijoz ko'z o'ngida
  // "yo'lda" edi). Buyurtma butunlay "kuryersiz" holatga qaytadi
  // (`status` "processing"da qoladi, faqat "picked_up"da "shipped"ga
  // o'tadi - pastga qarang), sotuvchi qayta boshqa kuryerga (yoki
  // xuddi shu kuryerga qaytadan) biriktirishi mumkin.
  if (action === "declined") {
    if (order.courierDeliveryStatus !== "assigned") {
      throw new HttpsError("failed-precondition", "Bu yetkazmani endi bekor qilib bo'lmaydi — u allaqachon boshlangan.");
    }
    await orderRef.update({
      courierId: admin.firestore.FieldValue.delete(),
      courierName: admin.firestore.FieldValue.delete(),
      courierPhone: admin.firestore.FieldValue.delete(),
      courierDeliveryStatus: admin.firestore.FieldValue.delete(),
      courierLocation: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
      const courierSnap = await db.collection("couriers").doc(String(courierId)).get();
      const courierName = courierSnap.exists ? courierSnap.data().name : "Kuryer";
      // Xom Firestore ID kesimisi o'rniga `orderNumber` (2026-09
      // punkt-royxati, 6-band) + engilroq tuzilish/emoji.
      await sendTelegramMessage(
        BOT_TOKEN.value(),
        order.sellerId,
        [
          `❌ *Kuryer buyurtmani rad etdi*`,
          "",
          `👤 Kuryer: ${courierName}`,
          `🧾 Buyurtma №${order.orderNumber || "-"}`,
          "",
          "Boshqa kuryerga biriktiring.",
        ].join("\n")
      );
    } catch (err) {
      console.error(`Sotuvchiga rad etish xabarini yuborishda xatolik (${orderId}):`, err);
    }
    return { success: true, status: order.status, courierDeliveryStatus: null, orderNumber: order.orderNumber || null };
  }

  // Bir vaqtning o'zida faqat bitta yetkazma "jarayonda"
  // ("picked_up") bo'lishi mumkin - bir vaqtda bir nechta buyurtmani
  // olib borish mantiqan noto'g'ri, chunki har biri har xil manzilga
  // boradi. Oddiy `where` so'rovi ishlatilmaydi (compound-index
  // talab qilishning oldini olish uchun) — kuryerga biriktirilgan
  // barcha buyurtmalar olinib, xotirada filtrlanadi.
  if (action === "picked_up") {
    const assignedSnap = await db.collection("orders").where("courierId", "==", String(courierId)).get();
    const alreadyActive = assignedSnap.docs.some(
      (d) => d.id !== orderId && d.data().courierDeliveryStatus === "picked_up"
    );
    if (alreadyActive) {
      throw new HttpsError("failed-precondition", "Avval joriy yetkazmani yakunlang, keyin yangisini boshlang.");
    }
  }

  const updates = {
    courierDeliveryStatus: action,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  // Buyurtma sotuvchi kuryer tayinlaganda (`handleAssignOrderToCourier`)
  // emas, faqat kuryer haqiqatan "Boshladim"ni bosganda (`picked_up`)
  // "shipped"ga o'tadi - buyurtma yuborilganda avtomatik "yo'lda"
  // qismga o'tmasligi, kuryer boshlashni bosganda faollashishi kerak.
  // "Yetkaza olmadim" (`failed`) faqat kuryer-darajasidagi maydonni
  // o'zgartiradi — sotuvchi qo'lda hal qilishi kerak.
  if (action === "picked_up" || action === "delivered") {
    updates.status = action === "delivered" ? "delivered" : "shipped";
  }

  await orderRef.update(updates);

  // Sotuvchiga mavjud platforma boti orqali (kuryer boti emas —
  // sotuvchi kuryer botiga ulangan emas) bildirishnoma. Bu ikkinchi
  // darajali amal, xato bo'lsa ham asosiy holat yangilanishi
  // allaqachon saqlangan bo'ladi.
  try {
    const courierSnap = await db.collection("couriers").doc(String(courierId)).get();
    const courierName = courierSnap.exists ? courierSnap.data().name : "Kuryer";
    const label = COURIER_ACTION_LABELS[action] || action;
    // Xom Firestore ID kesimisi o'rniga `orderNumber` (2026-09
    // punkt-royxati, 6-band) + engilroq tuzilish.
    await sendTelegramMessage(
      BOT_TOKEN.value(),
      order.sellerId,
      [
        `${label}`,
        "",
        `🧾 Buyurtma №${order.orderNumber || "-"}`,
        `🚴 Kuryer: ${courierName}`,
      ].join("\n")
    );
  } catch (err) {
    console.error(`Sotuvchiga kuryer holati xabarini yuborishda xatolik (${orderId}):`, err);
  }

  // Kuryer "Boshladim" bosgach, mijozga avtomatik (sotuvchi
  // aralashuvisiz) kuryerni jonli kuzatish havolasi yuboriladi.
  // Sotuvchi tomonida bu havolani qayta yuborish uchun alohida
  // `resendCourierTrackingLink` ham mavjud (masalan yetkazib
  // bo'lmagan holatlar uchun zaxira).
  if (action === "picked_up") {
    try {
      await sendCourierTrackingLinkToClient(order, orderId);
    } catch (err) {
      console.error(`Mijozga kuzatuv havolasini yuborishda xatolik (${orderId}):`, err);
    }
    // Kuryerga Telegramning o'zining jonli joylashuv funksiyasini
    // qo'lda yoqishni tavsiya qilamiz — bot buni avtomatik yoqa
    // olmaydi (Telegram platformasining cheklovi: faqat inson o'zi,
    // oddiy chat ichida, qog'ozgayroq (📎) menyusidan yoqishi mumkin).
    // Bu ixtiyoriy: kuryer buni o'tkazib yuborsa ham, Mini App'ning
    // o'z GPS kuzatuvi (`src/utils/geolocation.js`) baribir
    // ishlayveradi - bu faqat qo'shimcha ishonchlilik/native tajriba
    // uchun.
    try {
      await sendTelegramMessage(
        COURIER_BOT_TOKEN.value(),
        courierId,
        "📍 Maslahat: joylashuvingiz yanada ishonchli uzatilishi uchun, shu chatda 📎 (qog'ozgayroq) tugmasi orqali \"Joylashuv\" → \"Jonli joylashuvni yuborish\"ni yoqib qo'ying. Bu ixtiyoriy, lekin tavsiya etiladi."
      );
    } catch (err) {
      console.error(`Kuryerga jonli joylashuv tavsiyasini yuborishda xatolik (${orderId}):`, err);
    }
  }

  // Yetkazma yakunlanganda (muvaffaqiyatli yoki muvaffaqiyatsiz),
  // agar mijozga nativ jonli joylashuv pufakchasi yuborilgan bo'lsa,
  // aniq to'xtatiladi (aks holda `live_period` muddati tugagunicha,
  // hatto kuryer allaqachon to'xtagan bo'lsa ham, "jonli" ko'rinishda
  // osilib qolar edi - chalg'ituvchi UX).
  if ((action === "delivered" || action === "failed") && order.courierLiveLocationMessageId && order.clientId) {
    // Pufakcha aynan qaysi bot orqali yuborilgan bo'lsa
    // (`writeCourierLocationAndNotifyClient`dagi izohga qarang), aynan
    // o'sha bot orqali to'xtatiladi - boshqa bot begona xabarni
    // to'xtata olmaydi.
    const stopToken = order.courierLiveLocationBotSource === "custom"
      ? (await getSellerCustomBotToken(order.sellerId)) || BOT_TOKEN.value()
      : BOT_TOKEN.value();
    await stopTelegramLiveLocation(stopToken, order.clientId, order.courierLiveLocationMessageId);
    try {
      await orderRef.update({
        courierLiveLocationMessageId: admin.firestore.FieldValue.delete(),
        courierLiveLocationBotSource: admin.firestore.FieldValue.delete(),
      });
    } catch (err) {
      console.error(`courierLiveLocationMessageId maydonini o'chirishda xatolik (${orderId}):`, err);
    }
  }

  // `orderNumber` — chaqiruvchiga (`courierBot.js`dagi inline tugma
  // callback'i) qaytariladi, xom Firestore ID o'rniga tasdiqlash
  // xabarida ko'rsatish uchun (2026-09 punkt-royxati, 6-band).
  return { success: true, status: updates.status || order.status, courierDeliveryStatus: action, orderNumber: order.orderNumber || null };
}

/**
 * Sotuvchi "Kuryerlar" sahifasida "+ Kuryer qo'shish" bosganda —
 * taklif hujjati yaratiladi va HAVOLA qaytariladi (sotuvchi buni
 * nusxalab, o'zi kuryerga WhatsApp/Telegram orqali yuboradi — bu
 * bot O'ZI xabar YUBORMAYDI, chunki kuryerning Telegram ID'si hali
 * NOMA'LUM — u FAQAT botga /start bosgandan keyin ma'lum bo'ladi).
 */
async function handleCreateCourierInvite(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`createCourierInvite:${sellerId}`, 20, 3600);

  const { name, phone } = request.data || {};
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new HttpsError("invalid-argument", "Kuryer ismini kiriting.");
  }

  // Token boshiga `sellerId_` prefiksi qo'shiladi - shu orqali kuryer
  // botiga "/start <token>" bilan kirilganda, qaysi sotuvchining
  // `courierInvites` quyi kolleksiyasini tekshirish kerakligini
  // (qimmat `collectionGroup` so'rovisiz, to'g'ridan-to'g'ri) bilib
  // olish mumkin - `functions/lib/helpers.js`dagi referal
  // havolalarining "{sellerId}_r{referrerId}" naqshi bilan bir xil
  // g'oya. `sellerId` faqat raqamlardan iborat (Telegram ID) bo'lgani
  // uchun, ajratkich sifatida "_" ishlatish hech qachon to'qnashmaydi.
  const token = `${sellerId}_${crypto.randomBytes(9).toString("hex")}`;
  await db.collection("sellers").doc(sellerId).collection("courierInvites").doc(token).set({
    name: trimmedName,
    phone: (phone || "").trim() || null,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { inviteLink: buildCourierInviteLink(token), token };
}

/**
 * Sotuvchi kuryerni faollashtiradi/vaqtincha to'xtatadi ("Hide without
 * deleting" naqshi — kuryer hujjati o'chirilmaydi, faqat holati
 * o'zgaradi, shuning uchun kuryer keyinroq qayta faollashtirilsa,
 * botga qayta ulanishning hojati yo'q).
 *
 * Buni sotuvchidan tashqari kuryerning o'zi ham chaqira oladi —
 * o'zini vaqtincha "band" qilib (masalan tushlik/dam olish vaqtida)
 * yangi buyurtma olishni to'xtatib turishi uchun (Mini App'dagi
 * "Faol/Band" almashtirgichi). Kuryer Mini App sessiyasida
 * `request.auth.uid` — aynan shu kuryerning `couriers/{id}` hujjat
 * ID'si (custom token shunday yaratilgan — `courierAuth.js`ga
 * qarang), shuning uchun "courierId === auth.uid" tekshiruvi yetarli
 * va xavfsiz: kuryer faqat o'zini, boshqa kuryerni emas,
 * (de)faollashtira oladi. Buyurtma biriktirish tomonida qo'shimcha
 * o'zgarish shart emas — `handleAssignOrderToCourier` allaqachon
 * `courier.status !== "active"` bo'lsa rad etadi, `CourierPickerModal.jsx`
 * esa faqat faol kuryerlarni ko'rsatadi — shu ikkalasi o'z-o'zidan
 * "band" kuryerga yangi buyurtma tushishining oldini oladi.
 */
async function handleSetCourierActive(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // XAVFSIZLIK (2026-09 audit, P1): oldin bu yerda hech qanday
  // `checkRateLimit` yo'q edi — chaqiruvchi FOYDALANUVCHI bo'yicha
  // (aniq courierId bo'yicha EMAS — aks holda kuryerni almashtirib
  // chegarani aylanib o'tish mumkin bo'lardi) chegaralanadi.
  await checkRateLimit(`setCourierActive:${request.auth.uid}`, 30, 3600);
  const { courierId, active } = request.data || {};
  if (!courierId || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  const courierRef = db.collection("couriers").doc(String(courierId));
  const courierSnap = await courierRef.get();
  if (!courierSnap.exists) {
    throw new HttpsError("not-found", "Kuryer topilmadi.");
  }
  const courier = courierSnap.data();
  const isOwnerSeller = courier.sellerId === request.auth.uid;
  const isSelf = String(courierId) === String(request.auth.uid);
  if (!isOwnerSeller && !isSelf) {
    throw new HttpsError("permission-denied", "Bu kuryer sizga tegishli emas.");
  }
  await courierRef.update({ status: active ? "active" : "inactive" });
  return { success: true };
}

/**
 * Kuryerni ro'yxatdan butunlay olib tashlaydi — sotuvchi tomonidan
 * (masalan ishdan bo'shagan xodim), yoki kuryerning o'zi tomonidan
 * ("kuryerlikni to'xtatish" - Mini App'ning "Profil" bo'limi),
 * `handleSetCourierActive`dagi bilan bir xil "sotuvchi yoki o'zi"
 * ruxsat naqshi. Faol buyurtmalarga ta'sir qilmaydi — ular o'zining
 * `courierId`/`courierName`sini saqlab qoladi (tarixiy yozuv
 * sifatida), faqat yangi buyurtma bu kuryerga topshirilolmay qoladi
 * (ro'yxatdan yo'qoladi). Kuryer o'zini o'chirgandan keyin, keyingi
 * safar botga kirishga urinsa, `verifyCourierTelegramAuth` "hali
 * hech qanday do'konga ulanmagansiz" xatosini qaytaradi - bu "endi
 * kuryer emassiz" holatining tabiiy, to'g'ri natijasi.
 */
async function handleRemoveCourier(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // XAVFSIZLIK (2026-09 audit, P1): destruktiv amal — oldin rate-limit
  // yo'q edi, chaqiruvchi bo'yicha (courierId bo'yicha EMAS) cheklandi.
  await checkRateLimit(`removeCourier:${request.auth.uid}`, 20, 3600);
  const { courierId } = request.data || {};
  if (!courierId) {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  const courierRef = db.collection("couriers").doc(String(courierId));
  const courierSnap = await courierRef.get();
  if (!courierSnap.exists) {
    throw new HttpsError("not-found", "Kuryer topilmadi.");
  }
  const courier = courierSnap.data();
  const isOwnerSeller = courier.sellerId === request.auth.uid;
  const isSelf = String(courierId) === String(request.auth.uid);
  if (!isOwnerSeller && !isSelf) {
    throw new HttpsError("permission-denied", "Bu kuryer sizga tegishli emas.");
  }
  await courierRef.delete();
  return { success: true };
}

/**
 * Kuryer Mini App'ining "Profil" bo'limi: kuryer o'zining ismi/telefon
 * raqamini yangilaydi (masalan telefon raqami almashganda). Faqat
 * o'zi uchun (`request.auth.uid === courierId` - Mini App sessiyasida
 * bu ikkalasi har doim bir xil, `courierAuth.js`ga qarang) - sotuvchi
 * bu funksiya orqali kuryer profilini o'zgartira olmaydi (u faqat
 * taklif yaratish/faollashtirish/o'chirish huquqiga ega, chunki profil
 * ma'lumoti kuryerning o'zinikidir).
 */
async function handleUpdateCourierProfile(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const courierId = String(request.auth.uid);
  await checkRateLimit(`updateCourierProfile:${courierId}`, 20, 3600);

  const { name, phone } = request.data || {};
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new HttpsError("invalid-argument", "Ismingizni kiriting.");
  }

  const courierRef = db.collection("couriers").doc(courierId);
  const courierSnap = await courierRef.get();
  if (!courierSnap.exists) {
    throw new HttpsError("not-found", "Kuryer topilmadi.");
  }

  await courierRef.update({
    name: trimmedName,
    phone: (phone || "").trim() || null,
  });
  return { success: true };
}

/**
 * Sotuvchi buyurtmani tanlangan kuryerga topshiradi — `OrderCard.jsx`
 * dagi "Kuryerga topshirish" tugmasining ishlaydigan versiyasi.
 *
 * Faqat "Yig'ilmoqda" (`processing`) bosqichidagi buyurtmalar uchun
 * ishlaydi — `canDispatchYandex`ning yonida turgan, bir xil bosqich
 * talabiga ega (Yandex bilan parallel tanlov).
 *
 * `order.status` bu yerda o'zgartirilmaydi ("processing"da qoladi) -
 * u faqat kuryer "Boshladim"ni bosgach (`applyCourierOrderAction`ning
 * "picked_up" bo'limi), "shipped"ga o'tadi. Bu buyurtmani sotuvchi
 * tomonida haqiqatan yo'lga hali chiqmasdan turib "Yo'lda" deb
 * ko'rsatishning oldini oladi. Bu vaqtgacha buyurtma "Yig'ilmoqda"
 * bo'limida, lekin `courierId`+`courierDeliveryStatus:"assigned"`
 * bilan - frontend (`OrderCard.jsx`) buni alohida "kutilmoqda"
 * ko'rinishida (soat ikonkasi) ko'rsatadi.
 */
async function handleAssignOrderToCourier(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // MUHIM (2026-09, 10-band): endi FAQAT sotuvchi emas, `manageCouriers`
  // ruxsatiga ega FAOL xodim ham chaqira oladi - `sellerId` doim
  // HAQIQIY do'kon egasining uid'i bo'lib qoladi (xodim bo'lsa ham),
  // shuning uchun pastdagi barcha `order.sellerId`/`courier.sellerId`
  // tekshiruvlari o'zgarishsiz to'g'ri ishlayveradi.
  const { sellerId } = await resolveActingSellerContext(db, request.auth.uid, "manageCouriers");
  // XAVFSIZLIK (2026-09 audit, P1): bu funksiya har chaqiruvda umumiy
  // (platforma bo'ylab BARCHA sotuvchilar uchun bitta) `COURIER_BOT_
  // TOKEN` orqali Telegram'ga xabar yuboradi — oldin rate-limit yo'q
  // edi, ya'ni BITTA sotuvchi (yoki uning xodimi) sessiyasi bu
  // funksiyani spam qilib, umumiy botning Telegram API chegarasini
  // TUGATIB, boshqa BARCHA sotuvchilarning kuryer xabarlarini
  // kechiktirishi mumkin edi ("noisy neighbor"). `sellerId` bo'yicha
  // (aniq xodim uid'i bo'yicha EMAS — bir nechta xodim bitta do'kon
  // nomidan chegarani ko'paytirib yubormasligi uchun) chegarandi.
  await checkRateLimit(`assignOrderToCourier:${sellerId}`, 60, 3600);
  const { orderId, courierId } = request.data || {};
  if (!orderId || !courierId) {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }

  const orderRef = db.collection("orders").doc(orderId);
  const courierRef = db.collection("couriers").doc(String(courierId));
  const [orderSnap, courierSnap] = await Promise.all([orderRef.get(), courierRef.get()]);

  if (!orderSnap.exists || orderSnap.data().sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu buyurtma sizga tegishli emas.");
  }
  if (!courierSnap.exists || courierSnap.data().sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu kuryer sizga tegishli emas.");
  }

  const order = orderSnap.data();
  const courier = courierSnap.data();

  if (order.status !== "processing") {
    throw new HttpsError("failed-precondition", "Kuryerga faqat \"Yig'ilmoqda\" bosqichidagi buyurtmalarni topshirish mumkin.");
  }
  // Buyurtma allaqachon (boshqa) kuryerga biriktirilgan va u hali
  // javob bermagan ("assigned", ya'ni "Boshladim" bosilmagan) bo'lsa,
  // qayta biriktirib bo'lmaydi - avval "Bekor qilish" orqali ozod
  // qilinishi kerak. `status` hali "processing"da qolishi sababli, bu
  // tekshiruv bo'lmasa sotuvchi ikkinchi marta boshqa kuryer
  // tanlashi mumkin bo'lib qolardi.
  if (order.courierId && order.courierDeliveryStatus === "assigned") {
    throw new HttpsError("failed-precondition", "Bu buyurtma allaqachon boshqa kuryerga biriktirilgan.");
  }
  if (courier.status !== "active") {
    throw new HttpsError("failed-precondition", "Bu kuryer hozir faol emas.");
  }

  await orderRef.update({
    courierId: String(courierId),
    courierName: courier.name || null,
    courierPhone: courier.phone || null,
    courierDeliveryStatus: "assigned",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const text = buildCourierAssignmentMessage(order);
    const inlineKeyboard = buildCourierActionKeyboard(orderId, "assigned");
    await sendTelegramMessage(COURIER_BOT_TOKEN.value(), courierId, text, { inlineKeyboard });
  } catch (err) {
    // Kuryerga xabar yuborilmasa ham, buyurtma allaqachon
    // biriktirilgan — sotuvchi buni ilova ichida (badge) ko'radi,
    // kerak bo'lsa kuryer bilan qo'lda bog'lanadi. Bu assignment
    // amalining o'zini bekor qilmasligi kerak (Telegram vaqtinchalik
    // ishlamay qolishi mumkin).
    console.error(`Kuryerga Telegram orqali xabar yuborishda xatolik (${orderId}):`, err);
  }

  return { success: true };
}

/**
 * Mini App'dan (kuryer o'z ilovasida tugma bosganda) chaqiriladi.
 */
async function handleUpdateCourierOrderStatus(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // XAVFSIZLIK (2026-09 audit, P1): bu ham umumiy `COURIER_BOT_TOKEN`/
  // `BOT_TOKEN` orqali mijozga xabar yuborishi mumkin (`applyCourier
  // OrderAction` ichida) — oldin rate-limit yo'q edi. Telegram inline
  // tugma orqali (`courierBot.js`, webhook) chaqiriladigan XUDDI SHU
  // `applyCourierOrderAction`ga esa BU YERDA emas, faqat Mini App'dan
  // to'g'ridan-to'g'ri chaqiriladigan bu onCall funksiyaga qo'yiladi —
  // webhook'ning o'zi allaqachon `webhookDedup`/Telegram callback
  // semantikasi bilan himoyalangan.
  await checkRateLimit(`updateCourierOrderStatus:${request.auth.uid}`, 60, 3600);
  const { orderId, action } = request.data || {};
  return applyCourierOrderAction({ courierId: request.auth.uid, orderId, action });
}

/**
 * Sotuvchi "Kuzatuv havolasini qayta yuborish" tugmasini bosganda
 * chaqiriladi. Avtomatik yuborish (`applyCourierOrderAction` ichida,
 * "picked_up" bosqichida) asosiy yo'l — bu faqat zaxira (masalan
 * birinchi xabar yetib bormagan, yoki mijoz uni o'chirib qo'ygan
 * bo'lsa).
 */
async function handleResendTrackingLink(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { sellerId } = await resolveActingSellerContext(db, request.auth.uid, "manageCouriers");
  // XAVFSIZLIK (2026-09 audit, P1): mijozga Telegram orqali xabar
  // yuboradi — oldin rate-limit yo'q edi.
  await checkRateLimit(`resendCourierTrackingLink:${sellerId}`, 30, 3600);
  const { orderId } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si berilmagan.");
  }
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists || orderSnap.data().sellerId !== sellerId) {
    throw new HttpsError("permission-denied", "Bu buyurtma sizga tegishli emas.");
  }
  const order = orderSnap.data();
  if (order.courierDeliveryStatus !== "picked_up") {
    throw new HttpsError("failed-precondition", "Kuzatuv havolasi faqat hozir yo'ldagi yetkazmalar uchun mavjud.");
  }
  await sendCourierTrackingLinkToClient(order, orderId);
  return { success: true };
}

/**
 * Kuryer joylashuvini Firestore'ga yozadigan va (mavjud bo'lsa)
 * mijozning Telegram chatidagi nativ jonli joylashuv pufakchasini
 * yangilaydigan umumiy funksiya. Ikkala manba ham (Mini App'ning o'z
 * JS geolokatsiyasi — `handleUpdateCourierLocation`, va Telegramning
 * o'zining jonli joylashuv relesi — `handleCourierLiveLocationUpdate`)
 * shu bitta funksiya orqali o'tadi — kod duplikatsiyasiga yo'l
 * qo'ymaslik uchun.
 *
 * Birinchi chaqiruvda (`courierLiveLocationMessageId` hali yo'q)
 * mijozga yangi pufakcha yuboriladi va uning ID'si buyurtmaga
 * saqlanadi; keyingi chaqiruvlarda o'sha pufakcha tahrirlanadi (yangi
 * xabar yuborilmaydi — aks holda mijozning chatida har necha
 * soniyada yangi xabar to'planib qolardi). Mijozga xabar
 * yuborish/yangilash ikkinchi darajali amal: xato bo'lsa ham asosiy
 * Firestore yozuvi (xarita/ETA uchun) allaqachon saqlangan bo'ladi.
 *
 * Pufakcha mijozga ketadi, shuning uchun avval sotuvchining shaxsiy
 * boti orqali yuborishga urinadi (batafsil izoh:
 * `lib/customerNotify.js`). `editMessageLiveLocation`/
 * `stopMessageLiveLocation`ni faqat xabarni yuborgan bot chaqira
 * oladi - shuning uchun qaysi bot (shaxsiy yoki platforma) birinchi
 * marta muvaffaqiyatli yuborganini `courierLiveLocationBotSource`
 * maydonida ("custom"/"platform") eslab qolamiz va keyingi barcha
 * tahrirlash/to'xtatish chaqiruvlari (shu funksiyada va
 * `applyCourierOrderAction`ning to'xtatish bo'limida) aynan o'sha
 * botdan foydalanadi - aks holda "boshqa bot begona xabarni tahrirlay
 * olmaydi" xatosi bilan yangilanish to'xtab qolardi. Sotuvchining
 * haqiqiy bot tokeni bu yerda `orders/{id}` hujjatiga yozilmaydi (u
 * mijoz tomonidan o'qiladigan hujjat) - faqat "qaysi turdagi bot
 * ishlatilgani" belgisi saqlanadi, token esa har safar
 * `getSellerCustomBotToken` orqali qayta o'qiladi.
 */
async function writeCourierLocationAndNotifyClient(orderRef, order, orderId, lat, lng) {
  await orderRef.update({
    courierLocation: { lat, lng, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
  });

  if (!order.clientId) return;
  try {
    if (order.courierLiveLocationMessageId) {
      const editToken = order.courierLiveLocationBotSource === "custom"
        ? (await getSellerCustomBotToken(order.sellerId)) || BOT_TOKEN.value()
        : BOT_TOKEN.value();
      await editTelegramLiveLocation(editToken, order.clientId, order.courierLiveLocationMessageId, lat, lng);
    } else {
      const customToken = await getSellerCustomBotToken(order.sellerId);
      let messageId = customToken
        ? await sendTelegramLiveLocation(customToken, order.clientId, lat, lng, LIVE_LOCATION_PERIOD_SECONDS)
        : null;
      let botSource = "custom";
      if (!messageId) {
        messageId = await sendTelegramLiveLocation(BOT_TOKEN.value(), order.clientId, lat, lng, LIVE_LOCATION_PERIOD_SECONDS);
        botSource = "platform";
      }
      if (messageId) {
        await orderRef.update({ courierLiveLocationMessageId: messageId, courierLiveLocationBotSource: botSource });
      }
    }
  } catch (err) {
    console.error(`Mijozga jonli joylashuv pufakchasini yuborish/yangilashda xatolik (${orderId}):`, err);
  }
}

/**
 * Kuryerning Mini App'i, "Jarayonda" bosqichida (faqat
 * `courierDeliveryStatus === "picked_up"` bo'lganda), Telegram
 * `LocationManager`/brauzer geolokatsiyasi orqali olingan joylashuvni
 * bir necha soniyada bir marta shu yerga yuboradi
 * (`src/utils/geolocation.js`ga qarang). Joylashuv
 * `writeCourierLocationAndNotifyClient` orqali buyurtma hujjatiga
 * (`orders/{orderId}.courierLocation`) yoziladi - alohida kolleksiya
 * shart emas, chunki har bir kuryerda bir vaqtning o'zida faqat bitta
 * "picked_up" yetkazma bo'lishi mumkin.
 */
async function handleUpdateCourierLocation(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId, lat, lng } = request.data || {};
  if (!orderId || typeof lat !== "number" || typeof lng !== "number") {
    throw new HttpsError("invalid-argument", "Noto'g'ri so'rov.");
  }
  await checkRateLimit(`updateCourierLocation:${request.auth.uid}`, 40, 300);

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (String(order.courierId || "") !== String(request.auth.uid)) {
    throw new HttpsError("permission-denied", "Bu buyurtma sizga biriktirilmagan.");
  }
  if (order.courierDeliveryStatus !== "picked_up") {
    throw new HttpsError("failed-precondition", "Joylashuv faqat jarayondagi yetkazma uchun yangilanadi.");
  }

  await writeCourierLocationAndNotifyClient(orderRef, order, orderId, lat, lng);
  return { success: true };
}

/**
 * Telegramning jonli joylashuv relesi orqali (kuryer o'zi, oddiy
 * Telegram chat ichida, qog'ozgayroq (📎) menyusidan "Joylashuv" →
 * "Jonli joylashuvni yuborish"ni yoqqanda) `courierBot.js`ning
 * webhook'iga kelgan yangilanish shu yerga yo'naltiriladi
 * (`message.location` — birinchi ulashish, `edited_message.location`
 * — keyingi davriy yangilanishlar).
 *
 * Bot kuryerning "qaysi buyurtma ustida ishlayotgani"ni bilmaydi
 * (jonli joylashuv xabari buyurtma kontekstisiz keladi) — shuning
 * uchun aynan shu kuryerga biriktirilgan va hozir "picked_up"
 * (jarayonda) bo'lgan yagona buyurtma qidiriladi. Oddiy `where`
 * so'rovi ishlatilmaydi (compound-index talab qilishning oldini olish
 * uchun) — `applyCourierOrderAction`dagi bir xil naqsh: kuryerga
 * biriktirilgan barcha buyurtmalar olinib, xotirada filtrlanadi. Agar
 * mos buyurtma topilmasa (masalan kuryer yetkazmasiz turib shunchaki
 * jonli joylashuv yoqqan bo'lsa) jim qaytiladi (xato emas, oddiy
 * holat).
 */
async function handleCourierLiveLocationUpdate({ courierId, lat, lng }) {
  if (!courierId || typeof lat !== "number" || typeof lng !== "number") return;

  const assignedSnap = await db.collection("orders").where("courierId", "==", String(courierId)).get();
  const activeDoc = assignedSnap.docs.find((d) => d.data().courierDeliveryStatus === "picked_up");
  if (!activeDoc) return;

  await writeCourierLocationAndNotifyClient(activeDoc.ref, activeDoc.data(), activeDoc.id, lat, lng);
}

exports.createCourierInvite = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleCreateCourierInvite));
exports.setCourierActive = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleSetCourierActive));
exports.removeCourier = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleRemoveCourier));
exports.updateCourierProfile = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleUpdateCourierProfile));
// `updateCourierOrderStatus`ga `COURIER_BOT_TOKEN` kerak — "picked_up"
// bosqichida kuryerga (jonli joylashuvni yoqish tavsiyasi bilan)
// xabar yuborish uchun, hatto amal Mini App'dan (bot emas)
// chaqirilganda ham ishlashi kerak.
exports.assignOrderToCourier = onCall({ region: "asia-south1", secrets: [COURIER_BOT_TOKEN, SENTRY_DSN] }, withSentry(handleAssignOrderToCourier));
exports.updateCourierOrderStatus = onCall({ region: "asia-south1", secrets: [BOT_TOKEN, COURIER_BOT_TOKEN, SENTRY_DSN] }, withSentry(handleUpdateCourierOrderStatus));
exports.resendCourierTrackingLink = onCall({ region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] }, withSentry(handleResendTrackingLink));
// `BOT_TOKEN` kerak — mijozga jonli joylashuv pufakchasini
// yuborish/yangilash uchun (`writeCourierLocationAndNotifyClient`).
exports.updateCourierLocation = onCall({ region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] }, withSentry(handleUpdateCourierLocation));

// `courierBot.js` (bot inline tugmalari va jonli joylashuv relesi)
// ushbu funksiyalarni to'g'ridan-to'g'ri (onCall'siz) ishlatadi - kod
// duplikatsiyasiga yo'l qo'ymaslik uchun oddiy, qayta ishlatiladigan
// export sifatida ham beriladi.
exports.applyCourierOrderAction = applyCourierOrderAction;
exports.buildCourierActionKeyboard = buildCourierActionKeyboard;
exports.COURIER_ACTION_LABELS = COURIER_ACTION_LABELS;
exports.COURIER_BOT_USERNAME = COURIER_BOT_USERNAME;
exports.handleCourierLiveLocationUpdate = handleCourierLiveLocationUpdate;

exports._testables = {
  buildCourierInviteLink, buildCourierAssignmentMessage, buildCourierActionKeyboard,
  applyCourierOrderAction, handleCreateCourierInvite, handleSetCourierActive,
  handleRemoveCourier, handleUpdateCourierProfile, handleAssignOrderToCourier, handleUpdateCourierOrderStatus,
  handleResendTrackingLink, handleUpdateCourierLocation, sendCourierTrackingLinkToClient,
  writeCourierLocationAndNotifyClient, handleCourierLiveLocationUpdate,
  COURIER_BOT_USERNAME, LIVE_LOCATION_PERIOD_SECONDS,
};
