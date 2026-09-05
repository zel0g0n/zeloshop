/**
 * `CourierOrdersPage.jsx`dagi 3 BOSQICHLI YORLIQ (Yangi/Jarayonda/
 * Tarix) tizimining SOF mantig'i — komponentdan ALOHIDA sinalishi
 * uchun chiqarilgan (`src/utils/orderFilters.js`/`catalogFilters.js`
 * bilan BIR XIL, loyihada allaqachon o'rnatilgan naqsh: filtr/qidiruv
 * mantig'i har doim sof funksiya sifatida, komponent RENDER
 * qilinmasdan sinaladi).
 */
export const NEW_STATUSES = ["assigned"];
export const IN_PROGRESS_STATUSES = ["picked_up"];
export const HISTORY_STATUSES = ["delivered", "failed"];

export const COURIER_TABS = [
  { key: "new", statuses: NEW_STATUSES, labelKey: "tabNew", emptyKey: "emptyNew" },
  { key: "inProgress", statuses: IN_PROGRESS_STATUSES, labelKey: "tabInProgress", emptyKey: "emptyInProgress" },
  { key: "history", statuses: HISTORY_STATUSES, labelKey: "tabHistory", emptyKey: "emptyHistory" },
];

export const getCourierTab = (tabKey) => COURIER_TABS.find((tb) => tb.key === tabKey) || COURIER_TABS[0];

/**
 * Berilgan yorliq + qidiruv so'ziga mos buyurtmalarni qaytaradi.
 * Qidiruv — buyurtma ID'si, mijoz ismi yoki telefoni bo'yicha, katta-
 * kichik harfga sezgir EMAS (`toLowerCase`).
 */
export const filterCourierOrdersForTab = (orders, tabKey, searchQuery = "") => {
  const tab = getCourierTab(tabKey);
  const query = (searchQuery || "").trim().toLowerCase();
  return (orders || []).filter((o) => {
    if (!tab.statuses.includes(o.courierDeliveryStatus)) return false;
    if (!query) return true;
    const customer = o.customer || {};
    const idMatch = String(o.id || "").toLowerCase().includes(query);
    const nameMatch = (customer.fullName || "").toLowerCase().includes(query);
    const phoneMatch = (customer.phone || "").toLowerCase().includes(query);
    return idMatch || nameMatch || phoneMatch;
  });
};

/** Har bir yorliq uchun (qidiruvsiz) buyurtmalar sonini hisoblaydi. */
export const computeCourierTabCounts = (orders) => {
  const counts = {};
  COURIER_TABS.forEach((tab) => {
    counts[tab.key] = (orders || []).filter((o) => tab.statuses.includes(o.courierDeliveryStatus)).length;
  });
  return counts;
};

/**
 * HOZIR "picked_up" (Jarayonda) bosqichidagi YAGONA buyurtma ID'sini
 * topadi — bo'lsa, jonli joylashuv shunga yuboriladi; bo'lmasa,
 * boshqa "assigned" buyurtmalar "Boshlash"ni bosishi mumkin
 * (`canStart`). Bir vaqtning o'zida bittadan ortiq "picked_up"
 * BO'LMASLIGI kerak (backend buni kafolatlaydi) — shu sababli
 * BIRINCHISI qaytariladi, xolos.
 */
export const findActiveCourierOrderId = (orders) =>
  (orders || []).find((o) => o.courierDeliveryStatus === "picked_up")?.id || null;
