/**
 * Kuryerning joylashuvini olish uchun birlashgan, ikki qatlamli
 * interfeys.
 *
 * Oddiy brauzer `navigator.geolocation.watchPosition` ba'zi Telegram
 * Mini App WebView'larida ishonchsiz yoki umuman ishlamasligi mumkin.
 * Telegram bunday holatlar uchun alohida `WebApp.LocationManager`
 * API'sini beradi (Bot API 6.9+) — shuning uchun avval shu sinab
 * ko'riladi, va faqat u mavjud bo'lmasa (masalan brauzerda test
 * qilinayotganda) yoki xato bersa, oddiy brauzer API'siga qaytiladi.
 *
 * Telegram `LocationManager`da "davomiy kuzatuv" (watchPosition kabi)
 * mavjud emas — faqat bir martalik `getLocation()` bor. Shuning uchun
 * bu yerdagi `watchCourierLocation` davriylikni (har necha soniyada
 * bir so'rov) o'zi boshqaradi — ikkala manba uchun ham bir xil,
 * oddiy "so'rov -> kutish -> yana so'rov" siklida (`setInterval` emas,
 * `setTimeout` zanjiri — bitta so'rov kutilganidan uzoqroq davom
 * etsa, ustma-ust so'rovlar yuborilmasligi uchun).
 */

const getTelegramLocationManager = () => {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp?.LocationManager || null;
};

/**
 * `{ ok: true, lat, lng, source }` yoki `{ ok: false, reason }`
 * qaytaradi. `reason` — "denied" (foydalanuvchi/OS ruxsat bermagan —
 * boshqa manbaga urinishning ma'nosi yo'q, bir xil OS-darajasidagi
 * ruxsat) yoki "unavailable" (API yo'q/vaqtinchalik xato — boshqa
 * manbaga qaytish mantiqiy).
 */
const requestViaTelegram = () =>
  new Promise((resolve) => {
    const lm = getTelegramLocationManager();
    if (!lm) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }

    const finish = () => {
      try {
        lm.getLocation((data) => {
          if (data && typeof data.latitude === "number" && typeof data.longitude === "number") {
            resolve({ ok: true, lat: data.latitude, lng: data.longitude, source: "telegram" });
          } else {
            resolve({ ok: false, reason: lm.isAccessGranted === false ? "denied" : "unavailable" });
          }
        });
      } catch {
        resolve({ ok: false, reason: "unavailable" });
      }
    };

    if (lm.isInited) {
      finish();
    } else {
      try {
        lm.init(finish);
      } catch {
        resolve({ ok: false, reason: "unavailable" });
      }
    }
  });

const requestViaBrowser = () =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unavailable" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, source: "browser" }),
      (err) => resolve({ ok: false, reason: err?.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  });

/**
 * Bitta joylashuv o'qishini so'raydi — avval Telegram orqali, kerak
 * bo'lsa brauzer orqali.
 */
export const requestCourierLocationOnce = async () => {
  const viaTelegram = await requestViaTelegram();
  if (viaTelegram.ok) return viaTelegram;
  // Telegram aniq "ruxsat berilmagan" desa, brauzerga qaytishning
  // ma'nosi yo'q — ikkalasi ham bir xil OS-darajasidagi joylashuv
  // ruxsatiga tayanadi.
  if (viaTelegram.reason === "denied") return viaTelegram;
  return requestViaBrowser();
};

/**
 * Davriy joylashuv kuzatuvi. Har muvaffaqiyatli o'qishda `onUpdate({lat,
 * lng})` chaqiriladi; ruxsat aniq rad etilganda `onDenied()` faqat bir
 * marta (qayta-qayta bezovta qilmaslik uchun) chaqiriladi — vaqtinchalik
 * "unavailable" xatolar jim o'tkazib yuboriladi (masalan GPS signali
 * vaqtincha yo'qolishi doimiy muammo emas).
 *
 * @returns {() => void} to'xtatish funksiyasi
 */
export const watchCourierLocation = (onUpdate, onDenied, intervalMs = 8000) => {
  let cancelled = false;
  let timeoutId = null;
  let deniedAlreadyReported = false;

  const scheduleNext = () => {
    if (cancelled) return;
    timeoutId = setTimeout(tick, intervalMs);
  };

  const tick = async () => {
    const result = await requestCourierLocationOnce();
    if (cancelled) return;
    if (result.ok) {
      onUpdate({ lat: result.lat, lng: result.lng, source: result.source });
    } else if (result.reason === "denied" && !deniedAlreadyReported) {
      deniedAlreadyReported = true;
      onDenied?.();
    }
    scheduleNext();
  };

  tick();

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
};

/**
 * Kuryerga "joylashuv ruxsati" sozlamalarini ochish imkoni bo'lsa
 * (Telegram `LocationManager.openSettings()` — faqat rad etilgandan
 * keyin mavjud), UI'da "Sozlamalarni ochish" tugmasini ko'rsatish
 * uchun ishlatiladi. Mavjud bo'lmasa `false` qaytaradi — chaqiruvchi
 * o'rniga oddiy matnli yo'riqnoma ko'rsatishi kerak.
 */
export const openCourierLocationSettings = () => {
  const lm = getTelegramLocationManager();
  if (!lm?.openSettings) return false;
  try {
    lm.openSettings();
    return true;
  } catch {
    return false;
  }
};

export const isLocationSettingsShortcutAvailable = () => Boolean(getTelegramLocationManager()?.openSettings);
