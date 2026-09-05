import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bot, ShoppingCart, Heart, RotateCcw, Gift, Megaphone, Bell,
  Check, X, Loader2, AlertTriangle,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAiCeoPendingActions } from "@/hooks/useAiCeoPendingActions";
import { useSellerNotificationLog } from "@/hooks/useSellerNotificationLog";
import { buildInboxFeed } from "@/utils/inboxFeed";
import { respondToAiCeoPendingAction } from "@/services/ai/aiCeoInsights";

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

// `crmCampaign` FAQAT vip/churn ishlatadi; `adCampaign` (YANGI, Risk
// Level + Approval Engine boyitishi) esa MIJOZLAR RAZVEDKASI'ning
// to'liq 7-segment tasnifidan (`lib/customerIntelligence.js`dagi
// `PRIMARY_SEGMENT_KEYS`) + "all"dan foydalanadi.
const SEGMENT_KEYS = {
  vip: "segmentVip", churn: "segmentChurn", high_value: "segmentHighValue", sleeping: "segmentSleeping",
  churn_risk: "segmentChurnRisk", at_risk: "segmentAtRisk", new: "segmentNew", returning: "segmentReturning", all: "segmentAll",
};
// "failed" - YANGI (rasmiy Approval Engine): sotuvchi RAD ETGANIDAN
// (`rejected`) ANIQ farqlanadigan, HAQIQIY ijro xatosi holati (masalan
// promokod yaratib bo'lmadi) - eski uchta holatdan (pending/executed/
// rejected) FARQLI, aks holda sotuvchi buni o'zi bekor qilgan deb
// noto'g'ri tushunar edi.
const STATUS_KEYS = { pending: "statusPending", executed: "statusExecuted", rejected: "statusRejected", failed: "statusFailed" };
const STATUS_STYLES = {
  pending: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  executed: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500",
  failed: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
};
// YANGI: rasmiy Risk Level (`lib/aiRiskEngine.js`) - FAQAT Approval
// Engine orqali yaratilgan (yangi) harakatlarda mavjud (`riskLevel`
// maydoni) - eski hujjatlarda yo'q bo'lishi mumkin, shuning uchun
// quyida shart bilan ko'rsatiladi.
const RISK_KEYS = { LOW: "riskLow", MEDIUM: "riskMedium", HIGH: "riskHigh" };
const RISK_STYLES = {
  LOW: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  MEDIUM: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HIGH: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const timeAgo = (ts, t) => {
  if (!ts) return "";
  const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 60) return t("notificationsInfo.minutesAgo", { count: Math.max(diffMin, 1) });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("notificationsInfo.hoursAgo", { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  return t("notificationsInfo.daysAgo", { count: diffDay });
};

// YANGI: `expiresAtMs` (48 soatlik standart muddat, `lib/aiApprovalEngine.js`)
// asosida qolgan vaqtni inson o'qiydigan shaklda hisoblaydi - faqat
// hali hal qilinmagan (`pending`) harakatlar uchun mazmunli.
function expiryLabel(expiresAtMs, t) {
  if (!Number.isFinite(expiresAtMs)) return null;
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) return t("inbox.expiresExpired");
  const hours = Math.max(1, Math.round(remainingMs / (60 * 60 * 1000)));
  return t("inbox.expiresInHours", { hours });
}

const AiCeoActionCard = ({ action, id, t, onRespond, responding, respondError }) => {
  const segmentLabel = t(`inbox.${SEGMENT_KEYS[action.segment] || "segmentVip"}`);
  const statusLabel = t(`inbox.${STATUS_KEYS[action.status] || "statusPending"}`);
  const statusStyle = STATUS_STYLES[action.status] || STATUS_STYLES.pending;
  const riskKey = RISK_KEYS[action.riskLevel];
  // YANGI: `adCampaign` (Approval Engine orqali, "AI CEO'dan so'rang"
  // chatidan taklif qilingan) - `crmCampaign`dan farqli, haqiqiy
  // chegirma/byudjet/qabul qiluvchi soni bilan.
  const isAdCampaign = (action.type || action.actionType) === "adCampaign";
  const expiry = action.status === "pending" ? expiryLabel(action.expiresAtMs, t) : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Bot size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">{t("inbox.aiCeoBadge")}</p>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{timeAgo(action.createdAt, t)}</span>
          </div>
          <p className="text-xs font-black text-slate-800 dark:text-white mt-0.5">{action.title} · {segmentLabel}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-line">{action.message}</p>
          {isAdCampaign && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
              {t("inbox.adCampaignDetails", {
                discount: Number(action.discountPercent) || 0,
                recipients: (action.targetClientIds || []).length,
              })}
            </p>
          )}
        </div>
      </div>

      {(riskKey || expiry) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {riskKey && (
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${RISK_STYLES[action.riskLevel]}`}>{t(`inbox.${riskKey}`)}</span>
          )}
          {expiry && <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">{expiry}</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${statusStyle}`}>{statusLabel}</span>
        {action.status === "pending" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(id, false)}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              aria-label={t("inbox.reject")}
            >
              <X size={14} />
            </button>
            <button
              type="button"
              disabled={responding}
              onClick={() => onRespond(id, true)}
              className="h-8 px-3 rounded-xl bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
            >
              {responding ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {t("inbox.approve")}
            </button>
          </div>
        )}
      </div>
      {respondError && <p className="text-[10px] text-rose-500 font-semibold">{respondError}</p>}
    </div>
  );
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

  const [respondingId, setRespondingId] = useState(null);
  const [respondErrors, setRespondErrors] = useState({});

  const feed = useMemo(
    () => buildInboxFeed({ pendingActions: actions, notifications }),
    [actions, notifications]
  );

  const loading = actionsLoading || notificationsLoading;
  const error = actionsError || notificationsError;

  const handleRespond = useCallback(
    async (actionId, approve) => {
      setRespondingId(actionId);
      setRespondErrors((prev) => ({ ...prev, [actionId]: null }));
      try {
        await respondToAiCeoPendingAction(actionId, approve);
        // Yangi holat (`executed`/`rejected`) Firestore JONLI tinglovchi
        // (`useAiCeoPendingActions`) orqali o'zi keladi - qo'lda holat
        // yangilash shart emas.
      } catch (err) {
        setRespondErrors((prev) => ({ ...prev, [actionId]: err.message || t("inbox.respondError") }));
      } finally {
        setRespondingId(null);
      }
    },
    [t]
  );

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
