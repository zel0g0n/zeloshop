const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Har bir mahsulot uchun, BUTUN buyurtmalar tarixi (davr bilan
 * chegaralanmagan) bo'yicha OXIRGI marta sotilgan sanani topadi.
 *
 * MUHIM: bu ATAYIN tanlangan davrdan (masalan "Hafta") MUSTAQIL
 * ishlaydi — "bu mahsulot qachon oxirgi marta sotilgan" degan savol,
 * foydalanuvchi hozir qaysi filtrni tanlaganidan qat'i nazar, doim
 * HAQIQIY (butun tarixdagi) javobni berishi kerak. Aks holda, agar
 * foydalanuvchi "Bugun" filtrini tanlasa, HAMMA mahsulot "hech qachon
 * sotilmagan" bo'lib ko'rinib qolardi — bu chalg'ituvchi bo'lardi.
 *
 * @param {Array} orders
 * @returns {Map<string, number>} productId -> oxirgi sotilgan vaqt (ms)
 */
export function computeLastSoldMap(orders) {
  const map = new Map();
  orders
    .filter((o) => o.status === "delivered")
    .forEach((order) => {
      const ts = Number(order.createdAt) || 0;
      (order.orders || []).forEach((item) => {
        const prev = map.get(item.id);
        if (!prev || ts > prev) map.set(item.id, ts);
      });
    });
  return map;
}

/**
 * Tanlangan davr (rangeStart..rangeEnd) ichidagi "delivered"
 * buyurtmalar asosida, HAR BIR mahsulot uchun sotilgan dona, tushum
 * va sof foyda (haqiqiy tannarx bo'yicha) hisoblanadi.
 *
 * MUHIM: natijaga sotuvchining BARCHA mahsulotlari kiritiladi —
 * hatto tanlangan davrda bitta ham sotilmagan bo'lsa ham (unitsSold=0
 * bilan). Bu ataylab shunday: "o'lik mahsulotlar" va "hech qachon
 * sotilmagan" tahlili aynan shu nol-sotuv yozuvlariga tayanadi — agar
 * ularni chiqarib tashlasak, eng muhim tahlil imkoniyatini yo'qotgan
 * bo'lardik.
 *
 * @param {Array} products
 * @param {Array} orders
 * @param {number} rangeStart
 * @param {number} rangeEnd
 * @param {number} [now]
 * @returns {Array<Object>} har bir mahsulot uchun statistika
 */
export function buildProductPeriodStats(products, orders, rangeStart, rangeEnd, now = Date.now()) {
  const lastSoldMap = computeLastSoldMap(orders);

  const periodAgg = new Map(); // productId -> { unitsSold, revenue, profit, ordersCount }
  orders
    .filter((o) => o.status === "delivered" && (Number(o.createdAt) || 0) >= rangeStart && (Number(o.createdAt) || 0) <= rangeEnd)
    .forEach((order) => {
      (order.orders || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const lineRevenue = (Number(item.price) || 0) * qty;
        const existing = periodAgg.get(item.id) || { unitsSold: 0, revenue: 0, profit: 0, ordersCount: 0 };
        existing.unitsSold += qty;
        existing.revenue += lineRevenue;
        existing.ordersCount += 1;
        periodAgg.set(item.id, existing);
      });
    });

  // Har bir mahsulot uchun foydani ALOHIDA (o'zining haqiqiy
  // tannarxi bilan) hisoblash uchun ikkinchi o'tish kerak - narx
  // costPrice'dan mustaqil (mahsulot o'chirilgan/o'zgargan bo'lishi
  // mumkin), shuning uchun buni to'g'ridan-to'g'ri `products`
  // ro'yxatidan olamiz, order snapshot'idan emas.
  const costPriceMap = new Map();
  products.forEach((p) => costPriceMap.set(p.id, Number(p.costPrice) || 0));

  orders
    .filter((o) => o.status === "delivered" && (Number(o.createdAt) || 0) >= rangeStart && (Number(o.createdAt) || 0) <= rangeEnd)
    .forEach((order) => {
      (order.orders || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const cost = (costPriceMap.get(item.id) || 0) * qty;
        const lineRevenue = (Number(item.price) || 0) * qty;
        const existing = periodAgg.get(item.id);
        if (existing) existing.profit += lineRevenue - cost;
      });
    });

  return products.map((p) => {
    const agg = periodAgg.get(p.id) || { unitsSold: 0, revenue: 0, profit: 0, ordersCount: 0 };
    const lastSoldAt = lastSoldMap.get(p.id) || null;
    const daysSinceLastSale = lastSoldAt != null ? Math.floor((now - lastSoldAt) / DAY_MS) : null;
    // Bitta donaning potentsial marjasi (narx va tannarx asosida) —
    // davrda SOTILMAGAN bo'lsa ham hisoblanadi, chunki bu mahsulotning
    // O'ZI naqadar foydali ekanligini ko'rsatadi (sotuv tezligidan
    // mustaqil holda).
    const price = Number(p.price) || 0;
    const costPrice = Number(p.costPrice) || 0;
    const unitMarginPercent = price > 0 ? ((price - costPrice) / price) * 100 : null;

    return {
      id: p.id,
      name: p.name || "",
      image: p.image || (Array.isArray(p.images) && p.images[0]) || null,
      category: p.category || "Boshqa",
      price,
      costPrice,
      stock: Number(p.stock) || 0,
      averageRating: Number(p.averageRating) || 0,
      reviewCount: Number(p.reviewCount) || 0,
      unitsSold: agg.unitsSold,
      revenue: agg.revenue,
      profit: agg.profit,
      ordersCount: agg.ordersCount,
      periodMarginPercent: agg.revenue > 0 ? (agg.profit / agg.revenue) * 100 : null,
      unitMarginPercent,
      lastSoldAt,
      daysSinceLastSale,
    };
  });
}

