import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTelegramWebApp } from '@/config/telegram';
import {
  BarChart3, Users, CreditCard, Zap, Truck, Tag, Image,
  Bell, Globe, Lock, Headphones, LogOut, ChevronRight, Store, Moon, Sun, Bot, Bike, Gift, Inbox, UserRoundCog, PackagePlus, TrendingUp, LayoutGrid, Crown, Workflow,
} from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/i18n/translations';
import updateSeller from '@/services/sellers/updateSeller';
import LanguageModal from '@/components/ui/LanguageModal';
import ThemeModal from '@/components/ui/ThemeModal';
import StatusModal from '@/components/ui/StatusModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// OLDIN: bu sahifa oddiy ro'yxat edi, ikonkalar emoji shaklida,
// "Tizimdan chiqish" tasdiqlashsiz to'g'ridan-to'g'ri ishlardi, va
// bildirishnoma sozlamasi umuman yo'q edi.
const MorePage = () => {
  const { telegramUser, store, sellerId } = useSession();
  const { isDark } = useTheme();
  const { language, t } = useLanguage();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [openModal, setOpenModal] = useState(null); // 'language' | 'theme' | null
  const [comingSoonName, setComingSoonName] = useState(null);
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (store?.notifyNewOrder !== undefined) {
      setNotifyNewOrder(store.notifyNewOrder);
    }
  }, [store]);

  const displayName = useMemo(() => {
    if (store?.storeName) return store.storeName;
    if (!telegramUser) return t("more.defaultSellerName");
    return [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") || t("more.defaultSellerName");
  }, [store, telegramUser]);

  const isActive = store?.status !== "suspended";

  const handleToggleNotifications = useCallback(async () => {
    const next = !notifyNewOrder;
    setNotifyNewOrder(next);
    setSavingPref(true);
    try {
      await updateSeller(sellerId, { notifyNewOrder: next });
    } catch {
      setNotifyNewOrder(!next); // xatolik bo'lsa, orqaga qaytaramiz
    } finally {
      setSavingPref(false);
    }
  }, [notifyNewOrder, sellerId]);

  const menuGroups = useMemo(() => [
    {
      title: t("more.groupManagement"),
      items: [
        { id: 'analitika', name: t("more.analyticsName"), desc: t("more.analyticsDesc"), icon: BarChart3, onClick: () => navigate('/seller/pnl') },
        { id: 'buyruq-markazi', name: t("more.commandCenterName"), desc: t("more.commandCenterDesc"), icon: Crown, onClick: () => navigate('/seller/command-center') },
        { id: 'mijozlar', name: t("more.customersName"), desc: t("more.customersDesc"), icon: Users, onClick: () => navigate('/seller/crm') },
        { id: 'tariflar', name: t("more.tariffsName"), desc: t("more.tariffsDesc"), icon: CreditCard, onClick: () => navigate('/seller/tariffs') },
        { id: 'sotuvchi-taklif', name: t("more.inviteSellersName"), desc: t("more.inviteSellersDesc"), icon: Gift, onClick: () => navigate('/seller/invite-sellers') },
        { id: 'inbox', name: t("more.inboxName"), desc: t("more.inboxDesc"), icon: Inbox, onClick: () => navigate('/seller/inbox') },
      ]
    },
    {
      title: t("more.groupIntegration"),
      items: [
        { id: 'tolov-tizimlari', name: t("more.paymentSystemsName"), desc: t("more.paymentSystemsDesc"), icon: Zap, onClick: () => navigate('/seller/payment-settings') },
        { id: 'yetkazib-berish', name: t("more.deliveryName"), desc: t("more.deliveryDesc"), icon: Truck, onClick: () => navigate('/seller/delivery-settings') },
        { id: 'kuryerlar', name: t("more.couriersName"), desc: t("more.couriersDesc"), icon: Bike, onClick: () => navigate('/seller/couriers') },
        { id: 'xodimlar', name: t("more.staffName"), desc: t("more.staffDesc"), icon: UserRoundCog, onClick: () => navigate('/seller/staff') },
        { id: 'dokon-sozlamalari', name: t("more.storeSettingsName"), desc: t("more.storeSettingsDesc"), icon: Store, onClick: () => navigate('/seller/store-settings') },
        { id: 'kategoriya-boshqaruvi', name: t("more.categoryManagementName"), desc: t("more.categoryManagementDesc"), icon: LayoutGrid, onClick: () => navigate('/seller/category-settings') },
        { id: 'bannerlar', name: t("more.bannersName"), desc: t("more.bannersDesc"), icon: Image, onClick: () => navigate('/seller/banners') },
        { id: 'connections', name: t("more.connectionsName"), desc: t("more.connectionsDesc"), icon: Bot, onClick: () => navigate('/seller/connections') },
        { id: 'marketing', name: t("more.marketingName"), desc: t("more.marketingDesc"), icon: Tag, onClick: () => navigate('/seller/marketing') },
        { id: 'bundles', name: t("more.bundlesName"), desc: t("more.bundlesDesc"), icon: PackagePlus, onClick: () => navigate('/seller/bundles') },
        { id: 'pricing-suggestions', name: t("more.pricingSuggestionsName"), desc: t("more.pricingSuggestionsDesc"), icon: TrendingUp, onClick: () => navigate('/seller/pricing-suggestions') },
        { id: 'automation-rules', name: t("more.automationRulesName"), desc: t("more.automationRulesDesc"), icon: Workflow, onClick: () => navigate('/seller/automation-rules') },
      ]
    },
    {
      title: t("more.groupNotifications"),
      items: [
        { id: 'bildirishnoma', name: t("more.notificationsName"), desc: t("more.notificationsDesc"), icon: Bell, toggle: true, toggleValue: notifyNewOrder, onToggle: handleToggleNotifications },
        { id: 'til', name: t("more.languageName"), desc: translations[language].language_name, icon: Globe, onClick: () => setOpenModal('language') },
        { id: 'tema', name: t("more.themeName"), desc: isDark ? t("more.darkMode") : t("more.lightMode"), icon: isDark ? Moon : Sun, onClick: () => setOpenModal('theme') },
        { id: 'maxfiylik', name: t("more.privacyName"), desc: t("more.privacyDesc"), icon: Lock, onClick: () => navigate('/seller/security') },
      ]
    },
    {
      title: t("more.groupSupport"),
      items: [
        { id: 'support', name: t("more.supportName"), desc: t("more.supportDesc"), icon: Headphones, onClick: () => navigate('/seller/support') },
      ]
    },
  ], [t, language, isDark, notifyNewOrder, handleToggleNotifications, navigate]);

  const handleItemClick = (item) => {
    if (item.toggle) {
      item.onToggle();
      return;
    }
    if (item.comingSoon) {
      setComingSoonName(item.name);
      return;
    }
    item.onClick?.();
  };

  // MUHIM TUZATISH (mijoz tomonida - `Cabinet.jsx`da - allaqachon
  // tuzatilgan bilan AYNAN BIR XIL xato, shu yerda ham topildi): bu
  // ilova Telegram orqali AVTOMATIK autentifikatsiya qilinadi
  // (`SessionContext.jsx`, `signInWithCustomToken`) - sahifa qayta
  // yuklanganda, Telegram DARHOL yana o'sha foydalanuvchi sifatida
  // kirgizib qo'yardi. `signOut()+reload()` — ILOVA ICHIDA turib
  // "chiqish"ning IMKONSIZLIGINI yashiruvchi, aslida hech narsa
  // qilmaydigan kod edi. To'g'ri yechim - ILOVANI YOPISH.
  const handleLogout = () => {
    const webApp = getTelegramWebApp();
    if (webApp?.close) {
      webApp.close();
    } else {
      window.location.href = "/seller";
    }
  };



  return (
    <div className="max-w-md mx-auto bg-gray-50 dark:bg-slate-950 min-h-screen font-sans border-x border-gray-200 dark:border-slate-800 shadow-xl transition-colors duration-300 flex flex-col">

      <div className="shrink-0 p-4 bg-white/95 dark:bg-slate-900/95 sticky top-0 shadow-sm z-50">
        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{t("more.pageTitle")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        <div className="p-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="w-14 h-14 rounded-full border-2 border-indigo-100 dark:border-indigo-500/30 bg-indigo-600 text-white font-black text-lg flex items-center justify-center shrink-0 overflow-hidden">
              {store?.logo ? (
                <img src={store.logo} alt={store.storeName} className="w-full h-full object-cover" />
              ) : (
                <Store size={22} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold text-gray-800 dark:text-white leading-tight truncate">{displayName}</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                {store?.category || t("more.defaultCategory")}{store?.phone ? ` · ${store.phone}` : ""}
              </p>
              <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                {isActive ? t("more.statusActive") : t("more.statusSuspended")}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-6">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">
                {group.title}
              </h3>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm divide-y divide-gray-50 dark:divide-slate-800 overflow-hidden">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="p-3.5 flex items-center justify-between gap-3 active:scale-[0.98] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 shrink-0 bg-gray-50 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl flex items-center justify-center transition-all">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all truncate">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 font-medium truncate">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      {item.toggle ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); item.onToggle(); }}
                          disabled={savingPref}
                          className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${item.toggleValue ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${item.toggleValue ? "translate-x-5" : ""}`} />
                        </button>
                      ) : item.comingSoon ? (
                        <span className="shrink-0 text-[9px] font-black text-gray-300 dark:text-slate-600 uppercase tracking-wider">{t("more.comingSoon")}</span>
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-slate-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full py-3.5 border border-red-100 dark:border-red-500/20 text-red-500 rounded-2xl font-bold text-sm bg-white dark:bg-slate-900 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <LogOut size={15} />
            <span>{t("more.logout")}</span>
          </button>
        </div>
      </div>

      {openModal === 'language' && <LanguageModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}

      {comingSoonName && (
        <StatusModal
          variant="info"
          title={t("more.comingSoon")}
          message={t("more.comingSoonMessage", { feature: comingSoonName })}
          onClose={() => setComingSoonName(null)}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmDialog
          title={t("more.logoutConfirmTitle")}
          message={t("more.logoutConfirmMessage")}
          confirmLabel={t("more.logoutConfirmLabel")}
          danger
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}

export default MorePage;
