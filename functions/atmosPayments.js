const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { admin, db, BOT_TOKEN } = require("./lib/admin");
const { sendTelegramMessage, buildSellerAppLink } = require("./lib/helpers");
const { checkRateLimit } = require("./lib/rateLimit");
const { processBatched } = require("./lib/batchProcess");
const { withSentry, initSentry, Sentry, SENTRY_DSN } = require("./lib/sentry");
const {
  ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_ENV,
  ATMOS_PROXY_TOKEN,
  createTransaction, buildCheckoutUrl, getTransaction, verifyCallbackSign,
} = require("./lib/atmosClient");
const {
  TARIFF_MONTHLY_PRICE_SOM, TARIFF_BILLING_PERIOD_DAYS, TARIFF_BILLING_CUTOFF_MS,
  computeAiCeoEnabledForPlan, isTariffPurchasable, isTariffPastDue, paidUntilMs,
} = require("./lib/tariffs");

/**
 * Z-TARIFLAR — HAQIQIY (ATMOS) TO'LOV TIZIMI (2026-09).
 *
 * ARXITEKTURA (foydalanuvchi bilan tasdiqlangan qarorlar):
 *   1. Faqat TARIF (Z-Start/Z-Pro) to'lovi — mahsulot/checkout to'lovi
 *      hamon eski, decentralizatsiyalashgan strukturada qoladi
 *      (`sellers/{id}/private`dagi shaxsiy Click/Payme hisobi orqali,
 *      yoki naqd — `functions/orders.js`, bu faylga ALOQASI YO'Q).
 *      Atmos bu yerda FAQAT sotuvchi ZeloShop'ning O'ZIGA to'laydigan
 *      pulni qabul qiladi — hech qanday "split"/marketplace-routing
 *      shart emas (bu Atmos'da mavjud ham emas).
 *   2. TO'LOV DAVRI — oylik, QO'LDA yangilanadi (karta saqlanmaydi,
 *      har safar yangi to'lov — Atmos'ning "hosted checkout" sahifasi
 *      orqali, bizning serverimiz xom karta ma'lumotini HECH QACHON
 *      ko'rmaydi, batafsil: `lib/atmosClient.js`).
 *   3. ESKI (bu sanadan OLDIN ro'yxatdan o'tgan) sotuvchilar
 *      "grandfather" qilinadi — Z-Start ular uchun HAMON bepul,
 *      to'lov HECH QACHON so'ralmaydi (`lib/tariffs.js`dagi
 *      `TARIFF_BILLING_CUTOFF_MS`/`isBillingRequired`).
 *
 * OQIM — 2026-09-25'DA ESKI `/merchant/pay/create` YO'LIGA QAYTARILDI
 * (MUHIM TARIX, KEYINGI KIMDIR "nega checkout/invoice/create emas"
 * deb so'ramasin uchun batafsil yozilmoqda):
 *
 *   - 2026-09-14: Atmos xodimi ANIQ "sandbox test uchun checkout/
 *     invoice/create ishlating" degan edi, shu sabab oqim o'sha
 *     endpoint'ga o'tkazilgan edi (bu izohning O'ZI o'sha paytdan
 *     qolgan, pastda saqlanmoqda — tarixiy kontekst uchun).
 *   - 2026-09-15 — 2026-09-18 oralig'ida: `checkout/invoice/create`
 *     DOIMIY ravishda `-999998 "Invalid request format... Date format...
 *     snake_case"` xatosini qaytardi — o'nlab kombinatsiya sinaldi
 *     (`request_id` format, `store_id` turi, `expiration_date`/`_time`,
 *     `apikey` sarlavhasi, `items[].details[]`ning 5 XIL varianti —
 *     to'liq, oxirigacha, `empty_details`/`values_array`/`minimal_item`
 *     — HAMMASI bir xil xato). Diagnostika vositalari (`atmosProxyTest.js`,
 *     hozir ham loyihada, admin-only, qoldirilgan) orqali ANIQLANDI:
 *       (a) ESKI `/merchant/pay/create` ENDPOINTI (xuddi shu store_id/
 *           consumer key-secret bilan) DARHOL, TO'LIQ muvaffaqiyatli
 *           ishladi (`transactionId:257276` qaytardi) — demak
 *           store_id/kalitlar/proksi HAMMASI to'g'ri sozlangan, muammo
 *           FAQAT `checkout/invoice/create`ning o'ziga (yoki uning
 *           `items`/OFD-fiskal talabiga) xos;
 *       (b) `items[0]`da `details` KALITI MAVJUD bo'lganda (tarkibidan
 *           qat'i nazar) — doim `-999998`; `details` KALITI UMUMAN
 *           yo'q bo'lganda — BOSHQA xato (`-999999 "System error"`)
 *           chiqadi. Bu `details`ning ANIQ kutilgan formatini
 *           TOPOLMAGANIMIZNI, lekin muammo shu joyda ekanini tasdiqlaydi.
 *   - XULOSA (2026-09-25): `checkout/invoice/create`ning to'g'ri
 *     `items`/OFD formati Atmos qo'llab-quvvatlash xizmati bilan
 *     ALOHIDA aniqlashtirilishi kerak (bu hamon OCHIQ savol) — shu
 *     kutish sotuvchilarni to'lovsiz qoldirmasligi uchun, ISHLAYOTGANI
 *     ISBOTLANGAN eski `/merchant/pay/create` yo'liga QAYTARILDI.
 *     BU — PRAGMATIK VAQTINCHALIK YECHIM, "to'g'ri" yechim emas: Atmos
 *     o'zi "checkout/invoice/create ishlating" degan, va bu eski yo'lda
 *     OFD-fiskal ma'lumot UMUMAN yuborilmaydi (`buildTariffInvoiceItems`
 *     endi chaqirilmaydi, lekin kelajakda kerak bo'lib qolishi mumkinligi
 *     uchun pastda saqlanadi). Atmos javob bergach, `createTariffPayment`
 *     ichidagi `createTransaction`+`buildCheckoutUrl` chaqiruvini qayta
 *     `createCheckoutInvoice`ga almashtirish YETARLI (funksiya interfeysi
 *     — `{transactionId, checkoutUrl, amountSom}` — o'zgarmaydi, frontend
 *     buzilmaydi). Uzoqroq muddatda, ATMOS'ning "Card Linking + Recurring
 *     Payments" (`lib/atmosClient.js`dagi `bindCardInit`/`bindCardConfirm`/
 *     `createTransaction({cardToken})`) orqali sotuvchi kartasini BIR
 *     MARTA bog'lab, har oy AVTOMATIK yechib olish ham ko'rib chiqilishi
 *     mumkin — hozircha FAQAT diagnostika sifatida mavjud
 *     (`atmosProxyTest.js`), productionda ishlatilmaydi (PCI-DSS
 *     sababli, batafsil: `lib/atmosClient.js`).
 *
 *   YANGI OQIM: `createTariffPayment` → Atmos'da chernovik tranzaksiya
 *   yaratadi (`createTransaction`, `/merchant/pay/create`) → qaytgan
 *   RAQAMLI `transactionId` bilan hosted checkout havolasini quradi
 *   (`buildCheckoutUrl`) → sotuvchi shu havolaga o'tadi (Atmos'ning
 *   O'Z sahifasi, bizning serverimiz karta ma'lumotini HECH QACHON
 *   ko'rmaydi) → to'lov muvaffaqiyatli bo'lsa, Atmos bizning
 *   `atmosPaymentCallback` webhook'imizga xabar beradi (HAQIQIY
 *   tasdiqlash manbai — redirect emas) → `activateTariffPayment`
 *   `tariffPlan`/`tariffPaidUntil`ni yangilaydi. `getTariffPaymentStatus`
 *   esa frontend redirect'dan qaytgach holatni tekshirish/tezlashtirish
 *   (callback kechiksa, Atmos'dan `getTransaction`/`/merchant/pay/get`
 *   orqali to'g'ridan-to'g'ri so'rab, ZAXIRA yo'l bilan) uchun.
 *
 * FIRESTORE HUJJAT KALITI: `atmosPayments/{id}` ENDI (qaytadan) Atmos
 * qaytargan RAQAMLI `transactionId` bilan kalitlanadi (checkout/invoice/
 * create davridagi bizning oldindan-generatsiya qilingan `requestId`
 * EMAS) — buning muammosi yo'q, chunki `/merchant/pay/create`da
 * `redirectLink` alohida, `buildCheckoutUrl`da, transactionId Atmos'dan
 * QAYTGANDAN KEYIN quriladi (checkout/invoice/create'dagi kabi
 * "success_url oldindan kerak" muammosi bu yo'lda yo'q). Frontend
 * kontrakti (`?atmosTxn=...`, `getTariffPaymentStatus({transactionId})`)
 * o'zgarmadi — faqat qiymat endi Atmos'ning raqamli transaction_id'i
 * (satr sifatida).
 *
 * CALLBACK QIDIRUVI SODDALASHTI: `invoice`ning `payment_id`ga
 * tengligi haqidagi taxmin (ESKI izoh, pastda saqlangan) ENDI KERAK
 * EMAS — Firestore hujjati bevosita `transaction_id` bo'yicha
 * (webhook'ning eng ishonchli, hujjatlashtirilgan maydoni) topiladi.
 */

