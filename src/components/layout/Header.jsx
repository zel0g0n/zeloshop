import { useState } from "react";
import { IoIosSearch } from "@/constants/icons";
import Logo from '@/assets/logo.jpg';
import SearchOverlay from "@/features/shop/components/hero/search/SearchOverlay";

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="h-16 sticky top-0 z-50 px-[10px] pt-3">
        <div className="max-w-[440px] mx-auto">
          <div className="bg-white/70 backdrop-blur-xl border border-white/30 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-[24px] h-16 px-4 flex items-center gap-3">
            
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
              <img src={Logo} alt='logo brand' className='w-10 h-10 rounded-full'/>
            </div>

            <div 
              onClick={() => setIsSearchOpen(true)}
              className="flex-1 h-11 rounded-2xl bg-gray-100/80 border border-transparent flex items-center px-3 cursor-pointer select-none"
            >
              <span className="flex-1 text-sm text-gray-400 px-2">
                Mahsulotlarni qidirish...
              </span>

              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
                <IoIosSearch size={18} />
              </div>
            </div>

          </div>
        </div>
      </header>

      {isSearchOpen && <SearchOverlay onClose={() => setIsSearchOpen(false)} />}
    </>
  );
};

export { Header };