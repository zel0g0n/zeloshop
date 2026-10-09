import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Package, BarChart3, Eye, EyeOff, Trash2, Pencil, Copy, X, PackageSearch, Layers, Wallet, CircleCheck, AlertTriangle, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatMoney } from "@/utils/dashboardCharts";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const card = "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl";
const select =
  "h-10 pl-3 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:border-[#5346E0]/50 focus:ring-4 focus:ring-[#5346E0]/10 cursor-pointer";

const Stat = ({ icon: Icon, tint, label, value, unit, sub }) => (
  <div className={`${card} p-4 shadow-xs flex items-center gap-3.5`}>
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}><Icon size={20} /></span>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[22px] leading-none font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
        {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] font-semibold text-slate-400 mt-1 truncate">{sub}</p>}
    </div>
  </div>
);

/** Kompyuter uchun Mahsulotlar: statistika kartalari, filtr paneli va jadval. */
const DesktopProducts = ({
  products, counts, inventoryValue, categories, showAnalytics, aiDraftCount,
  searchQuery, onSearchChange, statusFilter, onStatusChange, categoryFilter, onCategoryChange, sortBy, onSortChange,
  selectedIds, onToggleSelect, onSelectAll, onClearSelection, bulkBusy, onBulk,
  onEdit, onDuplicate, onToggleActive, onDelete, hasMore, onLoadMore, loading, error,
}) => {
  const { t } = useLanguage();
  const [toDelete, setToDelete] = useState(null);

  const tabs = [
    { id: "Barchasi", label: t("sellerProducts.filterAll"), count: counts.allCount },
    { id: "Faol", label: t("sellerProducts.filterActive"), count: counts.activeCount },
    { id: "Nofaol", label: t("sellerProducts.filterInactive"), count: counts.inactiveCount },
    { id: "KamQolgan", label: t("sellerProducts.filterLowStock"), count: counts.lowStockCount },
  ];
  const sorts = [
    ["none", t("sellerProducts.sortDefault")],
    ["price-desc", t("sellerProducts.sortPriceDesc")],
    ["price-asc", t("sellerProducts.sortPriceAsc")],
    ["stock-desc", t("sellerProducts.sortStockDesc")],
    ["stock-asc", t("sellerProducts.sortStockAsc")],
  ];
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t("sellerProducts.title")}</h2>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-1">{t("desktop.catalogSub")}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {aiDraftCount > 0 && (
            <Link to="/seller/products/drafts" className="h-11 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black flex items-center gap-2 border border-emerald-100 dark:border-emerald-500/20">
              <Sparkles size={15} />{t("productDraftReview.bannerReadyTitle", { count: aiDraftCount })}
            </Link>
          )}
          {showAnalytics && (
            <Link to="/seller/products/analytics" className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-white dark:hover:bg-slate-800">
              <BarChart3 size={15} />{t("desktop.analytics")}
            </Link>
          )}
          <Link to="/seller/add-product" className="h-11 px-5 rounded-xl bg-[#5346E0] hover:bg-[#4338CA] text-white text-xs font-black flex items-center gap-2 shadow-[0_8px_20px_rgba(83,70,224,0.25)] transition-colors">
            <Plus size={16} />{t("sellerProducts.createNew")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        <Stat icon={Layers} tint="bg-[#5346E0]/10 text-[#5346E0] dark:text-[#8b85f5]" label={t("desktop.totalProducts")} value={counts.allCount} unit={t("sellerProducts.countSuffix")} />
        <Stat icon={Wallet} tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" label={t("desktop.inventoryValue")} value={formatMoney(inventoryValue)} unit="so'm" />
        <Stat icon={CircleCheck} tint="bg-blue-500/10 text-blue-600 dark:text-blue-400" label={t("desktop.activeLabel")} value={counts.activeCount} sub={t("desktop.inactiveSub", { count: counts.inactiveCount })} />
        <Stat icon={AlertTriangle} tint="bg-amber-500/10 text-amber-600 dark:text-amber-400" label={t("sellerProducts.filterLowStock")} value={counts.lowStockCount} unit={t("sellerProducts.stockSuffix")} />
      </div>

      <section className={`${card} shadow-xs overflow-hidden`}>
        {/* Asboblar paneli */}
        <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative w-64 shrink-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("desktop.searchProducts")}
              className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none border border-transparent focus:border-[#5346E0]/40 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-[#5346E0]/10 transition"
            />
          </div>
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={`h-8 px-3.5 rounded-lg text-xs font-black flex items-center gap-2 whitespace-nowrap transition-colors ${
                  statusFilter === tab.id ? "bg-white dark:bg-slate-700 text-[#5346E0] dark:text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] tabular-nums ${statusFilter === tab.id ? "text-[#5346E0]/70 dark:text-slate-300" : "text-slate-400"}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {categories.length > 0 && (
              <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} className={select} aria-label={t("sellerProducts.categoryFilterTitle")}>
                <option value="Barchasi">{t("desktop.allCategories")}</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} className={select} aria-label={t("sellerProducts.sortTitle")}>
              {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-[#5346E0] text-white flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClearSelection} aria-label={t("sellerProducts.bulkCancel")} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><X size={14} /></button>
              <span className="text-xs font-black">{t("sellerProducts.bulkSelected", { count: selectedIds.size })}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={bulkBusy} onClick={() => onBulk("activate")} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Eye size={14} />{t("sellerProducts.bulkActivate")}</button>
              <button type="button" disabled={bulkBusy} onClick={() => onBulk("deactivate")} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><EyeOff size={14} />{t("sellerProducts.bulkDeactivate")}</button>
              <button type="button" disabled={bulkBusy} onClick={() => onBulk("delete")} className="h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Trash2 size={14} />{t("sellerProducts.bulkDelete")}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
        ) : error ? (
          <p className="py-16 text-center text-sm text-rose-500">{t("sellerProducts.error")} {error}</p>
        ) : products.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3 text-center">
            <span className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"><PackageSearch size={26} /></span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerProducts.notFound")}</p>
            <p className="text-xs text-slate-400">{t("desktop.notFoundHint")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="w-12 pl-5 py-3">
                  <input type="checkbox" checked={allSelected} onChange={() => (allSelected ? onClearSelection() : onSelectAll(products.map((p) => p.id)))} aria-label={t("desktop.selectAll")} className="w-4 h-4 accent-[#5346E0] cursor-pointer" />
                </th>
                <th className="text-left font-bold px-3 py-3">{t("desktop.colProduct")}</th>
                <th className="text-left font-bold px-3 py-3">{t("desktop.colCategory")}</th>
                <th className="text-right font-bold px-3 py-3">{t("desktop.colPrice")}</th>
                <th className="text-right font-bold px-3 py-3">{t("desktop.colStock")}</th>
                <th className="text-right font-bold px-3 py-3">{t("desktop.colSold")}</th>
                <th className="text-center font-bold px-3 py-3">{t("desktop.colVisible")}</th>
                <th className="text-right font-bold pl-3 pr-5 py-3">{t("desktop.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {products.map((p) => {
                const active = p.isActive ?? true;
                const stock = Number(p.stock) || 0;
                const selected = selectedIds.has(p.id);
                const title = p.title || p.name || t("sellerProducts.untitled");
                return (
                  <tr key={p.id} className={`group transition-colors ${selected ? "bg-[#5346E0]/5" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"} ${active ? "" : "opacity-60"}`}>
                    <td className="pl-5 py-3">
                      <input type="checkbox" checked={selected} onChange={() => onToggleSelect(p.id)} aria-label={t("sellerProducts.select")} className="w-4 h-4 accent-[#5346E0] cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => onEdit(p)} className="flex items-center gap-3 text-left max-w-[340px]">
                        {p.image ? (
                          <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                        ) : (
                          <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0"><Package size={18} /></span>
                        )}
                        <span className="font-bold text-slate-800 dark:text-white truncate group-hover:text-[#5346E0] dark:group-hover:text-indigo-300 transition-colors">{title}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{p.category || "—"}</td>
                    <td className="px-3 py-3 text-right font-black text-slate-800 dark:text-white tabular-nums whitespace-nowrap">{formatMoney(p.price)} <span className="text-[10px] font-bold text-slate-400">so'm</span></td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-block min-w-[44px] text-center px-2.5 py-1 rounded-md text-xs font-black tabular-nums ${
                        stock <= 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                        : stock <= 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}>{stock}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">{Number(p.sold) || 0}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? t("sellerProducts.deactivate") : t("sellerProducts.activate")}
                        onClick={() => onToggleActive(p.id, !active)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-4" : ""}`} />
                      </button>
                    </td>
                    <td className="pl-3 pr-5 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => onEdit(p)} title={t("sellerProducts.edit")} aria-label={t("sellerProducts.edit")} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"><Pencil size={15} /></button>
                        <button type="button" onClick={() => onDuplicate(p.id)} title={t("sellerProducts.duplicate")} aria-label={t("sellerProducts.duplicate")} className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"><Copy size={15} /></button>
                        <button type="button" onClick={() => setToDelete(p)} title={t("sellerProducts.bulkDelete")} aria-label={t("sellerProducts.bulkDelete")} className="w-8 h-8 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>{t("desktop.shown", { count: products.length })}</span>
          {hasMore && !loading && (
            <button type="button" onClick={onLoadMore} className="text-[#5346E0] dark:text-[#8b85f5] font-black hover:underline">{t("sellerProducts.loadMore")}</button>
          )}
        </div>
      </section>

      {toDelete && (
        <ConfirmDialog
          title={t("desktop.deleteProductTitle")}
          message={t("desktop.deleteProductMessage", { name: toDelete.title || toDelete.name || "" })}
          confirmLabel={t("sellerProducts.bulkDelete")}
          cancelLabel={t("sellerProducts.bulkCancel")}
          danger
          onConfirm={() => { onDelete(toDelete.id); setToDelete(null); }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default DesktopProducts;
