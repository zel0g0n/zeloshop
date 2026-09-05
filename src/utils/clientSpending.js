/**
 * Xaridorning O'Z buyurtmalari asosida shaxsiy xarajat statistikasini
 * hisoblaydi - "P&L Dashboard"ning xaridor uchun soddalashtirilgan
 * ko'rinishi. SOF FUNKSIYA - to'g'ridan-to'g'ri test qilinadi.
 *
 * MUHIM: bu yerda hech qanday yangi Firestore so'rovi kerak emas -
 * xaridorning buyurtmalari (`useGetClientOrdersData`) ALLAQACHON
 * boshqa sahifa (Buyurtmalarim) tomonidan yuklab olingan.
 */
export function computeClientSpendingSummary(orders) {
  const delivered = orders.filter((o) => o.status === "delivered");

  const totalSpent = delivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const deliveredCount = delivered.length;
  const totalOrderCount = orders.length;
  const cancelledCount = orders.filter((o) => o.status === "cancel").length;
  const averageOrderValue = deliveredCount > 0 ? Math.round(totalSpent / deliveredCount) : 0;

  // ENG KO'P XARID QILINGAN MAHSULOT (nom bo'yicha guruhlab, eng
  // ko'p sotib olingan miqdorni topadi) - "sizning sevimli
  // mahsulotingiz" kabi qiziqarli ma'lumot berish uchun.
  const productCounts = new Map();
  delivered.forEach((order) => {
    (order.orders || []).forEach((item) => {
      const qty = Number(item.quantity) || 0;
      productCounts.set(item.name, (productCounts.get(item.name) || 0) + qty);
    });
  });
  const topProductEntry = Array.from(productCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    totalSpent,
    deliveredCount,
    totalOrderCount,
    cancelledCount,
    averageOrderValue,
    topProductName: topProductEntry ? topProductEntry[0] : null,
    topProductQty: topProductEntry ? topProductEntry[1] : 0,
  };
}

/**
 * So'nggi N oy uchun, oy bo'yicha xarajat qatorini quradi (grafik
 * uchun) - faqat yetkazilgan buyurtmalar hisobga olinadi.
 */
export function buildMonthlySpendingSeries(orders, monthCount = 6) {
  const delivered = orders.filter((o) => o.status === "delivered");
  const now = new Date();
  const buckets = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("uz-UZ", { month: "short" }), total: 0 });
  }

  delivered.forEach((order) => {
    const orderDate = new Date(Number(order.createdAt) || order.createdAt);
    const bucket = buckets.find((b) => b.year === orderDate.getFullYear() && b.month === orderDate.getMonth());
    if (bucket) bucket.total += Number(order.totalAmount) || 0;
  });

  return buckets;
}
