const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const yandex = require("./lib/yandexDelivery");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

// Yandex'ning "bekor qilingan" holatlari - frontend
// (`YandexDeliveryPage.jsx`)dagi bilan bir xil ro'yxat, ikkalasi
// sinxron bo'lishi kerak.
const CANCELLED_STATUSES = new Set([
  "cancelled", "cancelled_with_payment", "cancelled_by_taxi",
  "cancelled_with_items_on_hands", "failed", "performer_not_found", "estimating_failed",
]);

/**
 * Xaridor — checkout paytida, Yandex Delivery orqali yetkazib
 * berishning jonli hisoblangan narxini so'raydi.
 *
 * Bu faqat sotuvchi Yandex Delivery'ni ulagan va o'z do'kon manzilini
 * (aniq koordinata bilan) belgilagan bo'lsagina ishlaydi. Bo'lmasa,
 * mijoz oddiy hudud-asosidagi (`deliveryZones`) belgilangan narxdan
 * foydalanadi.
 */
async function handleCalculateYandexDeliveryPrice(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  await checkRateLimit(`calculateYandexPrice:${request.auth.uid}`, 20, 300);

  const { sellerId, dropoffLat, dropoffLng, dropoffAddress } = request.data || {};
  if (!sellerId || typeof dropoffLat !== "number" || typeof dropoffLng !== "number") {
    throw new HttpsError("invalid-argument", "Sotuvchi va yetkazib berish manzili koordinatalari kerak.");
  }

  const ydSnap = await db.collection("sellers").doc(sellerId).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists || !ydSnap.data().enabled) {
    throw new HttpsError("failed-precondition", "Bu sotuvchi Yandex Delivery xizmatini ulamagan.");
  }
  const yd = ydSnap.data();
  if (!yd.pickupLat || !yd.pickupLng) {
    throw new HttpsError("failed-precondition", "Sotuvchi hali do'kon manzilini (xaritada) belgilamagan.");
  }

  try {
    const priceCheck = await yandex.calculateOffer(
      yd.oauthToken,
      { lat: yd.pickupLat, lng: yd.pickupLng, address: yd.pickupAddress },
      { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress },
      {},
      yd.taxiClass
    );
    return {
      available: true,
      price: Number(priceCheck.price) || 0,
      currency: priceCheck.currency_rules?.code || "UZS",
      etaMinutes: priceCheck.eta,
      distanceMeters: priceCheck.distance_meters,
    };
  } catch (err) {
    console.error("Yandex Delivery narx hisoblashda xatolik:", err.message, err.body);
    // Xato bo'lsa ham checkout jarayonini to'xtatmaymiz - shunchaki
    // "mavjud emas" deb qaytaramiz, mijoz oddiy yetkazib berishdan
    // foydalanaveradi (Yandex qo'shimcha imkoniyat, majburiy emas).
    return { available: false, error: "Yandex Delivery narxini hisoblab bo'lmadi." };
  }
}

/**
 * Sotuvchi — buyurtmani Yandex Delivery orqali jo'natadi (kuryer
 * chaqiradi). Bu `claims/create` + `claims/accept`ni birga bajaradi,
 * chunki taklif faqat ~10 daqiqa amal qiladi.
 *
 * `request.data.taxiClass` — ixtiyoriy, "courier"|"express"|"cargo".
 * Sotuvchi buni har safar, tugma bosilganda tanlaydi (doimiy sozlama
 * emas) - berilmasa yoki noto'g'ri qiymat bo'lsa,
 * `lib/yandexDelivery.js`ning `resolveTaxiClass` funksiyasi xavfsiz
 * standart "express"ga qaytadi.
 */
