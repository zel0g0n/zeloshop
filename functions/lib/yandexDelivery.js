/**
 * Yandex Delivery (Express/Claims) API bilan ishlash uchun markazlashtirilgan
 * yordamchi modul. Rasmiy hujjatlarga asoslangan:
 * https://yandex.com/support/delivery-profile/en/api/express/overview
 *
 * MUHIM ARXITEKTURA QARORI: Yandex'ning o'z hujjatlari ochiq tan oladiki,
 * webhook/notification'lar ISHONCHLI EMAS ("if there are timeouts... it
 * will attempt to deliver the notification and then stop the attempts").
 * Shuning uchun bu integratsiya — ASOSAN, ISHONCHLI usul sifatida —
 * DAVRIY SO'ROV (polling, `syncYandexDeliveryStatuses` orqali)ga
 * tayanadi, webhook'ga emas.
 *
 * Har bir sotuvchi — O'Z shaxsiy OAuth tokeni bilan ishlaydi (xuddi
 * Click/Payme kabi — markazlashtirilmagan, platforma hech qanday umumiy
 * Yandex hisobiga tayanmaydi).
 */

const API_BASE = "https://b2b.taxi.yandex.net";

// Yandex Cargo API'ning rasmiy hujjatida tasdiqlangan `taxi_class`
// qiymatlari. `courier` — ODDIY, arzonroq tarif (kichik narsalar);
// `express` — TEZKOR, qimmatroq tarif; `cargo` — katta yuk/mashina
// talab qiladigan tarif. Noto'g'ri/kutilmagan qiymat kelsa, xavfsiz
// standart sifatida "express"ga qaytamiz (avvalgi, o'zgarmagan xatti-harakat).
const VALID_TAXI_CLASSES = new Set(["courier", "express", "cargo"]);
function resolveTaxiClass(taxiClass) {
  return VALID_TAXI_CLASSES.has(taxiClass) ? taxiClass : "express";
}

class YandexDeliveryError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "YandexDeliveryError";
    this.status = status;
    this.body = body;
  }
}

async function callYandexApi(oauthToken, path, body, method = "POST") {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${oauthToken}`,
      "Accept-Language": "ru",
    },
    // GET so'rovlar tanaga (body) ega bo'lmaydi - Yandex'ning
    // `claims/tracking-links` va `claims/performer-position`
    // endpointlari, boshqalaridan farqli, HAQIQIY GET so'rovlar
    // (rasmiy hujjatga ko'ra tasdiqlangan).
    ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 401 — token noto'g'ri/eskirgan; boshqa xatolar — so'rov tarkibida
    // muammo (masalan koordinatalar noto'g'ri).
    throw new YandexDeliveryError(
      data?.message || `Yandex Delivery so'rovi muvaffaqiyatsiz (${response.status})`,
      response.status,
      data
    );
  }

  return data;
}

/**
 * Berilgan (jo'natuvchi, qabul qiluvchi) koordinatalar va yuk
 * og'irligi/o'lchami asosida yetkazib berish narxining OLDINDAN
 * BAHOSINI oladi (hali hech qanday da'vo/claim yaratilmaydi).
 *
 * MUHIM TUZATISH: OLDIN bu funksiya `offers/calculate` endpoint'ini
 * ishlatgan edi — bu, Yandex hujjatlariga ko'ra, FAQAT ROSSIYA uchun
 * to'g'ri qadam! O'zbekiston kabi boshqa mamlakatlar uchun BUTUNLAY
 * BOSHQA endpoint — `check-price` — ishlatilishi kerak (foydalanuvchi
 * o'zining rasmiy Yandex Delivery hujjatidan aniq tasdiqladi). Bu —
 * "kuryer umuman topilmayapti" muammosining haqiqiy sababi bo'lishi
 * juda ehtimol edi (noto'g'ri endpoint chaqirilardi).
 *
 * MUHIM: `check-price` javobida `offer_id` YO'Q (faqat narx, masofa,
 * vaqt bahosi) — chunki bu, haqiqiy da'vo yaratmaydigan, faqat
 * OLDINDAN ko'rsatiladigan baho. Shuning uchun `createAndAcceptClaim`
 * endi `offer_id`ga MUHTOJ EMAS — `claims/create` o'zi mustaqil,
 * o'z ichida `client_requirements` bilan chaqiriladi.
 *
 * @param {string} oauthToken
 * @param {{lat:number,lng:number}} pickupLocation
 * @param {{lat:number,lng:number}} dropoffLocation
 * @param {{weightKg?: number}} [packageInfo]
 * @param {string} [taxiClass] "courier"|"express"|"cargo" - sotuvchining
 *   `yandexDelivery` sozlamasidagi tanlovi, standart "express".
 */
