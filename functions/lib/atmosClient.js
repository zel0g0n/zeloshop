const crypto = require("crypto");
const { defineSecret, defineString } = require("firebase-functions/params");
const { ProxyAgent } = require("undici");

/**
 * ATMOS TO'LOV SHLYUZI — API MIJOZI (2026-09, "tarif to'lovini ishga
 * tushirish" bo'limi).
 *
 * 2026-09-14 YANGILANDI — HOZIRGI ASOSIY OQIM `checkout/invoice/create`:
 * Atmos xodimining O'ZI aniq shuni ko'rsatdi ("тулов сахифасини тест
 * килишиз учун checkout/invoice/create шу методдан фойдаланишиз кере").
 * Bu ESKI "Platejnaya stranitsa" oqimidan (`createTransaction` +
 * `buildCheckoutUrl`, pastda ALOHIDA saqlangan) FARQLI, YANGI hujjat
 * bo'limi ("Оплаты (МПС)" → "Выставление счета"): bitta chaqiruv
 * (`createCheckoutInvoice`) TAYYOR checkout havolasini (`checkout.atmos.uz`
 * domenida) qaytaradi, alohida URL qurish shart emas. Holat so'rash —
 * `getCheckoutInvoiceStatus` (`checkout/invoice/get`).
 *   1) `createCheckoutInvoice` — Atmos'da invoys yaratadi, javobda TAYYOR
 *      `url` (checkout.atmos.uz) qaytadi;
 *   2) foydalanuvchi shu `url`ga o'tkaziladi — karta raqami/SMS-kod
 *      BUTUNLAY Atmos'ning O'Z sahifasida kiritiladi, bizning serverimiz
 *      HECH QACHON xom karta ma'lumotini (PAN/CVV/OTP) ko'rmaydi;
 *   3) to'lov natijasi `Callback API` orqali (`verifyCallbackSign`)
 *      serverga xabar qilinadi — HAQIQIY tasdiqlash manbai shu, redirect
 *      emas (redirect soxtalashtirilishi/uzilishi mumkin); `getCheckoutInvoiceStatus`
 *      esa ZAXIRA reconciliation yo'li (`atmosPayments.js`dagi
 *      `getTariffPaymentStatus`).
 *
 * MUHIM, HALI TO'LIQ TASDIQLANMAGAN 2 nuqta (sandboxda tekshirish SHART,
 * hujjat o'zi aniq ko'rsatmagan):
 *   a) `checkout/invoice/create`/`get` so'rovlarida FAQAT `Authorization:
 *      Bearer` sarlavhasi ko'rsatilgan (hujjat namunasida) — LEKIN shu
 *      bo'lim joylashgan "Эквайринг Visa/Mastercard (МПС)" bo'limining
 *      UMUMIY kirish qismida "партнеру выдается уникальный API ключ,
 *      который должен быть включен в любой запрос... в виде заголовка
 *      apikey" deyilgan. Bu ALOHIDA, karta-darajasidagi MPS-operatsiyalar
 *      (bind/create/apply) uchun berilgan kalit bo'lishi mumkin — pastdagi
 *      `ATMOS_API_KEY` esa BOSHQA maqsad uchun (Callback imzo tekshirish)
 *      ishlatiladi, shuning uchun bu yerda ATAYLAB ishlatilmadi (noto'g'ri
 *      taxmin qilmaslik uchun). Sandbox `checkout/invoice/create` chaqiruvi
 *      401/403 bilan qaytsa — BIRINCHI shu yerni tekshiring.
 *   b) Callback body'dagi `invoice` maydoni ("идентификатор оплаченного
 *      инвойса") `checkout/invoice/create` javobidagi `payment_id` bilan
 *      BIR XIL deb TAXMIN qilingan (`atmosPayments.js`dagi webhook shu
 *      maydon bo'yicha Firestore'da qidiradi) — hujjat buni aniq
 *      bog'lamagan, real sandbox to'lovida TASDIQLASH kerak.
 *
 * ESKI OQIM (pastda saqlangan, LEKIN `atmosPayments.js` ENDI ishlatmaydi):
 * faqat "Platejnaya stranitsa" (`/merchant/pay/create` + qo'lda qurilgan
 * `checkout.pays.uz` havolasi) — bu hujjatning ESKIROQ, alohida
 * bo'limi edi:
 *   1) `createTransaction` — bizning serverimiz черновик tranzaksiya
 *      yaratadi (`/merchant/pay/create`);
 *   2) foydalanuvchi `buildCheckoutUrl` havolasiga o'tkaziladi;
 *   3) xuddi yuqoridagidek, Callback API orqali tasdiqlanadi.
 *
 * ATAYLAB QO'SHILMAGAN: karta-raqam+OTP orqali to'g'ridan-to'g'ri API
 * chaqiruvi (`pay/pre-apply`+`pay/apply`), karta bog'lash (card
 * binding/card_token) — булар xom karta ma'lumotini bizning serverimiz
 * orqali o'tkazishni talab qiladi (PCI-ga yaqinroq xavfsizlik yuki) va
 * foydalanuvchi "qo'lda oyma-oy to'lash" qarorida (2026-09) buning
 * hojati yo'q.
 *
 * STATIK-IP PROKSI HAQIDA (2026-09, TUZATILGAN xulosa): loyihada bir
 * marta (faqat Atmos'ning OMMAVIY texnik hujjatiga asoslanib) "statik
 * IP shart emas" degan XATO xulosaga kelingan va shu asosda proksi
 * bekor qilingan edi. Bu NOTO'G'RI chiqdi — Atmos xodimining o'zi
 * ANIQ tasdiqladi: "Статик айпи манзил булиши кере, уни вайтлистга
 * кушганимиздан сунг, уша манзил оркали запрос юборолисиз" — ya'ni
 * ular bizning IP-manzilimizni whitelist qiladi va FAQAT o'sha
 * manzildan kelgan so'rovlarni qabul qiladi. `92.63.207.0/24` (hujjatda
 * ko'rsatilgan) — bu ATMOS'NING O'Z diapazoni, teskari yo'nalish
 * (Callback webhook) uchun, va bu ALOHIDA masala.
 *
 * Cloud Functions'ning o'zi statik chiquvchi IP'ga ega EMAS (Google'ning
 * umumiy, o'zgaruvchan IP hovuzi) — shuning uchun Atmos'ga ketadigan
 * HAR BIR HAQIQIY tarmoq so'rovi (token olish, to'lov yaratish, holat
 * so'rash) quyida `getProxyDispatcher()` orqali, statik IP'ga ega
 * proksi-VM (`35.211.129.224`, autentifikatsiyalangan HTTP CONNECT
 * tunnel) orqali yo'naltiriladi — `ATMOS_PROXY_URL` sozlangan bo'lsa.
 * `ATMOS_PROXY_URL` bo'sh bo'lsa (masalan lokal/emulator muhitida),
 * to'g'ridan-to'g'ri so'rov yuboriladi — bu FAQAT proksisiz muhitlarda
 * xavfsiz, productionda `ATMOS_PROXY_URL` doim sozlangan bo'lishi
 * SHART.
 */

