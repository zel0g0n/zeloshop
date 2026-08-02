import React, { useMemo } from "react";

// OLDIN: faqat tannarx/sotish narxi bor edi, chegirma yo'q edi, va
// to'lov turi (oldindan/yetib borgandan keyin) umuman tanlanmasdi.
const PricingCard = ({
  price,
  costPrice,
  discountPrice,
  paymentTypes,
  stock,
  disabled,
  onPriceChange,
  onCostPriceChange,
  onDiscountPriceChange,
  onStockChange,
  onTogglePaymentType,
}) => {
  // Eslatma: eski kod `price && costPrice` tekshiruvidan foydalangan edi —
  // narx "0" bo'lsa bu falsy bo'lib, hisoblash noto'g'ri ishlardi.
  // Bo'sh qatorni ("") haqiqiy 0 dan ajratish uchun to'g'ridan-to'g'ri tekshiramiz.
  const { calculatedProfit, marginPercentage, hasValues, effectivePrice } = useMemo(() => {
    const priceNum = Number(price);
    const costNum = Number(costPrice);
    const discountNum = Number(discountPrice);
    const valid = price !== "" && costPrice !== "" && !Number.isNaN(priceNum) && !Number.isNaN(costNum);

    if (!valid) {
      return { calculatedProfit: 0, marginPercentage: 0, hasValues: false, effectivePrice: 0 };
    }

    // Agar chegirma narxi kiritilgan bo'lsa, foyda HAQIQIY (chegirmali)
    // narxdan hisoblanadi — chunki xaridor aslida shuni to'laydi.
    const sellingPrice = discountPrice !== "" && !Number.isNaN(discountNum) && discountNum > 0
      ? discountNum
      : priceNum;

    const profit = sellingPrice - costNum;
    const margin = sellingPrice !== 0 ? Math.round((profit / sellingPrice) * 100) : 0;
    return { calculatedProfit: profit, marginPercentage: margin, hasValues: true, effectivePrice: sellingPrice };
  }, [price, costPrice, discountPrice]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Narx va Stok sozlamalari</label>
        <span className="text-[9px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-sm">SMART CALCULATOR</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Tannarxi *</label>
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

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Sotish narxi *</label>
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
          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Chegirma narxi (ixtiyoriy)</label>
          <input
            type="number"
            disabled={disabled}
            placeholder="Bo'sh qoldirsangiz, chegirma bo'lmaydi"
            value={discountPrice}
            onChange={(e) => onDiscountPriceChange(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 placeholder:font-normal placeholder:text-[10px]"
          />
        </div>
      </div>

      {hasValues && (
        <div
          className={`border p-3 rounded-xl flex items-center justify-between ${
            calculatedProfit >= 0
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400"
              : "bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-400"
          }`}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Sof foyda</div>
            <div className="text-sm font-black mt-0.5">
              {calculatedProfit >= 0 ? "+" : ""}
              {calculatedProfit.toLocaleString()} so'm
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Rentabellik</div>
            <div className="text-sm font-black mt-0.5">{marginPercentage}% {calculatedProfit >= 0 ? "🔥" : ""}</div>
          </div>
        </div>
      )}

      <div className="space-y-1 pt-1">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Ombor qoldig'i *</label>
        <input
          type="number"
          required
          disabled={disabled}
          placeholder="Masalan: 50"
          value={stock}
          onChange={(e) => onStockChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
      </div>

      {/* TO'LOV TURI — sotuvchi belgilaydi, bir nechtasini tanlashi
          mumkin (masalan ikkalasi ham). Xaridor faqat sotuvchi
          yoqqan variantlar orasidan ko'radi, o'zi qo'shimcha tanlay
          olmaydi. */}
      <div className="space-y-1.5 pt-1">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">To'lov turi</label>
        <div className="space-y-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTogglePaymentType("prepay")}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
              paymentTypes.includes("prepay")
                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500"
                : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent"
            }`}
          >
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
              paymentTypes.includes("prepay") ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-400"
            }`}>💳</span>
            <div className="text-left flex-1">
              <p className={`text-xs font-black ${paymentTypes.includes("prepay") ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}>Oldindan to'lov</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Click/Payme orqali darhol</p>
            </div>
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
              paymentTypes.includes("prepay") ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
            }`}>
              {paymentTypes.includes("prepay") && "✓"}
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onTogglePaymentType("cod")}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
              paymentTypes.includes("cod")
                ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500"
                : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent"
            }`}
          >
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
              paymentTypes.includes("cod") ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-slate-400"
            }`}>📦</span>
            <div className="text-left flex-1">
              <p className={`text-xs font-black ${paymentTypes.includes("cod") ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}>Yetkazilganda</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Naqd, qo'lga olinganda</p>
            </div>
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
              paymentTypes.includes("cod") ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
            }`}>
              {paymentTypes.includes("cod") && "✓"}
            </span>
          </button>
        </div>
        {paymentTypes.length === 0 && (
          <p className="text-[10px] text-rose-500 font-semibold pl-1">Kamida bitta to'lov turini tanlang</p>
        )}
      </div>
    </div>
  );
};

export default React.memo(PricingCard);