const PENDING_REUSE_WINDOW_MS = 30 * 60 * 1000; // 30 daqiqa ichida yaratilgan, hali to'lanmagan tranzaksiyani qayta ishlatamiz (dublikat oldini olish).
const REMINDER_WINDOW_DAYS = 3; // Muddat tugashiga shuncha kun qolganda eslatma.

function amountTiyinFor(plan) {
  return Math.round(TARIFF_MONTHLY_PRICE_SOM[plan] * 100);
}

/**
 * `checkout/invoice/create` uchun OFD/fiskal `items[]` massivi — FAQAT
 * shu ikkita qiymat foydalanuvchi (ZeloShop MChJ) tomonidan 2026-09-14
 * ANIQ berilgan, HECH NARSA fabrikatsiya qilinmagan:
 *   - ИКПУ kodi (dasturiy ta'minot/SaaS xizmati toifasi): 10305008003000000.
 *   - STIR (ZeloShop MChJ): 313278793.
 *
 * `package_code`/`mark_code` ATAYLAB BO'SH qoldirilgan — булар jismoniy
 * tovarga xos maydonlar (o'ram kodi/markirovka kodi), bizning holatimiz
 * esa jismoniy tovar EMAS (tarif/obuna xizmati). Bu Atmos bilan HALI
 * TASDIQLANMAGAN taxmin — sandbox to'lovida `items`/OFD xatosi chiqsa,
 * BIRINCHI shu ikki maydonni tekshiring.
 */
