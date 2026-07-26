import {useState} from 'react'
import { BsGrid, AiOutlineDollarCircle, MdOutlineNewReleases, AiFillStar, MdLocalFireDepartment}from "@/constants/icons";
import useChangeCategory from '@/hooks/useChangeCategory';
const FilterBadges = () => {
  const quickBadges = [
    { id: "all", title: "Barchasi", icon: <BsGrid /> },
    { id: "aksiya", title: "Aksiya", icon: <MdLocalFireDepartment /> },
    { id: "arzon", title: "Arzon", icon: <AiOutlineDollarCircle /> },
    { id: "new", title: "Yangilar", icon: <MdOutlineNewReleases /> },
    { id: "top", title: "Top", icon: <AiFillStar /> },
  ];
  const [activeBadge, setActiveBadge] = useState("all");
  const {changeCategory} = useChangeCategory()
  const categoryChangeHandler = (value) => {
    setActiveBadge(value)
    changeCategory(value)
  }
  return (
    <div className='sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 p-4 space-y-3'>
      <div className="flex gap-2 justify-between overflow-x-auto no-scrollbar py-0.5 scrollbar-hide">
        {quickBadges.map((badge) => (
          <div key={badge.id} className="flex flex-col  items-center gap-1">
            <button
              onClick={() => categoryChangeHandler(badge.id)}
              className={`flex items-center justify-center w-12 h-12 text-[11px] font-medium  rounded-full whitespace-nowrap transition-all duration-200 flex items-center gap-1.5
                  ${activeBadge === badge.id 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-gray-100 text-blue-600/55"
                  }`}
            >
                      {badge.icon && <span className="text-2xl">{badge.icon}</span>}
            </button>
            {badge.title} 
          </div>
        ))}
      </div>
    </div>
  )
}

export default FilterBadges