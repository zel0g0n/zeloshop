const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN, GEMINI_API_KEY } = require("./lib/admin");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { incrementDailyStat, logNotification } = require("./lib/dailyStats");
// AI CEO: `craftWinBackMessage`/`craftFavoriteReminderMessage` shu
// yerda, avtonom (sotuvchi tugma bosmasdan) eslatma matnlarini
// yaxshilash uchun qayta ishlatiladi. Batafsil izoh - pastda, tegishli
// funksiyalar ichida.
const { craftWinBackMessage, craftFavoriteReminderMessage } = require("./aiCeo");
// AI CEO natija kuzatuvi va o'rganish qatlami (batafsil izoh:
// `aiCeoLearning.js`): har bir avtonom xabar yuborilgach
// `recordAiCeoOutcome` chaqiriladi (kim, qanday xabar oldi - keyinroq
// "xarid qildimi" tekshirish uchun), va har bir AI-yozuv oldidan
// `getRecentAiPerformance` o'qiladi (AI oldingi natijasidan xabardor
// bo'lib yozishi uchun).
const { recordAiCeoOutcome, getRecentAiPerformance } = require("./aiCeoLearning");
// AI CEO avtonom chegirma moduli (batafsil izoh:
// `aiCeoAutoDiscount.js`): faqat `sendRepurchaseReminders` ichida, va
// faqat sotuvchi alohida yoqib, natija isbotlanganda ishlaydigan,
// haqiqiy bir martalik chegirma kodi yaratuvchi.
const { maybeIssueAutoWinBackDiscount } = require("./aiCeoAutoDiscount");
// 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
// `onSchedule` timeout'idan oshib ketishi mumkin edi - batafsil
// izoh: `lib/batchProcess.js`.
const { processBatched } = require("./lib/batchProcess");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
// Kategoriya-asoslangan iste'mol tsikli (batafsil izoh: `lib/
// replenishmentCycles.js`) - OLDINGI "hamma uchun qat'iy 30 kun"
// yondashuvi o'rniga.
const { pickEffectiveCycleDays, MIN_CYCLE_DAYS, MAX_CYCLE_DAYS } = require("./lib/replenishmentCycles");

/**
 * Xaridorni qaytarish bildirishnomalari - ikkita tizim bildirishnomasi:
 *   1. "Like bosilgan mahsulotga eslatma" (sevimlilar)
 *   2. "Qayta sotib olishga taklif" (avval xarid qilingan mahsulot)
 *
 * Ikkalasi ham `carts.js`dagi "tashlab ketilgan savat" eslatmasi
 * bilan bir xil, sinovdan o'tgan naqshda qurilgan.
 */

// Sevimlilar mahsuloti sarlavhasidan matnga kirituvchi qisqa nomlar
// yig'ish uchun cheklov (Gemini promptini ixcham saqlash uchun).
const MAX_FAVORITE_ITEM_NAMES_FOR_AI = 5;