async function calculateOffer(oauthToken, pickupLocation, dropoffLocation, packageInfo = {}, taxiClass) {
  // MUHIM: Yandex koordinatalarni [longitude, latitude] tartibida kutadi
  // (ko'pchilik xarita tizimlaridan FARQLI, ular odatda lat,lng tartibida
  // beradi) — buni chalkashtirib yuborish, hujjatlarning o'zida alohida
  // ta'kidlangan eng ko'p uchraydigan xato manbai.
  const body = {
    items: [
      {
        size: { length: 0.3, width: 0.3, height: 0.2 },
        weight: packageInfo.weightKg || 1,
        quantity: 1,
        pickup_point: 1,
        dropoff_point: 2,
      },
    ],
    // MUHIM TUZATISH: check-price (bu funksiya) VA claims/create
    // (createAndAcceptClaim) uchun route_points SXEMASI BOSHQA-BOSHQA!
    // check-price'ning rasmiy so'rov namunasi (Yandex hujjati +
    // Python SDK) faqat `id` ishlatadi - `point_id`/`visit_order`/
    // `type` FAQAT claims/create'ga tegishli, bu yerga emas. Avval
    // ikkalasiga bir xil sxema qo'llanilgan edi - bu xato edi.
    route_points: [
      { id: 1, coordinates: [pickupLocation.lng, pickupLocation.lat], fullname: pickupLocation.address || "Jo'natuvchi manzili" },
      { id: 2, coordinates: [dropoffLocation.lng, dropoffLocation.lat], fullname: dropoffLocation.address || "Qabul qiluvchi manzili" },
    ],
    requirements: { taxi_class: resolveTaxiClass(taxiClass) },
  };

  return callYandexApi(oauthToken, "/b2b/cargo/integration/v2/check-price", body);
}

/**
 * Da'vo (claim) yaratadi VA darhol tasdiqlashga urinadi
 * (`claims/accept`).
 *
 * MUHIM TUZATISH: OLDIN bu funksiya `offer_id` talab qilardi (Rossiya
 * uchun mo'ljallangan `offers/calculate` oqimidan). O'zbekiston kabi
 * mamlakatlar uchun to'g'ri oqim (`check-price`) esa OFFER_ID
 * BERMAYDI — shuning uchun `claims/create` endi offer_id'siz, faqat
 * `client_requirements` bilan mustaqil chaqiriladi.
 */
async function createAndAcceptClaim(oauthToken, { pickup, dropoff, items, requestId, taxiClass }) {
  const createBody = {
    items: items.map((item) => ({
      pickup_point: 1,
      droppof_point: 2, // MUHIM: Yandex API'sining o'zida shu maydon nomi XATOLIK bilan yozilgan ("droppof_point", "dropoff" emas) — bu, ularning rasmiy hujjatidagi haqiqiy maydon nomi.
      title: item.title,
      size: { length: 0.3, width: 0.3, height: 0.2 },
      weight: item.weightKg || 1,
      cost_value: String(item.costValue || 1000),
      cost_currency: "UZS",
      quantity: item.quantity || 1,
    })),
    // MUHIM TUZATISH: xuddi check-price'dagidek, so'rov tanasida
    // maydon nomi `point_id` (+ tartibni bildiruvchi `visit_order`)
    // bo'lishi kerak, `id` emas - bu aynan foydalanuvchi ko'rgan
    // "route_points[0].point_id: Field is missing" xatosining sababi.
    route_points: [
      {
        point_id: 1,
        visit_order: 1,
        type: "source",
        // MUHIM TOPILMA: `skip_confirmation` standart bo'yicha `false`
        // - bu degani, Yandex kuryer kelganda sotuvchidan SMS orqali
        // yuborilgan tasdiqlash kodini so'raydi va shuni kiritmaguncha
        // kuryer mahsulotni ololmaydi. Biz bu kodni HECH QAYERDA (na
        // ilovamizda, na boshqa joyda) ko'rsatmaymiz - sotuvchi buni
        // faqat o'z telefonidagi SMS orqali bilishi kerak bo'lardi,
        // bu esa keraksiz kechikish/tushunmovchilikka olib kelishi
        // mumkin edi. Kichik-do'kon holatida bu qadam ortiqcha, shuning
        // uchun uni o'chirib qo'yamiz.
        skip_confirmation: true,
        contact: { name: pickup.contactName, phone: pickup.contactPhone },
        address: { fullname: pickup.address, coordinates: [pickup.lng, pickup.lat] },
      },
      {
        point_id: 2,
        visit_order: 2,
        type: "destination",
        skip_confirmation: true,
        contact: { name: dropoff.contactName, phone: dropoff.contactPhone },
        address: { fullname: dropoff.address, coordinates: [dropoff.lng, dropoff.lat] },
      },
    ],
    // MUHIM: `claims/create`da maydon nomi `check-price`dagidan FARQ
    // QILADI — bu yerda `client_requirements.taxi_class` (birlik),
    // u yerda esa `requirements.taxi_class` (bir xil, lekin boshqa
    // ota-maydon ostida). Bu — Yandex API'sining o'zidagi izchilsizlik.
    client_requirements: { taxi_class: resolveTaxiClass(taxiClass) },
  };

  const claim = await callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/create?request_id=${requestId}`, createBody);

  // `claims/create` darhol "accepted" holatini bermaydi — avval
  // "ready_for_approval"ga yetguncha ozgina kutish kerak bo'lishi
  // mumkin, shuning uchun `accept`ni ALOHIDA, keyingi qadamda
  // chaqiramiz (chaqiruvchi tomon buni takror urinish bilan bajaradi).
  return claim;
}

// MUHIM TUZATISH: `version` — bu doim `1` bo'ladigan qat'iy raqam EMAS,
// balki da'voning HAQIQIY JORIY versiyasi (rasmiy hujjat: "Claim
// version. Changed after the claim was edited" va `claims/create`
// javobining namunasida boshlang'ich qiymat `0` ko'rsatilgan, `1` emas).
// Avval bu yerda har doim `1` qattiq yozilgan edi — agar haqiqiy versiya
// boshqacha bo'lsa (masalan `0`), Yandex so'rovni jim-jim rad etishi
// mumkin edi ("old_version" xatosi) — bu, da'voning "tasdiqlanmagan"
// holatda abadiy tiqilib qolishining sababi bo'lgan bo'lishi mumkin.
async function acceptClaim(oauthToken, claimId, version) {
  return callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/accept?claim_id=${claimId}`, { version });
}

