import { memo } from 'react'
import { BsGrid, AiOutlineDollarCircle, MdOutlineNewReleases, AiFillStar, MdLocalFireDepartment} from "@/constants/icons";
import useChangeCategory from '@/hooks/useChangeCategory';

const quickBadges = [
  { id: "all", title: "Barchasi", icon: <BsGrid /> },
  { id: "aksiya", title: "Aksiya", icon: <MdLocalFireDepartment /> },
  { id: "arzon", title: "Arzon", icon: <AiOutlineDollarCircle /> },
  { id: "new", title: "Yangilar", icon: <MdOutlineNewReleases /> },
  { id: "top", title: "Top", icon: <AiFillStar /> },
];

// OLDIN: bu komponent o'zining lokal `activeBadge` state'iga ega edi —
// bu esa Redux'dagi haqiqiy `activeCategory` bilan mos kelmay qolishi
// mumkin edi (masalan boshqa joydan filtr tozalansa, bu tugmalar buni
// bilmasdi). Endi Redux — yagona manba.
const FilterBadges = () => {
  const { changeCategory, activeCategory } = useChangeCategory()

  return (
    <div className='sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30 border-b border-gray-100 dark:border-slate-800 p-4 space-y-3'>
      <div className="flex gap-2 justify-between overflow-x-auto no-scrollbar py-0.5 scrollbar-hide">
        {quickBadges.map((badge) => (
          <div key={badge.id} className="flex flex-col items-center gap-1">
            <button
              onClick={() => changeCategory(badge.id)}
              className={`flex items-center justify-center w-12 h-12 text-[11px] font-medium rounded-full whitespace-nowrap transition-all duration-200 gap-1.5
                  ${activeCategory === badge.id 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-gray-100 dark:bg-slate-800 text-blue-600/55 dark:text-blue-400/70"
                  }`}
            >
                      {badge.icon && <span className="text-2xl">{badge.icon}</span>}
            </button>
            <span className="text-gray-600 dark:text-slate-400">{badge.title}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(FilterBadges)