const TARIFF_SERVICE_IKPU_CODE = "10305008003000000"; // [stated, 2026-09-14]
const ZELOSHOP_TIN = "313278793"; // [stated, 2026-09-14]

const TARIFF_PLAN_INVOICE_LABEL = { start: "Z-Start", pro: "Z-Pro", biznes: "Z-Biznes" };

// MUHIM (2026-09-14, real sandbox xatosidan keyin qo'shildi): `checkout/
// invoice/create` hujjatida `expiration_time`/`expiration_date` IKKALASI
// HAM "majburiy emas" deb belgilangan, LEKIN Atmos'ning o'zi doimiy
// ravishda "Date format must be yyyy-MM-dd'T'HH:mm:ss..." degan xato
// qaytarayotgani sababli (garchi bu matn boshqa xatolar uchun HAM
// chiqadigan umumiy shablon bo'lsa-da) — ehtiyot chorasi sifatida
// ikkalasini ham, hujjat NAMUNASIDAGI aniq formatda ("yyyy-MM-ddTHH:mm:ss",
// millisekund/`Z` belgisisiz), qo'shib yubormoqdamiz. 24 soat — invoys
// ochiq turadigan oqilona muddat (sotuvchi to'lovni tugatishga vaqt topsin).
const TARIFF_INVOICE_EXPIRATION_MINUTES = 24 * 60;

function formatAtmosExpirationDate(minutesFromNow) {
  // `toISOString()` HAR DOIM UTC'da, millisekund+`Z` bilan qaytaradi
  // (masalan "2026-09-15T10:30:00.000Z") — `slice(0, 19)` aynan hujjat
  // talab qilgan "yyyy-MM-ddTHH:mm:ss" shaklini beradi.
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString().slice(0, 19);
}

