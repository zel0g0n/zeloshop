const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Berilgan davr (rangeStart..rangeEnd) ichida YARATILGAN barcha
 * buyurtmalarni qaytaradi — HOLATIDAN qat'i nazar (bekor qilinganlar
 * ham kiradi, chunki "necha foizi bekor bo'ldi" degan savolga javob
 * berish uchun ular ham kerak).
 */
export function filterOrdersInRange(orders, rangeStart, rangeEnd) {
  return orders.filter((o) => {
    const ts = Number(o.createdAt) || 0;
    return ts >= rangeStart && ts <= rangeEnd;
  });
}

/**
 * Har bir holat (pending/new/processing/shipped/delivered/cancel)
 * bo'yicha son va foizni hisoblaydi — sotuvchi uchun "buyurtmalar
 * qayerda tiqilib qolyapti" degan savolga tezkor javob.
 *
 * @param {Array} periodOrders
 * @param {string[]} statusOrder - ORDER_STATUS_TABS (chaqiruvchi tomondan beriladi, doiraviy import bo'lmasin uchun)
 */
export function computeStatusBreakdown(periodOrders, statusOrder) {
  const total = periodOrders.length;
  const counts = new Map(statusOrder.map((s) => [s, 0]));
  periodOrders.forEach((o) => {
    if (counts.has(o.status)) counts.set(o.status, counts.get(o.status) + 1);
  });
  return statusOrder.map((status) => {
    const count = counts.get(status) || 0;
    return { status, count, percent: total > 0 ? (count / total) * 100 : 0 };
  });
}

/**
 * Davrning umumiy xulosasi: jami buyurtma, yetkazilgan daromad,
 * o'rtacha buyurtma qiymati (AOV) va bekor qilish darajasi.
 *
 * MUHIM: AOV faqat YETKAZILGAN buyurtmalar asosida hisoblanadi -
 * hali jarayondagi yoki bekor qilingan buyurtmalarning summasi
 * "haqiqiy" daromadni aks ettirmaydi, aralashtirilsa ko'rsatkich
 * chalg'ituvchi bo'lardi.
 */
export function computeOrderSummary(periodOrders) {
  const totalOrders = periodOrders.length;
  const delivered = periodOrders.filter((o) => o.status === "delivered");
  const deliveredRevenue = delivered.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const cancelCount = periodOrders.filter((o) => o.status === "cancel").length;

  return {
    totalOrders,
    deliveredCount: delivered.length,
    deliveredRevenue,
    aov: delivered.length > 0 ? deliveredRevenue / delivered.length : 0,
    cancelCount,
    cancelRate: totalOrders > 0 ? (cancelCount / totalOrders) * 100 : 0,
  };
}

/**
 * Berilgan millisekund vaqtini "YYYY-MM-DD" kun-kalitiga aylantiradi -
 * MAHALLIY (local) taqvim kuni bo'yicha, UTC emas.
 *
 * MUHIM TUZATISH (haqiqiy production xatosi, test orqali topilgan):
 * OLDIN bu yerda `toISOString().slice(0,10)` ishlatilardi - bu, vaqtni
 * UTC'ga NORMALLASHTIRIB, keyin kun qismini oladi. Lekin `dayStart`
 * qatorlari oddiy millisekund arifmetikasi bilan hisoblanadi (mahalliy
 * vaqt asosida) - natijada, agar brauzer/server UTC'dan farqli
 * vaqt zonasida bo'lsa (masalan O'zbekiston, UTC+5), bitta HAQIQIY
 * kalendar kuni ikki xil "kun-kalit"ga bo'linib ketishi mumkin edi -
 * buyurtma vaqti bitta kalitga tushib, panjaradagi hech qanday
 * "chelak" (bucket) bilan MOS KELMAY QOLARDI, va o'sha kunning
 * daromadi jimgina yo'qolib ketardi (grafikda ko'rinmasdi).
 *
 * Bu funksiya — sotuvchining O'Z BRAUZERIDA ishlaydi, shuning uchun
 * MAHALLIY taqvim kuni ishlatish nafaqat xatoni tuzatadi, balki
 * semantik jihatdan ham TO'G'RI: sotuvchi "bugun"/"kecha" deganda
 * o'zining mahalliy vaqtini nazarda tutadi, UTC'ni emas.
 */
function formatLocalDateKey(ms) {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Kunlik (yetkazilgan buyurtmalar) daromad qatorini quradi - grafik
 * uchun. Har bir kunda hech narsa yetkazilmagan bo'lsa ham, o'sha kun
 * 0 qiymat bilan qatorda bo'ladi (grafikda "uzilish" bo'lmasligi
 * uchun - `profitTimeSeries.js`da ishlatilgan bilan bir xil tamoyil).
 */
