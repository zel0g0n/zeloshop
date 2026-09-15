import { Bot, Check, X, Loader2 } from "lucide-react";
import { timeAgo, expiryLabel } from "@/utils/aiCeoActionTiming";

/**
 * AI CEO'ning bitta tasdiq kutayotgan/hal qilingan harakati (`crmCampaign`
 * yoki `adCampaign`) uchun karta — ILGARI faqat `InboxPage.jsx` ichida
 * edi ("Universal Inbox" MVP), endi Biznes Buyruq Markazi
 * (`BusinessCommandCenterPage.jsx`) ham AYNAN SHU kartani ishlatadi
 * (2026-09, foydalanuvchi so'rovi: "Buyruqlar markazidagi buyruqlar
 * qani, bu yerda hisobotdan bolak hech narsa yoqku" — sahifa nomiga mos
 * ravishda HAQIQIY, tasdiqlash/rad etish mumkin bo'lgan buyruqlar
 * qo'shildi). Ikkala joyda ham bir xil ko'rinish/xulq-atvor uchun umumiy
 * komponentga chiqarildi — ilgari ikkita joyda mantiqan bir xil, lekin
 * alohida-alohida yozilgan kod yo'q.
 */
const SEGMENT_KEYS = {
  vip: "segmentVip", churn: "segmentChurn", high_value: "segmentHighValue", sleeping: "segmentSleeping",
  churn_risk: "segmentChurnRisk", at_risk: "segmentAtRisk", new: "segmentNew", returning: "segmentReturning", all: "segmentAll",
};
const STATUS_KEYS = { pending: "statusPending", executed: "statusExecuted", rejected: "statusRejected", failed: "statusFailed" };
const STATUS_STYLES = {
  pending: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  executed: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500",
  failed: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
};
const RISK_KEYS = { LOW: "riskLow", MEDIUM: "riskMedium", HIGH: "riskHigh" };
const RISK_STYLES = {
  LOW: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  MEDIUM: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HIGH: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const AiCeoActionCard = ({ action, id, t, onRespond, responding, respondError }) => {
  const segmentLabel = t(`inbox.${SEGMENT_KEYS[action.segment] || "segmentVip"}`);
  const statusLabel = t(`inbox.${STATUS_KEYS[action.status] || "statusPending"}`);
  const statusStyle = STATUS_STYLES[action.status] || STATUS_STYLES.pending;
  const riskKey = RISK_KEYS[action.riskLevel];
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

export default AiCeoActionCard;
