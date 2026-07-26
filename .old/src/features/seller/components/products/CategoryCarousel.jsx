import React from "react";

const CategoryCarousel = ({ categories, selectedCategory, onSelectCategory }) => (
  <div className="px-4 mt-3 flex gap-2 overflow-x-auto no-scrollbar py-1">
    {categories.map((cat) => (
      <button
        key={cat}
        onClick={() => onSelectCategory(cat)}
        className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
          selectedCategory === cat
            ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
            : "bg-white text-slate-400 border border-slate-100"
        }`}
      >
        {cat === "Barchasi" ? "📦 Barchasi" : cat}
      </button>
    ))}
  </div>
);

export default React.memo(CategoryCarousel);
