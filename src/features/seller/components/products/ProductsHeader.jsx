import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, BarChart3, Tag, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSession } from "@/context/SessionContext";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";

/**
 * MUHIM DIZAYN QARORI: dastlab Analitika tugmasi qidiruv qatoriga
 * (saralash tugmasi yoniga) qo'yilgan edi - lekin foydalanuvchi
 * to'g'ri payqadi: bu yerga yana bitta (kategoriya) tugma qo'shilsa,
 * 3 ta tugma + qidiruv maydoni BITTA qatorda siqilib qolardi.
 *
 * YECHIM: Analitika kirish nuqtasi YUQORIGA, statistika bilan bir
 * joyga ko'chirildi - bu MANTIQAN ham to'g'ri (statistika = analitika
 * mavzusi), qidiruv qatorida esa endi FAQAT ikkita filtr tugmasi
 * (Saralash + Kategoriya) qoladi, hech qanday siqilish yo'q.
 *
 * "E'tiborni tortish" talabi uchun: oddiy matn o'rniga, statistika
 * BUTUNLAY BOSILADIGAN, aniq vizual chegarasi (rangli fon + ikonka +
 * "yangi ma'lumot" nuqtasi + o'ngga yo'naltiruvchi strelka) bo'lgan
 * "insight chip" ko'rinishida - lekin ATAYLAB suzib yuruvchi/sudrab
 * ko'chiriladigan qilinmadi (bunday tugmalar mobil interfeysda
 * tasodifiy surilib ketishi, boshqa elementlarni to'sib qo'yishi
 * mumkin - o'rnashgan, ishonchli joyda turgan tugma yaxshiroq UX).
 */
const ProductsHeader = ({
  searchQuery, onSearchChange, productsCount, inventoryValue, sortBy, onSortChange,
  categoryFilter, onCategoryChange,
}) => {
  const { t } = useLanguage();
  const { store } = useSession();
  const navigate = useNavigate();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categories = getEffectiveCategoriesForStore(store).map((c) => c.value);
  // Mahsulotlar analitikasi (`/seller/products/analytics`) Z-Start
  // tarifida mavjud emas — shu sabab bu "insight chip" kirish nuqtasi
  // Z-Start uchun butunlay yashiriladi (2026-09 tarif bo'yicha tozalash).
  const showAnalyticsChip = getEffectiveTariffPlan(store) !== "start";

  const SORT_OPTIONS = [
    { value: "none", label: t("sellerProducts.sortDefault") },
    { value: "price-desc", label: t("sellerProducts.sortPriceDesc") },
    { value: "price-asc", label: t("sellerProducts.sortPriceAsc") },
    { value: "stock-desc", label: t("sellerProducts.sortStockDesc") },
    { value: "stock-asc", label: t("sellerProducts.sortStockAsc") },
  ];

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">{t("sellerProducts.title")}</h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider truncate">{t("sellerProducts.subtitle")}</p>
        </div>

        {/* "INSIGHT CHIP" — statistika + Analitikaga kirish, bir tugmada.
            Z-Start tarifida yo'q (faqat Z-Pro/Z-Biznes). */}
        {showAnalyticsChip && (
          <button
            type="button"
            onClick={() => navigate("/seller/products/analytics")}
            className="group shrink-0 flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-500/15 dark:to-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 active:scale-95 transition-transform"
          >
            <span className="relative w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
              <BarChart3 size={14} className="text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900 animate-pulse" />
            </span>
            <div className="text-right leading-tight">
              <span className="block text-xs font-black text-slate-800 dark:text-white">{productsCount} {t("sellerProducts.countSuffix")}</span>
              <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{inventoryValue.toLocaleString()} so'm</span>
            </div>
            <ChevronRight size={13} className="text-indigo-400 dark:text-indigo-500 shrink-0 group-active:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-zinc-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={t("sellerProducts.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-zinc-400"
          />
        </div>

        {categories.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowCategoryMenu((v) => !v)}
              className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                categoryFilter !== "Barchasi" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-zinc-300"
              }`}
              title={t("sellerProducts.categoryFilterTitle")}
            >
              <Tag size={15} />
            </button>

            {showCategoryMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCategoryMenu(false)} />
                <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 py-1.5 w-56 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { onCategoryChange("Barchasi"); setShowCategoryMenu(false); }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                      categoryFilter === "Barchasi" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    {t("sellerProducts.filterAll")}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { onCategoryChange(cat); setShowCategoryMenu(false); }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                        categoryFilter === cat ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "text-slate-600 dark:text-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowSortMenu((v) => !v)}
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              sortBy !== "none" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-zinc-300"
            }`}
            title={t("sellerProducts.sortTitle")}
          >
            <ArrowUpDown size={15} />
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-12 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 py-1.5 w-56">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { onSortChange(opt.value); setShowSortMenu(false); }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold ${
                      sortBy === opt.value ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10" : "text-slate-600 dark:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ProductsHeader);
