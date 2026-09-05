// Har bir soha (niche) o'zining mos subkategoriyalariga ega — do'kon
// sohalari (STORE_NICHES) turli-tuman bo'lgani uchun yagona umumiy
// kategoriyalar ro'yxati barcha sohalarga mos kelmaydi.
// `getCategoriesForNiche(niche)` sotuvchining tanlagan sohasiga mos
// kategoriyalarni qaytaradi.
//
// YANGILANDI (15-niche universal platforma): bu fayl endi
// `src/config/niches.js`dagi to'liq NicheConfig registridan qayta
// eksport qiladi (bitta manba) — mavjud barcha chaqiruvchilar
// (`BasicInfoCard.jsx`, `CategoryGrid.jsx`, va h.k.) o'zgarishsiz
// ishlashda davom etadi, chunki eksport nomlari va shakli (`{value,
// label}[]`) bir xil qoldirildi.
export {
  getCategoriesForNiche,
} from "@/config/niches";
import { NICHES, getCategoriesForNiche as getCats } from "@/config/niches";

/** Barcha niche'lar uchun kategoriyalar xaritasi (niche id -> categories[]). */
export const NICHE_CATEGORIES = NICHES.reduce((acc, n) => {
  acc[n.id] = n.categories;
  return acc;
}, { Boshqa: getCats("Boshqa") });

// Eski kod bilan moslik uchun — hech kim ishlatmasa ham xavfsiz zaxira.
export const PRODUCT_CATEGORIES = NICHE_CATEGORIES["Kosmetika"];
