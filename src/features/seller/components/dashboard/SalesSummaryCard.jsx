import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import SalesChart from "./SalesChart";

const formatMoney = (value, isPrivate) => (isPrivate ? "•••• so'm" : `${value.toLocaleString()} so'm`);

const SalesSummaryCard = ({ timeframe, totalSales, growthPercent, orders, isPrivate }) => {
  const isPositive = growthPercent === null || growthPercent >= 0;

  return (
    <div className="bg-gradient-to-br from-[#5346E0] to-[#4338CA] rounded-[24px] p-5 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex justify-between items-start z-10 relative mb-3">
        <div>
          <span className="text-[10px] font-bold text-indigo-200/90 uppercase tracking-wider">
            {timeframe}gi umumiy savdo
          </span>
          <div className="text-2xl font-black tracking-tight mt-1 animate-fade-in">
            {formatMoney(totalSales, isPrivate)}
          </div>

          {growthPercent !== null ? (
            <div className={`mt-2 flex items-center gap-1 text-[11px] font-bold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>
              {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              <span>{Math.abs(growthPercent)}% oldingi davrga nisbatan</span>
            </div>
          ) : (
            <div className="mt-2 text-[11px] font-bold text-indigo-200">Birinchi davr</div>
          )}
        </div>
      </div>

      <div className="z-10 relative">
        <SalesChart orders={orders} timeframe={timeframe} isPrivate={isPrivate} />
      </div>
    </div>
  );
};

export default React.memo(SalesSummaryCard);
