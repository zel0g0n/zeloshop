// ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
// muammoni yechish bo'limi): mijoz (sotuvchi/xodim) TANLASHI mumkin
// bo'lgan sabablar ro'yxati — `functions/lib/stockAuditLog.js`dagi
// `CLIENT_STOCK_CHANGE_REASONS` va `firestore.rules`dagi
// `stockChangeReasonOk()` bilan ATAYLAB QAYTA YOZILGAN (loyihada
// allaqachon o'rnatilgan "frontend+backend duplikatsiyasi" naqshi,
// `TARIFF_LIMITS`/`STAFF_BOT_USERNAME` bilan bir xil). Uchalasi
// o'zgarsa, HAMMASINI birga yangilash SHART.
//
// `order_sale` ATAYLAB bu yerda YO'Q — buni FAQAT server
// (`functions/orders.js`) yozadi, mijoz hech qachon o'zi tanlay
// olmasligi kerak.
export const CLIENT_STOCK_CHANGE_REASONS = [
  "restock",
  "manual_correction",
  "damaged_lost",
  "inventory_count",
  "other",
];

// Har bir sabab (klient tanlaganlar + faqat serverga tegishli
// `order_sale`/eski yozuvlar uchun `unspecified`) uchun i18n kaliti
// (`sellerProductForm.*`, `translations.js`) — tarix ko'rinishida
// (`StockHistoryPanel.jsx`) VA tanlash chiplarida (`PricingCard.jsx`,
// `ProductItem.jsx`) BIR XIL nomlash ishlatilishi uchun markazlashgan.
export const STOCK_CHANGE_REASON_LABEL_KEYS = {
  restock: "stockReasonRestock",
  manual_correction: "stockReasonManualCorrection",
  damaged_lost: "stockReasonDamagedLost",
  inventory_count: "stockReasonInventoryCount",
  other: "stockReasonOther",
  order_sale: "stockReasonOrderSale",
  unspecified: "stockReasonUnspecified",
};

export function getStockChangeReasonLabelKey(reason) {
  return STOCK_CHANGE_REASON_LABEL_KEYS[reason] || STOCK_CHANGE_REASON_LABEL_KEYS.unspecified;
}