function buildTariffInvoiceItems({ plan, amountTiyin }) {
  const label = TARIFF_PLAN_INVOICE_LABEL[plan] || plan;
  return [
    {
      items_id: plan,
      code: TARIFF_SERVICE_IKPU_CODE,
      // MUHIM (2026-09-15): AVVAL em-dash ("—", Unicode U+2014) ishlatilgan
      // edi — buning o'zi xatoga sabab bo'lishi DALILLANMAGAN (hujjatning
      // o'z javob namunalarida kirill harflari bor, ya'ni Unicode umuman
      // muammo emasligini ko'rsatadi), LEKIN arzon va xavfsiz tuzatish
      // bo'lgani uchun oddiy tire ("-") bilan almashtirildi — ehtiyot
      // chorasi sifatida, asosiy gumon (pastdagi `apikey` sarlavhasi) bilan
      // BIRGA sinash uchun.
      name: `ZeloShop - ${label} tarifi (oylik obuna)`,
      amount: amountTiyin,
      quantity: 1,
      // MUHIM (2026-09-14, real sandbox xatosidan keyin): AVVAL
      // `package_code`/`mark_code` uchun BO'SH qator ("") yuborilgan
      // edi — hujjatning o'z namunasida esa BARCHA `details[].values`
      // maydonlari BO'SH-BO'LMAGAN matn bilan to'ldirilgan
      // ("код упаковки" va h.k.). Atmos "Invalid request format" (umumiy,
      // aniq maydonni ko'rsatmaydigan) xato qaytargani uchun, BO'SH
      // qatorning o'zi FORMAT xatosi sifatida rad etilayotgan bo'lishi
      // mumkin degan gumon bilan — neytral placeholder ("0") qo'yildi.
      // HALI TASDIQLANMAGAN taxmin: agar bu yordam bermasa, BOSHQA
      // maydonni (masalan `name`dagi "—" belgisi) tekshirish kerak.
      details: [
        { name: "package_code", values: "0" },
        { name: "mark_code", values: "0" },
        { name: "tin", values: ZELOSHOP_TIN },
        { name: "discount", values: "0" },
        { name: "quantity", values: "1" },
      ],
    },
  ];
}

/**
 * `sellers/{id}` hujjatidagi to'lov holatini HAQIQIY to'lov asosida
 * yangilaydi — `atmosPaymentCallback` (webhook) VA `getTariffPaymentStatus`
 * (zaxira reconciliation) ikkalasi ham shu BITTA funksiyani chaqiradi,
 * shunda ikkala yo'l ham bir xil, IDEMPOTENT natijaga olib keladi.
 *
 * @returns {Promise<{alreadyProcessed: boolean, plan: string, paidUntilMs: number}>}
 */
async function activateTariffPayment({ paymentDocId, callbackRaw = null }) {
  const paymentRef = db.collection("atmosPayments").doc(String(paymentDocId));

  return db.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) {
      throw new Error(`atmosPayments/${paymentDocId} topilmadi.`);
    }
    const payment = paymentSnap.data();

    if (payment.status === "paid") {
      // Allaqachon qayta ishlangan (masalan Atmos webhook'ni ikki marta
      // yuborgan, yoki reconciliation callback bilan poyga qildi) —
      // IDEMPOTENT: qayta ishlov bermaymiz, faqat joriy holatni qaytaramiz.
      return { alreadyProcessed: true, plan: payment.plan, paidUntilMs: paidUntilMs({ tariffPaidUntil: payment.sellerPaidUntilAtActivation }) };
    }

    const sellerRef = db.collection("sellers").doc(payment.sellerId);
    const sellerSnap = await tx.get(sellerRef);
    if (!sellerSnap.exists) {
      throw new Error(`sellers/${payment.sellerId} topilmadi.`);
    }
    const seller = sellerSnap.data();

    const now = Date.now();
    const currentPaidUntil = paidUntilMs(seller);
    const newPaidUntilMs = Math.max(now, currentPaidUntil) + TARIFF_BILLING_PERIOD_DAYS * 24 * 60 * 60 * 1000;

    const sellerUpdate = {
      tariffPlan: payment.plan,
      tariffPaidUntil: admin.firestore.Timestamp.fromMillis(newPaidUntilMs),
      tariffLastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      // Yangi davr boshlandi — keyingi muddat yaqinlashganda YANA
      // eslatma yuborilishi uchun, oldingi belgini tozalaymiz.
      tariffPaymentReminderSentAt: admin.firestore.FieldValue.delete(),
    };

    // AI CEO sinxronizatsiyasi — `startTariffTrial`dagi BIR XIL naqsh:
    // to'langan tarif AI CEO'ni talab qiladi VA hali yoqilmagan bo'lsa
    // — YOQAMIZ, alohida bayroq bilan belgilab (faqat O'ZIMIZ yoqqanini
    // bildiradi, referal/admin qo'lda bergan kirishga tegilmaydi).
    if (computeAiCeoEnabledForPlan(payment.plan) && seller.aiCeoEnabled !== true) {
      sellerUpdate.aiCeoEnabled = true;
      sellerUpdate.aiCeoGrantedViaPaidTariff = true;
    }

    tx.update(sellerRef, sellerUpdate);
    tx.update(paymentRef, {
      status: "paid",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      callbackRaw: callbackRaw || null,
      sellerPaidUntilAtActivation: newPaidUntilMs,
    });

    return { alreadyProcessed: false, plan: payment.plan, paidUntilMs: newPaidUntilMs, sellerId: payment.sellerId };
  });
}