/**
 * Berilgan ko'rsatkich (metric) bo'yicha ENG YAXSHI N ta mahsulotni
 * qaytaradi. Nol qiymatli yozuvlar chiqarib tashlanadi - "eng yaxshi"
 * ro'yxatida hech narsa sotmagan mahsulotning nima qilib turishi
 * mantiqsiz.
 *
 * @param {Array} stats - buildProductPeriodStats natijasi
 * @param {"revenue"|"unitsSold"|"profit"} metric
 * @param {number} [limit]
 */
export function getTopProducts(stats, metric, limit = 5) {
  return stats
    .filter((p) => p[metric] > 0)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit);
}

/**
 * Kategoriya kesimida tushum/dona taqsimotini hisoblaydi, tushum
 * ulushi foizi bilan birga - foydalanuvchi "qaysi kategoriya biznesni
 * ko'proq oziqlantiryapti" degan savolga bir qarashda javob topsin.
 */
export function getCategoryBreakdown(stats) {
  const totalRevenue = stats.reduce((sum, p) => sum + p.revenue, 0);
  const byCategory = new Map();

  stats.forEach((p) => {
    const existing = byCategory.get(p.category) || { category: p.category, revenue: 0, unitsSold: 0, productCount: 0 };
    existing.revenue += p.revenue;
    existing.unitsSold += p.unitsSold;
    existing.productCount += 1;
    byCategory.set(p.category, existing);
  });

  return Array.from(byCategory.values())
    .map((c) => ({ ...c, percentOfRevenue: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * "O'LIK" MAHSULOTLAR: ombor qoldig'i BOR, lekin uzoq vaqtdan beri
 * (yoki HECH QACHON) sotilmagan mahsulotlar. Bular — sotuvchi uchun
 * eng amaliy signal: chegirmaga qo'yish, joylashuvini o'zgartirish
 * yoki katalogdan olib tashlash haqida qaror qabul qilish kerak
 * bo'lgan mahsulotlar.
 *
 * Tartiblash: "hech qachon sotilmagan" (eng shubhali holat) eng
 * tepada, keyin eng uzoq sotilmagan mahsulotlar.
 *
 * @param {Array} stats
 * @param {number} [thresholdDays] - necha kun sotilmasa "o'lik" hisoblanadi
 */
export function getDeadStock(stats, thresholdDays = 30) {
  return stats
    .filter((p) => p.stock > 0 && (p.daysSinceLastSale === null || p.daysSinceLastSale >= thresholdDays))
    .sort((a, b) => (b.daysSinceLastSale ?? Infinity) - (a.daysSinceLastSale ?? Infinity));
}

/**
 * TEZ TUGAYOTGAN MAHSULOTLAR: joriy davrdagi sotuv tezligi asosida,
 * ombor necha kunda tugashini taxmin qiladi. Faqat DAVRDA haqiqatan
 * sotilgan mahsulotlar hisobga olinadi (tezlik hisoblash uchun kamida
 * bitta sotuv kerak).
 *
 * @param {Array} stats
 * @param {number} periodDays - tanlangan davr necha kunni qamrab oladi
 * @param {number} [alertThresholdDays] - shu kundan kam qolgan bo'lsa ogohlantiriladi
 */
export function getLowStockAlerts(stats, periodDays, alertThresholdDays = 7) {
  if (periodDays <= 0) return [];
  return stats
    .filter((p) => p.unitsSold > 0 && p.stock > 0)
    .map((p) => {
      const dailyVelocity = p.unitsSold / periodDays;
      const daysUntilStockout = dailyVelocity > 0 ? Math.floor(p.stock / dailyVelocity) : Infinity;
      return { ...p, daysUntilStockout };
    })
    .filter((p) => p.daysUntilStockout <= alertThresholdDays)
    .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
}

/**
 * Sahifa tepasidagi qisqa xulosa ko'rsatkichlari.
 */
export function computeSummaryInsights(stats, deadStock) {
  const totalUnitsSold = stats.reduce((sum, p) => sum + p.unitsSold, 0);
  const totalRevenue = stats.reduce((sum, p) => sum + p.revenue, 0);
  const categories = getCategoryBreakdown(stats).filter((c) => c.revenue > 0);

  return {
    totalProducts: stats.length,
    totalUnitsSold,
    totalRevenue,
    deadStockCount: deadStock.length,
    topCategory: categories.length > 0 ? categories[0].category : null,
  };
}
