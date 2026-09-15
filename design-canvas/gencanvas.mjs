import fs from "fs";

const heights = {
  "Main.dc.html": 1550,
  "Products.dc.html": 1550,
  "ProductAnalytics.dc.html": 2050,
  "ProductDraftReview.dc.html": 1050,
  "AddProduct.dc.html": 1750,
  "EditProduct.dc.html": 1750,
  "Orders.dc.html": 1050,
  "YandexDelivery.dc.html": 1350,
  "OrderAnalytics.dc.html": 1950,
  "More.dc.html": 2450,
  "PaymentSettings.dc.html": 1350,
  "Tariffs.dc.html": 1750,
  "Connections.dc.html": 1150,
  "Support.dc.html": 750,
  "PnL.dc.html": 1550,
  "ProfitDeepDive.dc.html": 750,
  "CrmHub.dc.html": 1750,
  "DeliverySettings.dc.html": 1350,
  "CourierManagement.dc.html": 950,
  "StaffManagement.dc.html": 1550,
  "StoreSettings.dc.html": 1350,
  "CategoryManagement.dc.html": 950,
  "BannerSettings.dc.html": 950,
  "AiCeoInfo.dc.html": 2850,
  "MarketingCoupons.dc.html": 1750,
  "CreatePromotion.dc.html": 1350,
  "PrivacySecurity.dc.html": 950,
  "SellerReferral.dc.html": 1550,
  "BundleManagement.dc.html": 1350,
  "AutomationRules.dc.html": 1050,
  "PricingSuggestions.dc.html": 1150,
  "CommandCenter.dc.html": 1750,
  "Inbox.dc.html": 850,
};

const order = [
  "Main.dc.html", "Products.dc.html", "ProductAnalytics.dc.html", "ProductDraftReview.dc.html", "AddProduct.dc.html", "EditProduct.dc.html",
  "Orders.dc.html", "YandexDelivery.dc.html", "OrderAnalytics.dc.html", "More.dc.html", "PaymentSettings.dc.html", "Tariffs.dc.html",
  "Connections.dc.html", "Support.dc.html", "PnL.dc.html", "ProfitDeepDive.dc.html", "CrmHub.dc.html", "DeliverySettings.dc.html",
  "CourierManagement.dc.html", "StaffManagement.dc.html", "StoreSettings.dc.html", "CategoryManagement.dc.html", "BannerSettings.dc.html", "AiCeoInfo.dc.html",
  "MarketingCoupons.dc.html", "CreatePromotion.dc.html", "PrivacySecurity.dc.html", "SellerReferral.dc.html", "BundleManagement.dc.html", "AutomationRules.dc.html",
  "PricingSuggestions.dc.html", "CommandCenter.dc.html", "Inbox.dc.html",
];

const COLS = 6;
const W = 390;
const GAP_X = 60;
const GAP_Y = 140;
const NOTE_H = 40;

const artboards = [];
let rowY = 0;
for (let r = 0; r * COLS < order.length; r++) {
  const rowFiles = order.slice(r * COLS, r * COLS + COLS);
  const rowMaxH = Math.max(...rowFiles.map((f) => heights[f]));
  rowFiles.forEach((f, c) => {
    artboards.push({ file: f, x: c * (W + GAP_X), y: rowY + NOTE_H, w: W, h: heights[f], title: f.replace(".dc.html", "") });
  });
  rowY += rowMaxH + NOTE_H + GAP_Y;
}

const annotations = [
  { id: "sec-1", x: 0, y: 0, w: 2500, text: "1. Bosh sahifa, mahsulotlar, mahsulot qo'shish/tahrirlash" },
  { id: "sec-2", x: 0, y: heights["Main.dc.html"] + NOTE_H + GAP_Y, w: 2500, text: "2. Buyurtmalar, moliya kirish nuqtasi, Ko'proq menyusi, to'lov, tariflar" },
];
// recompute annotation y positions to align with each row's start
let ry = 0;
const rowTexts = [
  "1. Bosh sahifa · Mahsulotlar · Mahsulot qo'shish/tahrirlash",
  "2. Buyurtmalar · Yetkazish · Analitika · Ko'proq menyu · To'lov · Tariflar",
  "3. Ulanishlar · Yordam · Moliya (P&L) · CRM · Yetkazib berish sozlamalari",
  "4. Kuryer/Xodim boshqaruvi · Do'kon/Toifa/Banner sozlamalari · AI CEO hisobot",
  "5. Marketing, promo-kod, aksiya, xavfsizlik, referal, bandl, avtomatlashtirish",
  "6. AI narx tavsiyalari · Buyruq markazi · Xabarlar oqimi",
];
const finalAnnotations = [];
for (let r = 0; r * COLS < order.length; r++) {
  const rowFiles = order.slice(r * COLS, r * COLS + COLS);
  const rowMaxH = Math.max(...rowFiles.map((f) => heights[f]));
  finalAnnotations.push({ id: `sec-${r + 1}`, x: 0, y: ry, w: 500, text: rowTexts[r] });
  ry += rowMaxH + NOTE_H + GAP_Y;
}

const canvas = {
  artboards,
  annotations: finalAnnotations,
  launch: { view: "focused", file: "Main.dc.html" },
};

fs.writeFileSync("canvas.json", JSON.stringify(canvas, null, 2));
console.log("canvas.json written,", artboards.length, "artboards");