/**
 * Sotuvchi "To'lash" tugmasini bosganda — Atmos'da chernovik
 * tranzaksiya yaratadi va hosted checkout havolasini qaytaradi.
 */
async function handleCreateTariffPayment(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const sellerId = request.auth.uid;
  await checkRateLimit(`createTariffPayment:${sellerId}`, 10, 3600);

  const plan = String(request.data?.plan || "");
  if (!isTariffPurchasable(plan)) {
    throw new HttpsError("invalid-argument", "Bu tarif hozircha to'g'ridan-to'g'ri sotib olinmaydi.");
  }

  const sellerSnap = await db.collection("sellers").doc(sellerId).get();
  if (!sellerSnap.exists) {
    throw new HttpsError("failed-precondition", "Sotuvchi hujjati topilmadi.");
  }

  // IDEMPOTENTLIK: agar so'nggi 30 daqiqada shu sotuvchi shu tarif
  // uchun ALLAQACHON to'lanmagan tranzaksiya yaratgan bo'lsa (masalan
  // qayta bosish/tarmoq uzilishi), YANGISINI yaratish o'rniga ESKISINI
  // qayta ishlatamiz — Atmos tomonida keraksiz dublikat "chernovik"
  // tranzaksiya to'planib qolmasligi uchun.
  const recentCutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PENDING_REUSE_WINDOW_MS);
  const pendingSnap = await db.collection("atmosPayments")
    .where("sellerId", "==", sellerId)
    .where("plan", "==", plan)
    .where("status", "==", "created")
    .where("createdAt", ">=", recentCutoff)
    .limit(1)
    .get();

  if (!pendingSnap.empty) {
    const existing = pendingSnap.docs[0].data();
    return { transactionId: pendingSnap.docs[0].id, checkoutUrl: existing.checkoutUrl, amountSom: existing.amountSom };
  }

  const amountSom = TARIFF_MONTHLY_PRICE_SOM[plan];
  const amountTiyin = amountTiyinFor(plan);
  // `account` — Atmos hujjatiga ko'ra to'lov identifikatori (произвольная
  // строка, faqat bizning tomonimizdan izlash/diagnostika uchun
  // ma'noli bo'lishi kerak — Atmos buni tekshirmaydi). Tarixiy sabablarga
  // ko'ra pastki chiziqcha bilan ("snake_case" xatosi checkout/invoice/
  // create bilan bog'liq bo'lgan, lekin bu format baribir xavfsiz va
  // o'qilishi oson bo'lgani uchun saqlab qolindi).
  const safeSellerId = String(sellerId).toLowerCase().replace(/[^a-z0-9]/g, "");
  const account = `tariff_${safeSellerId}_${Date.now()}`;

  // ESKI `/merchant/pay/create` oqimi (2026-09-25'dan — fayl boshidagi
  // izohga qarang): Atmos RAQAMLI `transactionId` bilan javob beradi,
  // `redirectLink` esa shu ID ma'lum bo'lgandan KEYIN, `buildCheckoutUrl`
  // orqali, mahalliy ravishda (Atmos'ga alohida yuborilmasdan) quriladi
  // — shuning uchun bu yerda "success_url oldindan kerak" muammosi yo'q.
  const { transactionId } = await createTransaction({ amountSom, account });
  const redirectLink = buildSellerAppLink(`/seller/tariffs?atmosTxn=${transactionId}`);
  const checkoutUrl = buildCheckoutUrl({ transactionId, redirectLink });

  await db.collection("atmosPayments").doc(String(transactionId)).set({
    sellerId,
    plan,
    amountSom,
    amountTiyin,
    account,
    transactionId,
    status: "created",
    checkoutUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { transactionId: String(transactionId), checkoutUrl, amountSom };
}

exports.createTariffPayment = onCall(
  {
    region: "asia-south1",
    secrets: [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_PROXY_TOKEN, SENTRY_DSN],
  },
  withSentry(handleCreateTariffPayment)
);

/**
 * ATMOS CALLBACK API — Atmos to'lov tasdiqlanganda shu manzilga
 * murojaat qiladi (sozlash: Atmos qo'llab-quvvatlash xizmati bilan
 * integratsiya vaqtida ushbu funksiya URL'i beriladi).
 *
 * XAVFSIZLIK: Telegram webhook'laridan FARQLI (ular `secret_token`
 * sarlavhasi bilan himoyalangan), Atmos imzoni (`sign`) SO'ROV TANASI
 * ICHIDA yuboradi — shuning uchun bu yerda `verifyCallbackSign`
 * (`store_id+transaction_id+invoice+amount+api_key` xeshi) tekshiruvi
 * HAR BIR so'rov uchun MAJBURIY.
 *
 * JAVOB SHARTI (Atmos hujjatiga ko'ra QAT'IY): HTTP 200 + tana
 * `{status:1, message:"..."}` — aks holda pul YECHILMAYDI. Shu sabab,
 * mantiqiy rad etish holatlarida ham (imzo/summasi mos kelmasa) HTTP
 * 200 qaytariladi, faqat `status:0` bilan — bu Atmos'ning O'Z
 * hujjatidagi namunaga mos.
 */
async function handleAtmosPaymentCallback(req, res) {
  const respond = (status, message) => res.status(200).json({ status, message });

  try {
    const body = req.body || {};
    const { store_id: storeId, transaction_id: transactionId, amount, invoice, sign } = body;

    if (!storeId || !transactionId || amount === undefined || amount === null || !sign) {
      respond(0, "Majburiy maydonlar yetishmayapti.");
      return;
    }

    // MUHIM: `.trim()` — `lib/atmosClient.js`dagi `trimAtmosValue`
    // bilan BIR XIL sabab (terminalda qo'lda kiritilgan sekretga
    // bilinmas probel qo'shilib qolishi mumkinligi) — bu yerda
    // alohida yozilgan, chunki `atmosPayments.test.js` `atmosClient`
    // modulini to'liq mock qiladi (`trimAtmosValue`ni import qilish
    // o'sha mock'ni ham yangilashni talab qilardi).
    const expectedStoreId = String(ATMOS_STORE_ID.value() || "").trim();
    if (String(storeId) !== String(expectedStoreId)) {
      console.error("atmosPaymentCallback: noto'g'ri store_id", storeId);
      respond(0, "Noto'g'ri merchant.");
      return;
    }

    const validSign = verifyCallbackSign({ storeId, transactionId, invoice, amount, sign });
    if (!validSign) {
      console.error("atmosPaymentCallback: imzo mos kelmadi", { transactionId });
      respond(0, "Noto'g'ri imzo.");
      return;
    }

    if (invoice === undefined || invoice === null) {
      respond(0, "invoice maydoni yo'q.");
      return;
    }

    // 2026-09-25'dan (fayl boshidagi izohga qarang): Firestore hujjati
    // ENDI to'g'ridan-to'g'ri `transaction_id` bilan kalitlangan —
    // `invoice`ning nimaga tengligi haqidagi taxminga endi ehtiyoj yo'q,
    // shunchaki oddiy `doc().get()`, QIDIRUVSIZ.
    const paymentRef = db.collection("atmosPayments").doc(String(transactionId));
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      respond(0, `Tranzaksiya ${transactionId} tizimda topilmadi.`);
      return;
    }
    const payment = paymentSnap.data();

    if (Number(payment.amountTiyin) !== Number(amount)) {
      console.error("atmosPaymentCallback: summa mos kelmadi", { transactionId, expected: payment.amountTiyin, got: amount });
      respond(0, "Summalar mos kelmadi.");
      return;
    }

    await activateTariffPayment({ paymentDocId: paymentSnap.id, callbackRaw: body });

    respond(1, "Успешно");
  } catch (err) {
    console.error("atmosPaymentCallback: kutilmagan xatolik:", err);
    initSentry();
    Sentry.captureException(err);
    respond(0, "Ichki xatolik.");
  }
}

