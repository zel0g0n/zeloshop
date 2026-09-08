import { useState, useMemo, useCallback } from "react";
import { PackagePlus, Search, ImageOff, Check, Trash2, Loader2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import { useBundles } from "@/hooks/seller/useBundles";
import { computeBundleIndividualTotal, computeBundleSavings } from "@/utils/bundlePricing";
import { useLanguage } from "@/context/LanguageContext";

/**
 * "BANDLLAR" (combo takliflar) bo'limi — 2026-09 birlashtirilgan
 * "Marketing va Kuponlar" sahifasining (`MarketingHub.jsx`) IKKINCHI
 * tabi.
 *
 * OLDIN: `BundleManagementPage.jsx` nomli TO'LIQ ALOHIDA sahifa edi.
 * Mantiq AYNAN, o'zgarishsiz shu yerga ko'chirildi — faqat tashqi
 * sahifa wrapper/sarlavhasi olib tashlandi (endi `MarketingHub.jsx`
 * bitta umumiy sarlavha va tab-panelni beradi).
 *
 * HAQIQIY, YAKUNIY narx har doim checkout paytida serverda
 * (`functions/orders.js`) qayta hisoblanadi va tekshiriladi - bu
 * yerdagi hisob-kitob faqat sotuvchiga OLDINDAN ko'rsatish uchun.
 */
const BundlesSection = () => {
  const { t } = useLanguage();
  const { sellerId } = useSession();
  const { products = [], loading: productsLoading } = useGetProductsData(sellerId);
  const { bundles, loading: bundlesLoading, create, remove, toggleActive } = useBundles(sellerId);

  const [name, setName] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => (p.title || p.name || "").toLowerCase().includes(query));
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)),
    [products, selectedIds]
  );

  const individualTotal = useMemo(() => computeBundleIndividualTotal(selectedProducts), [selectedProducts]);
  const { savings, savingsPercent } = useMemo(
    () => computeBundleSavings(individualTotal, bundlePrice),
    [individualTotal, bundlePrice]
  );

  const toggleSelect = useCallback((productId) => {
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }, []);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);

    if (selectedIds.length < 2) {
      setFormError(t("bundleManagement.minProductsError"));
      return;
    }
    if (!bundlePrice || Number(bundlePrice) <= 0) {
      setFormError(t("bundleManagement.priceRequired"));
      return;
    }
    if (Number(bundlePrice) >= individualTotal) {
      setFormError(t("bundleManagement.priceTooHighError"));
      return;
    }

    setCreating(true);
    try {
      await create({ name, productIds: selectedIds, bundlePrice });
      setName("");
      setBundlePrice("");
      setSelectedIds([]);
      setSearch("");
    } catch (err) {
      setFormError(err.message || t("bundleManagement.createError"));
    } finally {
      setCreating(false);
    }
  }, [name, bundlePrice, selectedIds, individualTotal, create, t]);

  const handleToggle = useCallback(async (bundle) => {
    setBusyId(bundle.id);
    try {
      await toggleActive(bundle.id, !bundle.isActive);
    } finally {
      setBusyId(null);
    }
  }, [toggleActive]);

  const handleDelete = useCallback(async (bundleId) => {
    setBusyId(bundleId);
    try {
      await remove(bundleId);
    } finally {
      setBusyId(null);
    }
  }, [remove]);

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
          <PackagePlus size={13} />
          <h3 className="text-xs font-black uppercase tracking-wider">{t("bundleManagement.newBundleTitle")}</h3>
        </div>

        <input
          type="text"
          disabled={creating}
          placeholder={t("bundleManagement.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("bundleManagement.productsLabel")} ({selectedIds.length})</label>
          <div className="relative mt-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("bundleManagement.searchPlaceholder")}
              className="w-full h-10 pl-8 pr-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {productsLoading && <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">{t("marketing.loading")}</p>}
            {!productsLoading && filteredProducts.map((product) => {
              const isSelected = selectedIds.includes(product.id);
              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => toggleSelect(product.id)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-colors ${isSelected ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-slate-100 dark:border-slate-800"}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                    {product.image || product.images?.[0] ? (
                      <img src={product.image || product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff size={12} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{product.title || product.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{Number(product.price).toLocaleString()} so'm</p>
                  </div>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isSelected ? "bg-indigo-600 text-white" : "border border-slate-200 dark:border-slate-700"}`}>
                    {isSelected && <Check size={12} />}
                  </div>
                </button>
              );
            })}
            {!productsLoading && filteredProducts.length === 0 && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">{t("createPromotion.noProducts")}</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("bundleManagement.bundlePriceLabel")}</label>
          <input
            type="number"
            disabled={creating}
            placeholder={t("bundleManagement.bundlePricePlaceholder")}
            value={bundlePrice}
            onChange={(e) => setBundlePrice(e.target.value)}
            className="w-full h-11 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        {selectedIds.length >= 2 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t("bundleManagement.individualTotalLabel")}: <span className="line-through">{individualTotal.toLocaleString()} so'm</span>
            {bundlePrice && Number(bundlePrice) > 0 && savings > 0 && (
              <> · {t("bundleManagement.savingsPreview", { savings: savings.toLocaleString(), percent: savingsPercent })}</>
            )}
          </p>
        )}

        {formError && <p className="text-[11px] text-rose-500 font-semibold">{formError}</p>}

        <button
          type="submit"
          disabled={creating}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <PackagePlus size={14} /> {creating ? t("marketing.creating") : t("bundleManagement.createButton")}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{t("bundleManagement.activeBundlesTitle")}</h3>

        {bundlesLoading && <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">{t("marketing.loading")}</p>}

        {!bundlesLoading && bundles.length === 0 && (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">{t("bundleManagement.noBundles")}</p>
        )}

        {!bundlesLoading && bundles.map((bundle) => (
          <div key={bundle.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{bundle.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t("bundleManagement.productsCount", { count: bundle.productIds?.length || 0 })} · {Number(bundle.bundlePrice).toLocaleString()} so'm
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(bundle)}
                  disabled={busyId === bundle.id}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors disabled:opacity-50 ${bundle.isActive ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(bundle.id)}
                  disabled={busyId === bundle.id}
                  className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 disabled:opacity-50"
                  aria-label={t("marketing.deleteAria")}
                >
                  {busyId === bundle.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BundlesSection;
