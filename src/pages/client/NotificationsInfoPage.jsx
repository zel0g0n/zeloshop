import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, ShoppingCart, Gift, Megaphone, Heart, RotateCcw, Info, X, AlertTriangle } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useNotificationLog } from "@/hooks/useNotificationLog";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * Bildirishnomalar sahifasi — asosiy ko'rinish mijozga haqiqatan
 * yuborilgan xabarlarning jonli ro'yxati (`notificationLogs`
 * kolleksiyasidan, `useNotificationLog` orqali). "Qanday xabarlar
 * kelishi mumkin" degan umumiy tushuntirish esa alohida, kichik "ℹ"
 * tugmasi orqali ochiladigan modal ichida joylashtirilgan (AI CEO
 * sahifasidagi bilan bir xil naqsh).
 */
const NOTIFICATION_TYPES = [
  { icon: ShoppingCart, titleKey: "cartReminderTitle", descKey: "cartReminderDesc" },
  { icon: Heart, titleKey: "favoriteReminderTitle", descKey: "favoriteReminderDesc" },
  { icon: RotateCcw, titleKey: "repurchaseReminderTitle", descKey: "repurchaseReminderDesc" },
  { icon: Gift, titleKey: "referralRewardTitle", descKey: "referralRewardDesc" },
  { icon: Megaphone, titleKey: "broadcastTitle", descKey: "broadcastDesc" },
];

const TYPE_ICONS = {
  cartReminder: ShoppingCart,
  favoriteReminder: Heart,
  repurchaseReminder: RotateCcw,
  referralReward: Gift,
  crmBroadcast: Megaphone,
};

const InfoModal = ({ onClose, t }) => {
  useEscapeToClose(onClose);
  return (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-[#f8fafc] dark:bg-slate-950 rounded-t-[28px] max-h-[85vh] overflow-y-auto">
      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-gray-100 dark:border-slate-800 p-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-800 dark:text-white">{t("notificationsInfo.pageTitle")}</h3>
        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <X size={14} className="text-gray-500 dark:text-slate-400" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[24px] p-5 text-white text-center shadow-lg shadow-blue-600/20">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-2.5">
            <Bell size={22} />
          </div>
          <h2 className="text-sm font-black">{t("notificationsInfo.heroTitle")}</h2>
          <p className="text-[11px] font-medium text-white/80 mt-1.5 leading-relaxed">{t("notificationsInfo.heroSubtitle")}</p>
        </div>
        <div className="space-y-2.5">
          {NOTIFICATION_TYPES.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3.5 flex gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-gray-800 dark:text-white">{t(`notificationsInfo.${titleKey}`)}</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">{t(`notificationsInfo.${descKey}`)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center leading-relaxed px-4">
          {t("notificationsInfo.footerNote")}
        </p>
      </div>
    </div>
  </div>
  );
};

const timeAgo = (sentAt, t) => {
  if (!sentAt) return "";
  const ms = sentAt.toMillis ? sentAt.toMillis() : new Date(sentAt).getTime();
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 60) return t("notificationsInfo.minutesAgo", { count: Math.max(diffMin, 1) });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("notificationsInfo.hoursAgo", { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  return t("notificationsInfo.daysAgo", { count: diffDay });
};

const NotificationsInfoPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, clientId } = useSession();
  const { notifications, loading, error } = useNotificationLog(sellerId, clientId);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white flex-1">{t("notificationsInfo.pageTitle")}</h1>
        {/* "Qanday xabarlar kelishi mumkin" - shu kichik tugma orqali,
            alohida modalda ko'rsatiladi. */}
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
        >
          <Info size={18} />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-3">
        {loading && (
          <div className="text-center text-xs text-gray-400 dark:text-slate-500 py-10">{t("notificationsInfo.loading")}</div>
        )}

        {/* So'rov xatoligi (masalan ruxsat yoki tarmoq muammosi) va
            haqiqiy bo'sh ro'yxat holati alohida, aniq farqlab
            ko'rsatiladi. */}
        {!loading && error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-6 text-center">
            <AlertTriangle size={24} className="text-rose-400 mx-auto mb-2.5" />
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{t("notificationsInfo.loadError")}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 underline underline-offset-2"
            >
              {t("notificationsInfo.retry")}
            </button>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-8 text-center">
            <Bell size={28} className="text-gray-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-xs text-gray-400 dark:text-slate-500">{t("notificationsInfo.emptyState")}</p>
          </div>
        )}

        {!loading && !error && notifications.map((n) => {
          const Icon = TYPE_ICONS[n.type] || Bell;
          return (
            <div key={n.id} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 flex gap-3">
              <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-gray-800 dark:text-white truncate">{n.title}</p>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">{timeAgo(n.sentAt, t)}</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line line-clamp-3">{n.message}</p>
                {n.delivered === false && (
                  <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1.5">
                    <AlertTriangle size={11} /> {t("notificationsInfo.notDelivered")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} t={t} />}
    </div>
  );
};

export default NotificationsInfoPage;
