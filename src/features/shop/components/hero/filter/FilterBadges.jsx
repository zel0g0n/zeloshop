import { memo } from 'react'
import { LayoutGrid, Flame, Wallet, Sparkles, Star } from 'lucide-react'
import useChangeCategory from '@/hooks/useChangeCategory';
import { useLanguage } from '@/context/LanguageContext';

/**
 * MUHIM QAYTA DIZAYN: OLDIN bu tezkor-filtrlar KATTA (48px) doira
 * ikonkalar + PASTDA alohida yorliq shaklida edi (react-icons,
 * 24px) - bu, ekranning katta qismini egallardi va zamonaviy UI
 * standartlariga mos kelmasdi ("qo'pol" ko'rinish). Endi - ixcham,
 * bitta qatorli PILL tugmalar (ikonka + matn YONMA-YON, bitta
 * chiziqda) - kamroq joy egallaydi, tozaroq ko'rinadi, va
 * sotuvchi panelidagi (`ProductAnalytics.jsx` va h.k.) bilan BIR
 * XIL vizual naqsh (faqat mijoz uchun belgilangan `blue-600` rangi
 * bilan).
 */
const FilterBadges = () => {
  const { changeCategory, activeCategory } = useChangeCategory()
  const { t } = useLanguage();

  const quickBadges = [
    { id: "all", title: t("catalog.filterAll"), Icon: LayoutGrid },
    { id: "aksiya", title: t("catalog.filterSale"), Icon: Flame },
    { id: "arzon", title: t("catalog.filterCheap"), Icon: Wallet },
    { id: "new", title: t("catalog.filterNew"), Icon: Sparkles },
    { id: "top", title: t("catalog.filterTop"), Icon: Star },
  ];

  return (
    <div className='sticky top-0 bg-white/95 dark:bg-slate-950/95 z-30 border-b border-gray-100 dark:border-slate-800 px-4 py-3'>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {quickBadges.map(({ id, title, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => changeCategory(id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors duration-200
                ${activeCategory === id
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
                }`}
          >
            <Icon size={14} />
            {title}
          </button>
        ))}
      </div>
    </div>
  )
}

export default memo(FilterBadges)
