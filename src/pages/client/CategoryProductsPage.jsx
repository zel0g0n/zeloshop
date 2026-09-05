import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SearchCatalog from "@/features/shop/components/hero/search/SearchCatalog";
import FilterBadges from "@/features/shop/components/hero/filter/FilterBadges";
import FilteredCatalogProducts from "@/features/shop/components/product/FilteredCatalogProducts";
import { CatalogFilterProvider, useCatalogControls } from "@/context/CatalogFilterContext";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import { useSession } from "@/context/SessionContext";

/**
 * BITTA KATEGORIYAGA OID mahsulotlar sahifasi -
 * `CategoryGrid.jsx`dagi kartochka bosilganda ochiladi.
 *
 * MUHIM ARXITEKTURA QARORI: yangi, alohida mahsulot-ro'yxati mantig'i
 * QURILMAGAN - buning o'rniga, MAVJUD `CatalogFilterProvider`+
 * `FilteredCatalogProducts` (Katalog bosh sahifasi ishlatadigan,
 * allaqachon tekshirilgan) qayta ishlatiladi, faqat `activeType`
 * URL parametridan OLDINDAN o'rnatiladi. Bu, ikkita mustaqil,
 * bir-biridan chetlashib qolishi mumkin bo'lgan filtrlash mexanizmi
 * o'rniga, BITTA manba (source of truth)ni saqlaydi.
 *
 * Qidiruv (`SearchCatalog`) ATAYLAB shu yerda ham GLOBAL ishlaydi
 * (faqat shu kategoriya ichida qidirmaydi) - avval muhokama
 * qilinganidek, qidiruv har doim butun katalog bo'yicha ishlashi
 * kerak.
 */
const CategoryTypeSetter = ({ categoryValue }) => {
  const { setActiveType } = useCatalogControls();
  useEffect(() => {
    setActiveType(categoryValue);
    return () => setActiveType("all"); // sahifadan chiqqanda tozalaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryValue]);
  return null;
};

const CategoryHeader = ({ categoryLabel }) => {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 z-30 border-b border-gray-100 dark:border-slate-800 px-4 py-3.5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
      >
        <ArrowLeft size={16} className="text-gray-600 dark:text-slate-300" />
      </button>
      <h1 className="text-sm font-black text-gray-800 dark:text-white truncate">{categoryLabel}</h1>
    </div>
  );
};

const CategoryProductsPage = () => {
  const { categoryValue } = useParams();
  const { store } = useSession();
  const decodedValue = decodeURIComponent(categoryValue || "");
  const categories = getEffectiveCategoriesForStore(store);
  const categoryLabel = categories.find((c) => c.value === decodedValue)?.label || decodedValue;

  return (
    <CatalogFilterProvider>
      <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-36 transition-colors duration-300">
        <CategoryTypeSetter categoryValue={decodedValue} />
        <CategoryHeader categoryLabel={categoryLabel} />
        <SearchCatalog />
        <FilterBadges />
        <FilteredCatalogProducts />
      </div>
    </CatalogFilterProvider>
  );
};

export default CategoryProductsPage;