const ATMOS_CONSUMER_KEY = defineSecret("ATMOS_CONSUMER_KEY");
const ATMOS_CONSUMER_SECRET = defineSecret("ATMOS_CONSUMER_SECRET");
const ATMOS_STORE_ID = defineSecret("ATMOS_STORE_ID");
// Callback API imzosini (`sign`) tekshirish uchun ALOHIDA maxfiy kalit —
// consumer_key/secret'dan MUSTAQIL, Atmos hujjatida alohida ta'kidlangan
// ("Поставщику предоставляется api_key для проверки входящих сообщений").
const ATMOS_API_KEY = defineSecret("ATMOS_API_KEY");

// Maxfiy EMAS (parol/kalit emas, faqat "sandbox"/"production" tanlovi) —
// shuning uchun `defineString` (oddiy parametr), `defineSecret` emas.
// Terminalda o'zgartirish: firebase functions:config yoki .env.<project>
// faylida `ATMOS_ENV=sandbox`. Standart — "production".
const ATMOS_ENV = defineString("ATMOS_ENV", { default: "production" });

// Statik-IP proksi-VM manzili (masalan "http://35.211.129.224:3128") —
// maxfiy EMAS (VM manzilining o'zi Atmos'ga baribir ma'lum bo'ladi),
// shuning uchun `defineString`. Bo'sh qoldirilsa (standart), proksi
// ISHLATILMAYDI — to'g'ridan-to'g'ri so'rov yuboriladi.
const ATMOS_PROXY_URL = defineString("ATMOS_PROXY_URL", { default: "" });
// Proksi-VM'ga so'rov yuborish uchun maxfiy token — VM buni
// `Proxy-Authorization` sarlavhasida tekshiradi, tokensiz/noto'g'ri
// so'rovlarni RAD ETADI (VM'ning ochiq relay sifatida suiiste'mol
// qilinishining oldini olish uchun, chunki Cloud Functions'ning o'zi
// o'zgaruvchan IP'dan chiqqani sababli VM firewall darajasida IP
// bo'yicha cheklab bo'lmaydi — himoya shu token orqali ta'minlanadi).
const ATMOS_PROXY_TOKEN = defineSecret("ATMOS_PROXY_TOKEN");

