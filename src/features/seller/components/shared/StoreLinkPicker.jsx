import { useState, useMemo, useCallback } from "react";
import { X, Grid3x3, Flame, Sparkles, Star, Package, ImageOff, AlertTriangle, Search, Loader2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import { buildShopLink, buildDeepLink } from "@/utils/shareLink";
import { useAnalyticsOrders } from "@/hooks/seller/useAnalyticsOrders";
import { useAnalyticsProducts } from "@/hooks/seller/useAnalyticsProducts";
import { buildProductPeriodStats, getDeadStock, getTopProducts } from "@/utils/productAnalytics";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * UMUMIY "HAVOLA TANLASH" OYNASI — CRM broadcast xabarlari va bosh
 * sahifa bannerlari uchun ishlatiladi. Sotuvchi havolani QO'LDA
 * yozish o'rniga, TAYYOR variantlardan birini TANLAYDI.
 *
 * MUHIM: bu — `buildDeepLink`/`parseStartParam` chuqur-havola
 * infratuzilmasiga tayanadi (yangi qurilgan) - shu orqali
 * "faqat aksiyadagi mahsulotlar" yoki "faqat bitta kategoriya"ga
 * TO'G'RIDAN-TO'G'RI ochiladigan HAQIQIY, ishlaydigan havolalar
 * yaratiladi.
 *
 * MUHIM QO'SHIMCHA (foydalanuvchi so'rovi bo'yicha, "real production"
 * darajasida): endi INDIVIDUAL MAHSULOT havolalari ham mavjud -
 * rasmi va narxi bilan, ikkita muhim guruhda: "Maxsus tovarlar"
 * (kam sotiladigan/uzoq vaqt sotilmagan - `getDeadStock` orqali,
 * xuddi Mahsulotlar Analitikasi sahifasi ISHLATADIGAN BIR XIL,
 * allaqachon tekshirilgan hisoblash mantig'i) va "Eng ko'p
 * sotilganlar". Bundan tashqari, istalgan mahsulotni QIDIRIB
 * topish ham mumkin.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const ProductLinkRow = ({ product, sellerId, badge, onPick }) => {
  const path = `/product/${product.id}`;
  const externalUrl = buildDeepLink(sellerId, path);
  return (
    <button
      type="button"
      onClick={() => onPick({ id: product.id, label: product.name, path, externalUrl })}
      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-left active:scale-[0.98] transition-transform"
    >
      <span className="w-9 h-9 rounded-lg bg-white dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <ImageOff size={13} className="text-slate-300 dark:text-slate-600" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{product.name}</p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">{Number(product.price || 0).toLocaleString()} so'm</p>
      </div>
      {badge}
    </button>
  );
};

const StoreLinkPicker = ({ onSelect, onClose }) => {
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const [productSearch, setProductSearch] = useState("");

  useEscapeToClose(onClose);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => getEffectiveCategoriesForStore(store), [store?.category, store?.categoryCustomization]);

  // MUHIM (xarajat haqida ochiq gap): bu, `getAnalyticsOrders`/
  // `getAnalyticsProducts` (sahifalashsiz, faqat Analitika sahifalari
  // ishlatadigan) so'rovlarini ISHGA TUSHIRADI - bu oyna FAQAT
  // sotuvchi CRM xabari yoki banner tayyorlaganda ochiladi (kam-tez
  // holat), shuning uchun bu - oqlangan, chegaralangan xarajat.
  const { orders = [], loading: ordersLoading } = useAnalyticsOrders(sellerId);
  const { products = [], loading: productsLoading } = useAnalyticsProducts(sellerId);
  const isLoadingProductData = ordersLoading || productsLoading;

  const productStats = useMemo(() => {
    const rangeStart = Date.now() - 365 * DAY_MS;
    return buildProductPeriodStats(products, orders, rangeStart, Date.now());
  }, [products, orders]);

  const specialProducts = useMemo(() => getDeadStock(productStats, 30).slice(0, 8), [productStats]);
  const bestSellers = useMemo(() => getTopProducts(productStats, "unitsSold", 8), [productStats]);

  const searchResults = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return [];
    return products.filter((p) => (p.title || p.name || "").toLowerCase().includes(query)).slice(0, 10);
  }, [products, productSearch]);

  // MUHIM: har bir variant IKKI XIL formatda qaytariladi -
  // `path` (ilova ICHKI yo'li, masalan "/catalog?quick=aksiya" -
  // banner kabi ILOVA ICHIDAGI navigatsiya uchun) va `externalUrl`
  // (to'liq Telegram havolasi - CRM broadcast xabari kabi ILOVADAN
  // TASHQARI, mijozga Telegram xabari sifatida yuboriladigan
  // holatlar uchun). Har bir chaqiruvchi o'ziga keragini oladi.
  // MUHIM: `externalUrl` HAR DOIM platformaning umumiy boti orqali
  // quriladi (`buildShopLink`/`buildDeepLink` - ichkarida) - shaxsiy
  // bot ULASHILADIGAN havolalar uchun ISHLAMAYDI (yuqoridagi
  // `shareLink.js`dagi izohga qarang).
  const quickOptions = useMemo(() => [
    { id: "all", icon: Grid3x3, label: t("linkPicker.allProducts"), path: "/catalog", externalUrl: buildShopLink(sellerId) },
    { id: "aksiya", icon: Flame, label: t("linkPicker.onSale"), path: "/catalog?quick=aksiya", externalUrl: buildDeepLink(sellerId, "/catalog?quick=aksiya") },
    { id: "new", icon: Sparkles, label: t("linkPicker.newArrivals"), path: "/catalog?quick=new", externalUrl: buildDeepLink(sellerId, "/catalog?quick=new") },
    { id: "top", icon: Star, label: t("linkPicker.topRated"), path: "/catalog?quick=top", externalUrl: buildDeepLink(sellerId, "/catalog?quick=top") },
  ], [sellerId, t]);

  const handlePick = useCallback((option) => {
    onSelect(option);
    onClose();
  }, [onSelect, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[28px] max-h-[80vh] overflow-y-auto animate-slide-up"
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("linkPicker.title")}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <X size={14} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("linkPicker.quickLinksLabel")}</p>
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handlePick(option)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-left active:scale-95 transition-transform"
                >
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <option.icon size={15} />
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* MUHIM TUZATISH: OLDIN, mahsulot ma'lumoti (orders/products)
              hali yuklanayotgan paytda, "Maxsus tovarlar"/"Eng ko'p
              sotilganlar" bo'limlari SHUNCHAKI BO'SH ko'rinardi (chunki
              massivlar hali `[]`), keyin ma'lumot kelganda BIRDANIGA
              paydo bo'lib qolardi - bu, sotuvchiga "biror narsa
              noto'g'ri ishlayaptimi" degan noto'g'ri taassurot
              qoldirishi mumkin edi. Endi - aniq "yuklanmoqda" holati
              ko'rsatiladi. */}
          {isLoadingProductData ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400 dark:text-slate-500">
              <Loader2 size={14} className="animate-spin" /> {t("linkPicker.loadingProducts")}
            </div>
          ) : (
            <>
              {specialProducts.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle size={11} /> {t("linkPicker.specialProductsLabel")}
                  </p>
                  <div className="space-y-1.5">
                    {specialProducts.map((p) => (
                      <ProductLinkRow
                        key={p.id}
                        product={p}
                        sellerId={sellerId}
                        onPick={handlePick}
                        badge={
                          <span className="shrink-0 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                            {p.daysSinceLastSale != null ? t("linkPicker.daysAgo", { days: p.daysSinceLastSale }) : t("linkPicker.neverSold")}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {bestSellers.length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("linkPicker.bestSellersLabel")}</p>
                  <div className="space-y-1.5">
                    {bestSellers.map((p) => (
                      <ProductLinkRow key={p.id} product={p} sellerId={sellerId} onPick={handlePick} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {categories.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("linkPicker.categoriesLabel")}</p>
              <div className="space-y-1.5">
                {categories.map((c) => {
                  const path = `/category/${encodeURIComponent(c.value)}`;
                  const externalUrl = buildDeepLink(sellerId, path);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => handlePick({ id: c.value, label: c.label, path, externalUrl })}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-left active:scale-[0.98] transition-transform"
                    >
                      <span className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Package size={13} />
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ISTALGAN MAHSULOTNI QIDIRISH - yuqoridagi guruhlarga
              tushmagan mahsulotlar uchun ham havola yaratish
              imkoniyati. */}
          <div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("linkPicker.searchProductLabel")}</p>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t("linkPicker.searchProductPlaceholder")}
                className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1.5">
                {searchResults.map((p) => (
                  <ProductLinkRow
                    key={p.id}
                    product={{ id: p.id, name: p.title || p.name, price: p.price, image: p.image || p.images?.[0] }}
                    sellerId={sellerId}
                    onPick={handlePick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreLinkPicker;
