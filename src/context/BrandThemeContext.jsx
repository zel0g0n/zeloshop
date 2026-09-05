import { createContext, useContext, useCallback, useLayoutEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "./SessionContext";
import { useTheme } from "./ThemeContext";
import { getThemeConfig, resolveThemeColors, DEFAULT_THEME_ID, isValidThemeId } from "@/config/themes";
import updateSeller from "@/services/sellers/updateSeller";

/**
 * BREND TEMA KONTEKSTI — Theme Engine'ning ikkinchi qatlami
 * (birinchisi — `ThemeContext.jsx`dagi Light/Dark/System, bu ikkalasi
 * MUSTAQIL, bir-biriga bog'lanmagan; batafsil izoh: `config/themes.js`).
 *
 * IKKI MUSTAQIL "brend rang" bor, IKKALASI HAM shu bitta kontekst
 * orqali boshqariladi, lekin HECH QACHON aralashib ketmaydi:
 *   - `sellerAppTheme` (`sellers/{id}.sellerAppTheme`) — sotuvchining
 *     O'ZI, boshqaruv paneli (`/seller/*` marshrutlari) uchun.
 *   - `storefrontTheme` (`sellers/{id}.storefrontTheme`) — sotuvchining
 *     XARIDORLARI ko'radigan do'kon (barcha QOLGAN marshrutlar: bosh
 *     sahifa, katalog, savat, checkout, kabinet) uchun.
 * Qaysi biri HOZIR faol ekanligi joriy YO'L (route) bo'yicha
 * aniqlanadi — ikkalasi bir vaqtning o'zida DOM'da ko'rinishi shart
 * emas (bitta brauzer tab bir vaqtda faqat bitta marshrutni chizadi),
 * shuning uchun bitta CSS o'zgaruvchi to'plamini (`--color-brand*`)
 * marshrut o'zgarganda mos qiymatga almashtirish YETARLI.
 *
 * XAVFSIZLIK: `store` (sotuvchi hujjati) — `SessionContext`dan keladi,
 * kim ko'rayotganidan qat'iy nazar (o'zi yoki xaridor) HAR DOIM
 * `verifyTelegramAuth`dagi server tomonidagi tekshiruvdan o'tgan,
 * to'g'ri sotuvchi hujjati (tenant-izolyatsiya — batafsil:
 * `SessionContext.jsx`). Bu kontekst hech qachon boshqa manbadan
 * (masalan URL parametridan) tema ID'sini qabul qilmaydi.
 */

const BrandThemeContext = createContext(null);

/**
 * Berilgan rang to'plami va radiusni hujjatning ILDIZ elementiga CSS
 * custom property sifatida yozadi. Bu — DARHOL almashtirish
 * mexanizmining o'zi: `--color-brand`ni o'zgartirish HECH QANDAY qayta
 * render yoki tarmoq so'rovisiz, shu o'zgaruvchidan foydalanadigan
 * BARCHA elementlarni (Tailwind `@theme`da aniqlangan `bg-brand`,
 * `text-brand-foreground`, `bg-brand-soft` utility'lari orqali)
 * yangilaydi — brauzerning o'zi CSS'ni qayta hisoblaydi.
 */
const applyBrandColorsToRoot = (colors, radius) => {
  const root = document.documentElement;
  root.style.setProperty("--color-brand", colors.primary);
  root.style.setProperty("--color-brand-foreground", colors.foreground);
  root.style.setProperty("--color-brand-soft", colors.soft);
  if (radius) root.style.setProperty("--radius-brand", radius);
};

export const BrandThemeProvider = ({ children }) => {
  const { store, sellerId, patchStore } = useSession();
  const { isDark } = useTheme();
  const location = useLocation();

  const sellerAppThemeId = isValidThemeId(store?.sellerAppTheme) ? store.sellerAppTheme : DEFAULT_THEME_ID;
  const storefrontThemeId = isValidThemeId(store?.storefrontTheme) ? store.storefrontTheme : DEFAULT_THEME_ID;

  // `/seller/*` — sotuvchining O'Z paneli, shuning uchun uning shaxsiy
  // tanlovi (`sellerAppTheme`) qo'llanadi. QOLGAN BARCHA marshrutlar —
  // xaridor tomoni (bosh sahifa, katalog, savat, checkout va h.k.),
  // hatto sotuvchining O'ZI o'z do'konini xaridor sifatida ochib
  // ko'rsa ham — u yerda XARIDORLAR ko'radigan rang (`storefrontTheme`)
  // ko'rinadi, chunki bu "qanday ko'rinishi kerak"ning haqiqiy sinovi.
  const isSellerDashboardRoute = location.pathname.startsWith("/seller");
  const activeThemeId = isSellerDashboardRoute ? sellerAppThemeId : storefrontThemeId;

  // `useLayoutEffect` — brauzer birinchi qatlamni CHIZISHDAN OLDIN,
  // sinxron ishlaydi (React'ning rasmiy kafolati), shuning uchun
  // marshrut/tema o'zgarganda ESKI rang HECH QACHON, bir lahza ham
  // ko'rinmaydi ("zero flicker" talabi).
  useLayoutEffect(() => {
    const themeConfig = getThemeConfig(activeThemeId);
    applyBrandColorsToRoot(resolveThemeColors(activeThemeId, isDark), themeConfig.radius);
  }, [activeThemeId, isDark]);

  /**
   * SOTUVCHI PANELI TEMASI — LOCAL-FIRST, IKKI BOSQICHLI:
   *   1. `previewSellerAppTheme` — FAQAT `patchStore` (Firestore'ga
   *      YOZMAYDI). Sotuvchi 8 ta rangdan birini bosganda chaqiriladi —
   *      butun ilova (bu panel EKANLIGI sababli, `isSellerDashboardRoute`
   *      true) DARHOL, haqiqiy vaqtda yangi rangga o'tadi — chunki
   *      `activeThemeId` shu `store.sellerAppTheme`dan hisoblanadi.
   *   2. `saveSellerAppTheme` — tanlovni Firestore'ga YAKUNIY saqlaydi
   *      (aniq "Saqlash" tugmasi bosilganda). Bu — 17-band talabi: HAR
   *      BIR bosishda emas, faqat FOYDALANUVCHI ANIQ tasdiqlaganda
   *      yoziladi. Agar sotuvchi tanlab ko'rib, saqlamasdan chiqib
   *      ketsa — keyingi sessiyada oxirgi SAQLANGAN qiymat qaytadi
   *      (kutilgan xatti-harakat, boshqa "Sozlamalar" sahifalari bilan
   *      bir xil naqsh).
   *
   * Firestore yozuvi muvaffaqiyatsiz bo'lsa ham — UI ALLAQACHON yangi
   * temada ishlayapti (23-band talabi); xatoni chaqiruvchi sahifa
   * ushlab, foydalanuvchiga "saqlanmadi, qayta urinib ko'ring" deb
   * ko'rsatadi (bu funksiya xatoni QAYTA uloqtiradi, yutib qolmaydi).
   */
  const previewSellerAppTheme = useCallback(
    (themeId) => {
      if (!isValidThemeId(themeId)) return;
      patchStore({ sellerAppTheme: themeId });
    },
    [patchStore]
  );

  const saveSellerAppTheme = useCallback(
    async (themeId) => {
      if (!isValidThemeId(themeId) || !sellerId) return;
      patchStore({ sellerAppTheme: themeId });
      await updateSeller(sellerId, { sellerAppTheme: themeId });
    },
    [sellerId, patchStore]
  );

  /**
   * DO'KON (STOREFRONT) TEMASI — bu yerda GLOBAL "preview" YO'Q ATAYLAB:
   * xaridorlar HOZIR ko'rayotgan do'kon rangi sotuvchi hali
   * SAQLAMAGAN tanlovi bilan o'zgarib qolmasligi kerak (16-band:
   * "Preview Firebase write qilmasin" — bundan tashqari, `store`
   * global sessiya holati, uni o'zgartirish sotuvchi HALI sinab
   * ko'rayotgan bosqichda ham darhol ta'sir qilardi). Shuning uchun
   * tanlash sahifasi (`StoreAppearanceSettingsPage.jsx`) preview'ni
   * O'ZINING mahalliy holatida, faqat bitta ko'rinish qutisi ichida
   * (inline CSS o'zgaruvchilari orqali) ko'rsatadi — bu kontekst bilan
   * UMUMAN ishlamaydi. Faqat "Saqlash" bosilgach, shu funksiya
   * chaqiriladi — o'sha payt HAQIQIY do'kon rangi ham o'zgaradi.
   */
  const saveStorefrontTheme = useCallback(
    async (themeId) => {
      if (!isValidThemeId(themeId) || !sellerId) return;
      patchStore({ storefrontTheme: themeId });
      await updateSeller(sellerId, { storefrontTheme: themeId });
    },
    [sellerId, patchStore]
  );

  const value = useMemo(
    () => ({
      activeThemeId,
      sellerAppThemeId,
      storefrontThemeId,
      isSellerDashboardRoute,
      previewSellerAppTheme,
      saveSellerAppTheme,
      saveStorefrontTheme,
    }),
    [activeThemeId, sellerAppThemeId, storefrontThemeId, isSellerDashboardRoute, previewSellerAppTheme, saveSellerAppTheme, saveStorefrontTheme]
  );

  return <BrandThemeContext.Provider value={value}>{children}</BrandThemeContext.Provider>;
};

export const useBrandTheme = () => {
  const ctx = useContext(BrandThemeContext);
  if (!ctx) throw new Error("useBrandTheme faqat <BrandThemeProvider> ichida ishlatilishi kerak");
  return ctx;
};