async function getClaimInfo(oauthToken, claimId) {
  return callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/info?claim_id=${claimId}`, {});
}

async function cancelClaim(oauthToken, claimId, cancelState, version) {
  return callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/cancel?claim_id=${claimId}`, { version, cancel_state: cancelState || "free" });
}

/**
 * Kuryerning (soxta, maxfiylikni himoya qiluvchi) telefon raqamini
 * oladi — bu raqam FAQAT buyurtma faol bo'lgan davrda ishlaydi
 * (holat "yakuniy"ga o'tguncha).
 *
 * MUHIM TUZATISH: rasmiy hujjatga ko'ra so'rov tanasida IKKITA maydon
 * ham kerak — `claim_id` VA `point_id` (ikkalasi ham majburiy).
 * Avval bu yerda faqat `point_id` yuborilar edi, `claim_id` esa
 * UMUMAN YO'Q edi — bu, "kuryer telefon raqamini olib bo'lmadi"
 * xatosining haqiqiy sababi bo'lgan bo'lishi mumkin (kuryer
 * tayinlangan-tayinlanmaganidan qat'i nazar, so'rov noto'g'ri
 * tuzilgani uchun rad etilardi).
 */
async function getCourierPhone(oauthToken, claimId, pointId) {
  return callYandexApi(oauthToken, "/b2b/cargo/integration/v2/driver-voiceforwarding", { claim_id: claimId, point_id: pointId });
}

/**
 * MIJOZGA KO'RSATISH UCHUN, HAR BIR YETKAZIB BERISH NUQTASI (destination
 * point) uchun ALOHIDA, tashqi (Yandex tomonidan boshqariladigan)
 * kuzatish havolasini oladi. Bu havola — mijozning O'ZI (Yandex OAuth
 * tokeni bo'lmasa ham) ochishi mumkin bo'lgan, jonli xaritani
 * ko'rsatadigan sahifa.
 *
 * MUHIM: bu — HAQIQIY GET so'rovi (boshqa aksariyat Yandex Delivery
 * chaqiruvlaridan farqli, ular POST + query-parametr shaklida).
 */
async function getTrackingLinks(oauthToken, claimId) {
  return callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/tracking-links?claim_id=${claimId}`, null, "GET");
}

/**
 * Kuryerning JONLI (real-time) geografik joylashuvini oladi -
 * FAQAT kuryer allaqachon tayinlangan bo'lsa (`performer_found`
 * holatidan boshlab) ma'noga ega.
 *
 * MUHIM: bu ham HAQIQIY GET so'rovi.
 */
async function getPerformerPosition(oauthToken, claimId) {
  return callYandexApi(oauthToken, `/b2b/cargo/integration/v2/claims/performer-position?claim_id=${claimId}`, null, "GET");
}

// Yandex'ning to'liq status ro'yxatidan, BIZNING order.status'imizga
// mos keladigan "yakuniy" (terminal) holatlar — bular polling'ni
// to'xtatish kerakligini bildiradi.
const TERMINAL_STATUSES = new Set([
  "delivered_finish", "returned_finish", "failed", "cancelled",
  "cancelled_with_payment", "cancelled_by_taxi", "cancelled_with_items_on_hands",
]);

module.exports = {
  YandexDeliveryError,
  VALID_TAXI_CLASSES,
  resolveTaxiClass,
  calculateOffer,
  createAndAcceptClaim,
  acceptClaim,
  getClaimInfo,
  cancelClaim,
  getCourierPhone,
  getTrackingLinks,
  getPerformerPosition,
  TERMINAL_STATUSES,
};
