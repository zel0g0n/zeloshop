import { useCallback, useEffect, useRef, useState } from "react";
import { getSellersPage, getSellerCounts, searchSellers } from "@/services/admin/getAllSellers";

// Qidiruv har harfda tarmoq so'rovini QAYTA yubormasligi uchun —
// `SearchCatalog.jsx`dagi bilan bir xil, allaqachon sinalgan 300ms
// debounce naqshi.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 2026-09 audit: bu hook OLDIN faqat `subscribeAllSellers`ni (BUTUN
 * kolleksiyaga cheksiz, doimiy ochiq tinglovchi) o'rar edi. Endi u —
 * haqiqiy sahifalab o'qish, holat (status) bo'yicha server tomonidagi
 * filtr, HAQIQIY (aggregatsiya orqali hisoblangan) sonlar, va
 * chegaralangan-lekin-HALOL qidiruvni birlashtiradi. Bu yerda ATAYLAB
 * Redux ishlatilmadi (izoh o'zgarmadi) — bu ma'lumot faqat
 * `AdminSellersPage`da ishlatiladi.
 */
const useGetAllSellers = () => {
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'suspended'
  const [sellers, setSellers] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [counts, setCounts] = useState({ total: 0, active: 0, suspended: 0 });

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = qidiruv rejimida emas
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchIsApproximate, setSearchIsApproximate] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const debounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  // Sahifalab o'qishning birinchi sahifasini yuklaydi — `statusFilter`
  // o'zgarganda qayta ishga tushadi (eski sahifalar tashlanadi).
  const loadFirstPage = useCallback(async (filter) => {
    setLoading(true);
    setError(null);
    try {
      const { sellers: page, lastDoc: cursor, hasMore: more } = await getSellersPage({
        statusFilter: filter,
      });
      setSellers(page);
      setLastDoc(cursor);
      setHasMore(more);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage(statusFilter);
  }, [statusFilter, loadFirstPage]);

  // Sonlar (tab yorliqlari uchun) — sahifadan mustaqil, bir marta
  // (va statusFilter o'zgarishidan qat'i nazar bir xil qolgani uchun
  // faqat bir marta) hisoblanadi.
  useEffect(() => {
    let cancelled = false;
    getSellerCounts()
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        // Sonlarni hisoblab bo'lmasa ham, ro'yxatning o'zi ishlashda
        // davom etishi kerak — shuning uchun bu yerda xato jim
        // yutiladi, faqat yorliqlar sonisiz ko'rinadi.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const { sellers: page, lastDoc: cursor, hasMore: more } = await getSellersPage({
        statusFilter,
        cursor: lastDoc,
      });
      setSellers((prev) => [...prev, ...page]);
      setLastDoc(cursor);
      setHasMore(more);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, lastDoc, statusFilter]);

  // Qidiruv — 300ms debounce bilan, faqat matn bo'lganda ishga tushadi.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = searchInput.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const requestId = ++searchRequestIdRef.current;
      setSearchLoading(true);
      setSearchError(null);
      searchSellers(trimmed)
        .then(({ results, isApproximate }) => {
          // Eskirgan (foydalanuvchi allaqachon boshqa narsa yozgan)
          // javobni e'tiborsiz qoldiramiz — poyga holati (race
          // condition)ning oldini olish uchun.
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults(results);
          setSearchIsApproximate(isApproximate);
        })
        .catch((err) => {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchError(err.message);
          setSearchResults([]);
        })
        .finally(() => {
          if (requestId === searchRequestIdRef.current) setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // MUHIM: OLDIN ro'yxat jonli (`onSnapshot`) tinglovchidan kelardi —
  // shuning uchun `AdminSellerCard`dagi holat almashtirish/AI CEO
  // yoqish/o'chirish yoki butunlay o'chirish amali muvaffaqiyatli
  // bo'lgach, Firestore o'zi yangilangan hujjatni ORQAGA yuborardi va
  // karta AVTOMATIK yangilanardi. ENDI ro'yxat BIR MARTALIK o'qishdan
  // kelgani uchun (yuqoridagi audit izohiga qarang), bu amallardan
  // keyin lokal `sellers`/`searchResults` holatini QO'LDA yangilash
  // SHART — aks holda karta admin sahifani qayta ochmaguncha ESKI
  // holatni ko'rsatib turardi (bu — funksional REGRESSIYA bo'lardi).
  const patchSellerStatus = useCallback((id, fromStatus, toStatus) => {
    setSellers((prev) => prev.map((s) => (s.id === id ? { ...s, status: toStatus } : s)));
    setSearchResults((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, status: toStatus } : s)) : prev));
    const fromSuspended = fromStatus === "suspended";
    const toSuspended = toStatus === "suspended";
    if (fromSuspended !== toSuspended) {
      setCounts((prev) => ({
        ...prev,
        suspended: prev.suspended + (toSuspended ? 1 : -1),
        active: prev.active + (toSuspended ? -1 : 1),
      }));
    }
  }, []);

  // 2026-09: ILGARI faqat ikkilik (`aiCeoEnabled`) holatni patch
  // qilardi ("AI CEO yoqilgan"/"o'chirilgan"). Endi `AdminSellerCard`
  // uchta tarifdan (start/pro/biznes) birini tanlash imkonini
  // berganidan beri, `tariffPlan`ni ham (bilan birga `aiCeoEnabled`ni
  // ham) mahalliy holatga yozib qo'yamiz — aks holda karta tanlangan
  // tarifni sahifa qayta ochilmaguncha ESKI holatda ko'rsatib turardi.
  const patchSellerTariffPlan = useCallback((id, plan) => {
    const aiCeoEnabled = plan !== "start";
    setSellers((prev) => prev.map((s) => (s.id === id ? { ...s, tariffPlan: plan, aiCeoEnabled } : s)));
    setSearchResults((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, tariffPlan: plan, aiCeoEnabled } : s)) : prev));
  }, []);

  const removeSeller = useCallback((id, wasSuspended) => {
    setSellers((prev) => prev.filter((s) => s.id !== id));
    setSearchResults((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
    setCounts((prev) => ({
      total: Math.max(0, prev.total - 1),
      suspended: wasSuspended ? Math.max(0, prev.suspended - 1) : prev.suspended,
      active: wasSuspended ? prev.active : Math.max(0, prev.active - 1),
    }));
  }, []);

  const isSearching = searchInput.trim().length > 0;

  // Qidiruv holatidagi natijalarga ham status yorlig'ini qo'llaymiz —
  // qidiruv butun (chegaralangan) ro'yxat bo'yicha ishlagani uchun.
  const visibleSellers = isSearching
    ? (searchResults || []).filter((seller) => {
        if (statusFilter === "all") return true;
        const isActive = seller.status !== "suspended";
        return statusFilter === "active" ? isActive : !isActive;
      })
    : statusFilter === "active"
      ? sellers.filter((seller) => seller.status !== "suspended")
      : sellers;

  return {
    sellers: visibleSellers,
    loading: isSearching ? searchLoading : loading,
    loadingMore,
    hasMore: !isSearching && hasMore,
    loadMore,
    error: isSearching ? searchError : error,
    counts,
    statusFilter,
    setStatusFilter,
    searchQuery: searchInput,
    setSearchQuery: setSearchInput,
    isSearching,
    searchIsApproximate: isSearching && searchIsApproximate,
    patchSellerStatus,
    patchSellerTariffPlan,
    removeSeller,
  };
};

export default useGetAllSellers;
