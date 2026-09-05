const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sanitizeFirestoreData, parseStartParam } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
const { verifyTelegramInitData, peekStartParamUnsafe } = require("./telegramAuth");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");

/**
 * Mijozning sotuvchi do'koniga BUGUNGI tashrifini yozadi — KONVERSIYA
 * (buyurtmalar / tashriflar) ko'rsatkichini haqiqiy hisoblash uchun.
 *
 * MUHIM: hujjat ID'si `{sellerId}_{sana}_{mijozId}` shaklida — bu,
 * BIR XIL mijoz BIR XIL kunda necha marta ilovani ochsa ham, FAQAT
 * BIR marta hisoblanishini avtomatik ta'minlaydi (noyob mijoz,
 * xom sahifa yuklanishi emas).
 *
 * Bu — faqat statistika uchun, MUHIM EMAS amal: xato bo'lsa ham,
 * autentifikatsiyaning o'zi davom etadi (shuning uchun o'z ichida
 * try/catch bilan himoyalangan, hech qachon tashqariga xato
 * tashlamaydi).
 */
async function recordVisit(sellerId, clientId) {
  if (!sellerId || !clientId) return;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateKey = today.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const docId = `${sellerId}_${dateKey}_${clientId}`;
    await db.collection("visits").doc(docId).set(
      {
        sellerId,
        clientId,
        date: dateKey,
        visitedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Tashrifni yozishda xatolik:", err);
  }
}

/**
 * Dashboard'ning BIRINCHI ko'rinishi uchun kerakli "Bugun" statistikasini
 * server tomonida (Admin SDK orqali, mijoz Firestore ulanishi
 * kutilmasdan) hisoblaydi. Xato bo'lsa (masalan hali yaratilmagan
 * indeks), `null` qaytaradi — Dashboard bu holda oddiy, avvalgidek
 * (mijoz tomonidan yuklash) rejimga qaytadi, hech narsa buzilmaydi.
 *
 * ISHLAB CHIQARISH DARAJASIGA MOSLASHTIRISH: mahsulot SONLARI uchun
 * Firestore'ning `.count()` AGREGATSIYA so'rovlaridan foydalaniladi
 * (hujjatlarning o'zi yuklanmaydi — katalog qanchalik katta bo'lishidan
 * qat'i nazar bir xil tezlikda ishlaydi). Tannarx xaritasi uchun esa
 * FAQAT bugun yetkazilgan buyurtmalarda ishtirok etgan mahsulotlar
 * aniq ID bo'yicha so'raladi — butun katalog emas.
 */
async function computeDashboardSummary(sellerId) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = admin.firestore.Timestamp.fromDate(todayStart);

    const productsCollection = db.collection("products").where("sellerId", "==", sellerId);

    const [ordersSnap, totalProductsCount, inactiveProductsCount, lowStockCount, visitsCount, everOrderedCount] = await Promise.all([
      db.collection("orders")
        .where("sellerId", "==", sellerId)
        .where("createdAt", ">=", todayStartTimestamp)
        // XAVFSIZLIK (2026-09 audit, P2): oldin `.limit()` YO'Q edi —
        // bu so'rov "bugungi" HAR BIR buyurtmaning TO'LIQ hujjatini
        // o'qiydi. `verifyTelegramAuth` (shu funksiyani chaqiruvchi)
        // Telegram `initData`ning o'zi bo'yicha "replay" himoyasiga ega
        // EMAS (bir xil `initData` 24 soatgacha qayta-qayta
        // ishlatilishi mumkin, faqat oddiy `checkRateLimit` bilan
        // cheklangan) — demak HAQIQIY xavf shundaki, real bo'lmagan
        // holatda (masalan buyurtma spam qilingan/juda katta kunlik
        // hajm) bu so'rov XARAJATI cheksiz o'sishi mumkin edi.
        // 1000 — HAQIQIY do'konlar uchun amalda hech qachon
        // yetilmaydigan, lekin ENG YOMON holatni chegaralaydigan
        // xavfsizlik chegarasi (bitta do'kon uchun kunига 1000
        // buyurtma — platformadagi eng katta do'konlar uchun ham
        // real emas).
        .limit(1000)
        .get(),
      productsCollection.count().get(),
      productsCollection.where("isActive", "==", false).count().get(),
      productsCollection.where("stock", "<=", 3).count().get(),
      db.collection("visits").where("sellerId", "==", sellerId).where("date", "==", todayStart.toISOString().slice(0, 10)).count().get(),
      // MUHIM: bu — "Sozlash bo'yicha qo'llanma" (onboarding checklist)
      // uchun "birinchi buyurtma qabul qilindimi" bosqichini BEPULGA
      // (Firebase xarajatini oshirmasdan) hisoblash imkonini beradi -
      // `.count()` agregatsiya so'rovi juda arzon (natijaviy hujjatlar
      // sonidan qat'i nazar 1 ta o'qish sifatida hisoblanadi), va bu
      // allaqachon bajarilayotgan PARALEL so'rovlar to'plamining bir
      // qismi - alohida, qo'shimcha tarmoq safari YO'Q.
      db.collection("orders").where("sellerId", "==", sellerId).count().get(),
    ]);

    const todaysOrders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const deliveredToday = todaysOrders.filter((o) => o.status === "delivered");
    const totalSales = deliveredToday.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

    // Faqat BUGUN yetkazilgan buyurtmalarda haqiqatan ishtirok etgan
    // mahsulotlarning tannarxini olamiz — butun katalog emas.
    const referencedProductIds = new Set();
    deliveredToday.forEach((order) => {
      (order.orders || []).forEach((item) => {
        if (item.id) referencedProductIds.add(item.id);
      });
    });

    const costPriceMap = new Map();
    if (referencedProductIds.size > 0) {
      const ids = Array.from(referencedProductIds);
      const CHUNK_SIZE = 30; // Firestore "in" so'rovi cheklovi
      const chunks = [];
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        chunks.push(ids.slice(i, i + CHUNK_SIZE));
      }
      const chunkSnaps = await Promise.all(
        chunks.map((chunk) =>
          db.collection("products")
            .where(admin.firestore.FieldPath.documentId(), "in", chunk)
            .get()
        )
      );
      chunkSnaps.forEach((snap) => {
        snap.forEach((doc) => costPriceMap.set(doc.id, Number(doc.data().costPrice) || 0));
      });
    }

    let totalCost = 0;
    deliveredToday.forEach((order) => {
      (order.orders || []).forEach((item) => {
        totalCost += (costPriceMap.get(item.id) || 0) * (Number(item.quantity) || 0);
      });
    });
    const netProfit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

    const pendingCount = todaysOrders.filter((o) => o.status === "pending" || o.status === "new").length;
    const activeProductsCount = totalProductsCount.data().count - inactiveProductsCount.data().count;
    const visitorCount = visitsCount.data().count;
    // HAQIQIY konversiya: buyurtmalar / noyob tashriflar. Tashrif
    // hali qayd etilmagan bo'lsa (masalan bugun birinchi tashrif —
    // hisoblanish ULGURMAGAN bo'lishi mumkin, chunki tashrif yozuvi
    // shu SO'ROVNING o'zi bilan bir vaqtda ketmoqda), 0 qaytariladi
    // — bo'linishga urinib, NaN yoki Infinity chiqmasligi uchun.
    const conversionRate = visitorCount > 0 ? Math.round((todaysOrders.length / visitorCount) * 1000) / 10 : 0;

    const recentOrders = [...todaysOrders]
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount || 0,
        createdAt: o.createdAt ? o.createdAt.toMillis() : null,
        customer: { fullName: o.customer?.fullName || null },
      }));

    return {
      timeframe: "Bugun",
      totalSales,
      netProfit,
      profitMargin,
      ordersCount: todaysOrders.length,
      pendingCount,
      activeProductsCount,
      totalProductsCount: totalProductsCount.data().count,
      lowStockCount: lowStockCount.data().count,
      visitorCount,
      conversionRate,
      recentOrders,
      // Onboarding checklist uchun - butun tarix bo'yicha kamida bitta
      // buyurtma bo'lganmi (faqat BUGUNGI emas, `todaysOrders`dan farqli).
      hasEverOrdered: everOrderedCount.data().count > 0,
    };
  } catch (err) {
    console.error("Dashboard summary hisoblashda xatolik:", err);
    return null;
  }
}

