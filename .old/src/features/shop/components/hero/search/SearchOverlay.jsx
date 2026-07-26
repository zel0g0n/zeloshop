import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosSearch } from "@/constants/icons";
import useLiveSearch from "@/hooks/useLiveSearch";
import { IoMdArrowBack } from "react-icons/io"; 

const SearchOverlay = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [queryValue, setQueryValue] = useState("")
  const { searchQuery, handleSearchChange, results, isLoading } = useLiveSearch();

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
    document.body.style.overflow = "hidden"; 
    return () => { document.body.style.overflow = "unset"; };
  }, []);

  const popularSearches = ["Atir", "Tozalovchi gel", "Krem", "Premium Collection"];
  const handleInputChange = (e) => {
    setQueryValue(e.target.value)
  }
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSearchChange(queryValue)
    onClose();
    navigate(`/catalog?search=${encodeURIComponent(queryValue.trim())}`);
  };

  return (
    <div className="fixed inset-0 bg-white z-[100] max-w-[440px] mx-auto flex flex-col animate-fadeIn">
      
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
        >
          <IoMdArrowBack size={22} />
        </button>

        <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={queryValue}
            onChange={(e) => handleInputChange(e)}
            placeholder="Qidirmoqchi bo'lgan mahsulotni yozing..."
            className="w-full bg-gray-100 rounded-2xl pl-4 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-transparent"
          />
          <button 
            type="submit" 
            className="absolute right-1 w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white"
          >
            <IoIosSearch size={18} />
          </button>
        </form>
      </div>

      {/* 2. Natijalar va tavsiyalar oynasi */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {isLoading && (
          <div className="text-center py-4 text-sm text-gray-400 animate-pulse">
            Qidirilmoqda...
          </div>
        )}

        {/* Live qidiruv natijalari */}
        {searchQuery && !isLoading && results.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Tavsiyalar
            </h3>
            <ul className="divide-y divide-gray-50">
              {results.map((item) => (
                <li 
                  key={item.id}
                  onClick={() => handleSearchSubmit(null, item.title)}
                  className="py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl px-2 transition-colors text-sm text-gray-700"
                >
                  <IoIosSearch size={16} className="text-gray-400" />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agar hech narsa topilmasa */}
        {searchQuery && !isLoading && results.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">
            Hech narsa topilmadi 😕
          </div>
        )}

        {/* Ommabop qidiruvlar teglari */}
        {!searchQuery && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Ommabop qidiruvlar
            </h3>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => handleSearchSubmit(null, tag)}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200/40 transition-colors"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchOverlay;