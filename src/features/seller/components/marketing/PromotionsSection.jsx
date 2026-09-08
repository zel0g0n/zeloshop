import { useState, useMemo, useCallback, memo } from "react";
import { Search, ImageOff, Check, X, Loader2, Flame, Timer } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import setDiscountPrice from "@/services/products/setDiscountPrice";
import { calculateDiscountFromPercent, isValidDiscountPrice, DISCOUNT_DURATION_OPTIONS, computeDiscountExpiresAt } from "@/utils/promotionHelpers";
import { isDiscountActive, getDiscountRemainingMs, formatCountdown } from "@/utils/productPricing";
import { getTariffLimits } from "@/utils/tariffLimits";
import { useLanguage } from "@/context/LanguageContext";

/**
 * "AKSIYALAR" bo'limi — 2026-09 birlashtirilgan "Marketing va
 * Kuponlar" sahifasining (`MarketingHub.jsx`) UCHINCHI tabi.
 *
 * OLDIN: `CreatePromotionPage.jsx` nomli TO'LIQ ALOHIDA sahifa edi
 * (o'zining sticky sarlavha+qidiruv qatori bilan). Mantiq AYNAN
 * o'zgarishsiz shu yerga ko'chirildi — faqat qidiruv qatori endi
 * (tashqi sticky sarlavha o'rniga) bo'lim ichida, oddiy (sticky
 * bo'lmagan) blok sifatida ko'rsatiladi.
 *
 * MUHIM FARQ (promokoddan): bu — mahsulotning O'ZIGA doimiy
 * ko'rinadigan "eski narx / yangi narx" chegirmasi (`discountPrice`
 * maydoni) - Katalog/Bosh sahifadagi "Aksiyadagi mahsulotlar"
 * bo'limida avtomatik ko'rinadi. Promokod (Promokodlar tabida) esa
 * BUYURTMA darajasida, kod kiritilganda ishlaydigan, alohida
 * mexanizm - ikkalasi BIR-BIRIDAN MUSTAQIL, alohida vazifalar.
 */
const DiscountEditor = memo(({ product, onSaved, onClose, discountLimitReached }) => {
  const { t } = useLanguage();
  const price = Number(product.price) || 0;
  const [discountValue, setDiscountValue] = useState(product.discountPrice ? String(product.discountPrice) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Z-TARIFLAR (2026-09): bu mahsulotda HALI chegirma yo'q VA
  // sotuvchi tarifining aksiya limiti to'lgan bo'lsa - saqlashga
  // urinishdan OLDIN, tezkor va tushunarli xabar (haqiqiy tekshiruv
  // `firestore.rules`da - bu faqat UX).
  const isNewDiscount = !product.discountPrice;
  const blockedByLimit = isNewDiscount && discountLimitReached;

  // "VAQTLI AKSIYA": sotuvchi muddat tugmalaridan BIRIGA bosmaguncha,
  // mavjud (agar bo'lsa) muddat O'ZGARTIRILMAYDI - shu orqali faqat
  // narxni tahrirlash, avvaldan qo'yilgan taymerni tasodifan
  // qayta boshlab yubormaydi.
  const existingExpiresAt = product.discountExpiresAt || null;
  const [durationTouched, setDurationTouched] = useState(false);
  const [selectedHours, setSelectedHours] = useState(null);

  const existingRemainingMs = !durationTouched ? getDiscountRemainingMs({ discountExpiresAt: existingExpiresAt }) : null;

  const applyPercent = (percent) => {
    setDiscountValue(String(calculateDiscountFromPercent(price, percent)));
  };

  const handleSave = useCallback(async () => {
    if (blockedByLimit) {
      setError(t("createPromotion.limitReached"));
      return;
    }
    if (!isValidDiscountPrice(discountValue, price)) {
      setError(Number(discountValue) >= price ? t("createPromotion.mustBeLower") : t("createPromotion.invalidPrice"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const discountExpiresAt = durationTouched ? computeDiscountExpiresAt(selectedHours) : existingExpiresAt;
      await setDiscountPrice(product.id, Number(discountValue), discountExpiresAt);
      onSaved(product.id, Number(discountValue), discountExpiresAt);
    } catch (err) {
      setError(err.message || t("createPromotion.saveError"));
    } finally {
      setSaving(false);
    }
  }, [discountValue, price, product.id, onSaved, t, durationTouched, selectedHours, existingExpiresAt, blockedByLimit]);

  const handleRemove = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await setDiscountPrice(product.id, null, null);
      onSaved(product.id, null, null);
    } catch (err) {
      setError(err.message || t("createPromotion.saveError"));
    } finally {
      setSaving(false);
    }
  }, [product.id, onSaved, t]);

  return (
    <div className="bg-indigo-50/60 dark:bg-indigo-500/10 rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        {[10, 20, 30].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPercent(p)}
            className="flex-1 h-9 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold"
          >
            -{p}%
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          type="number"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          placeholder={t("createPromotion.discountPricePlaceholder")}
          className="w-full h-11 px-3 pr-16 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">so'm</span>
      </div>

      {discountValue && Number(discountValue) > 0 && Number(discountValue) < price && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {t("createPromotion.originalPrice")}: <span className="line-through">{price.toLocaleString()} so'm</span> → <span className="font-bold text-indigo-600 dark:text-indigo-400">{Number(discountValue).toLocaleString()} so'm</span>
        </p>
      )}

      {/* "VAQTLI AKSIYA": chegirmaning qancha vaqt amal qilishini
          tanlash - sotuvchi tanlamasa, mavjud (yoki muddatsiz) holat
          o'zgarishsiz qoladi. */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{t("createPromotion.durationLabel")}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DISCOUNT_DURATION_OPTIONS.map((opt) => {
            const isSelected = durationTouched && selectedHours === opt.hours;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setDurationTouched(true); setSelectedHours(opt.hours); }}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-bold transition-colors ${
                  isSelected ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                {t(`createPromotion.duration_${opt.key}`)}
              </button>
            );
          })}
        </div>
        {existingRemainingMs != null && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
            <Timer size={11} /> {t("createPromotion.currentlyEndsIn", { time: formatCountdown(existingRemainingMs) })}
          </p>
        )}
      </div>

      {blockedByLimit && !error && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">{t("createPromotion.limitReached")}</p>
      )}
      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

      <div className="flex gap-2">
        {product.discountPrice && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="flex-1 h-10 rounded-xl bg-white dark:bg-slate-800 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <X size={13} /> {t("createPromotion.removeDiscount")}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="flex-1 h-10 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold disabled:opacity-60"
        >
          {t("createPromotion.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || blockedByLimit}
          className="flex-[2] h-10 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {t("createPromotion.saveDiscount")}
        </button>
      </div>
    </div>
  );
});
DiscountEditor.displayName = "DiscountEditor";

const PromotionsSection = () => {
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { products = [], loading } = useGetProductsData(sellerId);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [localOverrides, setLocalOverrides] = useState({});

  // Z-TARIFLAR: Z-Start tarifda ko'pi bilan 3 ta FAOL aksiya (server
  // tomonidan `firestore.rules`da HAQIQIY tekshiriladi - bu yerdagi
  // hisob faqat tezkor UX xabari uchun, haqiqiy hisoblagich
  // `sellers.activeDiscountCount`).
  const maxActiveDiscounts = getTariffLimits(store).maxActiveDiscounts;
  const discountLimitReached = maxActiveDiscounts !== null && Number(store?.activeDiscountCount || 0) >= maxActiveDiscounts;

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => (p.title || p.name || "").toLowerCase().includes(query));
  }, [products, search]);

  const handleSaved = useCallback((productId, newDiscountPrice, newDiscountExpiresAt) => {
    setLocalOverrides((prev) => ({ ...prev, [productId]: { discountPrice: newDiscountPrice, discountExpiresAt: newDiscountExpiresAt ?? null } }));
    setExpandedId(null);
  }, []);

  const getDiscountInfo = (product) =>
    Object.prototype.hasOwnProperty.call(localOverrides, product.id)
      ? localOverrides[product.id]
      : { discountPrice: product.discountPrice, discountExpiresAt: product.discountExpiresAt };

  return (
    <div className="p-4 space-y-2.5">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("createPromotion.searchPlaceholder")}
          className="w-full h-10 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {loading && <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-10">{t("productAnalytics.loading")}</div>}

      {!loading && filteredProducts.map((product) => {
        const { discountPrice, discountExpiresAt } = getDiscountInfo(product);
        const hasDiscount = isDiscountActive({ price: product.price, discountPrice, discountExpiresAt });
        const remainingMs = hasDiscount ? getDiscountRemainingMs({ discountExpiresAt }) : null;
        const isExpanded = expandedId === product.id;

        return (
          <div key={product.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 space-y-3">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : product.id)}
              className="w-full flex items-center gap-3 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                {product.image || product.images?.[0] ? (
                  <img src={product.image || product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff size={14} className="text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{product.title || product.name}</p>
                {hasDiscount ? (
                  <p className="text-[11px] mt-0.5">
                    <span className="line-through text-slate-400 dark:text-slate-500">{Number(product.price).toLocaleString()}</span>{" "}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{Number(discountPrice).toLocaleString()} so'm</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{Number(product.price).toLocaleString()} so'm</p>
                )}
              </div>
              {hasDiscount && (
                <span className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-rose-500 px-2 py-1 rounded-md">
                    <Flame size={10} /> {t("createPromotion.activeBadge")}
                  </span>
                  {remainingMs != null && (
                    <span className="text-[9px] font-bold text-rose-500">{formatCountdown(remainingMs)}</span>
                  )}
                </span>
              )}
            </button>

            {isExpanded && (
              <DiscountEditor
                product={{ ...product, discountPrice, discountExpiresAt }}
                onSaved={handleSaved}
                onClose={() => setExpandedId(null)}
                discountLimitReached={discountLimitReached}
              />
            )}
          </div>
        );
      })}

      {!loading && filteredProducts.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-10">{t("createPromotion.noProducts")}</p>
      )}
    </div>
  );
};

export default PromotionsSection;