/**
 * Frontend (SessionContext) shu funksiyani chaqiradi:
 *   const result = await verifyTelegramAuth({ initData });
 *
 * Natija: { token, telegramUser, startParam, isAdmin, store,
 *           security, dashboardSummary }
 */
async function handleVerifyTelegramAuth(request) {
  const { initData, ownerSellerId } = request.data || {};

  // 1) Qaysi sotuvchining SHAXSIY bot tokenini sinab ko'rish
  // kerakligini aniqlaymiz. Ikkita manba bor, IKKALASI HAM hali
  // ISHONILMAGAN (faqat qaysi tokenni SINASH kerakligini tanlash
  // uchun ishlatiladi — haqiqiy xavfsizlik chegarasi pastdagi HMAC
  // tekshiruvining o'zi):
  //   a) `ownerSellerId` — frontend URL'idan (sotuvchining shaxsiy
  //      bot Mini App manziliga ATAYLAB o'rnatilgan bo'ladi) — bu,
  //      bot HATTO `start_param`siz (oddiy "Start" bilan) ochilganda
  //      ham ishlaydi.
  //   b) `start_param` (initData ichidan) — havola orqali (masalan
  //      "Ulashish" tugmasidan) ochilganda.
  const candidateSellerId = ownerSellerId || parseStartParam(peekStartParamUnsafe(initData)).sellerId;

  let customBotToken = null;
  if (candidateSellerId) {
    try {
      const customBotSnap = await db.collection("sellers").doc(candidateSellerId)
        .collection("private").doc("customerBot").get();
      if (customBotSnap.exists && customBotSnap.data().botToken) {
        customBotToken = customBotSnap.data().botToken;
      }
    } catch (err) {
      console.error("Shaxsiy bot tokenini qidirishda xatolik:", err);
    }
  }

  let verified = null;
  let isCustomBotRequest = false;

  if (customBotToken) {
    try {
      verified = await verifyTelegramInitData(initData, customBotToken);
      isCustomBotRequest = true;
    } catch {
      // Shaxsiy bot tokeni bilan mos kelmadi — bu, ehtimol, umumiy
      // botdan kelgan oddiy so'rov edi. Pastda umumiy token bilan
      // qayta sinaymiz — hozircha xato tashlamaymiz.
      verified = null;
      isCustomBotRequest = false;
    }
  }

  if (!verified) {
    try {
      verified = await verifyTelegramInitData(initData, BOT_TOKEN.value());
    } catch (err) {
      console.error("Telegram auth tekshiruvi muvaffaqiyatsiz:", err.message);
      throw new HttpsError("unauthenticated", "Telegram autentifikatsiyasi tasdiqlanmadi.");
    }
  }

  const { user, startParam: rawStartParam } = verified;
  if (!user || !user.id) {
    throw new HttpsError("unauthenticated", "Telegram foydalanuvchi ma'lumoti topilmadi.");
  }

  const uid = String(user.id);

  // MUHIM: referal dasturi uchun, `start_param` endi ikkita shaklda
  // bo'lishi mumkin - oddiy "{sellerId}" (avvalgidek) yoki
  // "{sellerId}_r{referrerClientId}" (do'st taklif qilish havolasi
  // orqali). Bu yerda ajratib olamiz - frontend ESA buni bilishi
  // SHART EMAS: pastda qaytariladigan `startParam` har doim TOZA
  // (faqat sellerId) bo'lib qoladi, `SessionContext.jsx` o'zgarishsiz
  // ishlayveradi.
  const { sellerId: startParam, referrerId, deepLinkPath, sellerInviterId } = parseStartParam(rawStartParam);

  // SO'ROVLARNI CHEGARALASH: 5 daqiqada 60 tadan ortiq urinishga
  // yo'l qo'yilmaydi (juda keng — oddiy foydalanuvchi buncha tez-tez
  // ilovani ochmaydi), faqat skript orqali suiiste'molning oldini
  // olish uchun xavfsizlik to'ri sifatida.
  await checkRateLimit(`verifyTelegramAuth:${uid}`, 60, 300);

  // OLDIN: bu yerda `clients/{uid}` HAR DOIM (oddiy `set(...,
  // {merge:true})` bilan) yozilardi. Endi, agar referal ma'lumoti
  // bo'lsa, avval MAVJUD hujjatni o'qishimiz kerak - `referredBy`
  // FAQAT BIR MARTA (hujjat birinchi marta yaratilganda) yozilishi
  // kerak, keyingi har safar kirishda QAYTA YOZILMASLIGI kerak
  // (aks holda mijoz boshqa havola orqali kirsa, "kim taklif qilgan"
  // ma'lumoti almashinib ketardi).
  const clientWritePromise = startParam
    ? (async () => {
        try {
          const clientRef = db.collection("clients").doc(uid);
          const payload = {
            telegramId: uid,
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || null,
            username: user.username ? `@${user.username}` : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Referal ma'lumoti FAQAT: (a) havolada haqiqatan bor bo'lsa,
          // (b) odam O'ZINI-O'ZI taklif qilmagan bo'lsa, VA (c) bu
          // mijoz hali HECH QACHON (na shu, na boshqa referal orqali)
          // ro'yxatdan o'tmagan bo'lsa - shundagina qo'shiladi.
          if (referrerId && referrerId !== uid) {
            const existingSnap = await clientRef.get();
            if (!existingSnap.exists || !existingSnap.data()?.referredBy) {
              payload.referredBy = referrerId;
              payload.referredForSellerId = startParam;
              payload.referredAt = admin.firestore.FieldValue.serverTimestamp();
            }
          }

          await clientRef.set(payload, { merge: true });
        } catch (err) {
          console.error("Firestore'ga yozishda xatolik:", err);
          throw new HttpsError(
            "internal",
            "Ma'lumotlar bazasiga yozishda xatolik. Firestore Console'da baza yaratilganini tekshiring."
          );
        }
      })()
    : Promise.resolve(null);

  const tokenPromise = admin.auth().createCustomToken(uid, {
    startParam: startParam || null,
  }).catch((err) => {
    console.error("Custom token yaratishda xatolik:", err);
    throw new HttpsError(
      "internal",
      "Token yaratishda xatolik. Xizmat hisobida 'Service Account Token Creator' roli borligini tekshiring."
    );
  });

  // MUHIM: agar so'rov sotuvchining SHAXSIY (xaridor uchun) botidan
  // tasdiqlangan bo'lsa — bu HAR DOIM mijoz sifatida ko'riladi, hatto
  // sotuvchining O'ZI bosgan bo'lsa ham — chunki bu bot FAQAT
  // xaridorlar uchun mo'ljallangan, boshqaruv paneli hech qachon
  // shu yerda ochilmasligi kerak. Admin/xavfsizlik/Dashboard
  // qidiruvlarini BUTUNLAY o'tkazib yuboramiz — ular bu holatda
  // keraksiz.
  if (isCustomBotRequest) {
    // MUHIM: bu yerda 4 ta va'da bor (oxirgisi — `recordVisit`,
    // ATAYLAB hech qanday o'zgaruvchiga OLINMAYDI, natijasi kerak
    // emas). Pastdagi massivda 3 ta nom bor — bu TO'G'RI. Bu yerni
    // o'zgartirsangiz, pastdagi (oddiy) bo'limdagi xuddi shu turdagi
    // izohga qarang — aynan shu sinf xato oldin production'da
    // haqiqiy nosozlikka olib kelgan edi.
    const [customToken, _clientWriteResult, sellerSnap] = await Promise.all([
      tokenPromise,
      clientWritePromise,
      db.collection("sellers").doc(candidateSellerId).get(),
      recordVisit(candidateSellerId, uid),
    ]);

    return {
      token: customToken,
      telegramUser: {
        id: uid,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        username: user.username || null,
      },
      startParam: candidateSellerId,
      isAdmin: false,
      store: sellerSnap.exists ? { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) } : null,
      security: null,
      dashboardSummary: null,
    };
  }

  const sellerIdToFetch = startParam || uid;
  const shouldFetchOwnSecurity = !startParam;

  // MUHIM: bu yerda 7 ta va'da bor (oxirgisi — `recordVisit`,
  // ATAYLAB hech qanday o'zgaruvchiga OLINMAYDI, chunki uning
  // natijasi kerak emas — faqat "tugashini kutish" muhim). Pastdagi
  // massivda esa 6 ta nom bor — bu TO'G'RI (oxirgi joy bo'sh
  // qoldirilgan). Eslatma: aynan shu turdagi (massiv va nomlar soni
  // MOS KELMASLIGI) xato oldin production'da haqiqiy nosozlikka olib
  // kelgan edi — shuning uchun bu yerda o'zgartirish kiritsangiz,
  // ikkalasini ham (`Promise.all` massivi va destrukturizatsiya)
  // DIQQAT bilan solishtiring.
  const [customToken, _clientWriteResult, adminSnap, sellerSnap, securitySnap, dashboardSummary] = await Promise.all([
    tokenPromise,
    clientWritePromise,
    db.collection("admins").doc(uid).get(),
    db.collection("sellers").doc(sellerIdToFetch).get(),
    shouldFetchOwnSecurity
      ? db.collection("sellers").doc(uid).collection("private").doc("security").get()
      : Promise.resolve(null),
    shouldFetchOwnSecurity ? computeDashboardSummary(uid) : Promise.resolve(null),
    startParam ? recordVisit(startParam, uid) : Promise.resolve(null),
  ]);

  return {
    token: customToken,
    telegramUser: {
      id: uid,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      username: user.username || null,
    },
    startParam: startParam || null,
    deepLinkPath: deepLinkPath || null,
    // Sotuvchini taklif qilish havolasi orqali ochilgan bo'lsa
    // ("_i" formati) - `store` allaqachon `null` bo'ladi (chunki
    // `startParam` bu holatda ATAYLAB `null`, demak `sellerIdToFetch
    // = uid`, va bu odam hali sellers/{uid} hujjatiga ega bo'lmasa,
    // `sellerSnap.exists` false bo'ladi). Frontend shu maydonni
    // `CreateStoreScreen`da "kim taklif qilgan" sifatida yozib
    // qo'yadi (`sellerReferrals.js`dagi `recordSellerReferralSignup`).
    sellerInviterId: sellerInviterId || null,
    isAdmin: adminSnap.exists,
    store: sellerSnap.exists ? { id: sellerSnap.id, ...sanitizeFirestoreData(sellerSnap.data()) } : null,
    security: securitySnap?.exists ? sanitizeFirestoreData(securitySnap.data()) : null,
    dashboardSummary,
  };
}

exports.verifyTelegramAuth = onCall(
  { secrets: [BOT_TOKEN, SENTRY_DSN], region: "asia-south1" },
  withSentry(async (request) => {
    // Butun funksiya tashqi try/catch bilan himoyalangan — har qanday
    // kutilmagan xato TO'LIQ (xabar + stack) SERVER logiga yoziladi.
    //
    // ISHLAB CHIQARISH UCHUN TUZATILDI: ilgari (xatoni topish osonroq
    // bo'lishi uchun, diagnostika bosqichida) haqiqiy xato matni
    // to'g'ridan-to'g'ri MIJOZGA ham yuborilardi. Bu — production
    // uchun yaxshi odat emas (ichki tizim tafsilotlari — masalan
    // Firestore indeks nomlari, fayl yo'llari — begona odamga
    // ko'rinib qolishi mumkin). Endi mijoz FAQAT umumiy xabar oladi,
    // haqiqiy sabab esa serverning o'z logida (Firebase Console →
    // Functions → Logs) to'liq qoladi.
    try {
      return await handleVerifyTelegramAuth(request);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("verifyTelegramAuth — kutilmagan xato:", err.message, err.stack);
      throw new HttpsError("internal", "Kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
    }
  })
);

// Sinov (test) fayllari uchun — ichki mantiqni `onCall` o'rovisiz
// to'g'ridan-to'g'ri chaqirish imkonini beradi.
exports._testables = { handleVerifyTelegramAuth, computeDashboardSummary };
