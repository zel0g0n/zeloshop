import { createContext, useContext, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import { useLiveShopProducts } from "@/hooks/useLiveShopProducts";
import { applyAdvancedFilters, countActiveAdvancedFilters, DEFAULT_ADVANCED_FILTERS } from "@/utils/catalogFilters";
import { searchProducts } from "@/utils/smartSearch";
import { isDiscountActive } from "@/utils/productPricing";
import { isRecentlyAdded } from "@/utils/productFreshness";
import { getNicheConfig } from "@/config/niches";

/**
 * Katalog sahifasiga TEGISHLI qidiruv/filtr holati.
 *
 * OLDIN: qidiruv matni va filtr qiymatlari (`queryKey`, `activeCategory`,
 * `activeType`) Redux'da — ya'ni butun ilova uchun UMUMIY joyda
 * saqlanardi. Bu esa Bosh sahifa (Home) va Katalog sahifasining bir-
 * biriga bog'lanib qolishiga olib kelgan edi: Katalogda muvaffaqiyatsiz
 * qidiruv qilib, Bosh sahifaga o'tilsa, Bosh sahifadagi "Barcha
 * mahsulotlar" ro'yxati ham bo'sh ko'rinardi — chunki ikkalasi ham
 * aynan shu bitta Redux qiymatidan foydalanardi.
 *
 * ENDI: bu holat faqat shu Context orqali, Katalog sahifasining o'z
 * daraxti ICHIDA yashaydi. Bosh sahifa bu haqda umuman bilmaydi va
 * hech qachon undan ta'sirlanmaydi. Katalogdan chiqib ketilganda,
 * Provider o'zi bilan birga demontaj qilinadi — qidiruv holati
 * TABIIY ravishda yo'qoladi, buni qo'lda "tozalash" shart emas.
 *
 * RE-RENDER TUZATISHI (2026-09 audit, P0): OLDIN bitta `useCatalogFilter()`
 * hook BARCHA holatni (qidiruv matni + filtrlar + natijalar) BITTA
 * Context'da, BITTA `value` obyektida qaytarardi. Muammo: `queryKey`
 * (qidiruv matni) HAR HARF kiritilganda o'zgaradi -> `value` obyekti
 * YANGI reference oladi -> `useCatalogFilter()`ni chaqiruvchi HAR BIR
 * komponent (masalan `CategoryGrid`, `FilterPanel` — bular faqat
 * bir martalik `products` ro'yxatini o'qiydi, qidiruv bilan ISHI YO'Q)
 * ham qayta render bo'lardi. `React.memo` bu yerda YORDAM BERMAYDI —
 * memo faqat PROPSlarni solishtiradi, Context o'zgarishini bloklamaydi.
 *
 * ENDI: ikkita MUSTAQIL Context'ga bo'lindi:
 *  - `useCatalogSearch()` — TEZ-TEZ (har harfda) o'zgaradigan qism:
 *    `queryKey`/`setQueryKey`, `filteredProducts`, `loading`, `error`.
 *  - `useCatalogControls()` — KAMDAN-KAM (faqat filtr/kategoriya
 *    tanlanganda yoki mahsulot ma'lumoti yangilanganda) o'zgaradigan
 *    qism: `products`, `activeCategory`/`setActiveCategory`,
 *    `activeType`/`setActiveType`, `advancedFilters`/`setAdvancedFilters`,
 *    `activeAdvancedFilterCount`.
 * Faqat `useCatalogControls()` chaqiruvchi komponentlar endi qidiruv
 * paytida qayta render BO'LMAYDI — ular yangi Context'ning `value`si
 * qidiruv bilan bog'liq emas, shuning uchun o'zgarmaydi.
 */
const CatalogSearchContext = createContext(null);
const CatalogControlsContext = createContext(null);

const applyQuickFilter = (data, key) => {
  if (!data || data.length === 0) return [];
  switch (key) {
    case "new":
      // MUHIM (2026-09 tuzatish): `p.isNew` STATIK bayrog'i o'rniga
      // `createdAt`dan REAL VAQTDA hisoblanadi — ProductCard'dagi
      // "YANGI" belgisi bilan IZCHIL bo'lishi uchun (48 soatdan keyin
      // ikkalasi ham bir vaqtda "yangi emas" holatiga o'tadi).
      return data.filter((p) => isRecentlyAdded(p.createdAt));
    case "top":
      // MUHIM TUZATISH: bu yerda oldin `p.rating` ishlatilgan edi -
      // lekin mahsulot hujjatida bunday maydon UMUMAN YO'Q (haqiqiy
      // maydon nomi `averageRating`, `reviews.js` trigger orqali
      // hisoblanadi). Natijada "Top" tezkor-filtri HAR DOIM bo'sh
      // natija qaytarardi - hech qanday mahsulot `undefined > 4.8`
      // shartiga mos kelmasdi.
      return data.filter((p) => (Number(p.averageRating) || 0) > 4.8);
    case "aksiya":
      // MUHIM TUZATISH: bu yerda OLDIN `p.stock < 10` (kam qolgan
      // mahsulot) tekshirilardi - bu "Aksiya" (chegirma) bilan HECH
      // QANDAY aloqasi yo'q, chalkashtiruvchi xato edi! Mijoz "Aksiya"
      // tugmasini bossa, kam qolgan (lekin CHEGIRMASIZ) mahsulotlarni
      // ko'rardi. Endi - HAQIQIY, HALI AMAL QILAYOTGAN (muddati
      // o'tmagan) chegirma bor mahsulotlar (`isDiscountActive` -
      // `useFilterPriduct.jsx`dagi `onSaleProducts` bilan BIR XIL
      // tekshiruv, izchillik uchun).
      return data.filter((p) => isDiscountActive(p));
    case "arzon": {
      const sortedPrices = [...data].map((p) => Number(p.price) || 0).sort((a, b) => a - b);
      const cutoffIndex = Math.max(0, Math.floor(sortedPrices.length * 0.3) - 1);
      const cutoffPrice = sortedPrices[cutoffIndex];
      return data.filter((p) => (Number(p.price) || 0) <= cutoffPrice);
    }
    default:
      return data;
  }
};

export const CatalogFilterProvider = ({ children }) => {
  const { sellerId, store } = useSession();
  useLiveShopProducts(sellerId);

  const { products = [], loading, error } = useSelector((state) => state.products);

  // 15-NICHE UNIVERSAL PLATFORMA: do'konning HAQIQIY sohasiga (niche)
  // mos sinonim guruhlari (`config/niches.js`) - "Aqlli qidiruv"
  // shular orqali uch tildagi (o'zbek/rus/ingliz) sinonimlarni
  // tushunadi (masalan "телефон" ~ "telefon" ~ "phone").
  const nicheSynonymGroups = useMemo(
    () => getNicheConfig(store?.category).search?.synonymGroups || [],
    [store?.category]
  );

  // MUHIM QO'SHIMCHA: agar URL'da `?quick=aksiya` kabi parametr
  // bo'lsa (masalan CRM xabari yoki banner orqali chuqur havola
  // bilan kirilgan bo'lsa), boshlang'ich tezkor-filtr sifatida
  // ISHLATILADI - shu orqali "faqat aksiyadagi mahsulotlar"ga
  // TO'G'RIDAN-TO'G'RI havola yasash mumkin bo'ladi.
  const [searchParams] = useSearchParams();
  const initialQuickFilter = searchParams.get("quick") || "all";

  const [queryKey, setQueryKey] = useState("");
  const [activeCategory, setActiveCategory] = useState(initialQuickFilter);
  const [activeType, setActiveType] = useState("all");
  // Kengaytirilgan filtr paneli (narx oralig'i, reyting, ombor,
  // narx bo'yicha saralash) - tezkor-filtrlardan MUSTAQIL holat,
  // bularning barchasi bitta obyektda (`utils/catalogFilters.js`ning
  // kutgan shakliga mos).
  const [advancedFilters, setAdvancedFilters] = useState(DEFAULT_ADVANCED_FILTERS);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // "Aqlli qidiruv" (v39.13, `utils/smartSearch.js`): nomi/kategoriya/
    // tavsif bo'yicha, relevantlik bo'yicha tartiblab, kichik yozuv
    // xatolariga chidamli qidiradi - OLDINGI oddiy `name`dagi substring
    // filtri (tartiblovsiz) o'rniga.
    if (queryKey) {
      result = searchProducts(result, queryKey, nicheSynonymGroups);
    }

    // Haqiqiy mahsulot kategoriyasi bo'yicha (Skincare/Parfum/Makeup/Soch)
    if (activeType && activeType !== "all") {
      result = result.filter((p) => p.category === activeType);
    }

    result = applyQuickFilter(result, activeCategory);

    return applyAdvancedFilters(result, advancedFilters);
  }, [products, queryKey, activeCategory, activeType, advancedFilters, nicheSynonymGroups]);

  const activeAdvancedFilterCount = useMemo(() => countActiveAdvancedFilters(advancedFilters), [advancedFilters]);

  // TEZ-TEZ o'zgaradigan qism — faqat qidiruv/natija bilan ishlaydigan
  // komponentlar (`useLiveSearch`, `FilteredCatalogProducts`) shu
  // Context'ga obuna bo'lishi kerak.
  const searchValue = useMemo(
    () => ({ queryKey, setQueryKey, filteredProducts, loading, error }),
    [queryKey, filteredProducts, loading, error]
  );

  // KAMDAN-KAM o'zgaradigan qism — qidiruv matni o'zgarganda bu
  // obyekt reference'i O'ZGARMAYDI, shuning uchun faqat shu Context'ga
  // obuna bo'lgan komponentlar (`CategoryGrid`, `FilterPanel`,
  // `SearchCatalog`ning filtr-badge qismi, `useChangeType`/
  // `useChangeCategory`) qidiruv paytida qayta render BO'LMAYDI.
  const controlsValue = useMemo(
    () => ({
      products,
      activeCategory,
      setActiveCategory,
      activeType,
      setActiveType,
      advancedFilters,
      setAdvancedFilters,
      activeAdvancedFilterCount,
    }),
    [products, activeCategory, activeType, advancedFilters, activeAdvancedFilterCount]
  );

  return (
    <CatalogControlsContext.Provider value={controlsValue}>
      <CatalogSearchContext.Provider value={searchValue}>{children}</CatalogSearchContext.Provider>
    </CatalogControlsContext.Provider>
  );
};

/** Qidiruv matni va uning natijalari — HAR HARFDA o'zgaradi. */
export const useCatalogSearch = () => {
  const ctx = useContext(CatalogSearchContext);
  if (!ctx) {
    throw new Error("useCatalogSearch faqat <CatalogFilterProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};

/** Kategoriya/tur/kengaytirilgan filtrlar va xom mahsulotlar ro'yxati — qidiruv paytida O'ZGARMAYDI. */
export const useCatalogControls = () => {
  const ctx = useContext(CatalogControlsContext);
  if (!ctx) {
    throw new Error("useCatalogControls faqat <CatalogFilterProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};