async function handleDispatchYandexDelivery(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId, taxiClass } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si kerak.");
  }
  await checkRateLimit(`dispatchYandexDelivery:${request.auth.uid}`, 20, 3600);

  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (order.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z buyurtmangizni jo'nata olasiz.");
  }
  if (order.yandexClaimId) {
    throw new HttpsError("failed-precondition", "Bu buyurtma allaqachon Yandex Delivery'ga jo'natilgan.");
  }
  if (!order.customer?.location?.lat) {
    throw new HttpsError("failed-precondition", "Bu buyurtmada mijozning aniq (xaritadagi) joylashuvi yo'q.");
  }

  const ydSnap = await db.collection("sellers").doc(request.auth.uid).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists || !ydSnap.data().enabled) {
    throw new HttpsError("failed-precondition", "Yandex Delivery ulanmagan.");
  }
  const yd = ydSnap.data();
  const sellerSnap = await db.collection("sellers").doc(request.auth.uid).get();
  const storeName = sellerSnap.data()?.storeName || "Do'kon";

  try {
    const claim = await yandex.createAndAcceptClaim(yd.oauthToken, {
      pickup: {
        contactName: storeName,
        contactPhone: sellerSnap.data()?.phone || "",
        address: yd.pickupAddress,
        lat: yd.pickupLat,
        lng: yd.pickupLng,
      },
      dropoff: {
        contactName: order.customer.fullName,
        contactPhone: order.customer.phone,
        address: order.customer.address,
        lat: order.customer.location.lat,
        lng: order.customer.location.lng,
      },
      items: (order.orders || []).map((item) => ({
        title: item.name || "Mahsulot",
        quantity: item.quantity,
        costValue: item.price,
      })),
      // `request_id` — bir xil so'rovni ikki marta yuborib yuborsak
      // ham (masalan tarmoq uzilib, qayta urinilsa), Yandex tomonida
      // ikkinchi marta yangi da'vo yaratilmasligini ta'minlaydi
      // (idempotentlik).
      requestId: `${orderId}-${Date.now()}`,
      // Tarif sinfi doimiy sozlama emas - sotuvchi har bir buyurtmani
      // jo'natish paytida, "Kuryer chaqirish" tugmasi bosilganda
      // (`YandexTariffModal`) tanlaydi va shu tanlov to'g'ridan-to'g'ri
      // shu yerga keladi. Berilmasa (masalan eski frontend),
      // `resolveTaxiClass` xavfsiz standart sifatida "express"ga
      // qaytadi.
      taxiClass,
    });

    await orderRef.update({
      yandexClaimId: claim.id,
      yandexStatus: claim.status || "new",
      yandexDispatchedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // `accept` — alohida qadam, chunki `create`dan keyin holat darhol
    // "ready_for_approval"ga yetmagan bo'lishi mumkin. Bir necha marta,
    // qisqa kutish bilan urinib ko'ramiz (jami ~25 soniyagacha - agar
    // shu oralig'da ham ulgurmasa, davriy sinxronlash
    // (`syncYandexDeliveryStatuses`) buni keyinroq qayta tasdiqlaydi,
    // shuning uchun buyurtma abadiy "muzlab" qolmaydi).
    let accepted = false;
    for (let attempt = 0; attempt < 10 && !accepted; attempt++) {
      const info = await yandex.getClaimInfo(yd.oauthToken, claim.id);
      if (info.status === "ready_for_approval") {
        await yandex.acceptClaim(yd.oauthToken, claim.id, info.version);
        accepted = true;
      } else if (info.status === "estimating" || info.status === "new") {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      } else {
        break; // Kutilmagan holat — keyingi sinxronlashda (polling) hal bo'ladi.
      }
    }

    return { success: true, claimId: claim.id, accepted };
  } catch (err) {
    console.error("Yandex Delivery jo'natishda xatolik:", err.message, err.body);
    throw new HttpsError("internal", err.message || "Yandex Delivery'ga jo'natishda xatolik yuz berdi.");
  }
}

// Yandex'ning holatini bizning `orders.status`ga moslashtirish —
// faqat haqiqatan mos keladigan, aniq holatlarda avtomatik
// o'zgartiramiz (masalan "pickuped" hali "yo'lda" ekanini
// anglatadi, "delivered_finish" esa "yetkazildi").
const YANDEX_TO_ORDER_STATUS = {
  pickuped: "shipped",
  delivery_arrived: "shipped",
  delivered_finish: "delivered",
  // Status-diagrammada ko'rsatilgan "Return" oqimining (mijoz javob
  // bermaganda) yakuniy holati - shu moslashtirish bo'lmasa, mahsulot
  // haqiqatda qaytarilgandan keyin ham `order.status` eskirgan
  // qiymatda (masalan "yo'lda") abadiy qolib ketadi.
  returned_finish: "cancel",
};

/**
 * Davriy sinxronlash (har 10 daqiqada) — barcha faol (yakuniy
 * holatga yetmagan) Yandex Delivery buyurtmalarining haqiqiy
 * holatini so'raydi va Firestore'ni yangilaydi.
 *
 * Yandex'ning o'z webhook/bildirishnomalari rasman ishonchsiz deb
 * hujjatlashtirilgan, shuning uchun polling yagona ishonchli usul.
 */
const syncYandexDeliveryStatuses = onSchedule(
  { schedule: "every 10 minutes", region: "asia-south1", timeoutSeconds: 300 },
  async () => {
    const activeOrdersSnap = await db.collection("orders")
      .where("yandexClaimId", "!=", null)
      .get();

    // Sotuvchining OAuth tokenini har safar qayta so'ramaslik uchun,
    // shu ishga tushirish davomida keshlaymiz.
    const tokenCache = new Map();

    for (const doc of activeOrdersSnap.docs) {
      const order = doc.data();
      if (yandex.TERMINAL_STATUSES.has(order.yandexStatus)) continue; // Allaqachon yakunlangan - o'tkazib yuboramiz.

      try {
        let oauthToken = tokenCache.get(order.sellerId);
        if (!oauthToken) {
          const ydSnap = await db.collection("sellers").doc(order.sellerId).collection("private").doc("yandexDelivery").get();
          oauthToken = ydSnap.exists ? ydSnap.data().oauthToken : null;
          tokenCache.set(order.sellerId, oauthToken);
        }
        if (!oauthToken) continue;

        const info = await yandex.getClaimInfo(oauthToken, order.yandexClaimId);

        // Agar da'vo "ready_for_approval" holatida tiqilib qolgan
        // bo'lsa (masalan, dastlabki `dispatchYandexDelivery`
        // chaqiruvidagi kutish yetarli bo'lmagan bo'lsa), Yandex bu
        // da'voni avtomatik tasdiqlamaydi va kuryer qidirilmaydi -
        // shuning uchun davriy sinxronlash paytida ham qayta
        // tasdiqlashga urinib ko'ramiz. Aks holda bir martalik tarmoq
        // kechikishi butun buyurtmani abadiy "muzlatib" qo'yishi
        // mumkin.
        if (info.status === "ready_for_approval") {
          try {
            await yandex.acceptClaim(oauthToken, order.yandexClaimId, info.version);
            console.log(`Yandex Delivery: tiqilib qolgan da'vo qayta tasdiqlandi (order ${doc.id})`);
          } catch (acceptErr) {
            console.error(`Yandex Delivery: qayta tasdiqlashda xatolik (order ${doc.id}):`, acceptErr.message);
          }
        }

        if (info.status === order.yandexStatus) continue; // O'zgarish yo'q.

        const updates = { yandexStatus: info.status };
        const mappedOrderStatus = YANDEX_TO_ORDER_STATUS[info.status];
        if (mappedOrderStatus && mappedOrderStatus !== order.status) {
          updates.status = mappedOrderStatus;
        }
        await doc.ref.update(updates);
      } catch (err) {
        // Bitta buyurtmadagi xato qolganlarini sinxronlashni
        // to'xtatmasligi kerak, shuning uchun shu yerda ushlab,
        // keyingisiga o'tamiz.
        console.error(`Yandex Delivery sinxronlashda xatolik (order ${doc.id}):`, err.message);
      }
    }
  }
);

/**
 * Sotuvchi — kuryerning (faol buyurtma uchun) telefon raqamini
 * so'raydi (masalan, kuryer bilan bog'lanish uchun qo'ng'iroq
 * qilishdan oldin).
 */
async function handleGetYandexCourierPhone(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si kerak.");
  }
  await checkRateLimit(`getYandexCourierPhone:${request.auth.uid}`, 20, 300);

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (order.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z buyurtmangiz bo'yicha so'rov yubora olasiz.");
  }
  if (!order.yandexClaimId) {
    throw new HttpsError("failed-precondition", "Bu buyurtma Yandex Delivery'ga jo'natilmagan.");
  }

  const ydSnap = await db.collection("sellers").doc(request.auth.uid).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists) {
    throw new HttpsError("failed-precondition", "Yandex Delivery ulanmagan.");
  }

  try {
    // point_id = 1 — jo'natuvchi (do'kon) nuqtasi. Sotuvchi odatda
    // kuryer bilan o'z manzili (olib ketish) bo'yicha bog'lanadi,
    // shuning uchun shu nuqta ishlatiladi. `claim_id` — buyurtma
    // Yandex Delivery'ga jo'natilganda saqlangan `order.yandexClaimId`
    // (Yandex API hujjatiga ko'ra bu majburiy maydon).
    const result = await yandex.getCourierPhone(ydSnap.data().oauthToken, order.yandexClaimId, 1);
    return { phone: result.phone, ext: result.ext || null };
  } catch (err) {
    console.error("Kuryer telefonini olishda xatolik:", err.message, err.body);
    throw new HttpsError("unavailable", "Kuryer telefon raqamini olib bo'lmadi. Hali kuryer tayinlanmagan bo'lishi mumkin.");
  }
}

