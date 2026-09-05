/**
 * SOTUVCHIGA NISBATAN 3 BOSQICHLI YETKAZIB BERISH TIZIMI.
 *
 * MUHIM TUZATISH (foydalanuvchi bilan aniqlashtirilgan yondashuv):
 * OLDIN — kuryer narxlari 5 ta QATTIQ BELGILANGAN, sotuvchining
 * O'Z JOYLASHUVIGA UMUMAN BOG'LIQ BO'LMAGAN mintaqalarga (Toshkent
 * shahri/viloyati/Farg'ona vodiysi/Samarqand-Buxoro/Uzoq hududlar)
 * sozlanardi — bu, masalan Xorazmda joylashgan sotuvchi uchun
 * MANTIQSIZ edi (nega uning narxlari "Farg'ona vodiysi" atrofida
 * guruhlangan bo'lishi kerak?).
 *
 * ENDI — narx SOTUVCHINING O'Z HUDUDIGA (`store.region`) NISBATAN,
 * 3 bosqichda belgilanadi:
 *   1. "Shahar" — xaridor ANIQ SOTUVCHI bilan BIR XIL hududda
 *   2. "Viloyat ichidagi tumanlar" — xaridor SOTUVCHINING KENGROQ
 *      HUDUDIY GURUHIDA (pastga qarang), lekin ANIQ bir xil emas
 *   3. "Boshqa viloyatlar" — xaridor BUTUNLAY boshqa hududiy guruhda
 *
 * HUDUDIY GURUHLASH HAQIQIY GEOGRAFIK MANTIQQA ASOSLANGAN: faqat
 * "Toshkent shahri" va "Toshkent viloyati" — bir-biriga ENG YAQIN,
 * amalda bir-biridan farqlanadigan (shahar markazi / atrofdagi
 * tumanlar) IKKI ALOHIDA yozuv sifatida mavjud, shuning uchun FAQAT
 * ular uchun 2-bosqich (tumanlar) haqiqiy ma'no kasb etadi. Qolgan
 * 12 viloyatning HAR BIRI — o'zining YAKKA guruhi (chunki bizda
 * ularning ichki tuman darajasidagi ma'lumoti yo'q, va buni qo'shish
 * yuzlab tumanni o'z ichiga olgan katta ma'lumot bazasini talab
 * qilardi) — bu, amalda, ular uchun 2-bosqich HECH QACHON
 * ishlatilmasligini, faqat 1 ("aniq bir xil viloyat") va 3
 * ("boshqa viloyat") bosqichlar ishlashini anglatadi - bu XATO EMAS,
 * balki mavjud ma'lumot granularligiga MOS, halol cheklov.
 */
export const REGION_GROUPS = {
  "Toshkent shahri": "tashkent_metro",
  "Toshkent viloyati": "tashkent_metro",
  "Andijon": "andijon",
  "Buxoro": "buxoro",
  "Farg'ona": "fergana",
  "Jizzax": "jizzax",
  "Xorazm": "xorazm",
  "Namangan": "namangan",
  "Navoiy": "navoiy",
  "Qashqadaryo": "qashqadaryo",
  "Qoraqalpog'iston Respublikasi": "qoraqalpogiston",
  "Samarqand": "samarqand",
  "Sirdaryo": "sirdaryo",
  "Surxondaryo": "surxondaryo",
};

export const DELIVERY_TIER_KEYS = ["sameCity", "sameRegionDistricts", "otherRegions"];

/**
 * Sotuvchi hududi va xaridor hududini solishtirib, qaysi bosqich
 * (tier) qo'llanilishini aniqlaydi. SOF FUNKSIYA.
 *
 * @returns {"sameCity"|"sameRegionDistricts"|"otherRegions"|null} -
 *   `null` faqat ikkala hudud ham berilmagan holatda qaytadi.
 */
export function resolveDeliveryTier(sellerRegion, customerRegion) {
  if (!sellerRegion || !customerRegion) return null;
  if (sellerRegion === customerRegion) return "sameCity";
  const sellerGroup = REGION_GROUPS[sellerRegion];
  const customerGroup = REGION_GROUPS[customerRegion];
  if (sellerGroup && sellerGroup === customerGroup) return "sameRegionDistricts";
  return "otherRegions";
}

/**
 * 2-bosqich ("Viloyat ichidagi tumanlar") sotuvchi uchun HAQIQATAN
 * ma'noga ega ekanligini tekshiradi - faqat Toshkent shahri/viloyati
 * sotuvchilari uchun TO'G'RI (yuqoridagi izohga qarang). Boshqa
 * hududdagi sotuvchilar uchun bu bosqich UI'da ko'rsatilmaydi
 * (chalkashtirmaslik uchun - amalda hech qachon ishlatilmaydigan
 * narx maydonini ko'rsatishning ma'nosi yo'q).
 */
export function hasDistrictTier(sellerRegion) {
  const group = REGION_GROUPS[sellerRegion];
  if (!group) return false;
  return Object.values(REGION_GROUPS).filter((g) => g === group).length > 1;
}
