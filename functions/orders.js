const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, BOT_TOKEN } = require("./lib/admin");
const { checkRateLimit } = require("./lib/rateLimit");
const { getSellerCustomBotToken, sendCustomerNotification } = require("./lib/customerNotify");
const { resolveDeliveryTier } = require("./lib/deliveryTiers");
const { getMinLeadHours, isValidDeliverySlot } = require("./lib/deliverySlots");
const { logNotification, todayDocId } = require("./lib/dailyStats");
const { computeInstallmentAmounts } = require("./lib/installments");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const { computeIsoWeekKey } = require("./lib/referralLeaderboardBonus");
const { computeDailySoldCountUpdate } = require("./lib/dailySoldCounter");

/**
 * Xavfsiz buyurtma yaratish — asosiy mantiq.
 *
 * Mijoz faqat mahsulot ID'lari va sonini yuboradi. Narxlar, promokod
 * haqiqiyligi va chegirma — barchasi shu yerda, Firestore TRANSACTION
 * ichida, HAQIQIY (server tomonidagi) ma'lumotdan qayta hisoblanadi.
 * Bonusda: ombor qoldig'i avtomatik kamayadi, va promokod ishlatilish
 * soni bir vaqtning o'zida (parallel) ikkita mijoz tomonidan limitdan
 * oshib ketishining oldi olinadi.
 *
 * Ichki mantiq alohida funksiyaga ajratilgan — shunda uni `onCall`
 * o'rovisiz, to'g'ridan-to'g'ri sinov (test) fayllaridan chaqirish
 * mumkin.
 */