/**
 * Sotuvchi — buyurtmaning Yandex Delivery'dagi to'liq joriy holatini
 * (kuryer ismi, mashinasi, davlat raqami va h.k.) so'raydi — bu,
 * "kuryer qidirilmoqda..." matnidan tashqari, chiroyli holat oynasi
 * (modal) uchun kerak bo'ladi. Har safar ochilganda yangi so'rov
 * yuboriladi, 10 daqiqalik pollingga qaraganda yangiroq ma'lumot
 * olish uchun.
 */
async function handleGetYandexClaimDetails(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si kerak.");
  }
  await checkRateLimit(`getYandexClaimDetails:${request.auth.uid}`, 40, 300);

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (order.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z buyurtmangiz bo'yicha so'rov yubora olasiz.");
  }
  if (!order.yandexClaimId) {
    throw new HttpsError("failed-precondition", "Bu buyurtma Yandex Delivery'ga jo'natilmagan.");
  }

  const ydSnap = await db.collection("sellers").doc(request.auth.uid).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists) {
    throw new HttpsError("failed-precondition", "Yandex Delivery ulanmagan.");
  }

  try {
    let info = await yandex.getClaimInfo(ydSnap.data().oauthToken, order.yandexClaimId);

    // Agar da'vo "ready_for_approval" holatida tiqilib qolgan bo'lsa
    // (dastlabki dispatch chaqiruvida tasdiqlash ulgurmagan bo'lishi
    // mumkin), bu oyna ochilgan zahoti qayta tasdiqlashga urinib
    // ko'ramiz - 10 daqiqalik davriy sinxronlashni kutib o'tirmasdan.
    if (info.status === "ready_for_approval") {
      try {
        await yandex.acceptClaim(ydSnap.data().oauthToken, order.yandexClaimId, info.version);
        info = await yandex.getClaimInfo(ydSnap.data().oauthToken, order.yandexClaimId);
      } catch (acceptErr) {
        console.error("Qayta tasdiqlashda xatolik:", acceptErr.message, acceptErr.body);
      }
    }

    // Yandex `performer_info`ni faqat kuryer tayinlangandan keyin
    // (status "performer_found"dan boshlab) qaytaradi - undan oldin
    // bu maydon umuman yo'q, shuning uchun frontend uni "hali yo'q"
    // deb, xatosiz qabul qilishi kerak.
    //
    // Agar da'vo bekor qilingan/xato bo'lgan bo'lsa, Yandex buning
    // aniq sababini `error_messages` maydonida qaytaradi (masalan
    // "no_categories_in_zone", "estimating_failed"). Bu "Batafsil"
    // oynasida to'g'ridan-to'g'ri ko'rsatiladi, umumiy "Bekor qilindi"
    // xabari o'rniga.

    // Mijoz uchun kuzatish havolasi: kuryer birinchi marta
    // tayinlangandan keyin (`performer_found` va undan keyingi har
    // qanday holat), Yandex'dan tashqi kuzatish havolasini so'raymiz
    // va buyurtma hujjatiga saqlaymiz - shu orqali buni faqat bir
    // marta so'rashimiz kifoya (keyingi safar
    // `order.yandexTrackingLink` allaqachon mavjudligini tekshiramiz),
    // va mijoz bu havolani o'zining "Buyurtmalarim" sahifasida
    // to'g'ridan-to'g'ri ko'radi - hech qanday Yandex hisobi yoki
    // qo'shimcha so'rov kerak emas.
    let trackingLink = order.yandexTrackingLink || null;
    const performerAssigned = info.status && info.status !== "new" && info.status !== "estimating" && info.status !== "ready_for_approval" && info.status !== "accepted" && info.status !== "performer_lookup";

    if (!trackingLink && performerAssigned) {
      try {
        const linksResponse = await yandex.getTrackingLinks(ydSnap.data().oauthToken, order.yandexClaimId);
        // Javob strukturasi: routePoints[].sharing_link - odatda bitta
        // yetkazib berish nuqtasi bo'lgani uchun, birinchisini olamiz.
        const firstLink = linksResponse?.route_points?.[0]?.sharing_link || null;
        if (firstLink) {
          trackingLink = firstLink;
          await orderSnap.ref.update({ yandexTrackingLink: firstLink });
        }
      } catch (linkErr) {
        // Kuzatish havolasini olib bo'lmasligi asosiy holatni
        // ko'rsatishga to'sqinlik qilmasligi kerak - shuning uchun bu
        // yerdagi xatolik faqat logga yoziladi.
        console.error("Kuzatish havolasini olishda xatolik:", linkErr.message, linkErr.body);
      }
    }

    return {
      status: info.status,
      performerInfo: info.performer_info || null,
      price: info.pricing?.offer?.price || info.pricing?.total_price || null,
      currency: info.pricing?.currency || null,
      errorMessages: (info.error_messages || []).map((e) => ({ code: e.code, message: e.message })),
      warnings: (info.warnings || []).map((w) => ({ code: w.code, source: w.source, message: w.message })),
      trackingLink,
      // Yandex javobida ba'zan mavjud bo'lishi mumkin bo'lgan
      // qo'shimcha ma'lumotlar - bu maydonlarning har doim kelishiga
      // kafolat yo'q (hujjatlarda aniq belgilanmagan/mintaqaga qarab
      // farq qilishi mumkin), shuning uchun barchasi `|| null` bilan,
      // yo'q bo'lsa xato bermaydigan qilib chiqarilgan.
      createdAt: info.created_ts || info.created_at || null,
      routePoints: Array.isArray(info.route_points)
        ? info.route_points.map((p) => ({ type: p.type || null, visitStatus: p.visit_status || null }))
        : [],
      // Interaktiv xarita uchun - olib ketish (do'kon) va yetkazish
      // (mijoz) koordinatalari (`yandexDelivery` sozlamalarida va
      // buyurtmaning o'zida saqlangan).
      pickup: ydSnap.data().pickupLat && ydSnap.data().pickupLng
        ? { lat: ydSnap.data().pickupLat, lng: ydSnap.data().pickupLng }
        : null,
      dropoff: order.customer?.location?.lat && order.customer?.location?.lng
        ? { lat: order.customer.location.lat, lng: order.customer.location.lng }
        : null,
    };
  } catch (err) {
    console.error("Yandex Delivery holatini olishda xatolik:", err.message, err.body);
    throw new HttpsError("unavailable", "Buyurtma holatini olib bo'lmadi.");
  }
}

