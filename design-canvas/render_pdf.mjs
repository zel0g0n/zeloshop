import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const order = [
  "Main.dc.html", "Products.dc.html", "ProductAnalytics.dc.html", "ProductDraftReview.dc.html", "AddProduct.dc.html", "EditProduct.dc.html",
  "Orders.dc.html", "YandexDelivery.dc.html", "OrderAnalytics.dc.html", "More.dc.html", "PaymentSettings.dc.html", "Tariffs.dc.html",
  "Connections.dc.html", "Support.dc.html", "PnL.dc.html", "ProfitDeepDive.dc.html", "CrmHub.dc.html", "DeliverySettings.dc.html",
  "CourierManagement.dc.html", "StaffManagement.dc.html", "StoreSettings.dc.html", "CategoryManagement.dc.html", "BannerSettings.dc.html", "AiCeoInfo.dc.html",
  "MarketingCoupons.dc.html", "CreatePromotion.dc.html", "PrivacySecurity.dc.html", "SellerReferral.dc.html", "BundleManagement.dc.html", "AutomationRules.dc.html",
  "PricingSuggestions.dc.html", "CommandCenter.dc.html", "Inbox.dc.html",
];

const outDir = path.join(process.cwd(), "pdf_pages");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() =>
  chromium.launch()
);
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

const results = [];
for (let i = 0; i < order.length; i++) {
  const file = order[i];
  const fp = path.join(process.cwd(), "seller", file);
  await page.goto("file://" + fp, { waitUntil: "load" });
  // strip the missing support.js 404 noise; not needed further
  const h = await page.evaluate(() => document.body.scrollHeight);
  const outPath = path.join(outDir, String(i + 1).padStart(2, "0") + "-" + file.replace(".dc.html", ".pdf"));
  await page.pdf({
    path: outPath,
    width: "390px",
    height: Math.ceil(h) + "px",
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  results.push(outPath);
  console.log(file, "->", h, "px");
}

await browser.close();
fs.writeFileSync("pdf_order.json", JSON.stringify(results, null, 2));
console.log("done", results.length);
