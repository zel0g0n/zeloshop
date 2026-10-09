const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./lib/admin");
const { withSentry, SENTRY_DSN } = require("./lib/sentry");
const {
  ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_PROXY_TOKEN,
  createTransaction, buildCheckoutUrl, createCheckoutInvoice,
  bindCardInit, bindCardConfirm, listLinkedCards, removeLinkedCard,
} = require("./lib/atmosClient");

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI — ATMOS uchun tayyorlangan
 * statik-IP proksi-server (GCP e2-micro VM, IP: 35.211.129.224,
 * "atmos-static-ip" nomi bilan reserve qilingan) ishlab turganini va
 * Cloud Function undan haqiqatan ham shu STATIK IP orqali chiqayotganini
 * tasdiqlash uchun.
 *
 * TARIX (2026-09 tuzatish): bu fayl bir marta — faqat Atmos'ning
 * OMMAVIY texnik hujjatiga asoslanib ("statik IP shart emas" degan,
 * NOTO'G'RI chiqqan xulosa bilan) — xato ravishda o'chirilgan edi.
 * Aslida Atmos (haqiqiy yozishmada) sotuvchidan aniq statik IP'ni
 * whitelist qilish uchun so'ragan, va bu VM+IP infratuzilmasi
 * ALLAQACHON qurilib, tashqi tomondan ham (brauzerdan
 * `http://35.211.129.224:8080/whoami`) tasdiqlangan edi. Shuning
 * uchun bu fayl qayta tiklandi — ENDI hech qanday "kerak emas" degan
 * keyingi xulosasiz o'chirilmasin.
 *
 * ISHLASH PRINSIPI: bu funksiya proksi-VM'ning `/whoami` endpoint'iga
 * so'rov yuboradi; VM esa o'z navbatida tashqi "IP aniqlash" xizmatiga
 * (ipify.org) so'rov yuborib, o'zining HAQIQIY chiquvchi IP manzilini
 * qaytaradi. Shu tarzda butun zanjir (Cloud Function -> VM -> tashqi
 * internet) bir yo'la tekshiriladi.
 *
 * XAVFSIZLIK: faqat administrator chaqira oladi (`admins/{uid}`
 * tekshiruvi — boshqa admin-only funksiyalar bilan bir xil naqsh,
 * masalan `nicheMigration.js`).
 *
 * MUHIM: hozircha VM'dagi test-server FAQAT diagnostika uchun (8080-
 * port butun internetga ochiq, autentifikatsiyasiz) — bu ATMOS'ning
 * HAQIQIY to'lov so'rovlarini proksi qilish uchun YETARLI EMAS.
 * Productionga chiqishdan oldin: (1) VM'dagi serverni xavfsizlashtirish
 * (firewall manbasini cheklash yoki maxfiy token talab qilish), (2)
 * `lib/atmosClient.js`dagi haqiqiy Atmos so'rovlarini shu proksi orqali
 * yo'naltirish kerak — bularning ikkalasi ham hali qilinmagan.
 * Shu ikki qadam bajarilib, ATMOS integratsiyasi to'liq proksi orqali
 * ishlaydigan bo'lgach, bu VAQTINCHALIK diagnostika fayli olib
 * tashlanishi mumkin (lekin FAQAT o'shanda, va faqat shu sabab bilan).
 */
const PROXY_VM_WHOAMI_URL = "http://35.211.129.224:8080/whoami";
const EXPECTED_STATIC_IP = "35.211.129.224";
const REQUEST_TIMEOUT_MS = 10000;

async function handleTestAtmosProxyIp(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }

  let response;
  try {
    response = await fetch(PROXY_VM_WHOAMI_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Proksi-VM bilan bog'lanishda xatolik:", err);
    throw new HttpsError(
      "unavailable",
      "Proksi-VM'ga ulanib bo'lmadi. VM ishlab turganini va firewall 8080-portni ochganini tekshiring."
    );
  }

  if (!response.ok) {
    throw new HttpsError("internal", `Proksi-VM ${response.status} status qaytardi.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new HttpsError("internal", "Proksi-VM javobi noto'g'ri formatda (JSON emas).");
  }

  const vmOutboundIp = data && data.vmOutboundIp;
  return {
    vmOutboundIp: vmOutboundIp || null,
    expectedStaticIp: EXPECTED_STATIC_IP,
    matches: vmOutboundIp === EXPECTED_STATIC_IP,
  };
}

exports.testAtmosProxyIp = onCall({ region: "asia-south1", secrets: [SENTRY_DSN] }, withSentry(handleTestAtmosProxyIp));

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI №2 (2026-09-15, "checkout/invoice/create
 * doim -999998 'Invalid request format' qaytaryapti, sabab ANIQLANMADI"
 * muammosidan keyin qo'shildi).
 *
 * MAQSAD: xuddi shu `store_id`/hisob bilan ESKI, ANCHA ODDIYROQ oqim
 * (`/merchant/pay/create` — `lib/atmosClient.js`dagi `createTransaction`,
 * `items`/OFD-fiskal massivi UMUMAN talab qilinmaydi) ISHLAYDIMI, degan
 * savolga tezkor javob berish — bu DIAGNOSTIKA, productionga chiqarish
 * TAVSIYA ETILMAYDI (Atmos xodimi aniq "sandbox test uchun
 * checkout/invoice/create ishlating" degan edi).
 *
 * NATIJA IKKI XIL bo'lishi mumkin:
 *   - Bu ham AYNAN "-999998 Invalid request format" bersa — demak muammo
 *     umuman `store_id: 11115` hisobi/sandbox faollashtirilishi darajasida
 *     (checkout/invoice/create'ga XOS EMAS).
 *   - Bu MUVAFFAQIYATLI o'tsa (transactionId+checkoutUrl qaytsa) — demak
 *     muammo aniq `checkout/invoice/create` endpointi yoki uning
 *     `items`/OFD-fiskal talablariga XOS.
 *
 * Xato tashlash o'rniga TO'G'RIDAN-TO'G'RI natija sifatida qaytariladi
 * (`success:false` + xato tafsilotlari) — shunda administrator Sentry/GCP
 * Logging'ni titkilamasdan, chaqiruv natijasining o'zida darhol ko'radi.
 * Xavfsizlik: yuqoridagi `testAtmosProxyIp` bilan bir xil admin-only naqsh.
 */
const LEGACY_TEST_AMOUNT_SOM = 1000; // Eng kichik, xavfsiz test summasi (sandbox).

// MUHIM (2026-09-15): `onCall` (Firebase Auth ID-token talab qiladigan)
// versiyasi `firebase functions:shell` orqali sinashda ISHLAMADI —
// shell HTTP darajasida haqiqiy callable protokolini talab qiladi,
// va `{auth:{uid:...}}`ni qo'lda "soxtalashtirish" endi (yangi
// firebase-tools versiyalarida) imkonsiz ("Request body has extra
// fields: auth" xatosi). Shuning uchun QO'SHIMCHA, ODDIY `onRequest`
// (oddiy HTTP, brauzerdan ochish mumkin) versiyasi qo'shildi — Firebase
// Auth O'RNIGA oddiy maxfiy `token` so'rov parametri bilan himoyalangan
// (pastdagi `DIAG_HTTP_TOKEN`). BU FAQAT VAQTINCHALIK DIAGNOSTIKA UCHUN —
// muammo hal bo'lgach, bu funksiya (va uning tokeni) OLIB TASHLANISHI
// KERAK, chunki token manba kodida ochiq saqlanadi.
async function runLegacyPaymentDiagnostic() {
  const account = `diag_${Date.now()}`;
  try {
    const { transactionId } = await createTransaction({
      amountSom: LEGACY_TEST_AMOUNT_SOM,
      account,
      lang: "uz",
    });
    const checkoutUrl = buildCheckoutUrl({ transactionId });
    return { success: true, transactionId, checkoutUrl, amountSom: LEGACY_TEST_AMOUNT_SOM };
  } catch (err) {
    console.error("ATMOS_LEGACY_TEST_DEBUG_FULL", JSON.stringify({
      message: err.message,
      atmosCode: err.atmosCode || null,
      httpStatus: err.httpStatus || null,
    }));
    return {
      success: false,
      errorMessage: err.message,
      atmosCode: err.atmosCode || null,
      httpStatus: err.httpStatus || null,
    };
  }
}

async function handleTestAtmosLegacyPayment(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Tizimga kirgan bo'lishingiz kerak.");
  }
  const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
  if (!adminSnap.exists) {
    throw new HttpsError("permission-denied", "Bu amal faqat administratorlar uchun.");
  }
  return runLegacyPaymentDiagnostic();
}

exports.testAtmosLegacyPayment = onCall(
  { region: "asia-south1", secrets: [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_PROXY_TOKEN, SENTRY_DSN] },
  withSentry(handleTestAtmosLegacyPayment)
);

// VAQTINCHALIK, oddiy HTTP versiya — brauzerdan to'g'ridan-to'g'ri ochish
// mumkin: https://<function-url>?token=4be3736af95ef71200f9a6169ff593914fb3cc7350ed24d6
const DIAG_HTTP_TOKEN = "4be3736af95ef71200f9a6169ff593914fb3cc7350ed24d6";

async function handleTestAtmosLegacyPaymentHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  const result = await runLegacyPaymentDiagnostic();
  res.status(200).json(result);
}

exports.testAtmosLegacyPaymentHttp = onRequest(
  { region: "asia-south1", secrets: [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_PROXY_TOKEN] },
  handleTestAtmosLegacyPaymentHttp
);

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI №3 (2026-09-15, `testAtmosLegacyPaymentHttp`
 * `success:true` qaytargandan KEYIN qo'shildi — bu ESKI oqim ("/merchant/
 * pay/create", items/OFD massivisiz) ISHLAGANI 100% isbotladi: `store_id`,
 * kalitlar, proksi — HAMMASI to'g'ri. Demak muammo FAQAT `checkout/invoice/
 * create`ning O'ZIGA yoki uning `items`/`details` (OFD-fiskal) massiviga
 * XOS. Bu funksiya — shu massivning turli variantlarini, HAR SAFAR QAYTA
 * DEPLOY QILMASDAN (`?variant=...` so'rov parametri orqali), tezkor sinash
 * imkonini beradi.
 *
 * Variantlar:
 *   - `baseline`   — hozirgi productiondagi TO'LIQ payload (5 ta `details`
 *                    yozuvi, `values` — satr). Kutilgan natija: BOSHQA
 *                    o'zgarishlarsiz AYNAN shu -999998 xatoni takrorlashi
 *                    KERAK — agar takrorlanmasa, demak boshqa narsa (masalan
 *                    vaqt/muhit) ta'sir qilyapti.
 *   - `no_details` — `items[0]`da `details` maydoni UMUMAN yo'q.
 *   - `empty_details` — `details: []` (bo'sh massiv).
 *   - `values_array` — `details[].values` massiv sifatida (`["0"]`), satr
 *                    (`"0"`) o'rniga — "values" ko'plik shaklda nomlangani
 *                    uchun ehtimol massiv kutiladi, degan gumon.
 *   - `minimal_item` — `items[0]`da FAQAT `items_id`/`code`/`name`/`amount`
 *                    (na `quantity`, na `details`).
 *
 * NATIJA (2026-09-15, real sinovdan keyin): `baseline`/`empty_details`/
 * `values_array` — HAMMASI `-999998 Invalid request format` berdi (demak bu
 * xato `details`ning ICHKI tarkibiga bog'liq EMAS). Lekin `no_details` VA
 * `minimal_item` — IKKISI HAM `-999999 System error` berdi (boshqa kod!) —
 * `quantity` bor-yo'qligi farq qilmadi. Xulosa: farq FAQAT `details`
 * KALITINING items[0]da MAVJUD BO'LISHI/BO'LMASLIGIGA bog'liq. Shu sababli
 * yana ikki variant qo'shildi — balki `details` array-of-{name,values}
 * shaklida EMAS, boshqacha kutiladi:
 *   - `details_object` — `details` massiv o'rniga to'g'ridan-to'g'ri
 *                    kalit-qiymat OBYEKTI (`{package_code:"0", ...}`).
 *   - `flat_fields`  — `details` o'rovi UMUMAN yo'q, OFD maydonlari
 *                    `items[0]`ning o'zida bir darajali (flat) beriladi.
 *
 * Xavfsizlik: yuqoridagi `testAtmosLegacyPaymentHttp` bilan bir xil —
 * Firebase Auth O'RNIGA `DIAG_HTTP_TOKEN` bilan himoyalangan.
 */
function buildVariantItems(variant, amountTiyin) {
  const base = { items_id: "diag", code: "10305008003000000", name: "Diagnostika", amount: amountTiyin };
  const fullDetails = [
    { name: "package_code", values: "0" },
    { name: "mark_code", values: "0" },
    { name: "tin", values: "313278793" },
    { name: "discount", values: "0" },
    { name: "quantity", values: "1" },
  ];
  switch (variant) {
    case "no_details":
      return [{ ...base, quantity: 1 }];
    case "empty_details":
      return [{ ...base, quantity: 1, details: [] }];
    case "values_array":
      return [{
        ...base,
        quantity: 1,
        details: fullDetails.map((d) => ({ name: d.name, values: [d.values] })),
      }];
    case "minimal_item":
      return [base];
    // (2026-09-15, 3-bosqich) `no_details`/`minimal_item` HAR IKKISI ham
    // "-999999 System error" berdi — `quantity` bor-yo'qligidan qat'i nazar.
    // Demak farq FAQAT `details` KALITINING mavjudligidan kelib chiqadi, uning
    // ICHIDAGI tarkibdan (array/bo'sh/values-array — hammasi bir xil -999998
    // berdi) emas. Bu ikki variant shu gipotezani sinaydi: balki "details"
    // massiv-of-{name,values} shaklida EMAS, balki BOSHQA shaklda kutiladi.
    case "details_object":
      // `details` — array o'rniga TO'G'RIDAN-TO'G'RI kalit-qiymat obyekti.
      return [{
        ...base,
        quantity: 1,
        details: {
          package_code: "0",
          mark_code: "0",
          tin: "313278793",
          discount: "0",
          quantity: "1",
        },
      }];
    case "flat_fields":
      // "details" o'rovi UMUMAN yo'q — OFD maydonlari items[0]ning
      // TO'G'RIDAN-TO'G'RI o'zida (bir darajali/flat) beriladi.
      return [{
        ...base,
        quantity: 1,
        package_code: "0",
        mark_code: "0",
        tin: "313278793",
        discount: "0",
      }];
    case "baseline":
    default:
      return [{ ...base, quantity: 1, details: fullDetails }];
  }
}

const CHECKOUT_VARIANTS = [
  "baseline", "no_details", "empty_details", "values_array", "minimal_item",
  "details_object", "flat_fields",
];

async function runCheckoutVariantDiagnostic(variant) {
  const amountTiyin = LEGACY_TEST_AMOUNT_SOM * 100;
  const requestId = `diag_${variant}_${Date.now()}`;
  try {
    const result = await createCheckoutInvoice({
      requestId,
      account: requestId,
      amountSom: LEGACY_TEST_AMOUNT_SOM,
      successUrl: "https://commerce-zelo.web.app/seller/tariffs",
      items: buildVariantItems(variant, amountTiyin),
    });
    return { success: true, variant, ...result };
  } catch (err) {
    console.error("ATMOS_CHECKOUT_VARIANT_DEBUG_FULL", JSON.stringify({
      variant,
      message: err.message,
      atmosCode: err.atmosCode || null,
      httpStatus: err.httpStatus || null,
    }));
    return {
      success: false,
      variant,
      errorMessage: err.message,
      atmosCode: err.atmosCode || null,
      httpStatus: err.httpStatus || null,
    };
  }
}

async function handleTestAtmosCheckoutVariantHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  const variant = String(req.query.variant || "baseline");
  if (!CHECKOUT_VARIANTS.includes(variant)) {
    res.status(400).json({ error: `Noma'lum variant: "${variant}". Ruxsat etilganlar: ${CHECKOUT_VARIANTS.join(", ")}` });
    return;
  }
  const result = await runCheckoutVariantDiagnostic(variant);
  res.status(200).json(result);
}

exports.testAtmosCheckoutVariantHttp = onRequest(
  { region: "asia-south1", secrets: [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_PROXY_TOKEN] },
  handleTestAtmosCheckoutVariantHttp
);

/**
 * VAQTINCHALIK DIAGNOSTIKA FUNKSIYASI №4 — 3-USUL: "Karta bog'lash +
 * rekurrent to'lov" (2026-09-18, ATMOS'ning rasmiy hujjatida (docs.atmos.uz)
 * `checkout/invoice/create`dan MUSTAQIL, alohida "Card Linking" +
 * "Recurring Payments" bo'limi topilgandan keyin qo'shildi).
 *
 * G'OYA: `checkout/invoice/create`ning OFD-`items` formatini "topish"ga
 * urinish o'rniga — sotuvchining kartasini BIR MARTA bog'lab (SMS-kod
 * bilan tasdiqlab), keyin har oy shu ALLAQACHON ISHLAGAN `/merchant/
 * pay/create` (`createTransaction`, bu sessiyada `transactionId:257276`
 * bilan muvaffaqiyatli sinalgan) orqali, `card_token` bilan, OFD massivi
 * UMUMAN kerak bo'lmasdan, avtomatik yechib olish.
 *
 * OGOHLANTIRISH (MUHIM, `lib/atmosClient.js`dagi 2026-09-18 izohiga ham
 * qarang): `bind-card/init` HAQIQIY karta raqamini bizning serverimiz
 * orqali Atmos'ga yuboradi — bu `checkout/invoice/create`dan farqli
 * o'laroq (u yerda karta ma'lumoti Atmos sahifasida qolib, biz UMUMAN
 * ko'rmaymiz), PCI-DSS doirasini kengaytiradi. Shu sababli:
 *   - Bu FAQAT admin-diagnostika, productiondagi FOYDALANUVCHI oqimida
 *     HECH QACHON ishlatilmasin;
 *   - Karta raqami/OTP HAR DOIM POST so'rov TANASIDA (JSON body) beriladi,
 *     URL query parametri sifatida EMAS (aks holda server-loglarida,
 *     brauzer tarixida qoladi);
 *   - `console.error` orqali xato logi yozilganda cardNumber/otp/cardToken
 *     HECH QACHON to'liq holda yozilmaydi.
 *
 * OQIM (qo'lda, brauzer/Postman/curl orqali, POST so'rovlar bilan):
 *   1) `testAtmosCardLinkInitHttp` — {cardNumber, expiry} -> transactionId+phone
 *   2) `testAtmosCardLinkConfirmHttp` — {transactionId, otp} -> cardToken
 *   3) `testAtmosCardChargeHttp` — {cardToken, amountSom} -> AVTOMATIK
 *      (OTP'siz) yechib olishga urinadi — ASOSIY savol shu: muvaffaqiyatli
 *      o'tadimi, yoki qo'shimcha `pay/pre-apply`+`pay/apply` bosqichi
 *      talab qilinadimi?
 *   4) `testAtmosListCardsHttp` — bog'langan kartalar ro'yxati (tekshirish)
 *   5) `testAtmosRemoveCardHttp` — {cardToken} -> test-tokenni tozalash
 */
async function handleTestAtmosCardLinkInitHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Faqat POST so'rov qabul qilinadi (karta raqami URL'da ko'rinmasligi uchun)." });
    return;
  }
  const { cardNumber, expiry } = req.body || {};
  if (!cardNumber || !expiry) {
    res.status(400).json({ error: "POST body (JSON) da cardNumber va expiry talab qilinadi." });
    return;
  }
  try {
    const result = await bindCardInit({ cardNumber, expiry });
    res.status(200).json({ success: true, transactionId: result.transactionId, phone: result.phone });
  } catch (err) {
    console.error("ATMOS_CARD_LINK_INIT_DEBUG", JSON.stringify({
      message: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    }));
    res.status(200).json({
      success: false, errorMessage: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    });
  }
}

async function handleTestAtmosCardLinkConfirmHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Faqat POST so'rov qabul qilinadi." });
    return;
  }
  const { transactionId, otp } = req.body || {};
  if (!transactionId || !otp) {
    res.status(400).json({ error: "POST body (JSON) da transactionId va otp talab qilinadi." });
    return;
  }
  try {
    const result = await bindCardConfirm({ transactionId, otp });
    res.status(200).json({ success: true, cardToken: result.cardToken });
  } catch (err) {
    console.error("ATMOS_CARD_LINK_CONFIRM_DEBUG", JSON.stringify({
      message: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    }));
    res.status(200).json({
      success: false, errorMessage: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    });
  }
}

async function handleTestAtmosCardChargeHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Faqat POST so'rov qabul qilinadi." });
    return;
  }
  const { cardToken, amountSom } = req.body || {};
  if (!cardToken || !amountSom) {
    res.status(400).json({ error: "POST body (JSON) da cardToken va amountSom talab qilinadi." });
    return;
  }
  const account = `diag_card_${Date.now()}`;
  try {
    const { transactionId } = await createTransaction({ amountSom: Number(amountSom), account, cardToken });
    res.status(200).json({ success: true, transactionId });
  } catch (err) {
    console.error("ATMOS_CARD_CHARGE_DEBUG", JSON.stringify({
      message: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    }));
    res.status(200).json({
      success: false, errorMessage: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    });
  }
}

async function handleTestAtmosListCardsHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  try {
    const cards = await listLinkedCards({});
    res.status(200).json({ success: true, cards });
  } catch (err) {
    console.error("ATMOS_LIST_CARDS_DEBUG", JSON.stringify({
      message: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    }));
    res.status(200).json({
      success: false, errorMessage: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    });
  }
}

async function handleTestAtmosRemoveCardHttp(req, res) {
  if (req.query.token !== DIAG_HTTP_TOKEN) {
    res.status(403).json({ error: "Noto'g'ri yoki yo'q token." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Faqat POST so'rov qabul qilinadi." });
    return;
  }
  const { cardToken } = req.body || {};
  if (!cardToken) {
    res.status(400).json({ error: "POST body (JSON) da cardToken talab qilinadi." });
    return;
  }
  try {
    await removeLinkedCard({ cardToken });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("ATMOS_REMOVE_CARD_DEBUG", JSON.stringify({
      message: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    }));
    res.status(200).json({
      success: false, errorMessage: err.message, atmosCode: err.atmosCode || null, httpStatus: err.httpStatus || null,
    });
  }
}

const CARD_LINKING_SECRETS = [ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_PROXY_TOKEN];

exports.testAtmosCardLinkInitHttp = onRequest({ region: "asia-south1", secrets: CARD_LINKING_SECRETS }, handleTestAtmosCardLinkInitHttp);
exports.testAtmosCardLinkConfirmHttp = onRequest({ region: "asia-south1", secrets: CARD_LINKING_SECRETS }, handleTestAtmosCardLinkConfirmHttp);
exports.testAtmosCardChargeHttp = onRequest({ region: "asia-south1", secrets: CARD_LINKING_SECRETS }, handleTestAtmosCardChargeHttp);
exports.testAtmosListCardsHttp = onRequest({ region: "asia-south1", secrets: CARD_LINKING_SECRETS }, handleTestAtmosListCardsHttp);
exports.testAtmosRemoveCardHttp = onRequest({ region: "asia-south1", secrets: CARD_LINKING_SECRETS }, handleTestAtmosRemoveCardHttp);

exports._testables = {
  handleTestAtmosProxyIp, EXPECTED_STATIC_IP,
  handleTestAtmosLegacyPayment, handleTestAtmosLegacyPaymentHttp,
  handleTestAtmosCheckoutVariantHttp, buildVariantItems, CHECKOUT_VARIANTS,
  handleTestAtmosCardLinkInitHttp, handleTestAtmosCardLinkConfirmHttp,
  handleTestAtmosCardChargeHttp, handleTestAtmosListCardsHttp, handleTestAtmosRemoveCardHttp,
  LEGACY_TEST_AMOUNT_SOM, DIAG_HTTP_TOKEN,
};