/**
 * Sotuvchi — Yandex Delivery'ga jo'natilgan buyurtmani bekor qiladi.
 *
 * Yandex API'ning `cancel` chaqiruvi `version` maydonini talab qiladi
 * (optimistik qulflash - boshqa birov shu orada da'voni
 * o'zgartirmaganini tekshirish uchun). Shuning uchun bekor qilishdan
 * oldin eng so'nggi holatni (`getClaimInfo`) alohida so'raymiz -
 * eskirgan/keshlangan `version` bilan bekor qilishga urinish Yandex
 * tomonidan rad etilishi mumkin.
 *
 * Cheklov (Yandex'ning o'z qoidasi): bekor qilish faqat ma'lum
 * bosqichlarda (odatda kuryer hali "olib ketish" nuqtasiga yetib
 * bormagan bo'lsa) bepul bo'ladi. Agar buyurtma allaqachon ancha
 * oldinga ketgan bo'lsa, Yandex bekor qilishni rad etishi yoki jarima
 * bilan bekor qilishni talab qilishi mumkin - bu holatda Yandex'ning
 * aniq xato xabari to'g'ridan-to'g'ri sotuvchiga ko'rsatiladi, soxta
 * "muvaffaqiyatli bekor qilindi" xabari berilmaydi.
 */
