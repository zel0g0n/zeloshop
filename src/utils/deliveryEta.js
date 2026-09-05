// Kuryerning jonli joylashuvidan yetkazish manziligacha bo'lgan
// TAXMINIY masofa/vaqtni hisoblaydi. Haqiqiy yo'l (ko'cha, svetofor,
// tirbandlik) hisobga OLINMAYDI — bu oddiy "to'g'ri chiziq" (Haversine)
// masofasi, o'rtacha shahar-ichi tezlikka bo'linadi. Pullik marshrut
// API (Google/Yandex Directions) ULANMAGANI uchun ATAYLAB "taxminiy"
// deb belgilanadi — foydalanuvchiga chalg'ituvchi soxta aniqlik
// bermaslik uchun (interfeys tomonida albatta "~" belgisi va
// "taxminiy" so'zi bilan ko'rsatilishi kerak).

const EARTH_RADIUS_KM = 6371;

// Shahar ichida kuryer (piyoda/velosiped/mototsikl/avtomobil aralash)
// uchun o'rtacha tezlik, taxminan — tirbandlik/svetoforlarni hisobga
// olgan holda, real GPS masofadan SEZILARLI kamroq.
const ASSUMED_AVG_SPEED_KMH = 22;

/**
 * Ikki nuqta ({lat,lng}) orasidagi masofani kilometrda qaytaradi.
 * Kiritilgan qiymatlar noto'g'ri bo'lsa `null` qaytaradi.
 */
export function haversineDistanceKm(a, b) {
  if (!a || !b || typeof a.lat !== "number" || typeof a.lng !== "number" || typeof b.lat !== "number" || typeof b.lng !== "number") {
    return null;
  }
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Kuryer joylashuvidan manzilgacha TAXMINIY yetib borish vaqtini
 * (daqiqada) hisoblaydi. Masofa/koordinatalar mavjud bo'lmasa `null`
 * qaytaradi (interfeys bunday holda ETA'ni umuman ko'rsatmasligi kerak).
 */
export function estimateEtaMinutes(courierPosition, destination) {
  const distanceKm = haversineDistanceKm(courierPosition, destination);
  if (distanceKm === null) return null;
  return Math.max(1, Math.round((distanceKm / ASSUMED_AVG_SPEED_KMH) * 60));
}
