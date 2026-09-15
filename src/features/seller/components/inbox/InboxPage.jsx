import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Heart, RotateCcw, Gift, Megaphone, Bell, ArrowLeft, AlertTriangle } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAiCeoPendingActions } from "@/hooks/useAiCeoPendingActions";
import { useSellerNotificationLog } from "@/hooks/useSellerNotificationLog";
import { useRespondToAiCeoAction } from "@/hooks/useRespondToAiCeoAction";
import { buildInboxFeed } from "@/utils/inboxFeed";
import AiCeoActionCard from "@/features/seller/components/shared/AiCeoActionCard";
import { timeAgo } from "@/utils/aiCeoActionTiming";

/**
 * "Universal Inbox" MVP (ZeloShop TOP 15, #12).
 *
 * MUHIM (haqiqiy qamrov, ATAYLAB tor ushlab qolingan): kod bazasini
 * tekshirganda, foydalanuvchi dastlab ko'zda tutgan uchinchi manba
 * ("mijozdan sotuvchiga xabar/so'rov") HALI MAVJUD EMASLIGI aniqlandi
 * — xaridordan sotuvchiga to'g'ridan-to'g'ri yozish imkoniyati kodda
 * yo'q (`contactAdmin` - bu sotuvchidan ZeloShop administratoriga,
 * boshqa yo'nalish). Foydalanuvchi bilan aniqlashtirilgach, bu sahifa
 * ATAYLAB faqat IKKITA HAQIQIY, ALLAQACHON mavjud manbadan quriladi:
 *
 * 1) AI CEO'ning tasdiq kutayotgan harakatlari (`useAiCeoPendingActions`,
 *    OLDIN faqat Telegram botda ko'rinardi - endi shu yerdan ham
 *    tasdiqlash/rad etish mumkin, `respondToAiCeoPendingAction` orqali).
 * 2) Mijozlarga yuborilgan avtomatik xabarlar jurnali
 *    (`useSellerNotificationLog` - `notificationLogs`dan, HAQIQIY,
 *    hodisa-darajasidagi ma'lumot, hech narsa o'ylab topilmagan).
 *
 * Ikkalasi `buildInboxFeed` orqali BITTA, vaqt bo'yicha tartiblangan
 * oqimga birlashtiriladi.
 */
const NOTIFICATION_TYPE_ICONS = {
  cartReminder: ShoppingCart,
  favoriteReminder: Heart,
  repurchaseReminder: RotateCcw,
  referralReward: Gift,
  crmBroadcast: Megaphone,
};

const NotificationCard = ({ notification, t }) => {
  const Icon = NOTIFICATION_TYPE_ICONS[notification.type] || Bell;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex gap-3">
      <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black text-slate-800 dark:text-white truncate">{notification.title}</p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(notification.sentAt, t)}</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line line-clamp-3">{notification.message}</p>
        {notification.delivered === false && (
          <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1.5">
            <AlertTriangle size={11} /> {t("notificationsInfo.notDelivered")}
          </p>
        )}
      </div>
    </div>
  );
};

const InboxPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId } = useSession();
  const { actions, loading: actionsLoading, error: actionsError } = useAiCeoPendingActions(sellerId);
  const { notifications, loading: notificationsLoading, error: notificationsError } = useSellerNotificationLog(sellerId);

  const feed = useMemo(
    () => buildInboxFeed({ pendingActions: actions, notifications }),
    [actions, notifications]
  );

  const loading = actionsLoading || notificationsLoading;
  const error = actionsError || notificationsError;

  const { respondingId, respondErrors, handleRespond } = useRespondToAiCeoAction(t);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <h1 className="text-sm font-black text-slate-800 dark:text-white flex-1">{t("inbox.pageTitle")}</h1>
      </div>

      <div className="p-4 space-y-2.5">
        {loading && (
          <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-10">{t("inbox.loading")}</div>
        )}

        {!loading && error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-6 text-center">
            <AlertTriangle size={24} className="text-rose-400 mx-auto mb-2.5" />
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{t("inbox.loadError")}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-[11px] font-bold text-rose-600 dark:text-rose-400 underline underline-offset-2"
            >
              {t("inbox.retry")}
            </button>
          </div>
        )}

        {!loading && !error && feed.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 text-center">
            <Bell size={28} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("inbox.emptyState")}</p>
          </div>
        )}

        {!loading && !error && feed.map((item) =>
          item.kind === "aiCeoAction" ? (
            <AiCeoActionCard
              key={item.id}
              id={item.data.id}
              action={item.data}
              t={t}
              onRespond={handleRespond}
              responding={respondingId === item.data.id}
              respondError={respondErrors[item.data.id]}
            />
          ) : (
            <NotificationCard key={item.id} notification={item.data} t={t} />
          )
        )}
      </div>
    </div>
  );
};

export default InboxPage;
