import { createContext, useContext, useState, useMemo } from "react";
import { useSelector } from "react-redux";

/**
 * Katalog sahifasiga TEGISHLI qidiruv/filtr holati.
 *
 * OLDIN: qidiruv matni va filtr qiymatlari (`queryKey`, `activeCategory`,
 * `activeType`) Redux'da — ya'ni butun ilova uchun UMUMIY joyda
 * saqlanardi. Bu esa Bosh sahifa (Home) va Katalog sahifasining bir-
 * biriga bog'lanib qolishiga olib kelgan edi: Katalogda muvaffaqiyatsiz
 * qidiruv qilib, Bosh sahifaga o'tilsa, Bosh sahifadagi "Barcha
 * mahsulotlar" ro'yxati ham bo'sh ko'rinardi — chunki ikkalasi ham
 * aynan shu bitta Redux qiymatidan foydalanardi.
 *
 * ENDI: bu holat faqat shu Context orqali, Katalog sahifasining o'z
 * daraxti ICHIDA yashaydi. Bosh sahifa bu haqda umuman bilmaydi va
 * hech qachon undan ta'sirlanmaydi. Katalogdan chiqib ketilganda,
 * Provider o'zi bilan birga demontaj qilinadi — qidiruv holati
 * TABIIY ravishda yo'qoladi, buni qo'lda "tozalash" shart emas.
 */
const CatalogFilterContext = createContext(null);

const applyQuickFilter = (data, key) => {
  if (!data || data.length === 0) return [];
  switch (key) {
    case "new":
      return data.filter((p) => p.isNew === true);
    case "top":
      return data.filter((p) => p.rating > 4.8);
    case "aksiya":
      return data.filter((p) => p.stock < 10);
    case "arzon": {
      const sortedPrices = [...data].map((p) => Number(p.price) || 0).sort((a, b) => a - b);
      const cutoffIndex = Math.max(0, Math.floor(sortedPrices.length * 0.3) - 1);
      const cutoffPrice = sortedPrices[cutoffIndex];
      return data.filter((p) => (Number(p.price) || 0) <= cutoffPrice);
    }
    default:
      return data;
  }
};

export const CatalogFilterProvider = ({ children }) => {
  const { products = [], loading, error } = useSelector((state) => state.products);

  const [queryKey, setQueryKey] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeType, setActiveType] = useState("all");

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (queryKey) {
      const searchKey = queryKey.toLowerCase();
      result = result.filter((p) => p.name?.toLowerCase().includes(searchKey));
    }

    // Haqiqiy mahsulot kategoriyasi bo'yicha (Skincare/Parfum/Makeup/Soch)
    if (activeType && activeType !== "all") {
      result = result.filter((p) => p.category === activeType);
    }

    return applyQuickFilter(result, activeCategory);
  }, [products, queryKey, activeCategory, activeType]);

  const value = useMemo(
    () => ({
      queryKey,
      setQueryKey,
      activeCategory,
      setActiveCategory,
      activeType,
      setActiveType,
      filteredProducts,
      loading,
      error,
    }),
    [queryKey, activeCategory, activeType, filteredProducts, loading, error]
  );

  return <CatalogFilterContext.Provider value={value}>{children}</CatalogFilterContext.Provider>;
};

export const useCatalogFilter = () => {
  const ctx = useContext(CatalogFilterContext);
  if (!ctx) {
    throw new Error("useCatalogFilter faqat <CatalogFilterProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};