// MUHIM (2026-09-13, real production xatosidan keyin qo'shildi): terminalda
// (ayniqsa Windows/Git Bash'da) sekret/parametr qiymatini qo'lda kiritishda
// oxiriga/boshiga bilinmas probel yoki qator ko'chirish belgisi qo'shilib
// qolishi mumkin (`BOT_TOKEN`da ILGARI aynan shu sinf xato uchragan —
// `telegramAuth.js`dagi izohga qarang). Atmos'ning O'ZI buni "OAuth mijoz
// (client_id) topilmadi" (HTTP 401) deb, chalg'ituvchi tarzda qaytaradi —
// go'yo kalitning o'zi noto'g'irdek. Shuning uchun BARCHA Atmos
// sekret/parametrlari ishlatilishidan OLDIN `trimAtmosValue(...)` orqali
// tozalanadi — bu funksiya HAR BIR `.value()` chaqiruvi o'rniga ishlatiladi.
function trimAtmosValue(rawValue) {
  return typeof rawValue === "string" ? rawValue.trim() : rawValue;
}

const ATMOS_API_BASE = "https://apigw.atmos.uz";
const CHECKOUT_BASE_PRODUCTION = "https://checkout.pays.uz/invoice/get";
const CHECKOUT_BASE_SANDBOX = "http://test-checkout.pays.uz/invoice/get";

const REQUEST_TIMEOUT_MS = 15000;

// Proksi-agent ham keshlanadi (token bilan bir xil naqsh) — har bir
// so'rovda qaytadan TCP-tunnel/konfiguratsiya yaratmaslik uchun.
let cachedDispatcher = null;
let cachedDispatcherKey = null;

/**
 * Sozlangan bo'lsa, statik-IP proksi orqali chiqish uchun `undici`
 * `ProxyAgent`'ini qaytaradi (fetch'ning `dispatcher` argumenti sifatida
 * ishlatiladi). `ATMOS_PROXY_URL` bo'sh bo'lsa — `null` qaytaradi, ya'ni
 * chaqiruvchi kod to'g'ridan-to'g'ri (proksisiz) so'rov yuboradi.
 */
