// Desktop topbar'dagi tezkor qidiruv (Ctrl/⌘+K) va sarlavha uchun
// sotuvchi paneli bo'limlari ro'yxati. Faqat sof ma'lumot + filtr.

export const SELLER_NAV_TARGETS = [
  { path: "/seller", labelKey: "sellerSidebar.home", keywords: "dashboard bosh asosiy" },
  { path: "/seller/products", labelKey: "sellerSidebar.products", keywords: "tovar mahsulot katalog" },
  { path: "/seller/orders", labelKey: "sellerSidebar.orders", keywords: "buyurtma zakaz order" },
  { path: "/seller/crm", labelKey: "sellerSidebar.customers", keywords: "mijoz crm klient", minPlan: "pro" },
  { path: "/seller/pnl", labelKey: "sellerSidebar.finance", keywords: "moliya foyda hisobot pnl", minPlan: "pro" },
  { path: "/seller/marketing", labelKey: "sellerSidebar.marketing", keywords: "kupon aksiya reklama", minPlan: "pro" },
  { path: "/seller/functions", labelKey: "sellerSidebar.settings", keywords: "sozlama more funksiya" },
  { path: "/seller/store-settings", labelKey: "desktop.navStoreSettings", keywords: "do'kon profil logo" },
  { path: "/seller/inbox", labelKey: "desktop.navInbox", keywords: "xabar inbox bildirishnoma" },
  { path: "/seller/tariffs", labelKey: "desktop.navTariffs", keywords: "tarif to'lov obuna" },
];

/** Joriy yo'lga mos bo'lim (eng uzun mos prefiks). */
export function findNavTarget(pathname) {
  const path = (pathname || "").replace(/\/+$/, "") || "/seller";
  if (path === "/seller") return SELLER_NAV_TARGETS[0];
  return SELLER_NAV_TARGETS.filter((x) => x.path !== "/seller" && (path === x.path || path.startsWith(`${x.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0] || null;
}

/** Qidiruv so'rovi bo'yicha filtr (yorliq yoki kalit so'z). `labels` — {path: tarjima}. */
export function filterNavTargets(targets, query, labels, isStart = false) {
  const q = (query || "").trim().toLowerCase();
  return targets.filter((x) => {
    if (isStart && x.minPlan === "pro") return false;
    if (!q) return true;
    return (labels[x.path] || "").toLowerCase().includes(q) || x.keywords.includes(q);
  });
}
