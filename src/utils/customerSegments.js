const VIP_THRESHOLD = 500_000; // so'm
const CHURN_DAYS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/**
 * Mijozlarning segmentatsiyasini va umumiy CRM ko'rsatkichlarini
 * (o'rtacha LTV, Retention Rate) hisoblaydi. Sof funksiya — React'ga
 * bog'liq emas, `now` parametri orqali "hozirgi vaqt" tashqaridan
 * beriladi (testlarda o'zgarmas natija olish uchun).
 *
 * Funksiya server tomonida oldindan yig'ilgan mijoz yozuvlarini
 * (`useCrmCustomers`, batafsil izoh: `functions/orderRollups.js`)
 * qabul qiladi — har bir yozuv butun tarix bo'yicha hisoblangan LTV
 * va buyurtmalar sonini o'z ichiga oladi (vaqt oynasi bilan
 * cheklanmagan). Kirish hajmi buyurtmalar soniga emas, mijozlar
 * soniga bog'liq bo'lgani uchun bitta mijozning bir necha marta xarid
 * qilishi hisoblash hajmini oshirmaydi.
 *
 * @param {Array<{clientId:string, fullName?:string, phone?:string, ltv:number, orderCount:number, lastOrderAtMs:number}>} customers
 */
export function computeCustomerSegments(customers, now = Date.now()) {
  const list = Array.isArray(customers) ? customers : [];

  const withSegment = list
    .map((c) => {
      const ltv = Number(c.ltv) || 0;
      const orderCount = Number(c.orderCount) || 0;
      const lastOrderAtMs = Number(c.lastOrderAtMs) || 0;
      const daysSinceLastOrder = Math.floor((now - lastOrderAtMs) / MS_IN_DAY);

      let segment = "regular";
      if (ltv >= VIP_THRESHOLD) segment = "vip";
      else if (daysSinceLastOrder > CHURN_DAYS) segment = "churn";
      else if (orderCount === 1) segment = "new";

      return {
        clientId: c.clientId,
        fullName: c.fullName || "Noma'lum",
        phone: c.phone || "",
        ltv,
        orderCount,
        lastOrderAtMs,
        daysSinceLastOrder,
        segment,
      };
    })
    .sort((a, b) => b.ltv - a.ltv);

  const counts = {
    all: withSegment.length,
    vip: withSegment.filter((c) => c.segment === "vip").length,
    churn: withSegment.filter((c) => c.segment === "churn").length,
    regular: withSegment.filter((c) => c.segment === "regular").length,
    new: withSegment.filter((c) => c.segment === "new").length,
  };

  const averageLtv = withSegment.length > 0
    ? Math.round(withSegment.reduce((sum, c) => sum + c.ltv, 0) / withSegment.length)
    : 0;

  const retentionRate = withSegment.length > 0
    ? Math.round((withSegment.filter((c) => c.orderCount >= 2).length / withSegment.length) * 1000) / 10
    : 0;

  return { customers: withSegment, counts, averageLtv, retentionRate };
}
