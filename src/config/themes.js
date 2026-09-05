/**
 * BREND TEMA DVIGATELI (Theme Engine) — konfiguratsiya va registr.
 *
 * MUHIM AJRATISH — loyihada uchta MUSTAQIL "ko'rinish" tushunchasi bor,
 * ular bir-biriga BOG'LANMAGAN:
 *   1. "Appearance" (Light/Dark/System) — `ThemeContext.jsx`da, HAR BIR
 *      shaxsiy foydalanuvchi (sotuvchi ham, xaridor ham) o'zi uchun
 *      tanlaydigan neytral kontrast rejimi. Bu fayl bilan ISHI YO'Q.
 *   2. "Seller App Theme" (`sellers/{id}.sellerAppTheme`) — sotuvchi
 *      o'zining boshqaruv paneli (Mini App) uchun tanlaydigan brend
 *      rangi. Faqat sotuvchining o'ziga ko'rinadi.
 *   3. "Storefront Theme" (`sellers/{id}.storefrontTheme`) — sotuvchi
 *      o'z XARIDORLARI ko'radigan do'kon uchun tanlaydigan brend rangi.
 *      Mustaqil — (2) bilan bir xil bo'lishi SHART EMAS.
 *
 * Har bir tema — faqat rang emas, balki KICHIK "shaxsiyat" to'plami
 * (asosiy rang, tugma matni rangi, yumshoq fon, radius). Ranglar
 * WCAG AA (>=4.5:1, tugma matni uchun) standartiga qarshi TEKSHIRILGAN
 * (`/tmp/contrast-check.mjs` orqali, ishlab chiqish jarayonida).
 *
 * KENGAYTIRISH: yangi tema qo'shish uchun shu massivga bitta yangi
 * obyekt qo'shish YETARLI (+ tegishli 3 tildagi `themes.<id>` tarjima
 * kaliti) — birorta ham komponentni qayta yozish SHART EMAS, chunki
 * barcha komponentlar CSS o'zgaruvchilari (`--color-brand*`) orqali
 * ishlaydi, `BrandThemeContext.jsx` esa shu o'zgaruvchilarni HAR BIR
 * tanlangan temaning haqiqiy qiymatlariga runtime'da (build vaqtida
 * emas) moslaydi.
 */

