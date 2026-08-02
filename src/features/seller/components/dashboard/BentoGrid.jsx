import React from "react";
import { TrendingUp, ShoppingBag, Target, Package } from "lucide-react";

const formatMoney = (value, isPrivate) => (isPrivate ? "•••• so'm" : `${value.toLocaleString()} so'm`);

// Eslatma: "Konversiya" kartasi tashrif sonini talab qiladi, lekin
// ilovada hozircha HECH QANDAY tashrif/analitika kuzatuvi yo'q.
// Soxta raqam ko'rsatish o'rniga, buni ochiq "hali kuzatilmayapti"
// deb belgilaymiz — bu haqiqiy biznes qarorlariga ta'sir qilishi
// mumkin bo'lgan noto'g'ri ma'lumot berishdan ko'ra ancha to'g'ri.
const BentoGrid = ({ netProfit, profitMargin, ordersCount, pendingCount, activeProductsCount, lowStockCount, isPrivate }) => (
  <div className="grid grid-cols-2 gap-3">
    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        <TrendingUp size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wide">Sof foyda</span>
      </div>
      <div className={`text-base font-black mt-1.5 ${netProfit >= 0 ? "text-slate-800 dark:text-white" : "text-rose-500"}`}>
        {formatMoney(netProfit, isPrivate)}
      </div>
      <span className="text-[10px] font-bold text-emerald-500">{isPrivate ? "••%" : `${profitMargin}% margin`}</span>
    </div>

    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        <ShoppingBag size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wide">Buyurtmalar</span>
      </div>
      <div className="text-base font-black text-slate-800 dark:text-white mt-1.5">{ordersCount} ta</div>
      {pendingCount > 0 ? (
        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{pendingCount} tasi kutilmoqda</span>
      ) : (
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Barchasi ko'rib chiqilgan</span>
      )}
    </div>

    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        <Target size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wide">Konversiya</span>
      </div>
      <div className="text-base font-black text-slate-400 dark:text-slate-600 mt-1.5">—</div>
      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Hali kuzatilmayapti</span>
    </div>

    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
      <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
        <Package size={13} />
        <span className="text-[10px] font-bold uppercase tracking-wide">Ombor holati</span>
      </div>
      <div className="text-base font-black text-slate-800 dark:text-white mt-1.5">{activeProductsCount} faol</div>
      {lowStockCount > 0 ? (
        <span className="text-[10px] font-bold text-rose-500">⚠️ {lowStockCount} ta kam qoldi</span>
      ) : (
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Hammasi yetarli</span>
      )}
    </div>
  </div>
);

export default React.memo(BentoGrid);
