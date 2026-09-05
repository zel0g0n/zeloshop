/**
 * Sof funksiyalar - HAQIQIY (yetkazib berilgan) buyurtmalar tarixidan
 * "qaysi mahsulotlar ko'pincha BIRGA sotib olinadi" statistikasini
 * hisoblash uchun. Hech qanday ML/tashqi xizmat ishlatilmaydi -
 * oddiy, tushunarli "birga uchrash" (co-occurrence) sanog'i.
 *
 * MUHIM: bu — Upsell/Cross-sell bo'limining "kuchli" (ikkinchi
 * darajali zaxirasi — bir xil kategoriya — `src/utils/
 * productRecommendations.js`da) qatlami. Ma'lumot yetarli
 * bo'lmagan (yangi mahsulot/kam buyurtma) hollarda frontend
 * avtomatik ravishda kategoriya-zaxirasiga qaytadi - bu yerda hech
 * qanday uydirma/taxminiy son YO'Q.
 */

/**
 * Buyurtmalar ro'yxatidan mahsulotlar orasidagi "birga uchrash"
 * xaritasini quradi. Bitta buyurtma ichida BIR XIL mahsulot bir
 * necha marta bo'lsa ham (masalan miqdor=3), FAQAT BIR MARTA
 * hisoblanadi (aks holda ko'p sonli xarid tasodifan "mashhur juftlik"
 * bo'lib qolishi mumkin edi).
 *
 * @param {Array<{orders: Array<{id: string}>}>} deliveredOrders
 * @returns {Map<string, Map<string, number>>} productId -> (co-productId -> count)
 */
function buildCooccurrenceMap(deliveredOrders) {
  const map = new Map();
  for (const order of deliveredOrders || []) {
    const items = Array.isArray(order?.orders) ? order.orders : [];
    const uniqueIds = Array.from(new Set(items.map((i) => String(i?.id || "")).filter(Boolean)));
    if (uniqueIds.length < 2) continue; // bitta mahsulotli buyurtmada "birga sotib olish" degan narsa yo'q

    for (let i = 0; i < uniqueIds.length; i += 1) {
      for (let j = 0; j < uniqueIds.length; j += 1) {
        if (i === j) continue;
        const a = uniqueIds[i];
        const b = uniqueIds[j];
        if (!map.has(a)) map.set(a, new Map());
        const inner = map.get(a);
        inner.set(b, (inner.get(b) || 0) + 1);
      }
    }
  }
  return map;
}

/**
 * Har bir mahsulot uchun eng ko'p birga uchragan (ko'pi bilan
 * `maxPerProduct` ta) mahsulotlarni, `products/{id}.frequentlyBoughtWith`ga
 * yozishga tayyor shaklda qaytaradi.
 *
 * @param {Map<string, Map<string, number>>} cooccurrenceMap
 * @param {{maxPerProduct?: number}} [options]
 * @returns {Map<string, Array<{productId: string, count: number}>>}
 */
function buildFrequentlyBoughtWithEntries(cooccurrenceMap, { maxPerProduct = 5 } = {}) {
  const result = new Map();
  cooccurrenceMap.forEach((innerMap, productId) => {
    const entries = Array.from(innerMap.entries())
      .map(([coProductId, count]) => ({ productId: coProductId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, maxPerProduct);
    result.set(productId, entries);
  });
  return result;
}

module.exports = { buildCooccurrenceMap, buildFrequentlyBoughtWithEntries };
