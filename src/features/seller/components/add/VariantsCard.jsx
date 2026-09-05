import React, { useState, useCallback, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSession } from "@/context/SessionContext";
import { getNicheConfig } from "@/config/niches";

// OLDIN: bu yerda AVVAL alohida "xususiyat nomi" + "qiymatlar" +
// "saqlash" tugmasi bilan murakkab, ko'p bosqichli oqim bor edi.
// ENDI: aniq so'ralganidek — BITTA input va "+" tugmasi bitta
// qatorda. Sotuvchi xohlagan matnni yozadi (masalan "Qizil rang",
// "M razmer") va "+" bosadi (yoki Enter), qo'shilgan qiymatlar
// pastda ro'yxat sifatida ko'rinadi. Qo'shimcha "saqlash" bosqichi
// yo'q.
//
// 15-NICHE UNIVERSAL PLATFORMA (2026-09, niche tizimini oxirigacha
// ulash): `niches.js`dagi har bir sohaning `variantSuggestions`
// maydoni ("Kosmetika" uchun ["shade","volume"], "Kiyim-kechak" uchun
// ["size","color"] va h.k.) ANIQ shu komponent uchun mo'ljallangan
// edi (izohga qarang, `niches.js:44`), lekin OLDIN hech qayerda
// o'qilmagan/ishlatilmagan "o'lik konfiguratsiya" edi. Endi
// sotuvchining O'Z sohasiga mos tavsiya matni (masalan "Tavsiya:
// Rang, Hajm bo'yicha variantlar qo'shish mumkin") input ostida
// ko'rsatiladi — bu shunchaki INFORMATIV ESLATMA, majburiy shart
// emas (sotuvchi baribir istalgan erkin matn kirita oladi).
const VariantsCard = ({ variants, disabled, onVariantsChange }) => {
  const { t } = useLanguage();
  const { store } = useSession();
  const [inputValue, setInputValue] = useState("");

  const suggestionLabels = useMemo(() => {
    const keys = getNicheConfig(store?.category).variantSuggestions || [];
    return keys.map((key) => t(`productAttributes.${key}.label`));
  }, [store?.category, t]);

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
        {t("sellerProductForm.variantsLabel")}
      </label>

      <div className="flex items-center gap-2">
        <input
          type="text"
          disabled={disabled}
          placeholder={t("sellerProductForm.variantsPlaceholder")}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled || !inputValue.trim()}
          onClick={handleAdd}
          className="shrink-0 w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      {suggestionLabels.length > 0 && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
          {t("sellerProductForm.variantSuggestionsHint", { examples: suggestionLabels.join(", ") })}
        </p>
      )}

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
                  className="w-4 h-4 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20 flex items-center justify-center"
                >
                  <X size={10} strokeWidth={3} />
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
