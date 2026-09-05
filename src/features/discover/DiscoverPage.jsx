import { useState, useEffect, useCallback } from "react";
import { Compass, Store as StoreIcon, ExternalLink } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { getDiscoverStores } from "@/services/discover/getDiscoverStores";
import { filterVisibleStores, buildStoreSubtitle } from "@/utils/discoverStores";
import { buildShopLink } from "@/utils/shareLink";

/**
 * OMMAVIY "DO'KONLARNI KASHF ETING" SAHIFASI.
 *
 * MUHIM: bu — ilovaning YAGONA haqiqiy JAMOAT (Telegram autentifika-
 * siyasiz) sahifasi (`App.jsx`dagi `isDiscoverPath`ga qarang) - hech
 * qanday `SessionProvider`/Redux `store` yuklanmaydi, faqat
 * `sellers`/`products` kolleksiyalarining ALLAQACHON ochiq
 * (`firestore.rules`da `allow read: if true`) qismini o'qiydi.
 *
 * Bu yerdan haridni TO'LIQ yakunlab bo'lmaydi (checkout faqat
 * Telegram Mini App ichida ishlaydi) - shuning uchun har bir do'kon
 * kartochkasi shunchaki o'sha do'konning Telegram havolasiga
 * (`buildShopLink`) olib boradi.
 *
 * PERFORMANCE / SEKIN INTERNET: kichik sahifalash (`DISCOVER_PAGE_
 * SIZE`), skelet (skeleton) yuklanish holati, va rasm uchun
 * `loading="lazy"` - barchasi past tezlikdagi ulanishda ham sahifa
 * ishlatilishi mumkin bo'lishini ta'minlash uchun.
 */
const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3 animate-pulse">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-2/3 bg-slate-100 dark:bg-slate-800 rounded" />
      <div className="h-2.5 w-1/3 bg-slate-100 dark:bg-slate-800 rounded" />
    </div>
  </div>
);

const StoreCard = ({ store }) => {
  const subtitle = buildStoreSubtitle(store);
  return (
    <a
      href={buildShopLink(store.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform shadow-xs"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#F4F5F9] dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 text-slate-400 dark:text-slate-500">
        {store.logo ? (
          <img src={store.logo} alt={store.storeName} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <StoreIcon size={22} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate">{store.storeName}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">{subtitle}</p>}
      </div>
      <span className="shrink-0 w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
        <ExternalLink size={14} />
      </span>
    </a>
  );
};

const DiscoverPage = () => {
  const { t } = useLanguage();
  const [stores, setStores] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const loadPage = useCallback(async (afterDoc) => {
    const { stores: newStores, lastDoc, hasMore: more } = await getDiscoverStores(afterDoc);
    setStores((prev) => [...prev, ...filterVisibleStores(newStores)]);
    setCursor(lastDoc);
    setHasMore(more);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDiscoverStores(null)
      .then(({ stores: firstStores, lastDoc, hasMore: more }) => {
        if (cancelled) return;
        setStores(filterVisibleStores(firstStores));
        setCursor(lastDoc);
        setHasMore(more);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      await loadPage(cursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadPage]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-16 transition-colors duration-300">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 px-4 pt-10 pb-8 text-white text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
          <Compass size={26} />
        </div>
        <h1 className="text-lg font-black">{t("discover.heroTitle")}</h1>
        <p className="text-xs font-medium text-white/80 mt-1.5 max-w-sm mx-auto leading-relaxed">{t("discover.heroSubtitle")}</p>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-2.5">
        {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && error && (
          <div className="text-center py-16 text-rose-500 dark:text-rose-400 text-xs font-semibold">{t("discover.error")}</div>
        )}

        {!loading && !error && stores.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
            <StoreIcon size={28} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t("discover.emptyState")}</p>
          </div>
        )}

        {!loading && stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}

        {!loading && hasMore && stores.length > 0 && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-2xl active:scale-95 transition-transform disabled:opacity-60 mt-1"
          >
            {loadingMore ? t("discover.loadingMore") : t("discover.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
};

export default DiscoverPage;