function getProxyDispatcher() {
  const proxyUrl = trimAtmosValue(ATMOS_PROXY_URL.value());
  if (!proxyUrl) return null;

  const token = trimAtmosValue(ATMOS_PROXY_TOKEN.value());
  if (!token) {
    throw new Error(
      "ATMOS_PROXY_URL sozlangan, lekin ATMOS_PROXY_TOKEN yo'q (firebase functions:secrets:set ATMOS_PROXY_TOKEN)."
    );
  }

  const cacheKey = `${proxyUrl}::${token}`;
  if (cachedDispatcher && cachedDispatcherKey === cacheKey) {
    return cachedDispatcher;
  }
  cachedDispatcher = new ProxyAgent({ uri: proxyUrl, token: `Bearer ${token}` });
  cachedDispatcherKey = cacheKey;
  return cachedDispatcher;
}

// Token 3600s (1 soat) amal qiladi — 60s zaxira bilan keshlaymiz.
// Modul darajasidagi o'zgaruvchi — Cloud Function instance "issiq"
// (qayta ishlatilgan) bo'lganda keshdan foydalaniladi, sovuq boshlanishda
// (cold start) qaytadan olinadi. Bir nechta parallel instance bo'lishi
// mumkin (har biri o'z keshiga ega) — bu xavfsiz, chunki token olish
// operatsiyasi cheklovsiz qayta chaqirilishi mumkin (Atmos tomonidan
// hech qanday "bitta faol token" talabi hujjatlashtirilmagan).
let cachedToken = null; // { accessToken, expiresAtMs }

function assertOk(response, body, context) {
  if (!response.ok) {
    const desc = body?.result?.description || body?.error_description || JSON.stringify(body);
    const err = new Error(`Atmos ${context}: HTTP ${response.status} — ${desc}`);
    err.atmosCode = body?.result?.code || null;
    err.httpStatus = response.status;
    throw err;
  }
}

