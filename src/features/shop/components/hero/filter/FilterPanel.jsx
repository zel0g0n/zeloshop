import { useState, useEffect, useMemo } from "react";
import { X, Star, Package, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSession } from "@/context/SessionContext";
import { useCatalogControls } from "@/context/CatalogFilterContext";
import { DEFAULT_ADVANCED_FILTERS } from "@/utils/catalogFilters";
import { buildAttributeFilterDefs } from "@/utils/attributeFilters";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * Kengaytirilgan filtr paneli — narx oralig'i, reyting, ombor
 * mavjudligi, narx bo'yicha saralash.
 *
 * MUHIM: bu yerdagi mezonlar tezkor-filtr qatoridagi (Aksiya/Arzon/
 * Yangilar/Top) va kategoriya tanlovi bilan ATAYLAB TAKRORLANMAYDI -
 * ular allaqachon bir bosishda mavjud. Bu panel faqat ULARDA YO'Q
 * (aniq narx chegarasi, minimal reyting, faqat ombordagilar) narsalar
 * uchun.
 *
 * Panel LOKAL qoralama holatida ("Qo'llash" bosilmaguncha haqiqiy
 * ro'yxatga ta'sir qilmaydi) - bu, foydalanuvchi bir nechta mezonni
 * ketma-ket sozlab, har birida ro'yxat "sakrab" turishining oldini
 * oladi (yaxshiroq, kutilmaydigan his qoldiradigan UX).
 */
const RATING_OPTIONS = [4, 3];

const FilterPanel = ({ isOpen, onClose, filters, onApply }) => {
  const { t } = useLanguage();
  const { store } = useSession();
  const { products } = useCatalogControls();
  const [draft, setDraft] = useState(filters);

  // Panel HAR SAFAR ochilganda, joriy (haqiqiy qo'llangan) filtrlar
  // bilan qayta boshlanadi - aks holda oldingi "bekor qilingan"
  // qoralama saqlanib qolib, keyingi ochilishda chalkashtirardi.
  useEffect(() => {
    if (isOpen) setDraft(filters);
  }, [isOpen, filters]);

  // 15-NICHE UNIVERSAL PLATFORMA: do'konning HAQIQIY sohasi va TO'LIQ
  // (filtrlanmagan) katalog asosida, dinamik atribut filtrlari
  // quriladi - butun `products` ishlatiladi (`filteredProducts` emas),
  // shu orqali bitta filtrni tanlash boshqa filtrlarning variantlar
  // ro'yxatini "toraytirib" chalkashtirmaydi.
  const attributeDefs = useMemo(() => buildAttributeFilterDefs(store?.category, products), [store?.category, products]);

  useEscapeToClose(onClose, isOpen);

  if (!isOpen) return null;

  const handleReset = () => setDraft(DEFAULT_ADVANCED_FILTERS);
  const handleApply = () => { onApply(draft); onClose(); };
  const toggleAttributeFilter = (key, value) => {
    setDraft((d) => {
      const current = d.attributes || {};
      return { ...d, attributes: { ...current, [key]: current[key] === value ? "" : value } };
    });
  };

  const priceSortOptions = [
    { value: "price-asc", label: t("catalog.filterPanel.sortPriceAsc"), icon: ArrowUpNarrowWide },
    { value: "price-desc", label: t("catalog.filterPanel.sortPriceDesc"), icon: ArrowDownWideNarrow },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("catalog.filterPanel.title")}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 dark:text-slate-500 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* NARX ORALIG'I */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("catalog.filterPanel.priceRangeLabel")}</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={t("catalog.filterPanel.priceMinPlaceholder")}
              value={draft.priceMin ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, priceMin: e.target.value === "" ? null : Number(e.target.value) }))}
              className="w-full h-11 px-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-300 dark:text-slate-600 shrink-0">—</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={t("catalog.filterPanel.priceMaxPlaceholder")}
              value={draft.priceMax ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, priceMax: e.target.value === "" ? null : Number(e.target.value) }))}
              className="w-full h-11 px-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* REYTING */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("catalog.filterPanel.ratingLabel")}</h4>
          <div className="flex items-center gap-2">
            {RATING_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, minRating: d.minRating === n ? 0 : n }))}
                className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-1 text-xs font-bold transition-colors ${
                  draft.minRating === n
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Star size={12} fill="currentColor" /> {n}+ {t("catalog.filterPanel.andUp")}
              </button>
            ))}
          </div>
        </div>

        {/* 15-NICHE UNIVERSAL PLATFORMA: do'konning sohasiga (niche)
            mos, dinamik atribut filtrlari - masalan Kiyim-kechak uchun
            o'lcham/rang, Elektronika uchun brend/xotira, Kosmetika
            uchun teri turi. Har bir niche uchun HECH QANDAY qo'shimcha
            kod yozilmasdan, `config/niches.js`dan avtomatik hosil
            bo'ladi (`utils/attributeFilters.js`). */}
        {attributeDefs.map((def) => (
          <div key={def.key} className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t(`productAttributes.${def.key}.label`)}
            </h4>
            <div className="flex flex-wrap gap-2">
              {def.options.map((option) => {
                const isActive = (draft.attributes || {})[def.key] === option.value;
                const label = option.labelKey ? t(`productAttributes.${def.key}.options.${option.value}`) : option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleAttributeFilter(def.key, option.value)}
                    className={`h-9 px-3 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* OMBOR MAVJUDLIGI */}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, inStockOnly: !d.inStockOnly }))}
          className="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <Package size={14} className="text-slate-400 dark:text-slate-500" /> {t("catalog.filterPanel.inStockOnlyLabel")}
          </span>
          <span className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${draft.inStockOnly ? "bg-blue-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}>
            <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
          </span>
        </button>

        {/* NARX BO'YICHA SARALASH */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("catalog.filterPanel.sortLabel")}</h4>
          <div className="flex items-center gap-2">
            {priceSortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, priceSort: d.priceSort === opt.value ? "none" : opt.value }))}
                className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                  draft.priceSort === opt.value
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <opt.icon size={13} /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 h-12 rounded-2xl bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold"
          >
            {t("catalog.filterPanel.resetButton")}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-[2] h-12 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-600/30"
          >
            {t("catalog.filterPanel.applyButton")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
