import React, { useState, useRef, useEffect } from "react";
import { getCategoriesForNiche } from "@/constants/productCategories";
import { useSession } from "@/context/SessionContext";

const CUSTOM_OPTION = "__custom__";

// OLDIN: kategoriya tanlash uchun HTML'ning standart (native) <select>
// tegi ishlatilgan edi. Endi bu — to'liq o'zimiz loyihalagan (custom)
// dropdown komponenti, brauzerning standart uslubiga bog'liq emas,
// ilovaning boshqa qismlari bilan bir xil dizaynda.
const BasicInfoCard = ({ title, category, disabled, onTitleChange, onCategoryChange }) => {
  const { store } = useSession();
  const categoryOptions = getCategoriesForNiche(store?.category);
  const dropdownRef = useRef(null);

  const isKnownOption = categoryOptions.some((opt) => opt.value === category);
  const [isCustomMode, setIsCustomMode] = useState(Boolean(category) && !isKnownOption);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (value) => {
    if (value === CUSTOM_OPTION) {
      setIsCustomMode(true);
      onCategoryChange("");
    } else {
      setIsCustomMode(false);
      onCategoryChange(value);
    }
    setIsOpen(false);
  };

  const selectedLabel = isKnownOption
    ? categoryOptions.find((opt) => opt.value === category)?.label
    : null;

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
      <div className="space-y-1">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mahsulot nomi *</label>
        <input
          type="text"
          required
          disabled={disabled}
          placeholder="Masalan: Vitamin C Serum"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-transparent disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Kategoriya tanlang</label>

        {!isCustomMode ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsOpen((v) => !v)}
              className={`w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl font-bold text-xs flex items-center justify-between focus:outline-none disabled:opacity-60 ${
                isOpen ? "ring-1 ring-indigo-500" : ""
              } ${selectedLabel ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}
            >
              <span className="truncate">{selectedLabel || "Kategoriyani tanlang"}</span>
              <span className={`text-slate-400 dark:text-slate-500 transition-transform shrink-0 ml-2 ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 py-1.5 max-h-64 overflow-y-auto">
                {categoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold ${
                      category === opt.value
                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="my-1 border-t border-dashed border-slate-100 dark:border-slate-700" />
                <button
                  type="button"
                  onClick={() => handleSelect(CUSTOM_OPTION)}
                  className="w-full text-left px-4 py-2.5 text-xs font-black text-indigo-500 dark:text-indigo-400"
                >
                  + O'z kategoriyamni yozaman
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              disabled={disabled}
              placeholder="Kategoriya nomini yozing"
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="flex-1 h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => { setIsCustomMode(false); onCategoryChange(""); }}
              className="shrink-0 h-11 px-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-bold"
            >
              Bekor
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(BasicInfoCard);