async function handleCreateOrder(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }

  // So'rovlarni chegaralash: bir mijoz 5 daqiqada 10 tadan ortiq
  // buyurtma yarata olmaydi — bu oddiy xaridor uchun yetarlicha
  // keng, lekin omborni avtomatik "bo'shatib qo'yish" yoki tizimni
  // spam bilan bosib yuborishning oldini oladi.
  await checkRateLimit(`createOrder:${request.auth.uid}`, 10, 300);

  const { sellerId, customerData, items, couponCode, customerRegion, redeemBonusAmount, bundleId } = request.data || {};
  const clientId = request.auth.uid; // mijoz o'zi yubormaydi — sessiyadan olinadi.

  if (!sellerId) throw new HttpsError("invalid-argument", "Sotuvchi ko'rsatilmagan.");
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Savat bo'sh.");
  }
  if (!customerData?.fullName?.trim() || !customerData?.phone?.trim()) {
    throw new HttpsError("invalid-argument", "Mijoz ma'lumotlari to'liq emas.");
  }

  // ATMOS hali ulanmagani uchun (2026-09 punkt-royxati, 14-band) —
  // mijoz "Karta orqali" (`paymentMethod: "card"`) to'lovni tanlagan
  // bo'lsa, sotuvchining shaxsiy kartasiga o'tkazma qilib, TO'LOV
  // CHEKI SKRINSHOTINI albatta biriktirishi shart — aks holda sotuvchi
  // pul tushganini tekshira olmaydi. "Naqd" (`paymentMethod: "cash"`)
  // uchun bu talab qilinmaydi.
  const paymentMethod = customerData?.paymentMethod === "card" ? "card" : "cash";
  if (paymentMethod === "card" && !customerData?.paymentReceiptUrl) {
    throw new HttpsError("invalid-argument", "To'lov chekining skrinshotini yuklashingiz shart.");
  }

  const firestore = admin.firestore();

  try {
    const result = await firestore.runTransaction(async (transaction) => {
      // 1) Har bir mahsulotni Firestore'dan o'qiymiz - mijoz yuborgan
      // narx/nom/rasmga ishonilmaydi.
      const productRefs = items.map((item) => firestore.collection("products").doc(item.productId));
      const sellerRef = firestore.collection("sellers").doc(sellerId);
      // Buyurtma hujjatining ID'si shu yerda, OLDINDAN generatsiya
      // qilinadi (haqiqiy o'qish/yozish emas, faqat ID) — pastdagi
      // ombor qoldig'ini kamaytirish blokida, zaxira harakati audit
      // yozuviga (`lib/stockAuditLog.js`) "aynan QAYSI buyurtma sabab
      // bo'lgani"ni bog'lash uchun kerak (izoh: pastda).
      const orderRef = firestore.collection("orders").doc();
      // Referal dasturi uchun: mijoz hujjatini ham shu tranzaksiya
      // ichida o'qiymiz - shu orqali "referal chegirmasi
      // ishlatilganmi" tekshiruvi va "ishlatildi" deb belgilash bitta
      // atomik amalning bir qismi bo'ladi, poyga holati (race
      // condition) butunlay yo'q bo'ladi, hatto mijoz bir vaqtning
      // o'zida ikkita buyurtma yuborishga urinsa ham.
      const clientRef = firestore.collection("clients").doc(clientId);
      // Sodiqlik dasturi ("Bonus hisobi"): mijozning shu SOTUVCHIga
      // tegishli yig'ma hujjati - bonus balansi shu yerda saqlanadi
      // (`orderRollups.js`da "delivered" bo'lganda to'ldiriladi). Bu
      // ham xuddi referal tekshiruvi kabi, bitta tranzaksiya ichida
      // o'qilib-yozilishi kerak - aks holda mijoz ikkita buyurtmani
      // bir vaqtda yuborib, bitta bonusni ikki marta ishlatishi
      // mumkin bo'lardi.
      const customerRollupRef = firestore.collection("sellers").doc(sellerId).collection("customers").doc(clientId);
      // Doimiy buyurtma tartib raqami uchun -
      // `sellers/{id}/counters/orders` hujjatida saqlanadigan atomik
      // hisoblagich. Tartib raqamini yuklab olingan ro'yxatning
      // massiv ichidagi o'rniga (`orders.length - index`) qarab
      // hisoblash yuklash chegarasiga bog'liq bo'lib qolar edi (masalan
      // do'konda 150 tadan ko'p buyurtma bo'lganda). Shu sabab har bir
      // buyurtma yaratilgan paytda o'zining aniq, o'zgarmas tartib
      // raqamini oladi va shu yerda, hujjatning o'zida saqlanadi -
      // hisoblash keyinchalik shart emas va yuklash chegarasidan
      // mustaqil, har doim to'g'ri.
      const orderCounterRef = firestore.collection("sellers").doc(sellerId).collection("counters").doc("orders");
      const [productSnaps, sellerSnap, clientSnap, orderCounterSnap, customerRollupSnap] = await Promise.all([
        Promise.all(productRefs.map((ref) => transaction.get(ref))),
        transaction.get(sellerRef),
        transaction.get(clientRef),
        transaction.get(orderCounterRef),
        transaction.get(customerRollupRef),
      ]);
      const orderNumber = (orderCounterSnap.exists ? Number(orderCounterSnap.data().count) || 0 : 0) + 1;

      const orderItems = [];
      let subtotal = 0;

      for (let i = 0; i < items.length; i++) {
        const snap = productSnaps[i];
        const requestedQty = Number(items[i].quantity) || 0;

        if (!snap.exists) {
          throw new HttpsError("not-found", `Mahsulot topilmadi (${items[i].productId}).`);
        }
        const product = snap.data();

        if (product.sellerId !== sellerId) {
          throw new HttpsError("invalid-argument", "Savatda boshqa do'konning mahsuloti bor.");
        }
        if (requestedQty <= 0) {
          throw new HttpsError("invalid-argument", "Mahsulot soni noto'g'ri.");
        }
        if (Number(product.stock) < requestedQty) {
          throw new HttpsError("failed-precondition", `"${product.name}" omborda yetarli emas (qoldiq: ${product.stock}).`);
        }

        // "VAQTLI AKSIYA": chegirma muddati o'tgan bo'lsa - HISOBGA
        // OLINMAYDI, hatto mijoz mahsulot sahifasini eskirgan (kesh
        // qilingan) holatda ochib, "eski" chegirmali narxni ko'rib
        // turgan bo'lsa ham. Bu - HAQIQIY to'lov summasini belgilaydigan
        // YAGONA joy (frontend'dagi `isDiscountActive` faqat
        // KO'RSATISH uchun, bu yerdagi tekshiruv esa QAT'IY).
        const discountNotExpired = !product.discountExpiresAt || new Date(product.discountExpiresAt).getTime() > Date.now();
        const hasDiscount = product.discountPrice && Number(product.discountPrice) > 0 && Number(product.discountPrice) < Number(product.price) && discountNotExpired;
        const unitPrice = hasDiscount ? Number(product.discountPrice) : Number(product.price) || 0;

        orderItems.push({
          id: productRefs[i].id,
          name: product.name,
          image: product.image || (product.images && product.images[0]) || null,
          price: unitPrice,
          quantity: requestedQty,
        });
        subtotal += unitPrice * requestedQty;
      }

      // P&L hisob-kitoblari uchun har bir qatorning tannarxini ham
      // shu tranzaksiya ichida, hozirgi mahsulot hujjatidan "suratga
      // olamiz" - lekin ataylab `orderItems` (mijozga ham ko'rinadigan,
      // `orders/{id}` hujjatining o'zi) ichiga emas, balki alohida,
      // faqat sotuvchi o'qiy oladigan `sellers/{id}/orderCosts/{orderId}`
      // hujjatiga yozamiz. Sabab: `orders/{orderId}` hujjatini xaridor
      // ham o'qiy oladi (`firestore.rules`) - agar tannarx o'sha yerda
      // saqlansa, xaridor sotuvchining ulgurji narxini (marja
      // qanchaligini) ko'rib qolardi. Bu yig'ma yozuv esa, buyurtma
      // "delivered"ga o'tganda `orderRollups.js` trigger'i orqali
      // P&L/Dashboard hisob-kitoblarida ishlatiladi - shu orqali,
      // sotuvchi keyinroq mahsulot tannarxini o'zgartirsa ham, o'tgan
      // davr foydasi orqaga qarab o'zgarmaydi (buxgalteriya talabi).
      const costSnapshotItems = orderItems.map((item, i) => ({
        id: item.id,
        costPrice: Number(productSnaps[i].data().costPrice) || 0,
        quantity: item.quantity,
      }));

      const seller = sellerSnap.exists ? sellerSnap.data() : {};
      const client = clientSnap.exists ? clientSnap.data() : {};

      // ADMIN "faolsizlantirish" (suspend) tugmasi ISHLASHI UCHUN
      // haqiqiy to'siq: OLDIN `sellers/{id}.status` faqat KOSMETIK edi -
      // hech qanday backend/frontend joyda tekshirilmasdi, shuning
      // uchun "to'xtatilgan" do'kon baribir buyurtma qabul qilishda
      // davom etaverardi. Endi yangi buyurtma yaratishning ENG
      // markazlashgan joyida (bu yerda) qat'iy bloklanadi.
      if (!sellerSnap.exists || seller.status === "suspended") {
        throw new HttpsError("failed-precondition", "Bu do'kon hozircha buyurtma qabul qilmayapti.");
      }

      // 2026-09 punkt-royxati (to'lov turi endi MAHSULOT emas, SOTUVCHI
      // darajasida markazlashtirilgan — `sellers/{id}.paymentTypes`,
      // "To'lovlar va Tariflar" sozlamasi): mijoz tanlagan usul
      // (`paymentMethod`) albatta shu ro'yxatda bo'lishi SHART - aks
      // holda (masalan mijoz ilovani chetlab, funksiyani to'g'ridan-
      // to'g'ri chaqirsa) sotuvchi O'CHIRIB QO'YGAN to'lov usulini
      // baribir majburlab ishlatib bo'lardi. Sozlama hali sotuvchi
      // tomonidan tanlanmagan (eski) do'konlar uchun standart - FAQAT
      // "naqd" (`["cod"]`) - chunki bu hech qanday qo'shimcha
      // sozlashni talab qilmaydi va hech qachon ishlamay qolmaydi
      // (karta uchun esa "Jismoniy shaxs" ma'lumotlari kerak).
      const sellerPaymentTypes = Array.isArray(seller.paymentTypes) && seller.paymentTypes.length > 0
        ? seller.paymentTypes
        : ["cod"];
      const requiredPaymentType = paymentMethod === "card" ? "prepay" : "cod";
      if (!sellerPaymentTypes.includes(requiredPaymentType)) {
        throw new HttpsError("failed-precondition", "Bu to'lov usuli bu do'kon uchun mavjud emas.");
      }

      // 2) Promokodni — agar berilgan bo'lsa — HAQIQIY qoidalar
      // bo'yicha qayta tekshiramiz (mijoz "discountAmount"iga
      // ishonmaymiz).
      let appliedCoupon = null;
      let discountAmount = 0;
      let couponRef = null;
      // Hamkor/blogger kodi (#117): agar promokod sotuvchi tomonidan
      // ANIQ bir hamkorga bog'langan bo'lsa (`coupon.partnerName`
      // to'ldirilgan bo'lsa), shu nomni keyinroq (pastda, `totalAmount`
      // hisoblanganidan KEYIN) hamkorning sotuv statistikasini
      // yozishda ishlatamiz - shuning uchun `coupon` obyektining o'zi
      // block-scope tashqarisiga chiqmaydi, faqat kerakli maydon.
      let appliedCouponPartnerName = null;

      if (couponCode) {
        const normalizedCode = String(couponCode).trim().toUpperCase();
        couponRef = firestore.collection("sellers").doc(sellerId).collection("coupons").doc(normalizedCode);
        const couponSnap = await transaction.get(couponRef);

        if (!couponSnap.exists) {
          throw new HttpsError("not-found", "Bunday promokod topilmadi.");
        }
        const coupon = couponSnap.data();

        if (!coupon.isActive) {
          throw new HttpsError("failed-precondition", "Bu promokod faol emas.");
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
          throw new HttpsError("failed-precondition", "Bu promokodning muddati tugagan.");
        }
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          throw new HttpsError("failed-precondition", "Bu promokodning ishlatish limiti tugagan.");
        }

        discountAmount = coupon.discountType === "percent"
          ? Math.round((subtotal * coupon.discountValue) / 100)
          : Math.min(coupon.discountValue, subtotal);

        appliedCoupon = { code: normalizedCode, discountAmount };
        if (typeof coupon.partnerName === "string" && coupon.partnerName.trim()) {
          appliedCouponPartnerName = coupon.partnerName.trim();
        }
      }

      // 2.5) Referal dasturi: agar bu mijoz do'sti orqali taklif
      // qilingan bo'lsa, aynan shu sotuvchi uchun, va bu chegirmani
      // hali ishlatmagan bo'lsa - birinchi buyurtmasiga avtomatik
      // chegirma qo'llanadi. Ataylab promokod bilan bir vaqtda
      // qo'llanmaydi (faqat couponCode berilmagan holatda ishlaydi) -
      // ikki chegirmani bir-biriga qo'shib, suiiste'mol qilishning
      // (masalan sun'iy hisoblar yaratib, ikkalasini ham olishning)
      // oldini olish uchun.
      //
      // Atomiklik: "referralDiscountUsed" belgisi shu yagona
      // tranzaksiya ichida o'qiladi va yoziladi - shuning uchun mijoz
      // bir vaqtning o'zida ikkita buyurtma yuborishga urinsa ham,
      // chegirma faqat bittasiga tegishi kafolatlanadi.
      let referralApplied = null;
      let referralRewardCouponCode = null;
      const referralEligible =
        !couponCode &&
        client.referredBy &&
        client.referredForSellerId === sellerId &&
        !client.referralDiscountUsed &&
        seller.referralProgramEnabled !== false; // standart bo'yicha yoqilgan, faqat aniq false bo'lsa o'chadi

      if (referralEligible) {
        const percent = Number(seller.referralDiscountPercent) > 0 ? Number(seller.referralDiscountPercent) : 10;
        discountAmount = Math.round((subtotal * percent) / 100);
        referralApplied = { referrerId: client.referredBy, discountPercent: percent, discountAmount };
      }

      // 2.55) Combo ("bandl") taklifi: agar mijoz combo sifatida
      // taklif qilingan mahsulotlar to'plamini (`bundleId`) sotib
      // olayotgan bo'lsa, sotuvchi belgilagan BIRLASHGAN narxni shu
      // yerda, HOZIRGI (yuqorida hisoblangan `orderItems`dagi haqiqiy)
      // narxlardan QAYTA hisoblab tekshiramiz - mijoz UI'da ko'rgan
      // "tejash" summasiga ishonilmaydi. Kupon/referal bilan BIRGA
      // ishlatilishi mumkin (bandl - narx siyosati, kupon/referalning
      // bir-birini istisno qilish sababi - suiiste'mol - bu yerga
      // tegishli emas).
      let bundleDiscountAmount = 0;
      let appliedBundle = null;
      if (bundleId) {
        const bundleRef = firestore.collection("sellers").doc(sellerId).collection("bundles").doc(String(bundleId));
        const bundleSnap = await transaction.get(bundleRef);
        if (!bundleSnap.exists) {
          throw new HttpsError("not-found", "Bunday combo taklif topilmadi.");
        }
        const bundle = bundleSnap.data();
        if (!bundle.isActive) {
          throw new HttpsError("failed-precondition", "Bu combo taklif hozir faol emas.");
        }
        const bundleProductIds = Array.isArray(bundle.productIds) ? bundle.productIds : [];
        if (bundleProductIds.length < 2) {
          throw new HttpsError("failed-precondition", "Bu combo taklif noto'g'ri sozlangan.");
        }
        // Combo narxi qo'llanishi uchun - HAR BIR combo mahsuloti
        // savatda KAMIDA 1 donadan bo'lishi shart.
        const allPresent = bundleProductIds.every((pid) =>
          orderItems.some((item) => item.id === pid && item.quantity >= 1)
        );
        if (!allPresent) {
          throw new HttpsError("failed-precondition", "Combo uchun barcha mahsulotlar savatda bo'lishi kerak.");
        }
        const individualSum = bundleProductIds.reduce((sum, pid) => {
          const item = orderItems.find((oi) => oi.id === pid);
          return sum + (item ? item.price : 0); // bitta donaning HAQIQIY (chegirma bilan) narxi
        }, 0);
        bundleDiscountAmount = Math.max(0, individualSum - (Number(bundle.bundlePrice) || 0));
        appliedBundle = { bundleId: bundleRef.id, name: bundle.name || null, discountAmount: bundleDiscountAmount };
      }

      const amountAfterDiscount = Math.max(0, subtotal - discountAmount - bundleDiscountAmount);

      // 2.6) Sodiqlik dasturi ("Bonus hisobi"): mijoz oldingi
      // yetkazib berilgan buyurtmalaridan yig'gan bonusini shu
      // buyurtmada ISHLATISHI mumkin. Checkout'da ko'rsatilgan/
      // tanlangan miqdorga (`redeemBonusAmount`) ASLO ishonilmaydi -
      // haqiqiy balans (`customerRollupSnap`), sotuvchi bu dasturni
      // yoqqan-yoqmaganligi VA sotuvchi belgilagan eng yuqori foiz
      // chegarasi (`loyaltyMaxRedeemPercent`) shu yerda, serverda
      // QAYTA tekshiriladi. Kupon/referal chegirmasi bilan BIRGA
      // ishlatilishi mumkin (bonus - mijozning O'ZI yig'gan puli,
      // kupon/referalning bir-birini istisno qilishidagi
      // suiiste'mol xavfi bu yerda yo'q).
      const customerRollup = customerRollupSnap.exists ? customerRollupSnap.data() : {};
      let bonusRedeemed = 0;
      const requestedRedeem = Number(redeemBonusAmount) > 0 ? Math.floor(Number(redeemBonusAmount)) : 0;
      if (requestedRedeem > 0 && seller.loyaltyEnabled) {
        const availableBonusBalance = Math.max(0, Number(customerRollup.bonusBalance) || 0);
        const maxRedeemPercent = Number(seller.loyaltyMaxRedeemPercent) > 0 ? Number(seller.loyaltyMaxRedeemPercent) : 50;
        const maxRedeemByPercent = Math.floor((amountAfterDiscount * maxRedeemPercent) / 100);
        bonusRedeemed = Math.min(requestedRedeem, availableBonusBalance, maxRedeemByPercent, amountAfterDiscount);
      }
      const amountAfterBonus = Math.max(0, amountAfterDiscount - bonusRedeemed);

      // 3) Yetkazib berish narxini sotuvchi sozlamasidan hisoblaymiz
      // (mijoz hech qanday narx yubormaydi — faqat o'z hududini).
      //
      // Mijoz faqat o'z hududini yuboradi (`customerRegion`) - server
      // esa buni sotuvchining o'z hududi (`seller.region`) bilan
      // solishtirib, qaysi narx bosqichi (Shahar/Tumanlar/Boshqa
      // viloyat) qo'llanilishini o'zi hisoblab chiqadi
      // (`resolveDeliveryTier` - `lib/deliveryTiers.js`, frontenddagi
      // bilan bir xil mantiq). Bu, mijoz tomonidan mintaqa kalitining
      // to'g'ridan-to'g'ri yuborilishiga (va shu orqali narx
      // bosqichini soxtalashtirishga) yo'l qo'ymaydi.
      let deliveryZone = null;
      let deliveryFee = 0;

      const deliveryTierKey = resolveDeliveryTier(seller.region, customerRegion);
      const tierConfig = deliveryTierKey ? seller.deliveryTiers?.[deliveryTierKey] : null;

      // 2026-09 punkt-royxati, 15-band: xaridor tanlagan yetkazib
      // berish VAQT ORALIG'INI shu yerda, YAKUNIY ravishda tasdiqlaymiz
      // (frontend faqat UX uchun ko'rsatadi — `Checkout.jsx`, haqiqiy
      // manba emas). `getMinLeadHours` xuddi shu `deliveryTierKey`dan
      // (yuqorida hisoblangan) foydalanadi - "boshqa hudud" bo'lsa 27
      // soat, aks holda 3 soat.
      const minLeadHours = getMinLeadHours(deliveryTierKey);
      const deliverySlotOpts = {
        nowMs: Date.now(),
        minLeadHours,
        workingHoursOpen: seller.workingHoursOpen || "10:00",
        workingHoursClose: seller.workingHoursClose || "19:00",
      };
      const rawSlot = customerData?.deliveryTimeSlot;
      const submittedSlot = rawSlot ? { startMs: Number(rawSlot.start), endMs: Number(rawSlot.end) } : null;
      if (!isValidDeliverySlot(submittedSlot, deliverySlotOpts)) {
        throw new HttpsError("invalid-argument", "Yetkazib berish vaqtini to'g'ri tanlang.");
      }

      if (tierConfig && Number(tierConfig.price) > 0) {
        // MUHIM: bepul yetkazib berish chegarasi mijoz haqiqatan
        // TO'LAYDIGAN summaga (kupon/referal VA bonusdan keyingi)
        // nisbatan tekshiriladi - aks holda mijoz butun buyurtmani
        // bonus bilan yopib, baribir "chegaradan yuqori" hisoblanib,
        // bepul yetkazib berishga ega bo'lib qolishi mumkin edi.
        const isFreeDelivery = seller.freeDeliveryEnabled &&
          seller.freeDeliveryThreshold &&
          amountAfterBonus >= Number(seller.freeDeliveryThreshold);

        deliveryFee = isFreeDelivery ? 0 : (Number(tierConfig.price) || 0);
        deliveryZone = {
          tier: deliveryTierKey,
          customerRegion: customerRegion || null,
          price: deliveryFee,
          days: tierConfig.days || null,
          isFree: isFreeDelivery,
        };
      }

      const totalAmount = amountAfterBonus + deliveryFee;

      // HAMKOR/BLOGGER KODI SOTUV KUZATUVI (#117): agar ishlatilgan
      // promokod ANIQ bir hamkorga bog'langan bo'lsa (`partnerName`),
      // shu hamkorning YIG'MA statistikasini (buyurtmalar soni +
      // umumiy summa) shu YERDA, bitta tranzaksiya ichida, ATOMIK
      // ravishda oshiramiz - xuddi `referralCounts`dagi kabi, HAR
      // safar BARCHA buyurtmalarni qayta skanerlash o'rniga (arzon,
      // tayyor o'qish). `totalAmount` — yetkazib berish narxi VA
      // barcha chegirmalardan KEYINGI, mijoz HAQIQATDA to'lagan
      // summa; bu "hamkor QANCHA HAQIQIY savdo keltirdi" degan savolga
      // to'g'ridan-to'g'ri javob beradi.
      if (appliedCoupon && appliedCouponPartnerName) {
        const partnerStatsRef = firestore.collection("sellers").doc(sellerId)
          .collection("partnerCodeStats").doc(appliedCoupon.code);
        transaction.set(partnerStatsRef, {
          code: appliedCoupon.code,
          partnerName: appliedCouponPartnerName,
          orderCount: admin.firestore.FieldValue.increment(1),
          totalRevenue: admin.firestore.FieldValue.increment(totalAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // "BO'LIB TO'LASH" (installment) - FAQAT "karta orqali"
      // to'lovda, FAQAT sotuvchi shu funksiyani ONGLI ravishda
      // yoqqan bo'lsa VA mijoz ANIQ sotuvchi belgilagan qismlar
      // soniga so'ragan bo'lsa qo'llaniladi. Har qanday boshqa
      // holatda (funksiya o'chirilgan, yoki mijoz mos kelmaydigan son
      // yuborgan) - xato TASHLAMAYDI, jim ravishda oddiy, BIR
      // MARTALIK to'lovga qaytiladi (xavfsiz standart). Qismlarga
      // bo'linish HAQIQIY, server tomonida hisoblangan `totalAmount`
      // asosida - mijoz tomonidan yuborilgan hech qanday summaga
      // ishonilmaydi.
      let installmentPlan = null;
      if (
        paymentMethod === "card" &&
        seller.installmentPaymentEnabled === true &&
        Number(seller.installmentParts) >= 2 &&
        Number(customerData?.installments) === Number(seller.installmentParts)
      ) {
        const amounts = computeInstallmentAmounts(totalAmount, seller.installmentParts);
        installmentPlan = {
          totalParts: amounts.length,
          partsPaid: 1,
          totalAmount,
          amounts,
          payments: [
            { index: 0, amount: amounts[0], receiptUrl: customerData.paymentReceiptUrl, submittedAtMs: Date.now() },
          ],
        };
      }

      // 4) Ombor qoldig'ini kamaytiramiz va "sotilganlar" sonini
      // oshiramiz (har bir mahsulot uchun, bir xil yozuvda — ikkalasi
      // ham har doim birga, izchil o'zgarishi uchun, aks holda
      // mahsulot kartochkasidagi "sotildi" ko'rsatkichi ombor
      // qoldig'idan uzilib qolishi mumkin).
      // "Bugun sotildi" ijtimoiy isbot belgisi (#119) - HAQIQIY,
      // shu kun ichidagi sotuvlar soni (batafsil izoh:
      // `lib/dailySoldCounter.js`). Hech qanday qo'shimcha o'qish
      // shart emas - `productSnaps[i]` yuqorida shu tranzaksiya
      // orqali allaqachon o'qilgan.
      const todayDateId = todayDocId();
      productRefs.forEach((ref, i) => {
        const newStock = Number(productSnaps[i].data().stock) - orderItems[i].quantity;
        const dailySoldUpdate = computeDailySoldCountUpdate(productSnaps[i].data(), todayDateId, orderItems[i].quantity);
        transaction.update(ref, {
          stock: Math.max(0, newStock),
          sold: admin.firestore.FieldValue.increment(orderItems[i].quantity),
          soldTodayCount: dailySoldUpdate.soldTodayCount,
          soldTodayDate: dailySoldUpdate.soldTodayDate,
          // "KAM SOTILAYOTGAN MAHSULOT" AVTOMATLASHTIRISH TRIGGERI
          // (2026-09, "Buyruq Markazi/Avtomatlashtirish kengaytmasi"):
          // `functions/automationRules.js`dagi `slow_moving_product`
          // trigger'i shu maydonni o'qiydi ("oxirgi marta QACHON
          // sotilgan") — mahsulot yaratilganda ham (`addProduct.js`)
          // boshlang'ich qiymat sifatida beriladi, shunda yangi
          // qo'shilgan mahsulot darhol "sotilmayapti" deb belgilanmaydi
          // (yaratilish vaqtidan hisoblangan muhlat beriladi).
          lastSoldAtMs: Date.now(),
          // ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati"):
          // `functions/products.js`dagi `onProductWriteUpdateStockAudit`
          // trigger shu maydonlarni o'qib, `sellers/{id}/stockAuditLog`ga
          // "order_sale" sababli avtomatik yozuv qo'shadi — batafsil
          // izoh: `lib/stockAuditLog.js`. `order_sale` FAQAT shu yerda
          // (Admin SDK) yozilishi mumkin, `firestore.rules` buni mijoz
          // SDK'idan TAQIQLAYDI.
          lastStockChangeReason: "order_sale",
          lastStockChangeOrderRef: orderRef.id,
          lastStockChangeOrderNumber: orderNumber,
        });
      });

      // 5) Promokod ishlatilish sonini oshiramiz (agar bo'lsa).
      if (couponRef) {
        transaction.update(couponRef, { usedCount: admin.firestore.FieldValue.increment(1) });
      }

      // 5.3) Sodiqlik dasturi: ishlatilgan bonusni mijozning
      // balansidan ayiramiz. `set(..., {merge:true})` ishlatiladi
      // (`update` emas) - agar bu mijozning shu sotuvchi uchun
      // birinchi bonus-bog'liq amali bo'lsa, hujjat hali umuman
      // mavjud bo'lmasligi mumkin (`orderRollups.js` uni faqat
      // birinchi YETKAZILGAN buyurtmadan keyin yaratadi) - lekin bu
      // holatda `bonusRedeemed` allaqachon 0 bo'ladi (yuqoridagi
      // `availableBonusBalance` hisobi tufayli), shuning uchun bu
      // yozuv faqat HAQIQIY balans mavjud bo'lgandagina ishga tushadi.
      if (bonusRedeemed > 0) {
        transaction.set(customerRollupRef, { bonusBalance: admin.firestore.FieldValue.increment(-bonusRedeemed) }, { merge: true });
      }

      // 5.5) Referal mukofoti: agar yuqorida referal chegirmasi
      // qo'llangan bo'lsa - (a) mijozda "ishlatildi" belgisini
      // qo'yamiz (bir xil chegirma ikkinchi marta berilmasligi
      // uchun), (b) taklif qilgan kishiga, keyingi xaridi uchun
      // ishlatadigan yangi promokod yaratamiz. Barchasi shu bitta
      // tranzaksiya doirasida - yoki hammasi muvaffaqiyatli bo'ladi,
      // yoki hech biri (Firestore transaction kafolati).
      if (referralApplied) {
        transaction.update(clientRef, { referralDiscountUsed: true });

        referralRewardCouponCode = `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const rewardCouponRef = firestore.collection("sellers").doc(sellerId).collection("coupons").doc(referralRewardCouponCode);
        transaction.set(rewardCouponRef, {
          code: referralRewardCouponCode,
          discountType: "percent",
          discountValue: referralApplied.discountPercent,
          expiresAt: null,
          usageLimit: 1,
          usedCount: 0,
          isActive: true,
          isReferralReward: true,
          rewardForClientId: referralApplied.referrerId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAtMs: Date.now(),
        });

        // Kuzatuv/statistika uchun - sotuvchi panelida "kim kimni
        // taklif qildi" ko'rinishi mumkin bo'lsin.
        const referralRecordRef = firestore.collection("sellers").doc(sellerId).collection("referrals").doc(clientId);
        transaction.set(referralRecordRef, {
          referrerId: referralApplied.referrerId,
          refereeId: clientId,
          rewardCouponCode: referralRewardCouponCode,
          refereeDiscountAmount: referralApplied.discountAmount,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // REFERAL REYTINGI (`clientReferrals.js`dagi `getReferralLeaderboard`):
        // OLDIN reyting HAR SAFAR yuqoridagi `referrals` quyi
        // kolleksiyasini TO'LIQ (500 tagacha) qayta o'qib, so'rov
        // vaqtida hisoblanardi - sotuvchida 500 tadan ortiq referal
        // yozuvi to'planganda, TOP-10 NOTO'G'RI/to'liqsiz chiqishi
        // mumkin edi (Firestore `orderBy`siz `limit` - qaysi 500 ta
        // qaytishi KAFOLATLANMAGAN). ENDI - har bir muvaffaqiyatli
        // referal shu YERDA, bitta doimiy hisoblagichga (`referralCounts`)
        // qo'shiladi - reyting endi hajmdan qat'i nazar BIR XIL
        // tezlikda, TO'G'RI hisoblanadi.
        const referralCountRef = firestore.collection("sellers").doc(sellerId)
          .collection("referralCounts").doc(referralApplied.referrerId);
        transaction.set(referralCountRef, {
          count: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        // "HAFTALIK G'OLIB" mukofoti uchun (`referralLeaderboardBonus.js`) -
        // yuqoridagi bilan BIR XIL voqeadan, lekin FAQAT shu haftaga
        // tegishli alohida hisoblagich - doimiy reytingdan farqli
        // o'laroq, bu HAR HAFTA nolldan boshlanadi (bir kishi har doim
        // g'olib chiqavermasligi, mijozlar har hafta qayta faollashishi
        // uchun).
        const weekKey = computeIsoWeekKey();
        const weeklyCountRef = firestore.collection("sellers").doc(sellerId)
          .collection("referralWeeklyCounts").doc(weekKey);
        transaction.set(weeklyCountRef, {
          counts: { [referralApplied.referrerId]: admin.firestore.FieldValue.increment(1) },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // 5.7) "Tashlab ketilgan savat" eslatmasi uchun saqlangan savat
      // hujjatini o'chiramiz - buyurtma muvaffaqiyatli yaratilganda,
      // bu savat endi "tashlab ketilgan" emas, shuning uchun keyingi
      // eslatma tekshiruvida (`functions/carts.js`) ko'rib
      // chiqilmasligi kerak. Hujjat mavjud bo'lmasa ham xato bermaydi
      // (Firestore transaction.delete xavfsiz no-op).
      const cartRef = firestore.collection("carts").doc(`${sellerId}_${clientId}`);
      transaction.delete(cartRef);

      // TUG'ILGAN KUN CHEGIRMASI (`functions/birthdayRewards.js`) uchun:
      // mijoz ENDI shu sotuvchidan buyurtma berganini global
      // `clients/{clientId}` hujjatida qayd etamiz. Kunlik tug'ilgan kun
      // tekshiruvi ANIQ shu ro'yxat orqali, "bugun tug'ilgan kuni bo'lgan
      // mijoz QAYSI sotuvchi(lar)ning xaridori" ekanini biladi - aks
      // holda HAR BIR sotuvchini HAR BIR tug'ilgan kunlik mijoz uchun
      // alohida tekshirish kerak bo'lardi (juda qimmat so'rov).
      transaction.set(clientRef, { linkedSellerIds: admin.firestore.FieldValue.arrayUnion(sellerId) }, { merge: true });

      // 6) Buyurtmani yaratamiz (`orderRef` — yuqorida, tranzaksiya
      // boshida allaqachon generatsiya qilingan).
      transaction.set(orderRef, {
        sellerId,
        clientId,
        orderNumber,
        customer: {
          fullName: customerData.fullName.trim(),
          phone: customerData.phone.trim(),
          address: customerData.address || "",
          location: customerData.location || null,
          paymentTypes: Array.isArray(customerData.paymentTypes) ? customerData.paymentTypes : [],
        },
        orders: orderItems,
        status: "new",
        paymentMethod,
        paymentReceiptUrl: paymentMethod === "card" ? customerData.paymentReceiptUrl : null,
        installmentPlan,
        subtotal,
        appliedCoupon,
        referralDiscount: referralApplied ? { discountPercent: referralApplied.discountPercent, discountAmount: referralApplied.discountAmount } : null,
        appliedBundle,
        loyaltyBonusRedeemed: bonusRedeemed,
        // Kelajakda ("delivered"ga o'tganda) bonus QANCHA summadan
        // (yetkazib berish narxisiz, barcha chegirmalardan keyingi
        // sof summa) ishlanishini shu yerda, HOZIR "suratga olamiz" -
        // batafsil izoh: `lib/rollups.js`dagi `computeLoyaltyEarnDelta`.
        loyaltyBonusEarnBase: amountAfterBonus,
        deliveryZone,
        deliveryTimeSlot: { start: submittedSlot.startMs, end: submittedSlot.endMs },
        totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Tannarx suratini (yuqoridagi izohga qarang) - ALOHIDA, faqat
      // sotuvchiga ko'rinadigan hujjatga, xuddi shu orderRef.id bilan
      // yozamiz (`orderRollups.js` trigger'i buyurtma "delivered"ga
      // o'tganda shu hujjatni qidiradi).
      const orderCostRef = firestore.collection("sellers").doc(sellerId).collection("orderCosts").doc(orderRef.id);
      transaction.set(orderCostRef, {
        items: costSnapshotItems,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Hisoblagichni shu tranzaksiya ichida, atomik ravishda
      // yangilaymiz - shu orqali, hatto ikkita mijoz bir vaqtning
      // o'zida buyurtma bersa ham, ikkitasi hech qachon bir xil
      // tartib raqamini olmaydi (Firestore tranzaksiyasi buni
      // kafolatlaydi - to'qnashuv bo'lsa, biri avtomatik qayta
      // urinadi).
      transaction.set(orderCounterRef, { count: orderNumber }, { merge: true });

      return { orderId: orderRef.id, orderNumber, subtotal, discountAmount, bundleDiscountAmount, appliedBundle, bonusRedeemed, installmentPlan, deliveryZone, totalAmount, appliedCoupon, referralDiscount: referralApplied, referralRewardCouponCode };
    });

    // Referal mukofoti haqidagi Telegram xabari ataylab
    // tranzaksiyadan tashqarida yuboriladi. Tranzaksiya ichida
    // yuborilganda, Firestore tranzaksiyasi to'qnashuv (contention)
    // tufayli qayta urinishi mumkin bo'lardi - bu esa har bir qayta
    // urinishda xabar qayta-qayta yuborilishiga olib kelardi. Shu
    // sabab xabar faqat tranzaksiya muvaffaqiyatli yakunlangandan
    // keyin, bir marta yuboriladi.
    if (result.referralDiscount && result.referralRewardCouponCode) {
      try {
        // Mijozga xabar avval sotuvchining shaxsiy boti orqali
        // yuboriladi, platforma boti faqat zaxira (batafsil izoh:
        // `lib/customerNotify.js`).
        const customBotToken = await getSellerCustomBotToken(sellerId);
        const text = `Tabriklaymiz!\n\nSiz taklif qilgan do'stingiz birinchi xaridini amalga oshirdi.\n\nSizga ${result.referralDiscount.discountPercent}% chegirmali promokod berildi:\n${result.referralRewardCouponCode}\n\nKeyingi xaridingizda ishlating!`;
        await sendCustomerNotification(customBotToken, result.referralDiscount.referrerId, text);
        await logNotification({
          sellerId, clientId: result.referralDiscount.referrerId, type: "referralReward",
          title: "Referal mukofoti", message: text,
        });
      } catch (notifyErr) {
        // Bu xabar yuborilmasa ham, buyurtmaning o'zi va promokod
        // allaqachon muvaffaqiyatli yaratilgan - shuning uchun bu
        // yerdagi xatolik buyurtmani bekor qilmasligi kerak, faqat
        // logga yoziladi.
        console.error("Referal mukofoti haqida xabar yuborishda xatolik:", notifyErr);
      }
    }

    return result;
  } catch (err) {
    console.error("Xavfsiz buyurtma yaratishda xatolik:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Buyurtma yaratib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

exports.createOrder = onCall({ region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN] }, withSentry(handleCreateOrder));

// Sinov (test) fayllari uchun.
exports._testables = { handleCreateOrder };
