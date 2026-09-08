import React from "react";
import { Calculator, AlertTriangle } from "lucide-react";
import { computeProfitMetrics } from "@/utils/productPricing";
import { useLanguage } from "@/context/LanguageContext";
import { CLIENT_STOCK_CHANGE_REASONS, getStockChangeReasonLabelKey } from "@/utils/stockChangeReasons";

// OLDIN: hisob-kitob mantig'i shu komponent ICHIDA edi — endi sof,
// alohida sinov (test) qilinadigan funksiyaga (`utils/productPricing.js`)
// ajratildi. Bu ham kodni tozalaydi, ham xatolarni oldindan tutish
// imkonini beradi.
//
// OLDIN (2026-09 punkt-royxati): bu yerda HAR BIR MAHSULOT uchun
// alohida "to'lov turi" (naqd/karta) tanlanardi — bu haqiqiy xato
// keltirib chiqargan: savatda bitta mahsulot faqat "karta orqali",
// ikkinchisi faqat "naqd" bo'lsa, checkout'da ikkalasi ham qo'llab-
// quvvatlaydigan (kesishgan) to'lov turi TOPILMASDI. ENDI: to'lov
// turi BUTUN DO'KON uchun BITTA joyda — "Sozlamalar → To'lovlar va
// Tariflar" (`PaymentSettingsPage.jsx`) — belgilanadi, barcha
// mahsulotlarga bab-baravar qo'llaniladi.
// ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
// muammoni yechish bo'limi): `originalStock` FAQAT tahrirlash
// sahifalarida (`EditProductPage.jsx`/`StaffProductForm.jsx`)
// beriladi (yaratishda — `AddProductPage.jsx` — bermaydi, chunki
// yangi mahsulotning boshlang'ich zaxirasi "o'zgarish" emas, izoh:
// `functions/lib/stockAuditLog.js`). Agar berilgan bo'lsa VA sotuvchi
// zaxirani HAQIQATAN boshqa qiymatga o'zgartirgan bo'lsa — sabab
// tanlash SHART (`firestore.rules` buni serverga yozishda ham talab
// qiladi, bu yerda faqat UX: sotuvchi buni oldindan bilishi kerak).
const PricingCard = ({
  price,
  costPrice,
  discountPrice,
  stock,
  disabled,
  onPriceChange,
  onCostPriceChange,
  onDiscountPriceChange,
  onStockChange,
  originalStock = null,
  stockChangeReason = null,
  onStockChangeReasonChange,
  // XODIM RUXSATLARI (2026-09, "korporativ RBAC" — haqiqiy muammo:
  // Marketing Menejer/Ombor kabi `manageProducts` huquqiga ega, lekin
  // `viewFinance`ga EGA BO'LMAGAN xodim mahsulot tahrirlaganda TANNARX/
  // FOYDA/RENTABELLIKni ko'rmasligi/o'zgartira olmasligi SHART — aks
  // holda `manageProducts` orqali moliyaviy ma'lumot "orqa eshikdan"
  // sizib chiqardi. Standart `true` — sotuvchining o'zi (`AddProductPage`/
  // `EditProductPage`) HAR DOIM to'liq ko'radi, faqat `StaffProductForm`
  // buni `false` qilib uzatadi.
  showCostPrice = true,
}) => {
  const { t } = useLanguage();
  const { profit, marginPercentage, hasValues } = showCostPrice
    ? computeProfitMetrics(price, costPrice, discountPrice)
    : { profit: 0, marginPercentage: 0, hasValues: false };
  const stockActuallyChanged =
    originalStock != null && stock !== "" && Number(stock) !== Number(originalStock);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("sellerProductForm.pricingLabel")}</label>
        <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-sm flex items-center gap-1">
          <Calculator size={10} /> {t("sellerProductForm.smartCalculator")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {showCostPrice && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t("sellerProductForm.costPriceLabel")}</label>
            <input
              type="number"
              required
              disabled={disabled}
              placeholder="0"
              value={costPrice}
              onChange={(e) => onCostPriceChange(e.target.value)}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>
        )}

        <div className={`space-y-1 ${showCostPrice ? "" : "col-span-2"}`}>
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t("sellerProductForm.sellPriceLabel")}</label>
          <input
            type="number"
            required
            disabled={disabled}
            placeholder="0"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1 col-span-2">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">{t("sellerProductForm.discountPriceLabel")}</label>
          <input
            type="number"
            disabled={disabled}
            placeholder={t("sellerProductForm.discountPlaceholder")}
            value={discountPrice}
            onChange={(e) => onDiscountPriceChange(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 placeholder:font-normal placeholder:text-[10px]"
          />
        </div>
      </div>

      {showCostPrice && hasValues && (
        <div
          className={`border p-3 rounded-xl flex items-center justify-between ${
            profit >= 0
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400"
              : "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-400"
          }`}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t("sellerProductForm.netProfit")}</div>
            <div className="text-sm font-black mt-0.5">
              {profit >= 0 ? "+" : ""}
              {profit.toLocaleString()} so'm
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{t("sellerProductForm.margin")}</div>
            <div className="text-sm font-black mt-0.5">{marginPercentage}%</div>
          </div>
        </div>
      )}

      {!showCostPrice && (
        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-0.5">
          {t("sellerProductForm.costPriceRestricted")}
        </p>
      )}

      <div className="space-y-1 pt-1">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("sellerProductForm.stockQtyLabel")}</label>
        <input
          type="number"
          required
          disabled={disabled}
          placeholder={t("sellerProductForm.stockPlaceholder")}
          value={stock}
          onChange={(e) => onStockChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />

        {/* ZAXIRA HARAKATI AUDIT JURNALI: zaxira HAQIQATAN o'zgarganda,
            sabab tanlashni SO'RAYDI - `firestore.rules` buni serverga
            yozishda MAJBURIY qiladi (izoh: fayl boshi). */}
        {stockActuallyChanged && (
          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <AlertTriangle size={11} /> {t("sellerProductForm.stockChangeReasonPrompt")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CLIENT_STOCK_CHANGE_REASONS.map((reasonKey) => (
                <button
                  key={reasonKey}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStockChangeReasonChange?.(reasonKey)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                    stockChangeReason === reasonKey
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {t(`sellerProductForm.${getStockChangeReasonLabelKey(reasonKey)}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PricingCard);
