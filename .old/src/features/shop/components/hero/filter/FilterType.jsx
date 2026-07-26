import { useState } from 'react';
const FilterType = () => {
  const categories = [
      { id: "all", title: "Barchasi" },
      { id: "skincare", title: "Skincare" },
      { id: "parfum", title: "Parfum" },
      { id: "makeup", title: "Makeup" },
      { id: "hair", title: "Soch" },
    ];
    const [activeCategory, setActiveCategory] = useState("all");
  
  return (
    <div className='sticky top-0 bg-white/80 backdrop-blur-md z-30 border-b border-gray-100 p-4 space-y-3'>
       <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`text-xs font-semibold px-4 py-2 rounded-xl border whitespace-nowrap transition-all duration-300
                ${activeCategory === cat.id 
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                  : "bg-white border-gray-200/60 text-gray-500 hover:border-gray-300"
                }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
    </div>
  )
}

export default FilterType