async function handleCancelYandexDelivery(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si kerak.");
  }
  await checkRateLimit(`cancelYandexDelivery:${request.auth.uid}`, 10, 300);

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (order.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z buyurtmangiz bo'yicha so'rov yubora olasiz.");
  }
  if (!order.yandexClaimId) {
    throw new HttpsError("failed-precondition", "Bu buyurtma Yandex Delivery'ga jo'natilmagan.");
  }

  const ydSnap = await db.collection("sellers").doc(request.auth.uid).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists) {
    throw new HttpsError("failed-precondition", "Yandex Delivery ulanmagan.");
  }
  const oauthToken = ydSnap.data().oauthToken;

  try {
    // Eng so'nggi `version`ni olamiz - eskirgan qiymat bilan bekor
    // qilishga urinish Yandex tomonidan rad etiladi.
    const currentInfo = await yandex.getClaimInfo(oauthToken, order.yandexClaimId);

    if (CANCELLED_STATUSES.has(currentInfo.status)) {
      // Allaqachon bekor qilingan/tugagan - qayta urinishning hojati
      // yo'q, shunchaki joriy holatni qaytaramiz.
      //
      // `yandexClaimId`ni ham shu yerda tozalaymiz (`null`ga
      // o'rnatamiz) - aks holda `dispatchYandexDelivery`ning
      // "allaqachon jo'natilgan" tekshiruvi (`if (order.yandexClaimId)`)
      // da'vo bekor qilingan holatda ham ishga tushib, sotuvchi bekor
      // qilingandan keyin qayta kuryer chaqira olmay qolardi.
      await orderSnap.ref.update({ yandexStatus: currentInfo.status, yandexClaimId: null });
      return { status: currentInfo.status, alreadyCancelled: true };
    }

    await yandex.cancelClaim(oauthToken, order.yandexClaimId, "free", currentInfo.version);

    const updatedInfo = await yandex.getClaimInfo(oauthToken, order.yandexClaimId);
    // Yuqoridagi bilan bir xil sabab - `yandexClaimId` tozalanmasa,
    // "Qayta chaqirish" tugmasi (`YandexDeliveryPage.jsx`) doim
    // "Bu buyurtma allaqachon Yandex Delivery'ga jo'natilgan" xatosi
    // bilan muvaffaqiyatsiz tugaydi.
    await orderSnap.ref.update({ yandexStatus: updatedInfo.status, yandexClaimId: null });

    return { status: updatedInfo.status, alreadyCancelled: false };
  } catch (err) {
    console.error("Yandex Delivery'ni bekor qilishda xatolik:", err.message, err.body);
    // Yandex'ning aniq rad etish sababini (masalan, "bepul bekor
    // qilish muddati o'tgan") to'g'ridan-to'g'ri sotuvchiga
    // ko'rsatamiz - umumiy "xatolik yuz berdi" emas.
    const yandexReason = err.body?.message || err.body?.code || null;
    throw new HttpsError(
      "failed-precondition",
      yandexReason
        ? `Yandex Delivery bekor qilishni rad etdi: ${yandexReason}`
        : "Yetkazib berishni bekor qilib bo'lmadi. Ehtimol, kuryer allaqachon yo'lda."
    );
  }
}

