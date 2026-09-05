import { memo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { PackagePlus, ImageOff } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProductBundles } from "@/hooks/useProductBundles";
import { addBundleToCart } from "@/store/slices/product/cartSlice";
import { computeBundleIndividualTotal, computeBundleSavings } from "@/utils/bundlePricing";

/**
 * "COMBO TAKLIF" — mahsulot sahifasida shu mahsulot ishtirok etadigan
 * FAOL combo takliflarni ko'rsatadi ("buni ... bilan birga X so'mga
 * oling — Y so'm tejang"). Bosilganda combo'ga kiruvchi BARCHA
 * mahsulotlar bir yo'la savatga qo'shiladi.
 *
 * MUHIM: bu yerdagi "tejash" summasi faqat ko'rsatish uchun taxmin -
 * checkout paytida YAKUNIY narx serverda (`functions/orders.js`)
 * combo mahsulotlarining HOZIRGI narxlaridan qayta hisoblanadi.
 */
const BundleCard = memo(({ bundle, onAdd }) => {
  const { t } = useLanguage();
  const individualTotal = computeBundleIndividualTotal(bundle.products);
  const { savings, savingsPercent } = computeBundleSavings(individualTotal, bundle.bundlePrice);

  if (savings <= 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
        <PackagePlus size={14} />
        <h3 className="text-xs font-black uppercase tracking-wider">{bundle.name || t("productDetail.bundle.defaultTitle")}</h3>
      </div>

      <div className="flex items-center gap-2">
        {bundle.products.map((p, idx) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
              {p.image || p.images?.[0] ? (
                <img src={p.image || p.images[0]} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <ImageOff size={13} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
            {idx < bundle.products.length - 1 && <span className="text-slate-300 dark:text-slate-600 font-bold">+</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 line-through">{individualTotal.toLocaleString()} so'm</p>
          <p className="text-base font-black text-indigo-600 dark:text-indigo-400">{Number(bundle.bundlePrice).toLocaleString()} so'm</p>
        </div>
        <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-1 rounded-md shrink-0">
          {t("productDetail.bundle.savingsBadge", { percent: savingsPercent })}
        </span>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl"
      >
        {t("productDetail.bundle.addButton")}
      </button>
    </div>
  );
});
BundleCard.displayName = "BundleCard";

export const BundleOffer = memo(({ product }) => {
  const dispatch = useDispatch();
  const { sellerId } = useSession();
  const { bundles } = useProductBundles(sellerId, product);

  const handleAdd = useCallback((bundle) => {
    dispatch(addBundleToCart({
      bundleId: bundle.id,
      name: bundle.name,
      bundlePrice: bundle.bundlePrice,
      products: bundle.products,
    }));
  }, [dispatch]);

  if (bundles.length === 0) return null;

  return (
    <div className="space-y-3">
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} onAdd={() => handleAdd(bundle)} />
      ))}
    </div>
  );
});
BundleOffer.displayName = "BundleOffer";