export function buildDailyRevenueSeries(periodOrders, rangeStart, rangeEnd) {
  const delivered = periodOrders.filter((o) => o.status === "delivered");
  const dayCount = Math.max(1, Math.ceil((rangeEnd - rangeStart) / DAY_MS));

  const buckets = new Map();
  for (let i = 0; i < dayCount; i++) {
    const dayStart = rangeStart + i * DAY_MS;
    const key = formatLocalDateKey(dayStart);
    buckets.set(key, { date: key, revenue: 0, orders: 0 });
  }

  delivered.forEach((o) => {
    const key = formatLocalDateKey(Number(o.createdAt));
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.revenue += Number(o.totalAmount) || 0;
      bucket.orders += 1;
    }
  });

  return Array.from(buckets.values());
}

/**
 * ENG KO'P XARID QILGAN MIJOZLAR - faqat YETKAZILGAN buyurtmalar
 * asosida, mijoz ID (`clientId`) bo'yicha guruhlanadi. Telefon
 * raqami emas, `clientId` ishlatiladi - bu Firebase autentifikatsiya
 * ID'si, o'zgarmas va ishonchli identifikator.
 */
export function getTopCustomers(periodOrders, limit = 5) {
  const delivered = periodOrders.filter((o) => o.status === "delivered" && o.clientId);
  const byCustomer = new Map();

  delivered.forEach((o) => {
    const existing = byCustomer.get(o.clientId) || {
      clientId: o.clientId,
      fullName: o.customer?.fullName || "",
      phone: o.customer?.phone || "",
      totalSpent: 0,
      ordersCount: 0,
    };
    existing.totalSpent += Number(o.totalAmount) || 0;
    existing.ordersCount += 1;
    // Eng SO'NGGI buyurtmadagi ismni saqlaymiz (mijoz ismini
    // o'zgartirgan bo'lishi mumkin) - createdAt kattaroq bo'lsa yangilaymiz.
    if (!existing._lastTs || Number(o.createdAt) > existing._lastTs) {
      existing.fullName = o.customer?.fullName || existing.fullName;
      existing._lastTs = Number(o.createdAt);
    }
    byCustomer.set(o.clientId, existing);
  });

  return Array.from(byCustomer.values())
    .map(({ _lastTs, ...rest }) => rest)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

/**
 * BEKOR QILISH SABABLARI bo'yicha taqsimot. MUHIM CHEKLOV: sabab
 * matni Firestore'da TARJIMA QILINGAN holda saqlanadi (sotuvchi
 * bekor qilgan paytdagi tilda) - shuning uchun bu guruhlash faqat
 * BITTA til doirasida to'liq to'g'ri ishlaydi. Amalda sotuvchi
 * odatda bitta tildan foydalanadi, shuning uchun bu amaliy jihatdan
 * muammo emas, lekin nazariy chegarani bilib qo'yish kerak.
 */
export function getCancellationReasons(periodOrders) {
  const cancelled = periodOrders.filter((o) => o.status === "cancel" && o.cancelReason);
  const byReason = new Map();

  cancelled.forEach((o) => {
    byReason.set(o.cancelReason, (byReason.get(o.cancelReason) || 0) + 1);
  });

  const total = cancelled.length;
  return Array.from(byReason.entries())
    .map(([reason, count]) => ({ reason, count, percent: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Yetkazib berish bosqichlari (`deliveryZone.tier`) bo'yicha buyurtma
 * taqsimoti - qaysi bosqich (Shahar/Tumanlar/Boshqa viloyat) eng
 * ko'p talab keltirayotganini ko'rsatadi. Bosqich aniqlanmagan
 * buyurtmalar (`deliveryZone: null`) chetlab o'tiladi.
 *
 * MUHIM TUZATISH (haqiqiy regressiya, o'z-o'zini qayta tekshiruv
 * orqali topilgan): yetkazib berish tizimi qayta qurilganda
 * (`deliveryZone.key` → `deliveryZone.tier`, sotuvchi hududiga
 * nisbatan 3 bosqichli tizimga), bu YERDAGI filtr ESKI `.key`
 * maydonida QOLIB KETGAN edi - natijada, TIZIM QAYTA QURILGANDAN
 * KEYIN yaratilgan HAR BIR yangi buyurtma (ular endi `.tier`ga ega,
 * `.key`ga emas) bu hisobotdan BUTUNLAY CHIQARIB TASHLANARDI -
 * "Hudud taqsimoti" bo'limi jimgina bo'sh/noto'g'ri ko'rinardi.
 */
export function getDeliveryZoneBreakdown(periodOrders) {
  const withZone = periodOrders.filter((o) => o.deliveryZone?.tier);
  const total = withZone.length;
  const byZone = new Map();

  withZone.forEach((o) => {
    const tier = o.deliveryZone.tier;
    byZone.set(tier, (byZone.get(tier) || 0) + 1);
  });

  return Array.from(byZone.entries())
    .map(([tier, count]) => ({ tier, count, percent: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);
}

/**
 * "UXLAB QOLGAN" (lapsed) MIJOZLAR: avval xarid qilgan, lekin
 * SO'NGGI N KUNDA hech narsa buyurtma bermagan mijozlar.
 *
 * MUHIM: bu funksiya ATAYLAB davr filtridan MUSTAQIL ishlaydi - har
 * doim BUTUN buyurtmalar tarixini oladi (`allOrders`, davr bo'yicha
 * kesilmagan), chunki "mijoz oxirgi marta qachon xarid qilgan"
 * degan savol foydalanuvchi hozir qaysi vaqt oralig'ini tanlaganidan
 * qat'i nazar HAQIQIY javobga ega bo'lishi kerak - xuddi
 * `productAnalytics.js`dagi `daysSinceLastSale` bilan bir xil
 * tamoyil.
 *
 * @param {Array} allOrders - BUTUN buyurtmalar tarixi (davr bilan cheklanmagan)
 * @param {number} lapsedThresholdDays - shu kundan ko'p vaqt o'tgan bo'lsa "uxlab qolgan"
 * @param {number} [now]
 */
export function getLapsedCustomers(allOrders, lapsedThresholdDays = 30, now = Date.now()) {
  const delivered = allOrders.filter((o) => o.status === "delivered" && o.clientId);
  const byCustomer = new Map();

  delivered.forEach((o) => {
    const ts = Number(o.createdAt) || 0;
    const existing = byCustomer.get(o.clientId) || {
      clientId: o.clientId,
      fullName: o.customer?.fullName || "",
      phone: o.customer?.phone || "",
      totalOrders: 0,
      totalSpent: 0,
      lastOrderAt: 0,
      lastProductName: null,
    };
    existing.totalOrders += 1;
    existing.totalSpent += Number(o.totalAmount) || 0;
    if (ts > existing.lastOrderAt) {
      existing.lastOrderAt = ts;
      existing.fullName = o.customer?.fullName || existing.fullName;
      existing.lastProductName = o.orders?.[0]?.name || existing.lastProductName;
    }
    byCustomer.set(o.clientId, existing);
  });

  const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;
  return Array.from(byCustomer.values())
    .map((c) => ({ ...c, daysSinceLastOrder: Math.floor((now - c.lastOrderAt) / DAY_MS_LOCAL) }))
    .filter((c) => c.daysSinceLastOrder >= lapsedThresholdDays)
    .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
}

const DAY_PARTS = [
  { key: "morning", startHour: 6, endHour: 12 },
  { key: "afternoon", startHour: 12, endHour: 18 },
  { key: "evening", startHour: 18, endHour: 24 },
  { key: "night", startHour: 0, endHour: 6 },
];

/**
 * Kunning qaysi qismida (tong/kunduzi/kechqurun/tun) eng ko'p
 * buyurtma tushayotganini ko'rsatadi - sotuvchi shu vaqtlarda
 * ko'proq e'tiborli bo'lishi (yoki xodim rejalashtirishi) uchun
 * foydali. 24 soatlik grafik o'rniga 4 ta katta bo'lak ishlatilgan -
 * mobil ekranda o'qilishi ANCHA OSON, va amaliy qaror qabul qilish
 * uchun shu darajadagi aniqlik yetarli.
 */
export function getDayPartBreakdown(periodOrders) {
  const total = periodOrders.length;
  const counts = new Map(DAY_PARTS.map((p) => [p.key, 0]));

  periodOrders.forEach((o) => {
    const hour = new Date(Number(o.createdAt)).getHours();
    const part = DAY_PARTS.find((p) => hour >= p.startHour && hour < p.endHour);
    if (part) counts.set(part.key, counts.get(part.key) + 1);
  });

  return DAY_PARTS.map((p) => ({
    key: p.key,
    count: counts.get(p.key) || 0,
    percent: total > 0 ? (counts.get(p.key) / total) * 100 : 0,
  }));
}
