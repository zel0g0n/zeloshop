import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from "react-router-dom";
import { IoIosSearch, FiSliders} from "@/constants/icons";
import useLiveSearch from '@/hooks/useLiveSearch';

// OLDIN: har bir bosilgan harfda `handleSearchChange` to'g'ridan-to'g'ri
// chaqirilardi — bu esa Redux'ga har bir belgi uchun dispatch yuborar,
// natijada butun katalog ro'yxati (useFilterProducts ichidagi useMemo)
// har bosilgan harfda qayta hisoblanardi. Endi 300ms debounce qo'shildi.
const SearchCatalog = () => {
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const {handleSearchChange, clearSearch} = useLiveSearch()
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
    <div className='sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 p-4 space-y-3'>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center bg-gray-100 rounded-2xl border border-transparent focus-within:border-blue-500/30 focus-within:bg-white transition-all duration-300 px-3 h-11">
            <input
              type="text"
              value={searchInput}
              onChange={handleInputChange}
              placeholder="Katalogdan qidirish..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400 px-1"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); clearSearch(); }}
                className="text-gray-400 hover:text-blue-600 transition-colors text-xs px-1"
              >
                ✕
              </button>
            )}
            <button type="submit" className="text-gray-400 hover:text-blue-600 transition-colors">
              <IoIosSearch size={20} />
            </button>
          </div>
          
          <button type="button" className="w-11 h-11 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 active:scale-95 transition-transform">
            <FiSliders size={18} />
          </button>
        </form>
    </div>
  )
}

export default SearchCatalog
