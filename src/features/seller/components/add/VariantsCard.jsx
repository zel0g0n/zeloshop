import React, { useState, useCallback } from "react";

// OLDIN: bu yerda AVVAL alohida "xususiyat nomi" + "qiymatlar" +
// "saqlash" tugmasi bilan murakkab, ko'p bosqichli oqim bor edi.
// ENDI: aniq so'ralganidek — BITTA input va "+" tugmasi bitta
// qatorda. Sotuvchi xohlagan matnni yozadi (masalan "Qizil rang",
// "M razmer") va "+" bosadi (yoki Enter), qo'shilgan qiymatlar
// pastda ro'yxat sifatida ko'rinadi. Qo'shimcha "saqlash" bosqichi
// yo'q.
const VariantsCard = ({ variants, disabled, onVariantsChange }) => {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = useCallback(() => {
    const value = inputValue.trim();
    if (!value) return;
    if (variants.includes(value)) {
      setInputValue("");
      return;
    }
    onVariantsChange([...variants, value]);
    setInputValue("");
  }, [inputValue, variants, onVariantsChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    handleAdd();
  }, [handleAdd]);

  const handleRemove = useCallback((index) => {
    onVariantsChange(variants.filter((_, i) => i !== index));
  }, [variants, onVariantsChange]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        Mahsulot xususiyatlari (ixtiyoriy)
      </label>

      <div className="flex items-center gap-2">
        <input
          type="text"
          disabled={disabled}
          placeholder="Masalan: Qizil rang, M razmer"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled || !inputValue.trim()}
          onClick={handleAdd}
          className="shrink-0 w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-lg font-bold disabled:opacity-40 active:scale-95 transition-all"
        >
          +
        </button>
      </div>

      {variants.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {variants.map((value, index) => (
            <span
              key={value}
              className="bg-indigo-50 dark:bg-indigo-500/10 text-[#5346E0] dark:text-[#8b85f5] text-[11px] font-black pl-2.5 pr-1.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-1"
            >
              {value}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="w-4 h-4 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(VariantsCard);