/**
 * Kuryerning jonli joylashuvini oladi - sotuvchi "Batafsil" oynasida
 * "Kuryer qayerda?" tugmasini bosganda ishga tushadi (avtomatik,
 * doimiy so'ralmaydi - Yandex API xarajatini nazorat ostida ushlab
 * turish uchun).
 */
async function handleGetYandexPerformerPosition(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const { orderId } = request.data || {};
  if (!orderId) {
    throw new HttpsError("invalid-argument", "Buyurtma ID'si kerak.");
  }
  await checkRateLimit(`getYandexPerformerPosition:${request.auth.uid}`, 30, 300);

  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Buyurtma topilmadi.");
  }
  const order = orderSnap.data();
  if (order.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Faqat o'z buyurtmangiz bo'yicha so'rov yubora olasiz.");
  }
  if (!order.yandexClaimId) {
    throw new HttpsError("failed-precondition", "Bu buyurtma Yandex Delivery'ga jo'natilmagan.");
  }

  const ydSnap = await db.collection("sellers").doc(request.auth.uid).collection("private").doc("yandexDelivery").get();
  if (!ydSnap.exists) {
    throw new HttpsError("failed-precondition", "Yandex Delivery ulanmagan.");
  }

  try {
    const position = await yandex.getPerformerPosition(ydSnap.data().oauthToken, order.yandexClaimId);
    // Javob strukturasi: { position: { lat, lon, timestamp } }
    if (!position?.position) {
      throw new HttpsError("failed-precondition", "Kuryer joylashuvi hali mavjud emas.");
    }
    return {
      lat: position.position.lat,
      lon: position.position.lon,
      timestamp: position.position.timestamp || null,
    };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("Kuryer joylashuvini olishda xatolik:", err.message, err.body);
    throw new HttpsError("unavailable", "Kuryer joylashuvini olib bo'lmadi.");
  }
}

exports.calculateYandexDeliveryPrice = onCall({ region: "asia-south1" }, handleCalculateYandexDeliveryPrice);
exports.dispatchYandexDelivery = onCall({ region: "asia-south1", timeoutSeconds: 60, secrets: [SENTRY_DSN] }, withSentry(handleDispatchYandexDelivery));
exports.getYandexCourierPhone = onCall({ region: "asia-south1" }, handleGetYandexCourierPhone);
exports.getYandexClaimDetails = onCall({ region: "asia-south1" }, handleGetYandexClaimDetails);
exports.getYandexPerformerPosition = onCall({ region: "asia-south1" }, handleGetYandexPerformerPosition);
exports.cancelYandexDelivery = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleCancelYandexDelivery));
exports.syncYandexDeliveryStatuses = syncYandexDeliveryStatuses;

exports._testables = { handleCalculateYandexDeliveryPrice, handleDispatchYandexDelivery, handleGetYandexCourierPhone, handleGetYandexClaimDetails, handleGetYandexPerformerPosition, handleCancelYandexDelivery, YANDEX_TO_ORDER_STATUS };
