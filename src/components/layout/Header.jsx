import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosSearch, FiSliders } from "@/constants/icons";
import { MdVerified } from "react-icons/md";
import Logo from '@/assets/logo.jpg';
import { useSession } from "@/context/SessionContext";

// OLDIN: do'kon ma'lumoti Header'ning O'Z lokal state'ida yuklanardi.
// Header sahifadan sahifaga o'tganda qayta montaj qilinadi (masalan
// Katalogga o'tib, Bosh sahifaga qaytganda) — shuning uchun HAR SAFAR
// avval bo'sh/standart holat (statik logotip, nomsiz) ko'rinib, keyin
// haqiqiy ma'lumotga almashardi. Endi bu ma'lumot `SessionContext`dan
// olinadi — u yerda bir marta yuklanib, butun sessiya davomida
// (Header necha marta qayta montaj qilinishidan qat'i nazar) saqlanadi.
const Header = () => {
  const navigate = useNavigate();
  const { store } = useSession();
  const [searchValue, setSearchValue] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    navigate(trimmed ? `/catalog?search=${encodeURIComponent(trimmed)}` : "/catalog");
  };

  return (
    <header className="px-[10px] pt-3 space-y-2.5">
      <div className="max-w-[440px] mx-auto space-y-2.5">

        {/* Do'kon ma'lumotlari */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/30 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-[22px] px-4 py-3 flex items-center gap-3">
          <img
            src={store?.logo || Logo}
            alt="Do'kon logotipi"
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black text-gray-800 dark:text-white truncate">
                {store?.storeName || "Do'kon"}
              </p>
              {/* Oddiy dekorativ belgi — haqiqiy tasdiqlash tizimi hali yo'q */}
              <MdVerified className="text-blue-500 shrink-0" size={16} />
            </div>
            {store?.phone && (
              <p className="text-xs text-gray-400 dark:text-slate-500">{store.phone}</p>
            )}
          </div>
        </div>

        {/* Qidiruv */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="flex-1 h-12 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/30 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-2xl px-4 flex items-center gap-2">
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Mahsulotlarni qidirish..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500"
            />
            <button type="submit" className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md">
              <IoIosSearch size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="w-12 h-12 shrink-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/30 dark:border-slate-700/30 rounded-2xl flex items-center justify-center text-gray-500 dark:text-slate-400"
          >
            <FiSliders size={18} />
          </button>
        </form>

      </div>
    </header>
  );
};

export { Header };
