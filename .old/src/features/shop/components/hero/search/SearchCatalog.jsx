import {useState} from 'react'
import { useSearchParams } from "react-router-dom";
import { IoIosSearch, FiSliders}from "@/constants/icons";
import useLiveSearch from '@/hooks/useLiveSearch';
const SearchCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const {searchQuery, handleSearchChange, clearSearch} = useLiveSearch()
  const handleSearchSubmit = (e) => {
    setSearchInput(e.target.value)
    e.preventDefault();
    handleSearchChange(e.target.value)
  };
  return (
    <div className='sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 p-4 space-y-3'>
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="flex-1 relative flex items-center bg-gray-100 rounded-2xl border border-transparent focus-within:border-blue-500/30 focus-within:bg-white transition-all duration-300 px-3 h-11">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchSubmit(e)}
              placeholder="Katalogdan qidirish..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400 px-1"
            />
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