const FAVORITE_REMINDER_DAYS = 3;
const formatMoney = (n) => `${Math.round(n).toLocaleString()} so'm`;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 1) Sevimlilar eslatmasi — mahsulotni "like" bosib, lekin
 * FAVORITE_REMINDER_DAYS kun ichida sotib olmagan xaridorga eslatma
 * yuboradi. Har bir sevimlilar hujjati uchun faqat bir marta
 * (status="reminded"ga o'tkaziladi) - agar xaridor keyinroq
 * ro'yxatni yana o'zgartirsa, `syncFavorites.js` uni "active"ga
 * qaytaradi va jarayon tabiiy ravishda qayta boshlanadi.
 *
 * Sotuvchi buni alohida, ochiq-oydin yoqqan bo'lsa
 * (`aiCeoAutoFavoriteEnabled === true`, standart holatda o'chiq),
 * matnni AI CEO Gemini orqali shaxsiylashtirib yozadi. Gemini xato
 * bersa jim qolib, oddiy shablonga qaytamiz, chunki eslatma
 * yuborilishi AI'ning ishlashiga bog'liq bo'lmasligi kerak.
 */
exports.sendFavoriteReminders = onSchedule(
  {
    schedule: "0 12 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - FAVORITE_REMINDER_DAYS * 24 * 60 * 60 * 1000);

    // Xavfsizlik chegarasi: `.limit()` qo'yilmasa, bir kunda juda ko'p
    // sevimlilar "eskirsa" (masalan aksiya kuni ko'p mahsulot like
    // bosilsa), funksiya ularning barchasini cheklovsiz qayta ishlar
    // edi - nazoratsiz Telegram xabar oqimi. Qolganlari ertangi
    // yugurishda qayta ishlanadi.
    const MAX_FAVORITES_PER_RUN = 200;

    const favSnap = await db.collection("favorites")
      .where("updatedAt", "<=", cutoff)
      .limit(MAX_FAVORITES_PER_RUN)
      .get();

    if (favSnap.empty) return;

    // Elementlarni AVVAL sotuvchi bo'yicha guruhlaymiz: GURUH ICHIDA
    // ketma-ket ishlanadi (sotuvchi ma'lumoti bir marta o'qiladi, xuddi
    // avvalgidek), GURUHLAR orasida esa PARALEL ishlov beriladi
    // (batafsil izoh: `carts.js`, `lib/batchProcess.js`).
    const favsBySeller = new Map();
    favSnap.docs.forEach((favDoc) => {
      const fav = favDoc.data();
      // `status` maydoni bo'lmagan (hali eslatma yuborilmagan) yoki
      // "active" bo'lgan hujjatlargina qayta ishlanadi - "reminded"
      // holatidagilar chetlab o'tiladi.
      if (fav.status === "reminded") return;
      if (!fav.sellerId || !fav.clientId || !Array.isArray(fav.items) || fav.items.length === 0) return;
      if (!favsBySeller.has(fav.sellerId)) favsBySeller.set(fav.sellerId, []);
      favsBySeller.get(fav.sellerId).push(favDoc);
    });

    const result = await processBatched(Array.from(favsBySeller.entries()), async ([sellerId, favDocs]) => {
      // Mijozga xabar avval sotuvchining shaxsiy boti orqali
      // yuboriladi, platforma boti faqat zaxira (batafsil izoh:
      // `lib/customerNotify.js`).
      const sellerSnap = await db.collection("sellers").doc(sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      // Faqat AI-yozuv yoqilgan bo'lsa o'qiladi - bitta o'qish,
      // sotuvchi boshiga bir marta, butun ishga tushirish davomida
      // keshlangan holda.
      const recentPerformance = seller.aiCeoEnabled === true && seller.aiCeoAutoFavoriteEnabled === true
        ? await getRecentAiPerformance(sellerId, "favorite")
        : null;
      const customBotToken = await getSellerCustomBotToken(sellerId);

      for (const favDoc of favDocs) {
        const fav = favDoc.data();
        try {
          // Sotuvchi bu bildirishnomani o'chirib qo'ygan bo'lishi mumkin.
          if (seller.favoriteReminderEnabled === false) continue;

          const itemsList = fav.items.slice(0, 5).map((i) => `• ${i.name} — ${formatMoney(i.price)}`).join("\n");
          const moreCount = fav.items.length > 5 ? fav.items.length - 5 : 0;

          let text = `Sevimlilaringizda mahsulotlar sizni kutmoqda!\n\n${itemsList}`;
          if (moreCount > 0) text += `\n... va yana ${moreCount} ta mahsulot`;
          text += `\n\nHali ham qiziqasizmi? Ular tugab qolishi mumkin!`;
          let aiGenerated = false;

          if (seller.aiCeoEnabled === true && seller.aiCeoAutoFavoriteEnabled === true) {
            try {
              const itemNames = fav.items.slice(0, MAX_FAVORITE_ITEM_NAMES_FOR_AI).map((i) => i.name);
              const aiText = await craftFavoriteReminderMessage({ itemNames, storeName: seller.storeName, recentPerformance });
              if (aiText) {
                text = aiText;
                aiGenerated = true;
              }
            } catch (aiErr) {
              // AI xato bersa jim qolamiz, oddiy shablon bilan davom
              // etamiz - eslatma yuborilishi AI xatosiga bog'liq
              // bo'lmasligi kerak.
              console.error(`AI sevimlilar eslatmasi yaratib bo'lmadi (${favDoc.id}), oddiy shablon ishlatiladi:`, aiErr);
            }
          }

          await sendCustomerNotification(customBotToken, fav.clientId, text);
          await incrementDailyStat(fav.sellerId, "favoriteRemindersSent");
          if (aiGenerated) {
            await incrementDailyStat(fav.sellerId, "aiCeoAutoFavoriteSent");
          }
          await logNotification({
            sellerId: fav.sellerId, clientId: fav.clientId, type: "favoriteReminder",
            title: "Sevimlilar eslatmasi", message: text,
          });
          // AI CEO premium sotuvchilar uchun (AI-yozuv
          // yoqilgan-yoqilmaganidan qat'i nazar - shu orqali AI vs oddiy
          // shablon natijasi keyinchalik solishtiriladi), bu xabarning
          // haqiqiy natijasi ("mijoz keyinroq xarid qildimi") kuzatuvga
          // olinadi.
          if (seller.aiCeoEnabled === true) {
            await recordAiCeoOutcome({ sellerId: fav.sellerId, type: "favorite", clientId: fav.clientId, aiGenerated });
          }

          await favDoc.ref.update({
            status: "reminded",
            reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          console.error(`Sevimlilar eslatmasi xatosi (${favDoc.id}):`, err);
        }
      }
    });
    console.log(`sendFavoriteReminders: ${result.successCount}/${result.total} sotuvchi guruhi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);

/**
 * 2) Qayta sotib olishga taklif — yetkazib berilgan buyurtmadagi
 * mahsulot(lar)ning KATEGORIYASIGA mos "o'rtacha tugash muddati"
 * (`lib/replenishmentCycles.js`) o'tgach, xaridorga "yana buyurtma
 * berishni xohlaysizmi" degan taklif yuboradi.
 *
 * MUHIM O'ZGARISH (2026-09, kategoriya-asoslangan tsikl): OLDIN bu
 * funksiya HAR QANDAY yetkazilgan buyurtma uchun, mahsulot turidan
 * qat'i nazar, qat'iy 30 kundan keyin ishlardi - bu kiyim/poyabzal/
 * mebel kabi UZOQ MUDDATLI mahsulot sotib olgan xaridorlar uchun
 * tegishsiz, bezovta qiluvchi eslatma edi (batafsil izoh: `lib/
 * replenishmentCycles.js`). Endi har bir buyurtma UNING O'Z
 * mahsulot(lari) kategoriyasiga qarab (masalan yuz kremi ~30 kun,
 * shampun ~45 kun) alohida muddatda tekshiriladi; kategoriyasi
 * "muntazam tugaydigan" deb ANIQ bilinmagan mahsulot (kiyim,
 * elektronika va h.k.) uchun EslATMA UMUMAN YUBORILMAYDI - noto'g'ri
 * taxminiy muddat ko'rsatishdan ko'ra yubormaslik afzal.
 *
 * Dizayn qarori (xarajat va aniqlik muvozanati): turli buyurtmaning
 * muddati turlicha bo'lgani uchun, KENG oyna (eng qisqa va eng uzun
 * kategoriya muddati orasidagi barcha kunlar) so'raladi, so'ng HAR BIR
 * buyurtma UCHUN ALOHIDA, o'zining kategoriya-muddati kelib-kelmaganini
 * xotirada (in-memory) tekshiramiz - aks holda bitta umumiy "kesim"
 * bilan turli uzunlikdagi tsikllarni to'g'ri aniqlab bo'lmas edi. Har
 * bir buyurtma uchun, xaridor o'sha vaqtdan beri qayta buyurtma
 * bermaganini aniq tekshiramiz - aks holda, allaqachon qaytgan
 * mijozga keraksiz, noqulay eslatma yuborilishi mumkin edi.
 *
 * Bu funksiya hech kimning tugma bosishisiz, avtomatik ishlaydi.
 * Sotuvchi buni alohida, ochiq-oydin yoqqan bo'lsa
 * (`aiCeoAutoWinBackEnabled === true`, standart holatda o'chiq),
 * matnni AI CEO Gemini orqali yaxshilab yozadi - bu, eng xavfsiz va
 * qaytariladigan harakat turi uchun (oddiy, bosimsiz "sizni sog'indik"
 * eslatmasi, moliyaviy va'da yo'q) to'liq avtonom ijro degani. Gemini
 * xato bersa (tarmoq, kvota va h.k.) jim qolib, oddiy shablonga
 * qaytamiz, chunki eslatma yuborilishi AI'ning ishlashiga bog'liq
 * bo'lmasligi kerak. Har bir AI-yozilgan xabar
 * `aiCeoAutoWinBackSent` hisoblagichida qayd etiladi - sotuvchi buni
 * kunlik hisobotda ("AI CEO bugun N ta amalni avtomatik bajardi")
 * ko'ra oladi, to'liq shaffoflik uchun.
 *
 * Kengaytirilgan doira (batafsil izoh: `aiCeoAutoDiscount.js`): xuddi
 * shu funksiya ichida, faqat sotuvchi butunlay alohida
 * `aiCeoAutoDiscountEnabled`ni yoqqan bo'lsa va `aiCeoLearning.js`da
 * yig'ilgan haqiqiy natija AI matni yetarlicha ishlamayapti degan
 * isbot bergan bo'lsa - matn xabariga qo'shimcha, haqiqiy
 * (deterministik, Gemini ishtirokisiz yaratilgan) bir martalik
 * chegirma promokodi ham qo'shiladi.
 */
exports.sendRepurchaseReminders = onSchedule(
  {
    schedule: "0 13 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, GEMINI_API_KEY, SENTRY_DSN],
    // 50-100+ faol sotuvchida ketma-ket ishlov berish standart 60s
    // timeout'dan oshib ketishi mumkin edi - qo'shimcha xavfsizlik
    // zaxirasi (batafsil izoh: `lib/batchProcess.js`).
    timeoutSeconds: 300,
  },
  withSentry(async () => {
    // Turli kategoriya turli muddatga ega bo'lgani uchun, bitta
    // KENG oyna so'raladi (eng qisqa - eng uzun kategoriya muddati
    // oralig'idagi barcha kunlar) - har bir buyurtovchi tsikli pastda,
    // xotirada, ALOHIDA tekshiriladi.
    const windowStart = Date.now() - (MAX_CYCLE_DAYS + 1) * DAY_MS;
    const windowEnd = Date.now() - MIN_CYCLE_DAYS * DAY_MS;

    // Xavfsizlik chegarasi - avvalgisidan kattaroq, chunki endi oyna
    // kengroq (bir necha o'nlab kunlik buyurtmalarni qamrab oladi).
    const MAX_ORDERS_PER_RUN = 300;

    const ordersSnap = await db.collection("orders")
      .where("status", "==", "delivered")
      .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(windowStart))
      .where("createdAt", "<=", admin.firestore.Timestamp.fromMillis(windowEnd))
      .limit(MAX_ORDERS_PER_RUN)
      .get();

    if (ordersSnap.empty) return;

    // Elementlarni AVVAL sotuvchi bo'yicha guruhlaymiz - bu MAJBURIY,
    // oddiy `carts.js`/`sendFavoriteReminders`dan farqli o'laroq: pastda
    // `discountState.issuedCount` - shu sotuvchi uchun ishga tushirish
    // davomida berilgan chegirmalar sonini hisoblovchi UMUMIY o'zgaruvchan
    // hisoblagich (`MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN` chegarasi
    // uchun). Agar bir xil sotuvchining buyurtmalari PARALEL ishlansa,
    // bu hisoblagich poyga sharoitiga (race condition) uchraydi va
    // chegarani buzishi mumkin - shuning uchun GURUH ICHIDA (bir xil
    // sotuvchi) ketma-ket, GURUHLAR orasida (turli sotuvchilar) PARALEL
    // ishlanadi (batafsil izoh: `lib/batchProcess.js`).
    //
    // Shu yerda, guruhlashdan OLDIN, ikkita narsa alohida-alohida
    // "yakunlanadi" (ular ORTIQCHA - hech qachon o'zgarmaydigan -
    // sabablar bo'lgani uchun, kelajakda qayta tekshirishning hojati
    // yo'q): (a) kategoriyasi "muntazam tugaydigan" deb tanilmagan
    // buyurtma (`lib/replenishmentCycles.js`) - HECH QACHON eslatmaga
    // loyiq bo'lmaydi; (b) hali OʻZ muddatiga yetmagan buyurtma - bu
    // ENDI EMAS, lekin KEYINGI kunlarda qayta tekshiriladi (belgilanmaydi).
    const skipUpdates = []; // {ref, data} - "hech qachon loyiq emas" holatlar
    const ordersBySeller = new Map();
    const now = Date.now();
    ordersSnap.docs.forEach((orderDoc) => {
      const order = orderDoc.data();
      if (order.repurchaseReminderSent) return;
      if (!order.sellerId || !order.clientId || !Array.isArray(order.orders) || order.orders.length === 0) return;

      const categories = order.orders.map((i) => i.category);
      const effectiveCycleDays = pickEffectiveCycleDays(categories);
      if (effectiveCycleDays === null) {
        // Kiyim/poyabzal/elektronika va h.k. - bu kategoriyalar uchun
        // "tugash muddati" tushunchasi mos emas, shuning uchun HECH
        // QACHON eslatma yubormaymiz. Buni darhol belgilab qo'yamiz -
        // aks holda bu buyurtma har kuni, foydasiz qayta o'qilardi.
        skipUpdates.push(orderDoc.ref);
        return;
      }

      const createdAtMs = order.createdAt?.toMillis ? order.createdAt.toMillis() : Number(order.createdAt) || 0;
      const daysSinceDelivered = (now - createdAtMs) / DAY_MS;
      if (daysSinceDelivered < effectiveCycleDays) return; // hali vaqti kelmagan - ertaga qayta tekshiriladi

      if (!ordersBySeller.has(order.sellerId)) ordersBySeller.set(order.sellerId, []);
      // `orderDoc.data()`ni pastda QAYTA chaqirish o'rniga, shu yerda
      // HISOBLANGAN `effectiveCycleDays`ni to'g'ridan-to'g'ri
      // birga olib o'tamiz - Firestore Admin SDK'ning `.data()`si har
      // chaqiruvda YANGI obyekt qaytarishi mumkin, shuning uchun
      // hisoblangan qiymatni `order` obyektiga "yopishtirib" qo'yishga
      // suyanib bo'lmaydi.
      ordersBySeller.get(order.sellerId).push({ orderDoc, effectiveCycleDays });
    });

    if (skipUpdates.length > 0) {
      await Promise.all(skipUpdates.map((ref) => ref.update({
        repurchaseReminderSent: true,
        repurchaseReminderSkippedReason: "no_consumable_category",
      }).catch((err) => console.error(`Repurchase "loyiq emas" belgilashda xatolik (${ref.id}):`, err))));
    }

    if (ordersBySeller.size === 0) return;

    const result = await processBatched(Array.from(ordersBySeller.entries()), async ([sellerId, orderDocs]) => {
      // Mijozga xabar avval sotuvchining shaxsiy boti orqali
      // yuboriladi, platforma boti faqat zaxira (batafsil izoh:
      // `lib/customerNotify.js`).
      const sellerSnap = await db.collection("sellers").doc(sellerId).get();
      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      // Faqat AI-yozuv yoqilgan bo'lsa o'qiladi - bitta o'qish,
      // sotuvchi boshiga bir marta, butun ishga tushirish davomida
      // keshlangan holda.
      const recentPerformance = seller.aiCeoEnabled === true && seller.aiCeoAutoWinBackEnabled === true
        ? await getRecentAiPerformance(sellerId, "winback")
        : null;
      const customBotToken = await getSellerCustomBotToken(sellerId);
      // Shu sotuvchi guruhi ICHIDA ketma-ket ishlangani uchun bu
      // hisoblagich xavfsiz - `MAX_AUTO_DISCOUNTS_PER_SELLER_PER_RUN`
      // chegarasi uchun zarur.
      const discountState = { issuedCount: 0 };

      for (const { orderDoc, effectiveCycleDays } of orderDocs) {
        const order = orderDoc.data();
        try {
          // Mijoz o'sha buyurtmadan keyin qayta buyurtma berganmi -
          // agar berilgan bo'lsa, eslatma yuborishning hojati yo'q.
          const newerOrdersSnap = await db.collection("orders")
            .where("sellerId", "==", order.sellerId)
            .where("clientId", "==", order.clientId)
            .where("createdAt", ">", order.createdAt)
            .limit(1)
            .get();
          if (!newerOrdersSnap.empty) {
            await orderDoc.ref.update({ repurchaseReminderSent: true }); // qayta tekshirmaslik uchun belgilaymiz
            continue;
          }

          if (seller.repurchaseReminderEnabled === false) continue;

          const itemsList = order.orders.slice(0, 5).map((i) => `• ${i.name} x${i.quantity}`).join("\n");
          // MUHIM: "Bir oy oldin" endi TO'G'RI KELMAYDI - tsikl
          // kategoriyaga qarab farq qiladi (`effectiveCycleDays`,
          // 20-90 kun oralig'ida) - shuning uchun umumiy, muddat
          // raqamiga bog'lanmagan matn ishlatiladi.
          let text = `Avval buyurtma bergan mahsulotlaringiz tugab qolgan bo'lishi mumkin!\n\n${itemsList}\n\nYana buyurtma berish uchun do'konimizga tashrif buyuring!`;
          let aiGenerated = false;

          if (seller.aiCeoEnabled === true && seller.aiCeoAutoWinBackEnabled === true) {
            try {
              const aiText = await craftWinBackMessage({
                customerName: order.customer?.fullName,
                daysSinceLastOrder: effectiveCycleDays,
                lastProductName: order.orders[0]?.name,
                storeName: seller.storeName,
                recentPerformance,
              });
              if (aiText) {
                text = aiText;
                aiGenerated = true;
              }
            } catch (aiErr) {
              // AI xato bersa jim qolamiz, oddiy shablon bilan davom
              // etamiz - eslatma yuborilishi AI xatosiga bog'liq
              // bo'lmasligi kerak.
              console.error(`AI qaytarish xabari yaratib bo'lmadi (buyurtma ${orderDoc.id}), oddiy shablon ishlatiladi:`, aiErr);
            }
          }

          // Matn tayyor bo'lgach, lekin yuborilishdan oldin - agar
          // shart-sharoit muvofiq bo'lsa (opt-in, isbotlangan past
          // konversiya, xavfsizlik chegarasi ichida), haqiqiy,
          // deterministik chegirma kodi yaratiladi va xabar oxiriga
          // qo'shimcha qator sifatida qo'shiladi. Chegirma yaratib
          // bo'lmasa (yoki shart-sharoit mos kelmasa) `text` o'zgarmay
          // qoladi, xabar baribir yuboriladi (batafsil izoh:
          // `aiCeoAutoDiscount.js`).
          let discountIssued = false;
          if (seller.aiCeoEnabled === true) {
            const discountResult = await maybeIssueAutoWinBackDiscount({
              sellerId: order.sellerId,
              clientId: order.clientId,
              seller,
              recentPerformance,
              issuedCountThisRun: discountState.issuedCount,
            });
            if (discountResult.issued) {
              discountIssued = true;
              discountState.issuedCount += 1;
              text += `\n\nMaxsus taklif: ${discountResult.discountPercent}% chegirma bilan qaytib keling!\nPromokod: ${discountResult.code} (7 kun amal qiladi)`;
            }
          }

          await sendCustomerNotification(customBotToken, order.clientId, text);
          await incrementDailyStat(order.sellerId, "repurchaseRemindersSent");
          if (aiGenerated) {
            await incrementDailyStat(order.sellerId, "aiCeoAutoWinBackSent");
          }
          if (discountIssued) {
            await incrementDailyStat(order.sellerId, "aiCeoAutoDiscountsIssued");
          }
          await logNotification({
            sellerId: order.sellerId, clientId: order.clientId, type: "repurchaseReminder",
            title: "Qayta sotib olish taklifi", message: text,
            // Kelajakda "qaysi tsikl uzunligi ko'proq xarid keltirdi"
            // kabi HAQIQIY tahlil qilish uchun - real xarid
            // ma'lumotlari bilan birga, statik taxminiy jadvalni
            // (`lib/replenishmentCycles.js`) haqiqiy ma'lumot bilan
            // tekshirish/moslashtirish shu orqali bo'ladi.
            meta: { cycleDaysUsed: effectiveCycleDays },
          });
          // AI CEO premium sotuvchilar uchun (AI-yozuv
          // yoqilgan-yoqilmaganidan qat'i nazar), bu xabarning haqiqiy
          // natijasi ("mijoz keyinroq xarid qildimi") kuzatuvga olinadi.
          if (seller.aiCeoEnabled === true) {
            await recordAiCeoOutcome({ sellerId: order.sellerId, type: "winback", clientId: order.clientId, aiGenerated, discountIssued });
          }

          await orderDoc.ref.update({
            repurchaseReminderSent: true,
            repurchaseReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
            repurchaseCycleDaysUsed: effectiveCycleDays,
          });
        } catch (err) {
          console.error(`Qayta sotib olish eslatmasi xatosi (${orderDoc.id}):`, err);
        }
      }
    });
    console.log(`sendRepurchaseReminders: ${result.successCount}/${result.total} sotuvchi guruhi muvaffaqiyatli, ${result.failureCount} xato`);
  })
);
