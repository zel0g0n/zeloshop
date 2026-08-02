import { memo } from 'react';
import useChangeType from '@/hooks/useChangeType';
import { PRODUCT_CATEGORIES } from '@/constants/productCategories';

// OLDIN: bu komponent o'zining LOKAL state'iga ega edi va tugma bosilganda
// faqat vizual ko'rinishni o'zgartirardi — hech qanday Redux action
// dispatch qilinmasdi, demak bosilganda haqiqiy mahsulot ro'yxati
// UMUMAN filtrlanmasdi. Bundan tashqari, ro'yxatdagi qiymatlar
// ("skincare", "parfum", "hair") haqiqiy mahsulot ma'lumotidagi
// qiymatlarga ("Skincare", "Perfume", "Tools") mos kelmasdi. Ikkalasi
// ham tuzatildi: endi Redux orqali ishlaydi va bitta umumiy
// kategoriya ro'yxatidan (`constants/productCategories.js`) foydalanadi.
const categories = [{ value: "all", label: "Barchasi" }, ...PRODUCT_CATEGORIES];

const FilterType = () => {
  const { activeType, changeType } = useChangeType();

  return (
    <div className='sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30 border-b border-gray-100 dark:border-slate-800 p-4 space-y-3'>
       <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => changeType(cat.value)}
              className={`text-xs font-semibold px-4 py-2 rounded-xl border whitespace-nowrap transition-all duration-300
                ${activeType === cat.value 
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                  : "bg-white dark:bg-slate-900 border-gray-200/60 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300"
                }`}
            >
              {cat.value === "all" ? cat.label : cat.value}
            </button>
          ))}
        </div>
    </div>
  )
}

export default memo(FilterType)
