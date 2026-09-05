import SearchCatalog from "@/features/shop/components/hero/search/SearchCatalog";
import FilterBadges from "@/features/shop/components/hero/filter/FilterBadges";
import CategoryGrid from "@/features/shop/components/catalog/CategoryGrid";
import FilteredCatalogProducts from "@/features/shop/components/product/FilteredCatalogProducts";
import { CatalogFilterProvider } from "@/context/CatalogFilterContext";

// Qidiruv/filtr holati endi `CatalogFilterProvider` ichida yashaydi —
// bu Provider faqat shu daraxt uchun, va Katalogdan chiqilganda
// (marshrut o'zgarganda) o'zi bilan birga tabiiy ravishda demontaj
// qilinadi. Bosh sahifa bu holatdan mustaqil.
//
// OLDIN: kategoriya tanlovi `FilterType.jsx` — gorizontal scroll
// qiladigan matn-pill qatori orqali, SHU sahifaning o'zida amalga
// oshirilardi. Foydalanuvchi bilan muhokamadan keyin: bu naqsh
// kategoriyalar ko'paygan sari yomon masshtablanadi va kam sonli
// kategoriyada "bo'sh" ko'rinadi. ENDI — kategoriya panjarasi
// (`CategoryGrid`) bosilganda ALOHIDA sahifaga (`/category/:value`)
// olib boradi, bu yerda esa faqat qidiruv/tezkor-filtr/to'liq
// ro'yxat (o'zgarishsiz) qoladi - "shunchaki ko'rib chiqmoqchi"
// bo'lgan foydalanuvchi kategoriya tanlashga MAJBUR emas.
const CatalogPage = () => {
  return (
    <CatalogFilterProvider>
      <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-36 transition-colors duration-300">
        <SearchCatalog />
        <CategoryGrid />
        <FilterBadges />
        <FilteredCatalogProducts />
      </div>
    </CatalogFilterProvider>
  );
};

export default CatalogPage;
