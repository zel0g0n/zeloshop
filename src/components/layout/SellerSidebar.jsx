import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, ClipboardList, Users, BarChart3, Megaphone, Settings, Plus, LogOut } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNewOrdersCount } from "@/hooks/seller/useNewOrdersCount";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import SellerQuickCreateMenu from "./SellerQuickCreateMenu";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Katta ekran (lg+, kompyuter/planshet) uchun chap yon panel — telefonda
 * (`SellerNavbar.jsx`, pastki suzuvchi navbar) o'rniga ko'rinadi.
 * Ikkalasi BIR XIL yo'llarga olib boradi; farqi faqat joylashuvda.
 *
 * Z-Start tarifida mavjud bo'lmagan bo'limlar (Mijozlar, Hisobotlar,
 * Marketing) `More.jsx`dagi `START_HIDDEN_IDS` bilan BIR XIL qoida
 * bo'yicha yashiriladi.
 */
const SellerSidebar = () => {
  const { sellerId, store, isWebSession, logout } = useSession();
  const { t } = useLanguage();
  const newOrdersCount = useNewOrdersCount(sellerId);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isStart = getEffectiveTariffPlan(store) === "start";

  const items = [
    { path: "/seller", end: true, icon: LayoutDashboard, label: t("sellerSidebar.home") },
    { path: "/seller/products", icon: Package, label: t("sellerSidebar.products") },
    { path: "/seller/orders", icon: ClipboardList, label: t("sellerSidebar.orders"), badge: newOrdersCount || 0 },
    ...(isStart
      ? []
      : [
          { path: "/seller/crm", icon: Users, label: t("sellerSidebar.customers") },
          { path: "/seller/pnl", icon: BarChart3, label: t("sellerSidebar.finance") },
          { path: "/seller/marketing", icon: Megaphone, label: t("sellerSidebar.marketing") },
        ]),
    { path: "/seller/functions", icon: Settings, label: t("sellerSidebar.settings") },
  ];

  const initial = (store?.storeName || "Z").trim().charAt(0).toUpperCase();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        {store?.logo ? (
          <img src={store.logo} alt="" className="w-10 h-10 rounded-2xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-[#5346E0] text-white font-black flex items-center justify-center">{initial}</div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 dark:text-white truncate">{store?.storeName || "ZeloShop"}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">ZeloShop</p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setShowQuickCreate(true)}
          className="w-full h-11 rounded-2xl bg-[#5346E0] hover:bg-[#4338CA] text-white text-xs font-black flex items-center justify-center gap-2 transition-colors shadow-[0_8px_20px_rgba(83,70,224,0.25)]"
        >
          <Plus size={16} />
          {t("sellerSidebar.create")}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1" aria-label="Sotuvchi paneli">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-bold transition-colors ${
                isActive
                  ? "bg-[#5346E0]/10 text-[#5346E0] dark:bg-[#5346E0]/20 dark:text-indigo-300"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`
            }
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {isWebSession && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
          >
            <LogOut size={18} />
            {t("sellerSidebar.logout")}
          </button>
        </div>
      )}

      {showQuickCreate && <SellerQuickCreateMenu onClose={() => setShowQuickCreate(false)} />}
      {showLogoutConfirm && (
        <ConfirmDialog
          title={t("more.logoutConfirmTitle")}
          message={t("more.logoutConfirmMessageWeb")}
          confirmLabel={t("more.logoutConfirmLabel")}
          danger
          onConfirm={() => logout()}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </aside>
  );
};

export default SellerSidebar;
