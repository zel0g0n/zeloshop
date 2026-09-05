/**
 * Mahsulotlar ro'yxatini qidiruv, holat (status), kategoriya va
 * saralash bo'yicha filtrlaydi. SOF funksiya (React'ga bog'liq emas)
 * — Products.jsx'dagi `useMemo` ichidan chaqiriladi, va alohida
 * sinov (test) faylida to'g'ridan-to'g'ri tekshiriladi.
 *
 * @param {Array} products
 * @param {{ searchQuery: string, statusFilter: string, categoryFilter: string, sortBy: string }} filters
 */
export function filterAndSortProducts(products, { searchQuery = "", statusFilter = "Barchasi", categoryFilter = "Barchasi", sortBy = "none" } = {}) {
  const query = searchQuery.trim().toLowerCase();

  let result = products.filter((prod) => {
    const name = (prod.title || prod.name || "").toLowerCase();
    const brand = (prod.brand || prod.category || "").toLowerCase();
    const matchesSearch = !query || name.includes(query) || brand.includes(query);
    const matchesCategory = categoryFilter === "Barchasi" || prod.category === categoryFilter;

    const isActive = prod.isActive ?? true;
    let matchesStatus = true;
    if (statusFilter === "Faol") matchesStatus = isActive;
    if (statusFilter === "Nofaol") matchesStatus = !isActive;
    if (statusFilter === "KamQolgan") matchesStatus = Number(prod.stock) <= 3;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (sortBy !== "none") {
    const [field, dir] = sortBy.split("-");
    result = [...result].sort((a, b) => {
      const diff = (Number(a[field]) || 0) - (Number(b[field]) || 0);
      return dir === "desc" ? -diff : diff;
    });
  }

  return result;
}

/** Holat (status) bo'yicha har bir toifada nechta mahsulot borligini hisoblaydi. */
export function computeStatusCounts(products) {
  const activeCount = products.filter((p) => p.isActive ?? true).length;
  return {
    allCount: products.length,
    activeCount,
    inactiveCount: products.length - activeCount,
    lowStockCount: products.filter((p) => Number(p.stock) <= 3).length,
  };
}

/** Butun ombor qiymatini (narx × qoldiq, barcha mahsulotlar bo'yicha) hisoblaydi. */
export function computeInventoryValue(products) {
  return products.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0), 0);
}
