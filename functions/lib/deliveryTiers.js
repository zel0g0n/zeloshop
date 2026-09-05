/**
 * MUHIM: bu fayl `src/constants/deliveryTiers.js`dagi MANTIQ bilan
 * TO'LIQ BIR XIL bo'lishi SHART - frontend va backend ALOHIDA npm
 * paketlar bo'lgani uchun (umumiy import qilib bo'lmaydi), shu sof
 * mantiq ATAYLAB IKKALA joyda TAKRORLANGAN. Agar birini
 * o'zgartirsangiz, IKKINCHISINI HAM albatta yangilang - aks holda
 * mijozga KO'RSATILGAN narx bilan SERVERDA HAQIQIY hisoblangan narx
 * bir-biriga to'g'ri kelmay qolishi mumkin.
 */
const REGION_GROUPS = {
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

function resolveDeliveryTier(sellerRegion, customerRegion) {
  if (!sellerRegion || !customerRegion) return null;
  if (sellerRegion === customerRegion) return "sameCity";
  const sellerGroup = REGION_GROUPS[sellerRegion];
  const customerGroup = REGION_GROUPS[customerRegion];
  if (sellerGroup && sellerGroup === customerGroup) return "sameRegionDistricts";
  return "otherRegions";
}

module.exports = { resolveDeliveryTier, REGION_GROUPS };