/**
 * Bearer access-token oladi (keshlangan bo'lsa — keshdan).
 */
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30000) {
    return cachedToken.accessToken;
  }

  const consumerKey = trimAtmosValue(ATMOS_CONSUMER_KEY.value());
  const consumerSecret = trimAtmosValue(ATMOS_CONSUMER_SECRET.value());
  if (!consumerKey || !consumerSecret) {
    throw new Error("ATMOS_CONSUMER_KEY/ATMOS_CONSUMER_SECRET sozlanmagan (firebase functions:secrets:set).");
  }
  const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const dispatcher = getProxyDispatcher();
  const response = await fetch(`${ATMOS_API_BASE}/token?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(dispatcher ? { dispatcher } : {}),
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  assertOk(response, body, "token olish");

  if (!body?.access_token) {
    throw new Error("Atmos token olish: javobda access_token yo'q.");
  }

  cachedToken = {
    accessToken: body.access_token,
    expiresAtMs: now + (Number(body.expires_in) || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

async function atmosPost(path, payload) {
  const accessToken = await getAccessToken();
  const dispatcher = getProxyDispatcher();
  const response = await fetch(`${ATMOS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(dispatcher ? { dispatcher } : {}),
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  assertOk(response, body, path);

  if (body?.result && body.result.code !== "OK") {
    const err = new Error(`Atmos ${path}: ${body.result.description || body.result.code}`);
    err.atmosCode = body.result.code;
    throw err;
  }

  return body;
}

/**
 * `atmosPost`ga O'XSHASH, LEKIN `body.result.code` konventsiyasini
 * MAJBURIY qilmaydi — `checkout/invoice/*` endpointlari muvaffaqiyatni
 * BOSHQA shaklda bildiradi (`result` emas, `status` obyekti, VA
 * `code` qiymati ham boshqacha: "OK" yoki "0" — endpointga qarab).
 * Chaqiruvchi funksiya javob tanasini O'ZI tekshiradi.
 */
async function atmosPostRaw(path, payload) {
  const accessToken = await getAccessToken();
  const dispatcher = getProxyDispatcher();
  const response = await fetch(`${ATMOS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(dispatcher ? { dispatcher } : {}),
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  assertOk(response, body, path);
  return body;
}

/**
 * YANGI (2026-09-14, Atmos xodimi ko'rsatgan) ASOSIY OQIM: bitta
 * so'rovda invoys yaratadi VA tayyor checkout havolasini (`url`,
 * `checkout.atmos.uz` domenida) qaytaradi — `createTransaction` +
 * `buildCheckoutUrl` (eski, ikki bosqichli) o'rniga.
 *
 * `items` — OFD/fiskal ma'lumotlar (ИКПУ kod, STIR va h.k.) talab
 * qiladigan massiv; chaqiruvchi kod (`atmosPayments.js`) buni to'liq
 * shakllantirib beradi — bu yerda hech qanday standart/fabrikatsiya
 * qilingan qiymat QO'YILMAYDI (moliyaviy/fiskal ma'lumot, xato bo'lsa
 * soliq muammosi tug'diradi).
 *
 * @param {{
 *   requestId: string, account: string, amountSom: number,
 *   successUrl: string, items: Array<object>,
 *   expirationMinutes?: number, expirationDateIso?: string,
 * }} params
 * @returns {Promise<{storeId: number|string, paymentId: number, token: string, url: string}>}
 */
async function createCheckoutInvoice({
  requestId, account, amountSom, successUrl, items, expirationMinutes, expirationDateIso,
}) {
  if (!requestId) {
    throw new Error("createCheckoutInvoice: requestId talab qilinadi.");
  }
  if (!Number.isFinite(amountSom) || amountSom <= 0) {
    throw new Error("createCheckoutInvoice: amountSom musbat son bo'lishi kerak.");
  }
  if (!account) {
    throw new Error("createCheckoutInvoice: account (to'lov identifikatori) talab qilinadi.");
  }
  if (!successUrl) {
    throw new Error("createCheckoutInvoice: successUrl talab qilinadi.");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("createCheckoutInvoice: items (kamida bitta) talab qilinadi.");
  }
  const storeIdRaw = trimAtmosValue(ATMOS_STORE_ID.value());
  if (!storeIdRaw) {
    throw new Error("ATMOS_STORE_ID sozlanmagan (firebase functions:secrets:set).");
  }
  // MUHIM (2026-09-14, real sandbox xatosidan keyin qo'shildi): hujjatning
  // o'z namunasida `store_id` JSON'da RAQAM sifatida yuboriladi (`"store_id": 3`,
  // tirnoqsiz) — Firebase sekret qiymati esa DOIM string bo'lgani uchun buni
  // ataylab songa aylantiramiz. Aylantirib bo'lmasa (masalan sekret raqam
  // bo'lmagan matn bo'lsa), aniq xato bilan to'xtaymiz — Atmos'ning o'zi
  // "Invalid request format" kabi noaniq xato qaytarib, buni topishni
  // qiyinlashtiradi.
  const storeId = Number(storeIdRaw);
  if (!Number.isFinite(storeId)) {
    throw new Error(`ATMOS_STORE_ID raqam bo'lishi kerak, hozirgi qiymat: "${storeIdRaw}".`);
  }

  const payload = {
    request_id: String(requestId),
    store_id: storeId,
    account: String(account),
    amount: Math.round(amountSom * 100), // so'm -> tiyin
    success_url: successUrl,
    items,
  };
  if (expirationMinutes) payload.expiration_time = expirationMinutes;
  if (expirationDateIso) payload.expiration_date = expirationDateIso;

  const body = await atmosPostRaw("/checkout/invoice/create", payload);

  if (body?.status?.code !== "OK") {
    // MUHIM (2026-09-14, TUZATILDI): Sentry `exception.value` maydonini
    // ~200 belgida KESIB tashlar ekan (real production event'da
    // tasdiqlandi) — shuning uchun endi TO'LIQ payload/javob ikki joyga
    // yoziladi: (a) `console.error` orqali Google Cloud Logging'ga
    // (bu HECH QACHON kesilmaydi, GCP Console → Cloud Run functions →
    // createTariffPayment → LOGS'da "ATMOS_DEBUG_FULL" matnini qidirib
    // topish mumkin — SSH/token kerak emas), (b) `err.extraContext`
    // orqali Sentry "Additional Data" bo'limiga (o'sha ham kesilmaydi,
    // lekin GCP Logging asosiy/ishonchli manba deb hisoblansin).
    console.error("ATMOS_DEBUG_FULL", JSON.stringify({ sentPayload: payload, atmosResponseBody: body }));
    const err = new Error(
      `Atmos checkout/invoice/create: ${body?.status?.description || body?.status?.code || "noma'lum xato"}`
    );
    err.atmosCode = body?.status?.code || null;
    err.extraContext = { atmosRequestPayload: payload, atmosResponseStatus: body?.status || null };
    throw err;
  }
  if (!body?.payment_id || !body?.url) {
    throw new Error("Atmos checkout/invoice/create: javobda payment_id/url yo'q.");
  }

  return {
    storeId: body.store_id,
    paymentId: body.payment_id,
    token: body.token,
    url: body.url,
  };
}

/**
 * Avval yaratilgan invoysning joriy holatini so'raydi
 * (`/checkout/invoice/get`) — webhook kechikkan/yo'qolgan hollarda
 * solishtirish (reconciliation) uchun ishlatiladi. Hujjatga ko'ra
 * `paymentId` YOKI `token` beriladi, IKKALASI BIRDAN EMAS.
 */
async function getCheckoutInvoiceStatus({ paymentId, token } = {}) {
  if (!paymentId && !token) {
    throw new Error("getCheckoutInvoiceStatus: paymentId yoki token talab qilinadi.");
  }
  if (paymentId && token) {
    throw new Error("getCheckoutInvoiceStatus: paymentId VA token bir vaqtda berilmasin (hujjatga ko'ra faqat bittasi).");
  }
  const payload = paymentId ? { payment_id: paymentId } : { token };
  const body = await atmosPostRaw("/checkout/invoice/get", payload);

  return {
    success: body?.success === true,
    final: body?.final === true,
    state: body?.state || null,
    amount: body?.amount ?? null,
    account: body?.account ?? null,
    raw: body,
  };
}

/**
 * ESKI OQIM — `atmosPayments.js` ENDI ishlatmaydi (yuqoridagi fayl
 * izohiga qarang), LEKIN kelajakda kerak bo'lib qolishi mumkinligi
 * uchun (va mavjud testlar sababli) olib tashlanmagan.
 *
 * Черновik tranzaksiya yaratadi (`/merchant/pay/create`).
 * @param {{amountSom: number, account: string, lang?: string}} params
 * @returns {Promise<{transactionId: number}>}
 */
async function createTransaction({ amountSom, account, lang = "uz" }) {
  if (!Number.isFinite(amountSom) || amountSom <= 0) {
    throw new Error("createTransaction: amountSom musbat son bo'lishi kerak.");
  }
  if (!account) {
    throw new Error("createTransaction: account (to'lov identifikatori) talab qilinadi.");
  }
  const storeId = trimAtmosValue(ATMOS_STORE_ID.value());
  if (!storeId) {
    throw new Error("ATMOS_STORE_ID sozlanmagan (firebase functions:secrets:set).");
  }

  const body = await atmosPost("/merchant/pay/create", {
    amount: Math.round(amountSom * 100), // so'm -> tiyin
    account: String(account),
    store_id: storeId,
    lang,
  });

  const transactionId = body?.transaction_id;
  if (!transactionId) {
    throw new Error("Atmos createTransaction: javobda transaction_id yo'q.");
  }
  return { transactionId };
}

/**
 * Avval yaratilgan tranzaksiya holatini so'raydi (`/merchant/pay/get`) —
 * webhook kechikkan/yo'qolgan hollarda solishtirish (reconciliation)
 * uchun ishlatiladi.
 */
async function getTransaction({ transactionId }) {
  const storeId = trimAtmosValue(ATMOS_STORE_ID.value());
  const body = await atmosPost("/merchant/pay/get", {
    store_id: storeId,
    transaction_id: transactionId,
  }).catch((err) => {
    // `/merchant/pay/get` "yopiq"/topilmagan tranzaksiya uchun ham
    // `result.code !== "OK"` bilan xato tashlaydi (`atmosPost` orqali) —
    // lekin `store_transaction` (masalan `confirmed`) baribir tanadan
    // kerak bo'lishi mumkin, shuning uchun bu yerda xatoni qaytadan
    // ko'taramiz, chaqiruvchi kod o'zi hal qiladi.
    throw err;
  });
  return {
    confirmed: body?.store_transaction?.confirmed === true,
    statusMessage: body?.store_transaction?.status_message || null,
    raw: body,
  };
}

/**
 * Atmos'ning hosted to'lov sahifasi (checkout) havolasini quradi.
 * Foydalanuvchi shu sahifada karta raqami/SMS-kodni KIRITADI — bizning
 * serverimiz bu ma'lumotni HECH QACHON ko'rmaydi.
 */
function buildCheckoutUrl({ transactionId, redirectLink }) {
  const storeId = trimAtmosValue(ATMOS_STORE_ID.value());
  const base = trimAtmosValue(ATMOS_ENV.value()) === "sandbox" ? CHECKOUT_BASE_SANDBOX : CHECKOUT_BASE_PRODUCTION;
  const url = new URL(base);
  url.searchParams.set("storeId", storeId);
  url.searchParams.set("transactionId", String(transactionId));
  if (redirectLink) {
    url.searchParams.set("redirectLink", redirectLink);
  }
  return url.toString();
}

/**
 * Callback API imzosini hisoblaydi va solishtiradi.
 *
 * Hujjatdagi aniq formula: `sign = hash(store_id+transaction_id+invoice+amount+api_key)`
 * (bo'sh joy/ajratuvchisiz ulash) — LEKIN hujjat xesh algoritmining
 * NOMINI aniq ko'rsatmagan. MD5 ishlatilgan — O'zbekiston to'lov
 * shlyuzlari ekotizimida (Click.uz, Payme va h.k.) BIR XIL "ulangan
 * qatorni xeshlash" konventsiyasi deyarli har doim MD5 bilan qo'llaniladi,
 * shuning uchun bu ENG EHTIMOLIY variant sifatida tanlandi. PRODAKSHENGA
 * CHIQISHDAN OLDIN: sandbox to'lovini sinab, Atmos'dan real callback
 * kelganda imzo mos kelishini tasdiqlash SHART — mos kelmasa, faqat
 * shu funksiya ichidagi `"md5"` qiymatini almashtirish kifoya.
 */
function computeCallbackSign({ storeId, transactionId, invoice, amount }) {
  const apiKey = trimAtmosValue(ATMOS_API_KEY.value());
  const raw = `${storeId}${transactionId}${invoice}${amount}${apiKey}`;
  return crypto.createHash("md5").update(raw, "utf8").digest("hex");
}

function verifyCallbackSign({ storeId, transactionId, invoice, amount, sign }) {
  if (!sign || typeof sign !== "string") return false;
  const expected = computeCallbackSign({ storeId, transactionId, invoice, amount });
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(String(sign).toLowerCase(), "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

module.exports = {
  ATMOS_CONSUMER_KEY, ATMOS_CONSUMER_SECRET, ATMOS_STORE_ID, ATMOS_API_KEY, ATMOS_ENV,
  ATMOS_PROXY_TOKEN,
  trimAtmosValue,
  getAccessToken,
  createCheckoutInvoice,
  getCheckoutInvoiceStatus,
  createTransaction,
  getTransaction,
  buildCheckoutUrl,
  computeCallbackSign,
  verifyCallbackSign,
  _testables: { assertOk, ATMOS_API_BASE, CHECKOUT_BASE_PRODUCTION, CHECKOUT_BASE_SANDBOX, getProxyDispatcher },
};
