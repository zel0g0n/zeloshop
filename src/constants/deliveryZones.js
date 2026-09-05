// Yetkazib berish narxlari uchun HUDUDIY GURUHLAR — bular
// `constants/uzbekistanRegions.js`dagi 14 ta aniq viloyatdan farqli
// (u yerda sotuvchi o'z joylashuvini bitta aniq viloyat sifatida
// tanlaydi). Bu yerda esa kuryer narxini sozlashni soddalashtirish
// uchun 5 ta kengroq mintaqaga guruhlangan.
//
// KO'P TILLILIK TUZATISHI: bu qiymatlar SOTUVCHI SOZLAMALARIDA VA
// XARIDOR CHECKOUT'IDA ham ko'rsatiladi — shuning uchun `label`
// endi to'g'ridan-to'g'ri matn EMAS, balki tarjima kaliti
// (`labelKey`). Chaqiruvchi tomon `t(\`deliveryZones.${labelKey}\`)`
// orqali oladi.
export const DELIVERY_ZONES = [
  { key: "tashkent_city", labelKey: "tashkentCity" },
  { key: "tashkent_region", labelKey: "tashkentRegion" },
  { key: "fergana_valley", labelKey: "ferganaValley" },
  { key: "samarkand_bukhara", labelKey: "samarkandBukhara" },
  { key: "far_regions", labelKey: "farRegions" },
];

// MUHIM: bu qiymatlar OLDIN to'g'ridan-to'g'ri (tarjima qilinmagan)
// matn sifatida Firestore'ga SAQLANARDI. Endi — barqaror KALITLAR
// (`deliveryZones.${key}` orqali tarjima qilinadi). Eski, xom matn
// sifatida saqlangan qiymatlar hali ham xavfsiz — `t()` funksiyasi
// tanimagan kalitni topilmasa, uni o'zgarishsiz qaytaradi (demak eski
// sotuvchilar sozlamalari buzilmaydi, faqat yangi saqlanganlar
// to'liq ko'p tillilikka ega bo'ladi).
export const DELIVERY_TIME_KEYS = ["days1_2", "days2_3", "days3_5", "days5_7"];
