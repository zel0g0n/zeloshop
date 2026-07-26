import React, { useMemo } from "react";

const PricingCard = ({ price, costPrice, stock, disabled, onPriceChange, onCostPriceChange, onStockChange }) => {
  // Eslatma: eski kod `price && costPrice` tekshiruvidan foydalangan edi —
  // narx "0" bo'lsa bu falsy bo'lib, hisoblash noto'g'ri ishlardi.
  // Bo'sh qatorni ("") haqiqiy 0 dan ajratish uchun to'g'ridan-to'g'ri tekshiramiz.
  const { calculatedProfit, marginPercentage, hasValues } = useMemo(() => {
    const priceNum = Number(price);
    const costNum = Number(costPrice);
    const valid = price !== "" && costPrice !== "" && !Number.isNaN(priceNum) && !Number.isNaN(costNum);

    if (!valid) {
      return { calculatedProfit: 0, marginPercentage: 0, hasValues: false };
    }

    const profit = priceNum - costNum;
    const margin = priceNum !== 0 ? Math.round((profit / priceNum) * 100) : 0;
    return { calculatedProfit: profit, marginPercentage: margin, hasValues: true };
  }, [price, costPrice]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Narx va Stok sozlamalari</label>
        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-sm">SMART CALCULATOR</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 block">Tannarxi *</label>
          <input
            type="number"
            required
            disabled={disabled}
            placeholder="0"
            value={costPrice}
            onChange={(e) => onCostPriceChange(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 block">Sotish narxi *</label>
          <input
            type="number"
            required
            disabled={disabled}
            placeholder="0"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {hasValues && (
        <div
          className={`border p-3 rounded-xl flex items-center justify-between ${
            calculatedProfit >= 0
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-700"
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
        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Ombor qoldig'i *</label>
        <input
          type="number"
          required
          disabled={disabled}
          placeholder="Masalan: 50"
          value={stock}
          onChange={(e) => onStockChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
      </div>
    </div>
  );
};

export default React.memo(PricingCard);
