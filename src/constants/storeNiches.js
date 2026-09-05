// Do'kon SOHASI (butun do'konga tegishli, keng ro'yxat) — bu
// `constants/productCategories.js` dagi (Skincare/Makeup/Perfume/Tools)
// mahsulot kategoriyalaridan FARQ QILADI. U yerdagi ro'yxat faqat
// bitta sohaning mahsulot kategoriyalari; bu yerdagi ro'yxat esa
// istalgan sohadagi sotuvchi ro'yxatdan o'tishi uchun.
//
// MUHIM: bu qiymatlar (`value`) — Firestore'da saqlanadigan va
// `getCategoriesForNiche()` orqali mos mahsulot kategoriyalarini
// topish uchun KALIT sifatida ishlatiladigan MA'LUMOT (xuddi
// mahsulot kategoriyalari kabi) — shuning uchun ATAYLAB tarjima
// qilinmaydi (Products bosqichida qabul qilingan qaror bilan bir xil).
//
// OLDIN bu yerda emoji (`icon`) maydoni bor edi — lekin bu ro'yxat
// FAQAT native HTML `<select><option>` ichida ishlatiladi, u yerda
// Lucide SVG ikonkalarini ko'rsatib bo'lmaydi (option — faqat matn).
// Shuning uchun emoji butunlay olib tashlandi (loyihaning "faqat
// lucide-react ikonkalar" qoidasiga mos ravishda).
//
// YANGILANDI (15-niche universal platforma): bu ro'yxat endi
// `src/config/niches.js`dagi TO'LIQ NicheConfig registridan HOSIL
// QILINADI (bitta manba, ikki joyda saqlanmaydi) — har bir niche
// endi faqat kategoriyalar emas, balki attributelar, AI konteksti,
// qidiruv sinonimlari va tavsiya qoidalariga ham ega. "Mahsulot
// qo'shish" formasi ENDI tanlangan sohaga mos kategoriyalarni
// to'g'ri ko'rsatadi (`BasicInfoCard.jsx`/`AttributesCard.jsx`) —
// oldingi versiyada bu yerda hujjatlashtirilgan nomuvofiqlik
// (barcha sotuvchilarga faqat Kosmetika kategoriyalari ko'rinishi)
// endi TUZATILDI.
import { NICHE_IDS } from "@/config/niches";

export const STORE_NICHES = NICHE_IDS.map((value) => ({ value }));
