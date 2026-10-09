import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShoppingBag, BarChart3, Inbox, Wallet, Activity, ClipboardList, X, CheckCircle2, Truck, Ban, Trash2, MousePointerClick } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ORDER_STATUS_TABS, getOrderStatusInfo, CAN_HIDE_STATUSES } from "@/constants/orderStatus";
import { STATUS_COLORS, formatMoney } from "@/utils/dashboardCharts";
import { formatRelativeTime } from "@/utils/relativeTime";
import OrderRow from "./OrderCard";

const card = "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl";

const Stat = ({ icon: Icon, tint, label, value, unit }) => (
  <div className={`${card} p-4 shadow-xs flex items-center gap-3.5`}>
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tint}`}><Icon size={20} /></span>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-[22px] leading-none font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
        {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
      </p>
    </div>
  </div>
);

/**
 * Kompyuter uchun Buyurtmalar: statistika, holat bo'yicha jadval (chapda) va
 * tanlangan buyurtmaning to'liq tafsiloti (o'ngda, yopishqoq panel).
 * Buyurtma ustidagi barcha amallar (kuryer, Yandex, bekor qilish...) mavjud
 * `OrderRow` komponentidan foydalanadi — mantiq takrorlanmaydi.
 */
const DesktopOrders = ({
  orders, visibleOrders, filteredCount, orderNumbers, activeTab, onTabChange, searchQuery, onSearchChange,
  totalRevenue, activeOrdersCount, showAnalytics, selectedIds, onToggleSelect, onClearSelection, bulkBusy,
  onBulkStatus, onBulkHide, couriers, onCopied, loading, onShowMore, canShowMore, bulkError,
}) => {
  const { t } = useLanguage();
  const [pickedId, setPickedId] = useState(null);
  const picked = visibleOrders.find((o) => o.id === pickedId) || visibleOrders[0] || null;
  const countOf = (status) => orders.filter((o) => o.status === status && !o.hiddenAt).length;
  const isHistoryTab = CAN_HIDE_STATUSES.includes(activeTab);
  const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selectedIds.has(o.id));

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{t("sellerOrders.title")}</h2>
          <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mt-1">{t("desktop.ordersSub")}</p>
        </div>
        {showAnalytics && (
          <Link to="/seller/orders/analytics" className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-white dark:hover:bg-slate-800">
            <BarChart3 size={15} />{t("desktop.analytics")}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-4 gap-5">
        <Stat icon={Inbox} tint="bg-violet-500/10 text-violet-600 dark:text-violet-400" label={t("desktop.newOrders")} value={countOf("new")} unit={t("desktop.ordersUnit")} />
        <Stat icon={Activity} tint="bg-amber-500/10 text-amber-600 dark:text-amber-400" label={t("desktop.activeOrders")} value={activeOrdersCount} unit={t("desktop.ordersUnit")} />
        <Stat icon={Wallet} tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" label={t("desktop.deliveredRevenue")} value={formatMoney(totalRevenue)} unit="so'm" />
        <Stat icon={ClipboardList} tint="bg-[#5346E0]/10 text-[#5346E0] dark:text-[#8b85f5]" label={t("desktop.totalOrders")} value={orders.filter((o) => !o.hiddenAt).length} unit={t("desktop.ordersUnit")} />
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        <section className={`${card} col-span-7 xl:col-span-8 shadow-xs overflow-hidden`}>
          <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
              {ORDER_STATUS_TABS.map((status) => {
                const info = getOrderStatusInfo(status);
                const on = activeTab === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onTabChange(status)}
                    className={`h-8 px-3 rounded-lg text-xs font-black flex items-center gap-2 whitespace-nowrap transition-colors ${
                      on ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    <i className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                    {t(`orderStatus.${info.key}`)}
                    <span className="text-[10px] tabular-nums text-slate-400">{countOf(status)}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t("desktop.searchOrders")}
                className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none border border-transparent focus:border-[#5346E0]/40 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-[#5346E0]/10 transition"
              />
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="px-4 py-2.5 bg-[#5346E0] text-white flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClearSelection} aria-label={t("sellerProducts.bulkCancel")} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><X size={14} /></button>
                <span className="text-xs font-black">{t("sellerProducts.bulkSelected", { count: selectedIds.size })}</span>
              </div>
              <div className="flex items-center gap-2">
                {isHistoryTab ? (
                  <button type="button" disabled={bulkBusy} onClick={onBulkHide} className="h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Trash2 size={14} />{t("sellerOrders.bulkHide")}</button>
                ) : (
                  <>
                    {activeTab === "new" && <button type="button" disabled={bulkBusy} onClick={() => onBulkStatus("processing")} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><CheckCircle2 size={14} />{t("sellerOrders.bulkApprove")}</button>}
                    {activeTab === "processing" && <button type="button" disabled={bulkBusy} onClick={() => onBulkStatus("shipped")} className="h-8 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Truck size={14} />{t("sellerOrders.bulkShip")}</button>}
                    <button type="button" disabled={bulkBusy} onClick={() => onBulkStatus("cancel")} className="h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Ban size={14} />{t("sellerOrders.bulkCancel")}</button>
                  </>
                )}
              </div>
            </div>
          )}
          {bulkError && <p className="px-5 py-2 text-xs font-semibold text-rose-500">{bulkError}</p>}

          {loading ? (
            <div className="p-6 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
          ) : visibleOrders.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-center">
              <span className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"><ShoppingBag size={24} /></span>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("sellerOrders.emptyState")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                  <th className="w-12 pl-5 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => visibleOrders.forEach((o) => { if (allVisibleSelected === selectedIds.has(o.id)) onToggleSelect(o.id); })}
                      aria-label={t("desktop.selectAll")}
                      className="w-4 h-4 accent-[#5346E0] cursor-pointer"
                    />
                  </th>
                  <th className="text-left font-bold px-3 py-3">{t("desktop.colOrder")}</th>
                  <th className="text-left font-bold px-3 py-3">{t("desktop.colCustomer")}</th>
                  <th className="text-left font-bold px-3 py-3">{t("desktop.colPayment")}</th>
                  <th className="text-right font-bold px-3 py-3">{t("desktop.colAmount")}</th>
                  <th className="text-right font-bold pl-3 pr-5 py-3">{t("desktop.colTime")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {visibleOrders.map((o) => {
                  const on = picked?.id === o.id;
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setPickedId(o.id)}
                      className={`cursor-pointer transition-colors ${on ? "bg-[#5346E0]/6 dark:bg-[#5346E0]/10" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"}`}
                    >
                      <td className="pl-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => onToggleSelect(o.id)} aria-label={t("sellerOrders.select")} className="w-4 h-4 accent-[#5346E0] cursor-pointer" />
                      </td>
                      <td className="px-3 py-3.5 font-black tabular-nums text-[#5346E0] dark:text-[#8b85f5]">#{orderNumbers.get(o.id)}</td>
                      <td className="px-3 py-3.5">
                        <p className="font-bold text-slate-800 dark:text-white truncate max-w-[200px]">{o.customer?.fullName || t("sellerOrders.unknownCustomer")}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">{o.customer?.phone || ""}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                          {o.paymentMethod === "card" ? t("sellerOrders.paymentTypePrepay") : t("sellerOrders.paymentTypeCod")}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-black text-slate-800 dark:text-white tabular-nums whitespace-nowrap">{formatMoney(o.totalAmount)} <span className="text-[10px] font-bold text-slate-400">so'm</span></td>
                      <td className="pl-3 pr-5 py-3.5 text-right text-xs font-semibold text-slate-400 whitespace-nowrap">{formatRelativeTime(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>{t("desktop.shown", { count: visibleOrders.length })} / {filteredCount}</span>
            {canShowMore && <button type="button" onClick={onShowMore} className="text-[#5346E0] dark:text-[#8b85f5] font-black hover:underline">{t("sellerOrders.showMore")}</button>}
          </div>
        </section>

        <aside className="col-span-5 xl:col-span-4 sticky top-6">
          {picked ? (
            <OrderRow
              key={picked.id}
              order={picked}
              orderNumber={orderNumbers.get(picked.id)}
              isSelected={false}
              onToggleSelect={onToggleSelect}
              onCopied={onCopied}
              couriers={couriers}
              defaultOpen
              hideSelect
            />
          ) : (
            <div className={`${card} p-10 text-center shadow-xs`}>
              <span className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"><MousePointerClick size={22} /></span>
              <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">{t("desktop.pickOrder")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("desktop.pickOrderHint")}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default DesktopOrders;