export const THEMES = [
  {
    id: "ocean",
    nameKey: "themes.ocean",
    descKey: "themes.oceanDesc",
    radius: "1rem",
    colors: {
      light: { primary: "#2563EB", foreground: "#FFFFFF", soft: "#E7EFFE" },
      dark: { primary: "#5B9BFF", foreground: "#0B1220", soft: "#16233D" },
    },
  },
  {
    id: "royalPurple",
    nameKey: "themes.royalPurple",
    descKey: "themes.royalPurpleDesc",
    radius: "1rem",
    colors: {
      light: { primary: "#7C3AED", foreground: "#FFFFFF", soft: "#F1E9FE" },
      dark: { primary: "#B294FF", foreground: "#160B33", soft: "#241A3D" },
    },
  },
  {
    id: "freshGreen",
    nameKey: "themes.freshGreen",
    descKey: "themes.freshGreenDesc",
    radius: "1rem",
    colors: {
      light: { primary: "#15803D", foreground: "#FFFFFF", soft: "#E3F6E9" },
      dark: { primary: "#4ADE80", foreground: "#08210F", soft: "#12291B" },
    },
  },
  {
    id: "energyOrange",
    nameKey: "themes.energyOrange",
    descKey: "themes.energyOrangeDesc",
    radius: "0.875rem",
    colors: {
      light: { primary: "#C2410C", foreground: "#FFFFFF", soft: "#FCE9DD" },
      dark: { primary: "#FB923C", foreground: "#2A1103", soft: "#2E1B0D" },
    },
  },
  {
    id: "boldRed",
    nameKey: "themes.boldRed",
    descKey: "themes.boldRedDesc",
    radius: "0.75rem",
    colors: {
      light: { primary: "#DC2626", foreground: "#FFFFFF", soft: "#FBE4E2" },
      dark: { primary: "#F87171", foreground: "#2C0B0B", soft: "#301414" },
    },
  },
  {
    id: "blossom",
    nameKey: "themes.blossom",
    descKey: "themes.blossomDesc",
    radius: "1.25rem",
    colors: {
      light: { primary: "#BE185D", foreground: "#FFFFFF", soft: "#FBE3EE" },
      dark: { primary: "#F9A8D4", foreground: "#3A0A20", soft: "#33121F" },
    },
  },
  {
    id: "luxury",
    nameKey: "themes.luxury",
    descKey: "themes.luxuryDesc",
    radius: "1.25rem",
    colors: {
      light: { primary: "#8A6A1E", foreground: "#FFFFFF", soft: "#F3ECD8" },
      dark: { primary: "#E3B65C", foreground: "#241900", soft: "#2A2210" },
    },
  },
  {
    id: "minimal",
    nameKey: "themes.minimal",
    descKey: "themes.minimalDesc",
    radius: "0.5rem",
    colors: {
      light: { primary: "#18181B", foreground: "#FFFFFF", soft: "#F1F1F3" },
      dark: { primary: "#E4E4E7", foreground: "#18181B", soft: "#232327" },
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const DEFAULT_THEME_ID = "ocean";

const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

/**
 * Har qanday (shu jumladan noto'g'ri/eskirgan/`null`) qiymat uchun
 * XAVFSIZ tema konfiguratsiyasini qaytaradi — hech qachon `undefined`
 * qaytarmaydi, hech qachon throw qilmaydi. Noma'lum ID kelsa (masalan
 * Firestore'da qo'lda buzilgan qiymat, yoki kelajakda olib tashlangan
 * eski tema), standart "Ocean"ga qaytadi — `niches.js`dagi
 * `getNicheConfig`ning "Boshqa"ga zaxira qilish tamoyili bilan BIR XIL.
 */
export function getThemeConfig(themeId) {
  return THEME_MAP.get(themeId) || THEME_MAP.get(DEFAULT_THEME_ID);
}

export function isValidThemeId(themeId) {
  return THEME_MAP.has(themeId);
}

/**
 * Berilgan tema + rejim (light/dark) uchun HAQIQIY rang qiymatlarini
 * qaytaradi — `BrandThemeContext`dagi CSS o'zgaruvchi in'ektsiyasi va
 * tema tanlash sahifalaridagi mahalliy (preview) qamrov uchun
 * ishlatiladi.
 */
export function resolveThemeColors(themeId, isDark) {
  const theme = getThemeConfig(themeId);
  return theme.colors[isDark ? "dark" : "light"];
}

/**
 * 15 SOHA UCHUN TEMA TAVSIYASI (2026-09 punkt-royxati, 29-band).
 *
 * MUHIM: bu FAQAT tavsiya — onboarding yoki tema tanlash sahifasida
 * "sizning sohangiz uchun mos" belgisi sifatida ko'rsatiladi, sotuvchi
 * tanlovini HECH QACHON cheklamaydi yoki majburlamaydi. `niches.js`dagi
 * `id` qiymatlari (masalan "Kosmetika") bilan bog'langan, chunki
 * sotuvchining sohasi shu maydonda saqlanadi (`sellers/{id}.category`).
 */
export const NICHE_THEME_RECOMMENDATIONS = {
  "Kosmetika": "blossom",
  "Kiyim-kechak": "luxury",
  "Poyabzal": "boldRed",
  "Uy-ro'zg'or buyumlari": "minimal",
  "Elektronika": "ocean",
  "Bolalar tovarlari": "blossom",
  "Zargarlik va aksessuarlar": "luxury",
  "Suvenir mahsulotlar": "energyOrange",
  "Uy hayvonlari tovarlari": "freshGreen",
  "Sport va faollik": "freshGreen",
  "Kitoblar": "minimal",
  "Avto ehtiyot qismlari": "boldRed",
  "Asboblar va qurilish": "energyOrange",
  "Sumka va charm buyumlar": "luxury",
  "O'yinchoqlar va xobbi": "energyOrange",
};

export function getRecommendedThemeId(nicheCategoryId) {
  return NICHE_THEME_RECOMMENDATIONS[nicheCategoryId] || null;
}