exports.atmosPaymentCallback = onRequest(
  { region: "asia-south1", secrets: [ATMOS_STORE_ID, ATMOS_API_KEY, SENTRY_DSN] },
  handleAtmosPaymentCallback
);

/**
 * Sotuvchi checkout'dan qaytgach (`redirectLink`) — holatni tekshiradi.
 * Agar webhook hali yetib kelmagan bo'lsa (tarmoq kechikishi), Atmos'dan
 * TO'G'RIDAN-TO'G'RI (`/merchant/pay/get`, biz ISHONCHLI access-token
 * bilan chaqiramiz) so'rab, ZAXIRA yo'l bilan ham faollashtiradi —
 * shuning uchun sign tekshiruvi shart EMAS (bu yerdagi ishonch manbai
 * — bizning O'Z, autentifikatsiyalangan Atmos so'rovimiz, tashqi
 * "da'vo" emas).
 */
async function handleGetTariffPaymentStatus(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  // MUHIM: nom (`transactionId`) FRONTEND KONTRAKTINI o'zgartirmaslik
  // uchun eski nomicha qoldirilgan — qiymat esa ENDI bizning
  // `requestId`imiz (Firestore hujjat ID'i), Atmos'ning raqamli
  // transaction_id'i EMAS (batafsil: fayl boshidagi izoh).
  const transactionId = String(request.data?.transactionId || "");
  if (!transactionId) {
    throw new HttpsError("invalid-argument", "transactionId talab qilinadi.");
  }

  const paymentRef = db.collection("atmosPayments").doc(transactionId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    throw new HttpsError("not-found", "To'lov topilmadi.");
  }
  const payment = paymentSnap.data();
  if (payment.sellerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Bu to'lov sizga tegishli emas.");
  }

  if (payment.status === "paid") {
    return { status: "paid", plan: payment.plan, paidUntilMs: payment.sellerPaidUntilAtActivation || null };
  }

  // QO'LDA (bank o'tkazmasi) TO'LOV (2026-09-25, `manualTariffPayments.js`):
  // bu yozuv Atmos orqali UMUMAN yaratilmagan — `payment.transactionId`
  // yo'q, shuning uchun pastdagi Atmos reconciliation so'rovini
  // chaqirish MA'NOSIZ (baribir xato beradi). O'rniga hujjatda
  // saqlangan holatning O'ZINI qaytaramiz — admin `reviewManualTariffPayment`
  // orqali tasdiqlagach, hujjat `status: "paid"` bo'ladi va yuqoridagi
  // shart ishga tushadi (sotuvchi sahifani qayta ochganda).
  if (payment.method === "manual") {
    if (payment.status === "rejected") {
      return { status: "rejected", plan: payment.plan, amountSom: payment.amountSom, rejectReason: payment.rejectReason || null };
    }
    return { status: "pending_review", plan: payment.plan, amountSom: payment.amountSom };
  }

  // ZAXIRA YO'L: webhook hali kelmagan bo'lishi mumkin — Atmos'dan
  // to'g'ridan-to'g'ri so'raymiz (`/merchant/pay/get`, 2026-09-25'dan —
  // fayl boshidagi izohga qarang).
  try {
    const { confirmed } = await getTransaction({ transactionId: payment.transactionId || transactionId });
    if (confirmed) {
      const result = await activateTariffPayment({ paymentDocId: transactionId, callbackRaw: null });
      return { status: "paid", plan: result.plan, paidUntilMs: result.paidUntilMs };
    }
  } catch (err) {
    // Atmos vaqtincha javob bermasa ham, sotuvchiga "hali kutilmoqda"
    // holatini ko'rsatishda davom etamiz — xato tashlab, frontend'ni
    // buzmaymiz.
    console.error("getTariffPaymentStatus: reconciliation xatosi:", err);
  }

  return { status: "created", plan: payment.plan, amountSom: payment.amountSom };
}

