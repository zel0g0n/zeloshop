import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase/config';
import {
  BarChart3, Users, CreditCard, Zap, Truck, Tag,
  Bell, Globe, Lock, Headphones, LogOut, ChevronRight, Store, Moon, Sun,
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
  const { language } = useLanguage();

  const [signingOut, setSigningOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [openModal, setOpenModal] = useState(null); // 'language' | 'theme' | null
  const [comingSoonName, setComingSoonName] = useState(null);
  const [logoutError, setLogoutError] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (store?.notificationsEnabled !== undefined) {
      setNotificationsEnabled(store.notificationsEnabled);
    }
  }, [store]);

  const displayName = useMemo(() => {
    if (store?.storeName) return store.storeName;
    if (!telegramUser) return "Sotuvchi";
    return [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ") || "Sotuvchi";
  }, [store, telegramUser]);

  const isActive = store?.status !== "suspended";

  const handleToggleNotifications = useCallback(async () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    setSavingPref(true);
    try {
      await updateSeller(sellerId, { notificationsEnabled: next });
    } catch {
      setNotificationsEnabled(!next); // xatolik bo'lsa, orqaga qaytaramiz
    } finally {
      setSavingPref(false);
    }
  }, [notificationsEnabled, sellerId]);

  const menuGroups = useMemo(() => [
    {
      title: "Boshqaruv va analitika",
      items: [
        { id: 'analitika', name: 'Analitika va Hisobotlar', desc: "Real-time P&L, foyda va xarajatlar", icon: BarChart3, onClick: () => navigate('/seller/pnl') },
        { id: 'mijozlar', name: 'Mijozlar Bazasi', desc: "Xaridorlar LTV, segmentatsiya, xabar yuborish", icon: Users, onClick: () => navigate('/seller/crm') },
        { id: 'tariflar', name: "To'lovlar va Tariflar", desc: "Balans, Pro plan statusi", icon: CreditCard, comingSoon: true },
      ]
    },
    {
      title: "Integratsiya va do'kon sozlamalari",
      items: [
        { id: 'tolov-tizimlari', name: "To'lov Tizimlari", desc: "Click, Payme hisobingizni ulang", icon: Zap, onClick: () => navigate('/seller/payment-settings') },
        { id: 'yetkazib-berish', name: "Yetkazib berish va Logistika", desc: "Kuryer narxlari, bepul yetkazib berish limiti", icon: Truck, onClick: () => navigate('/seller/logistics') },
        { id: 'dokon-sozlamalari', name: "Do'kon sozlamalari", desc: "Logotip, do'kon nomi, telefon, joylashuv", icon: Store, onClick: () => navigate('/seller/store-settings') },
        { id: 'marketing', name: 'Marketing va Kuponlar', desc: "Promokodlar va aksiyalar", icon: Tag, onClick: () => navigate('/seller/marketing') },
      ]
    },
    {
      title: "Bildirishnomalar va tizim",
      items: [
        { id: 'bildirishnoma', name: 'Bildirishnomalar', desc: "Buyurtma kelganda xabar berish", icon: Bell, toggle: true, toggleValue: notificationsEnabled, onToggle: handleToggleNotifications },
        { id: 'til', name: 'Ilova tili', desc: translations[language].language_name, icon: Globe, onClick: () => setOpenModal('language') },
        { id: 'tema', name: "Ko'rinish rejimi", desc: isDark ? "Tungi rejim" : "Yorqin rejim", icon: isDark ? Moon : Sun, onClick: () => setOpenModal('theme') },
        { id: 'maxfiylik', name: "Maxfiylik va Xavfsizlik", desc: "PIN kod himoyasi", icon: Lock, onClick: () => navigate('/seller/security') },
      ]
    },
    {
      title: "Qo'llab-quvvatlash",
      items: [
        { id: 'support', name: "Qo'llab-quvvatlash xizmati", desc: "Savol va takliflaringiz uchun", icon: Headphones, comingSoon: true },
      ]
    },
  ], [language, isDark, notificationsEnabled, handleToggleNotifications, navigate]);

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

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      setLogoutError(err.message);
      setSigningOut(false);
      setShowLogoutConfirm(false);
    }
  };



  return (
    <div className="max-w-md mx-auto bg-gray-50 dark:bg-slate-950 min-h-screen font-sans border-x border-gray-200 dark:border-slate-800 shadow-xl transition-colors duration-300 flex flex-col">

      <div className="shrink-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 shadow-sm z-50">
        <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Sozlamalar</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
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
                {store?.category || "Do'kon"}{store?.phone ? ` · ${store.phone}` : ""}
              </p>
              <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
                {isActive ? "Faol" : "To'xtatilgan"}
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
                        <span className="shrink-0 text-[9px] font-black text-gray-300 dark:text-slate-600 uppercase tracking-wider">Tez orada</span>
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
            <span>Tizimdan chiqish</span>
          </button>
        </div>
      </div>

      {openModal === 'language' && <LanguageModal onClose={() => setOpenModal(null)} />}
      {openModal === 'theme' && <ThemeModal onClose={() => setOpenModal(null)} />}

      {comingSoonName && (
        <StatusModal
          variant="info"
          title="Tez orada"
          message={`Ushbu funksiya ("${comingSoonName}") keyingi yangilanishda taqdim etiladi! 🚀`}
          onClose={() => setComingSoonName(null)}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmDialog
          title="Tizimdan chiqasizmi?"
          message="Qayta kirish uchun Telegram orqali botni yana ochishingiz kerak bo'ladi."
          confirmLabel="Ha, chiqish"
          danger
          busy={signingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {logoutError && (
        <StatusModal
          variant="error"
          title="Tizimdan chiqishda xatolik"
          message={logoutError}
          onClose={() => setLogoutError(null)}
        />
      )}
    </div>
  );
}

export default MorePage;
