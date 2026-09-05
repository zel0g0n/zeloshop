/**
 * SOTUVCHI UCHUN "SOZLASH BO'YICHA QO'LLANMA" (onboarding checklist).
 *
 * MUHIM ARXITEKTURA QARORI (Firebase xarajatlarini nazarda tutib):
 * bu funksiya HECH QANDAY yangi Firestore so'rovi qilmaydi - faqat
 * SessionContext orqali ALLAQACHON xotirada mavjud bo'lgan
 * `store` (sotuvchi hujjati) va `dashboardSummary` (auth chaqiruvi
 * bilan bepul kelgan statistika) ma'lumotidan foydalanadi. Yangi
 * "obuna" (listener) yoki so'rov ochilmaydi.
 *
 * @param {Object|null} store - SessionContext'dagi `store`
 * @param {Object|null} dashboardSummary - SessionContext'dagi `dashboardSummary`
 * @returns {Array<{key:string, done:boolean, routeTo:string|null, action:string|null}>}
 */
export function buildOnboardingSteps(store, dashboardSummary) {
  const hasLogoAndName = Boolean(store?.storeName?.trim()) && Boolean(store?.logo);
  const hasProduct = (dashboardSummary?.totalProductsCount || 0) >= 1;
  // MUHIM TUZATISH (haqiqiy regressiya, o'z-o'zini qayta tekshiruv
  // orqali topilgan): yetkazib berish tizimi `deliveryZones`dan
  // `deliveryTiers`ga (sotuvchi hududiga nisbatan 3 bosqichli
  // tizimga) QAYTA QURILGANDA, bu YERDAGI tekshiruv ESKI maydon
  // nomida QOLIB KETGAN edi - natijada, HECH QACHON to'g'ri
  // "bajarilgan" deb belgilanmasdi (chunki sotuvchilar ENDI faqat
  // `deliveryTiers`ga yozadi, `deliveryZones`ga emas) - checklist
  // bosqichi doim "bajarilmagan" bo'lib ko'rinardi, hatto sotuvchi
  // narxlarni to'liq sozlagan bo'lsa ham.
  const hasDeliveryZone = Boolean(store?.deliveryTiers && Object.keys(store.deliveryTiers).length > 0);
  const hasOrder = Boolean(dashboardSummary?.hasEverOrdered);
  const hasShared = Boolean(store?.onboardingSharedAt);

  return [
    { key: "storeInfo", done: hasLogoAndName, routeTo: "/seller/store-settings", action: null },
    { key: "firstProduct", done: hasProduct, routeTo: "/seller/add-product", action: null },
    { key: "deliveryZone", done: hasDeliveryZone, routeTo: "/seller/delivery-settings", action: null },
    // MUHIM O'ZGARISH: OLDIN bu bosqich faqat pastdan chiqadigan
    // ulashish oynasini (`ShareStoreModal`) ochardi. Endi, foydalanuvchi
    // so'rovi bilan, TO'LIQ "Ulanishlar" sahifasiga yo'naltiradi — u
    // yerda do'kon havolasi BILAN BIRGA shaxsiy bot ulash ham ko'rinadi
    // (ikkalasi ham "do'konga qanday bog'lanish mumkin" mavzusiga
    // aloqador). "Bajarilgan" belgisi endi shu sahifada real nusxalash/
    // ulashish bosilganda qo'yiladi (`ConnectionsPage.jsx`dagi
    // `markShared`), oynani ochish paytida EMAS.
    { key: "shareStore", done: hasShared, routeTo: "/seller/connections", action: null },
    { key: "firstOrder", done: hasOrder, routeTo: null, action: null },
  ];
}

/**
 * Umumiy taraqqiyot (progress) - bosqichlar soni va foizi.
 */
export function computeOnboardingProgress(steps) {
  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    isComplete: total > 0 && completed === total,
  };
}