exports.getTariffPaymentStatus = onCall(
  {
    region: "asia-south1",
    secrets: [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_PROXY_TOKEN, SENTRY_DSN],
  },
  withSentry(handleGetTariffPaymentStatus)
);

/**
 * Har kuni ishlaydi: to'lov muddati yaqinlashayotgan (yoki bepul 7
 * kunlik davr tugagan, hali bir marta ham to'lamagan) YANGI (billing
 * talab qilinadigan) sotuvchilarga Telegram orqali eslatma yuboradi.
 *
 * QAMROV ATAYLAB TOR: faqat `createdAt >= TARIFF_BILLING_CUTOFF_MS`
 * (billing rejimidagi) sotuvchilar tekshiriladi — bu to'plam BUGUNDAN
 * boshlab noldan o'sadi, shuning uchun to'liq skanerlash (murakkab
 * composite-index so'rovlar o'rniga) hozircha xavfsiz va oddiy.
 */
async function handleSendTariffPaymentReminders() {
  const MAX_PER_RUN = 500;
  const now = Date.now();

  const cutoffSnap = await db.collection("sellers")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromMillis(TARIFF_BILLING_CUTOFF_MS))
    .limit(MAX_PER_RUN)
    .get();

  const candidates = cutoffSnap.docs.filter((doc) => {
    const seller = doc.data();
    if (seller.tariffPaymentReminderSentAt) return false; // shu davr uchun allaqachon yuborilgan.
    const pastDue = isTariffPastDue(seller, now);
    if (pastDue) return true;
    const paidUntil = paidUntilMs(seller);
    if (paidUntil > 0 && paidUntil - now <= REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000) return true;
    return false;
  });

  const result = await processBatched(candidates, async (doc) => {
    const seller = doc.data();
    const pastDue = isTariffPastDue(seller, now);
    const text = pastDue
      ? [
          "⏳ *Bepul davr tugadi*",
          "",
          `Z-Start uchun 7 kunlik bepul davringiz yakunlandi. Do'koningizni to'liq boshqarishda davom etish uchun "Tariflar" sahifasidan to'lovni amalga oshiring.`,
        ].join("\n")
      : [
          "🔔 *Tarif muddati yaqinlashmoqda*",
          "",
          `Joriy tarif to'lovingiz muddati ${REMINDER_WINDOW_DAYS} kun ichida tugaydi. Uzluksiz ishlash uchun "Tariflar" sahifasidan oldindan to'lovni amalga oshirishingiz mumkin.`,
        ].join("\n");

    await sendTelegramMessage(BOT_TOKEN.value(), doc.id, text, {
      buttonText: "To'lov qilish",
      buttonUrl: buildSellerAppLink("/seller/tariffs"),
    }).catch(() => {});

    await doc.ref.update({ tariffPaymentReminderSentAt: admin.firestore.FieldValue.serverTimestamp() });
  });

  console.log(`sendTariffPaymentReminders: ${result.successCount}/${result.total} muvaffaqiyatli, ${result.failureCount} xato`);
}

