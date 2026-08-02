import React, { memo } from "react";
import { Package } from "lucide-react";
import { getCategoriesForNiche } from "@/constants/productCategories";
import { useSession } from "@/context/SessionContext";

const ProductsCategoryTabs = ({ selectedCategory, onSelectCategory }) => {
  const { store } = useSession();
  const categories = ["Barchasi", ...getCategoriesForNiche(store?.category).map((c) => c.value)];

  return (
    <div className="px-4 pt-3 flex gap-2 overflow-x-auto no-scrollbar py-1 bg-white dark:bg-slate-900">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelectCategory(cat)}
          className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${
            selectedCategory === cat
              ? "bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-zinc-300 border border-slate-100 dark:border-slate-800"
          }`}
        >
          {cat === "Barchasi" && <Package size={12} />}
          {cat}
        </button>
      ))}
    </div>
  );
};

export default memo(ProductsCategoryTabs);
