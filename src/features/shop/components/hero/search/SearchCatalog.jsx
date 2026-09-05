import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from "react-router-dom";
import { IoIosSearch, FiSliders} from "@/constants/icons";
import { X } from "lucide-react";
import useLiveSearch from '@/hooks/useLiveSearch';
import { useLanguage } from '@/context/LanguageContext';
import { useCatalogControls } from '@/context/CatalogFilterContext';
import FilterPanel from '@/features/shop/components/hero/filter/FilterPanel';

// OLDIN: har bir bosilgan harfda `handleSearchChange` to'g'ridan-to'g'ri
// chaqirilardi — bu esa Redux'ga har bir belgi uchun dispatch yuborar,
// natijada butun katalog ro'yxati (useFilterProducts ichidagi useMemo)
// har bosilgan harfda qayta hisoblanardi. Endi 300ms debounce qo'shildi.
const SearchCatalog = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const {handleSearchChange, clearSearch} = useLiveSearch()
  const { advancedFilters, setAdvancedFilters, activeAdvancedFilterCount } = useCatalogControls();
  const debounceRef = useRef(null);

  useEffect(() => {
    if (searchParams.get("search")) {
      handleSearchChange(searchParams.get("search"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSearchChange(value);
    }, 300);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    handleSearchChange(searchInput);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
    <div className='sticky top-0 bg-white/95 dark:bg-slate-950/95 z-30 border-b border-gray-100 dark:border-slate-800 p-4 space-y-3'>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center bg-gray-100 dark:bg-slate-900 rounded-2xl border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all duration-300 px-3 h-11">
            <input
              type="text"
              value={searchInput}
              onChange={handleInputChange}
              placeholder={t("catalog.searchPlaceholder")}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 px-1"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); clearSearch(); }}
                className="text-gray-400 hover:text-blue-600 transition-colors px-1"
              >
                <X size={14} />
              </button>
            )}
            <button type="submit" className="text-gray-400 hover:text-blue-600 transition-colors">
              <IoIosSearch size={20} />
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => setShowFilterPanel(true)}
            className={`relative w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 transition-transform ${
              activeAdvancedFilterCount > 0
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"
            }`}
          >
            <FiSliders size={18} />
            {activeAdvancedFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-950">
                {activeAdvancedFilterCount}
              </span>
            )}
          </button>
        </form>
      </div>

      <FilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
      />
    </>
  )
}

export default SearchCatalog