exports.sendTariffPaymentReminders = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Tashkent", region: "asia-south1", secrets: [BOT_TOKEN, SENTRY_DSN], timeoutSeconds: 300 },
  withSentry(handleSendTariffPaymentReminders)
);

// `manualTariffPayments.js` (2026-09-25, "qo'lda tasdiqlash" — bank
// o'tkazmasi + admin ko'rib chiqish oqimi, Atmos'ga QO'SHIMCHA variant)
// admin tasdiqlagan to'lovni AYNAN SHU funksiya orqali faollashtiradi —
// `tariffPaidUntil`/AI CEO/eslatma-belgisi mantiqi IKKALA oqim uchun
// ham BITTA, yagona joyda qolishi uchun (couriers.js'dagi
// `applyCourierOrderAction` bilan bir xil, loyihada allaqachon
// o'rnatilgan "qo'shni modul funksiyasini to'g'ridan-to'g'ri eksport
// qilish" konvensiyasi — `_testables` FAQAT testlar uchun, production
// kodi buni ishlatmasligi kerak).
exports.activateTariffPayment = activateTariffPayment;

exports._testables = {
  handleCreateTariffPayment,
  handleAtmosPaymentCallback,
  handleGetTariffPaymentStatus,
  handleSendTariffPaymentReminders,
  activateTariffPayment,
  amountTiyinFor,
  // 2026-09-25: `checkout/invoice/create` oqimi vaqtincha to'xtatilgani
  // sababli (fayl boshidagi izohga qarang) quyidagi uchtasi ASOSIY
  // oqimda ENDI chaqirilmaydi — lekin Atmos javob berib, o'sha oqimga
  // qaytish kerak bo'lganda ZARUR bo'lgani uchun saqlanadi, shuning
  // uchun shu yerda "ishlatilgan" deb belgilanadi (lint xatosi
  // bermasligi uchun).
  buildTariffInvoiceItems,
  formatAtmosExpirationDate,
  TARIFF_INVOICE_EXPIRATION_MINUTES,
  ATMOS_ENV,
};
