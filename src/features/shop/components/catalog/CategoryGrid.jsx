import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ImageOff, ChevronRight } from "lucide-react";
import { useCatalogControls } from "@/context/CatalogFilterContext";
import { useSession } from "@/context/SessionContext";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import { buildCategoryCards } from "@/utils/categoryGrid";
import { useLanguage } from "@/context/LanguageContext";

/**
 * KATALOG BOSH SAHIFASI — KATEGORIYA PANJARASI (Yandex Market/Ozon/
 * Wildberries uslubida).
 *
 * OLDIN: bu yerda `FilterType.jsx` — gorizontal scroll qiladigan,
 * matn-pill qatori bor edi. Foydalanuvchi bilan muhokamadan keyingi
 * xulosa: bu naqsh kategoriyalar ko'paygan sari yomon masshtablanadi
 * (cheksiz gorizontal scroll), va kam sonli kategoriyada "bo'sh"
 * ko'rinadi. Panjara (grid) ikkalasini ham hal qiladi.
 *
 * MUHIM TOPILGAN VA TUZATILGAN XATO: `FilterType.jsx` sotuvchining
 * HAQIQIY sohasidan (niche) qat'i nazar, doim `PRODUCT_CATEGORIES`
 * (qattiq belgilangan, faqat "Kosmetika" sohasiga tegishli ro'yxat)
 * dan foydalanardi - masalan Kiyim-kechak sotuvchisi uchun ham
 * Skincare/Makeup kabi kategoriyalar ko'rsatilardi. Bu yerda
 * to'g'ri, sotuvchining SOHASIGA mos (`getEffectiveCategoriesForStore`
 * - niche ro'yxati + sotuvchining shaxsiy moslashtirishi) ro'yxat
 * ishlatiladi - xuddi sotuvchi panelidagi kabi.
 *
 * "BOSHIDA BARCHASINI KO'RISH" MUAMMOSI (avval muhokama qilingan):
 * bu panjara mijozni bitta qo'shimcha bosishga majbur qiladi -
 * shuning uchun bu komponent Katalog sahifasining FAQAT yuqori
 * qismini egallaydi, pastda esa (o'zgarishsiz) "Barchasi/Aksiya/
 * Arzon/Yangi/Top" tezkor-filtrlar + to'liq mahsulot ro'yxati
 * DAVOM ETADI - kim shunchaki ko'rib chiqmoqchi bo'lsa, pastga
 * scroll qilaveradi, kategoriya tanlash SHART emas.
 */
const CategoryCard = memo(({ category, unitLabel, onNavigate }) => (
  <button
    type="button"
    onClick={() => onNavigate(category.value)}
    className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform"
  >
    <div className="w-full aspect-square bg-gray-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
      {category.coverImage ? (
        <img src={category.coverImage} alt={category.label} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <ImageOff size={22} className="text-gray-300 dark:text-slate-600" />
      )}
    </div>
    <div className="p-2.5 flex items-center justify-between gap-1">
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{category.label}</p>
        <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">{category.count} {unitLabel}</p>
      </div>
      <ChevronRight size={14} className="text-gray-300 dark:text-slate-600 shrink-0" />
    </div>
  </button>
));
CategoryCard.displayName = "CategoryCard";

const CategoryGrid = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();
  const { products } = useCatalogControls();

  // 15-NICHE UNIVERSAL PLATFORMA (band #20): sotuvchi yashirgan
  // kategoriya vitrinadan chetlanadi, nomlangan/tartiblangan holicha
  // ko'rsatiladi - `config/categoryCustomization.js`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => getEffectiveCategoriesForStore(store), [store?.category, store?.categoryCustomization]);
  const cards = useMemo(() => buildCategoryCards(products, categories), [products, categories]);

  const handleNavigate = (categoryValue) => {
    navigate(`/category/${encodeURIComponent(categoryValue)}`);
  };

  if (cards.length === 0) return null;

  return (
    <div className="p-4 pb-0">
      <h2 className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
        {t("catalog.categoriesTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <CategoryCard key={c.value} category={c} unitLabel={t("catalog.productsUnit")} onNavigate={handleNavigate} />
        ))}
      </div>
    </div>
  );
};

export default memo(CategoryGrid);
