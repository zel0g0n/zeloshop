// Yetkazib berish narxlari uchun HUDUDIY GURUHLAR — bular
// `constants/uzbekistanRegions.js`dagi 14 ta aniq viloyatdan farqli
// (u yerda sotuvchi o'z joylashuvini bitta aniq viloyat sifatida
// tanlaydi). Bu yerda esa kuryer narxini sozlashni soddalashtirish
// uchun 5 ta kengroq mintaqaga guruhlangan.
export const DELIVERY_ZONES = [
  { key: "tashkent_city", label: "Toshkent shahri" },
  { key: "tashkent_region", label: "Toshkent viloyati" },
  { key: "fergana_valley", label: "Farg'ona vodiysi" },
  { key: "samarkand_bukhara", label: "Samarqand / Buxoro (Voha)" },
  { key: "far_regions", label: "Uzoq viloyatlar (Xorazm/Qoraqalpog'iston)" },
];

export const DELIVERY_TIME_OPTIONS = [
  "1-2 kun ichida",
  "2-3 kun ichida",
  "3-5 kun ichida",
  "5-7 kun ichida",
];
