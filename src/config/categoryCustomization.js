import { getCategoriesForNiche } from "@/config/niches";

/**
 * SOTUVCHI DARAJASIDAGI KATEGORIYA MOSLASHTIRISH.
 *
 * MUAMMO: `niches.js`dagi kategoriyalar ro'yxati BUTUN NICHE uchun
 * UMUMIY (masalan barcha Kosmetika sotuvchilari bir xil 10 ta
 * kategoriyani ko'radi). Lekin ayrim sotuvchilar o'z do'konining
 * o'ziga xosligini aks ettirish uchun: (1) kerak bo'lmagan
 * kategoriyani YASHIRISHNI, (2) o'ziga qulayroq NOM berishni
 * (masalan "Yuz parvarishi" o'rniga "Premium teri parvarishi"), (3)
 * o'zi ko'rsatgan TARTIBDA ko'rishni, (4) va NICHE ro'yxatida umuman
 * yo'q, o'ziga xos SUBKATEGORIYA (masalan "Luxury Skincare")
 * qo'shishni xohlashi mumkin.
 *
 * YECHIM: sotuvchi hujjatida (`sellers/{id}.categoryCustomization`)
 * saqlanadigan, ixtiyoriy "qatlam" — niche konfiguratsiyasining O'ZINI
 * o'zgartirmaydi (barcha boshqa sotuvchilarga ta'sir qilmaydi), faqat
 * SHU sotuvchi uchun YAKUNIY, ko'rsatiladigan ro'yxatni hosil qiladi.
 *
 * MUHIM (mavjud ma'lumotni himoya qilish): mahsulotning
 * `product.category` maydonida HAR DOIM asl `value` saqlanadi — hech
 * qachon O'ZGARTIRILMAYDI. "Rename" FAQAT ko'rsatiladigan `label`ni
 * o'zgartiradi, "hide" esa mahsulotni O'CHIRMAYDI, faqat uni tanlash/
 * ko'rsatish ro'yxatlaridan chetlab o'tadi — mavjud mahsulot, garchi
 * kategoriyasi "yashirilgan" bo'lsa ham, ishlab turishda davom etadi
 * (faqat yangi mahsulot qo'shishda endi tanlanmaydi).
 *
 * `categoryCustomization` shakli (barcha maydonlar ixtiyoriy):
 *   {
 *     hiddenValues: string[],              // yashirilgan kategoriya `value`lari
 *     renamedLabels: { [value]: string },  // sotuvchi bergan yangi ko'rinadigan nom
 *     order: string[],                     // sotuvchi tanlagan ko'rsatish tartibi (value bo'yicha)
 *     customCategories: {value,label}[],   // sotuvchi qo'shgan, niche ro'yxatida YO'Q kategoriya/subkategoriya
 *   }
 */
export const EMPTY_CATEGORY_CUSTOMIZATION = {
  hiddenValues: [],
  renamedLabels: {},
  order: [],
  customCategories: [],
};

/**
 * Niche'ning BAZAVIY kategoriyalar ro'yxati + sotuvchining
 * moslashtirishlarini birlashtirib, YAKUNIY (ko'rsatiladigan) ro'yxatni
 * qaytaradi. Sof funksiya — Firestore/tarmoqqa bog'liq emas, to'g'ridan-
 * to'g'ri testlanadi.
 *
 * Tartib: (1) sotuvchi qo'shgan CUSTOM kategoriyalar bazaviy ro'yxatga
 * QO'SHILADI (agar shu `value` allaqachon mavjud bo'lsa — bazaviy
 * versiya SAQLANADI, takror qo'shilmaydi), (2) RENAME qo'llaniladi
 * (faqat `label`, `value` o'zgarmaydi), (3) YASHIRILGANLAR olib
 * tashlanadi, (4) TARTIB qo'llaniladi (`order`da yo'q qiymatlar —
 * masalan yangi qo'shilgan kategoriya — oxiriga, asl tartibda
 * qo'shiladi).
 *
 * @param {Array<{value:string,label:string}>} baseCategories
 * @param {typeof EMPTY_CATEGORY_CUSTOMIZATION} [customization]
 * @returns {Array<{value:string,label:string}>}
 */
export function applyCategoryCustomization(baseCategories, customization) {
  const base = Array.isArray(baseCategories) ? baseCategories : [];
  const c = customization || EMPTY_CATEGORY_CUSTOMIZATION;
  const hiddenValues = new Set(Array.isArray(c.hiddenValues) ? c.hiddenValues : []);
  const renamedLabels = c.renamedLabels && typeof c.renamedLabels === "object" ? c.renamedLabels : {};
  const order = Array.isArray(c.order) ? c.order : [];
  const customCategories = Array.isArray(c.customCategories) ? c.customCategories : [];

  const existingValues = new Set(base.map((cat) => cat.value));
  const merged = [
    ...base,
    ...customCategories.filter((cat) => cat && cat.value && !existingValues.has(cat.value)),
  ];

  const renamed = merged.map((cat) => (
    renamedLabels[cat.value] ? { ...cat, label: renamedLabels[cat.value] } : cat
  ));

  const visible = renamed.filter((cat) => !hiddenValues.has(cat.value));

  if (order.length === 0) return visible;

  const orderIndex = new Map(order.map((value, index) => [value, index]));
  return visible
    .map((cat, originalIndex) => ({ cat, originalIndex }))
    .sort((a, b) => {
      const aIndex = orderIndex.has(a.cat.value) ? orderIndex.get(a.cat.value) : order.length + a.originalIndex;
      const bIndex = orderIndex.has(b.cat.value) ? orderIndex.get(b.cat.value) : order.length + b.originalIndex;
      return aIndex - bIndex;
    })
    .map((entry) => entry.cat);
}

/**
 * `store` (sotuvchi hujjati, `SessionContext`dan) uchun, uning
 * niche'i + shaxsiy moslashtirishlarini birlashtirgan YAKUNIY
 * kategoriyalar ro'yxatini qaytaradi. Barcha chaqiruvchilar
 * (`BasicInfoCard.jsx`, `CategoryGrid.jsx` va h.k.) shu funksiyani
 * `getCategoriesForNiche(store?.category)` o'rniga ishlatadi — shu
 * orqali "sotuvchi nom o'zgartirdi/yashirdi/tartibladi" HAR QAYERDA
 * (mahsulot qo'shish formasi, do'kon vitrinasi, filtrlar) BIR XIL
 * ko'rinadi.
 *
 * @param {{category?: string, categoryCustomization?: object}|null|undefined} store
 */
export function getEffectiveCategoriesForStore(store) {
  return applyCategoryCustomization(getCategoriesForNiche(store?.category), store?.categoryCustomization);
}
