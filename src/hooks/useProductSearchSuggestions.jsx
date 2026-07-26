import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

// OLDIN: SearchOverlay.jsx `useLiveSearch()` dan `results` va `isLoading`
// larni kutib olardi, lekin bu hook ularni umuman qaytarmasdi — natijada
// `results.length` chaqirilganda ilova CRASH bo'lardi (agar foydalanuvchi
// avvalroq biror narsa qidirgan bo'lsa, Redux'dagi eski searchQuery hali
// ham "truthy" bo'lgani uchun bu holat amalda tez-tez yuzaga kelardi).
//
// Bu yerda alohida, YENGIL hook: allaqachon Redux keshida (state.products)
// mavjud mahsulotlar ro'yxati bo'yicha, HAR BIR HARFDA emas, balki
// debounce (250ms) bilan qidiradi. Hech qanday Firestore so'rovi va hech
// qanday global (Redux) state yozuvi yo'q — faqat lokal filtrlash.
export const useProductSearchSuggestions = (query, delay = 250) => {
  const { products } = useSelector((state) => state.products);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (query === debouncedQuery) return;
    setIsLoading(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsLoading(false);
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, delay]);

  const results = useMemo(() => {
    const trimmed = debouncedQuery?.trim().toLowerCase();
    if (!trimmed) return [];
    return products.filter((p) => p.name?.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [products, debouncedQuery]);

  return { results, isLoading };
};
