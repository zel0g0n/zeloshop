import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Workflow, Trash2, Loader2, Crown, ChevronRight, Clock, PackageX, AlertTriangle, Send, Megaphone,
  TrendingDown, Percent, Truck,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import { useAutomationRules } from "@/hooks/seller/useAutomationRules";
import CustomSelect from "@/components/ui/CustomSelect";
import BiznesBadge from "@/components/ui/BiznesBadge";

const TRIGGER_ICONS = {
  customer_inactive: Clock,
  order_undelivered: PackageX,
  low_stock: AlertTriangle,
  slow_moving_product: TrendingDown,
  courier_delay: Truck,
};
const ACTION_ICONS = { notify_customer_telegram: Send, alert_manager: Megaphone, apply_discount: Percent };

const DEFAULT_TRIGGER_PARAMS = {
  customer_inactive: { days: 30, vipOnly: false },
  order_undelivered: { hours: 72 },
  low_stock: { threshold: 5 },
  slow_moving_product: { days: 30 },
  courier_delay: { hours: 3 },
};
const DEFAULT_DISCOUNT_PERCENT = 15;
const DEFAULT_DISCOUNT_DURATION_DAYS = 14;

/**
 * ADVANCED AUTOMATION (Z-Biznes, 2026-09 punkt-royxati, 5-band) —
 * sotuvchi O'ZI WHEN -> IF -> THEN qoidalarini quradigan sahifa.
 * `BundleManagementPage.jsx` bilan BIR XIL me'moriy naqsh (klient
 * to'g'ridan-to'g'ri Firestore'ga yozadi, `firestore.rules` himoya
 * qiladi) — lekin bu yerda IJRO alohida, serverdagi soatlik cron
 * orqali (`functions/automationRules.js`), batafsil izoh o'sha faylda.
 *
 * MUHIM: `notify_customer_telegram` harakati FAQAT `customer_inactive`,
 * `apply_discount` esa FAQAT `slow_moving_product` trigger'i bilan mos
 * keladi (birinchisida `clientId`, ikkinchisida `price` mavjud) — bu
 * cheklov `firestore.rules`da HAM, backendda HAM, shu yerdagi formada
 * HAM (harakat tanlovi dinamik ravishda cheklanadi) qo'llanadi.
 */
const AutomationRulesPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";
  const { rules, loading, create, remove, toggleActive } = useAutomationRules(sellerId);

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("customer_inactive");
  const [triggerParams, setTriggerParams] = useState(DEFAULT_TRIGGER_PARAMS.customer_inactive);
  const [actionType, setActionType] = useState("notify_customer_telegram");
  const [message, setMessage] = useState("");
  const [discountPercent, setDiscountPercent] = useState(DEFAULT_DISCOUNT_PERCENT);
  const [discountDurationDays, setDiscountDurationDays] = useState(DEFAULT_DISCOUNT_DURATION_DAYS);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const triggerOptions = useMemo(() => ([
    { value: "customer_inactive", label: t("automationRules.trigger.customer_inactive") },
    { value: "order_undelivered", label: t("automationRules.trigger.order_undelivered") },
    { value: "low_stock", label: t("automationRules.trigger.low_stock") },
    { value: "slow_moving_product", label: t("automationRules.trigger.slow_moving_product") },
    { value: "courier_delay", label: t("automationRules.trigger.courier_delay") },
  ]), [t]);

  // `CustomSelect` variantlar ichida `disabled` bayrog'ini QO'LLAMAYDI
  // (faqat butun tanlovni o'chirib qo'yish mumkin) — shuning uchun
  // "Mijozga xabar" harakati faqat `customer_inactive`, "Avtomatik
  // chegirma" esa faqat `slow_moving_product` trigger'i tanlanganda
  // RO'YXATGA UMUMAN qo'shiladi (backend/`firestore.rules` bilan BIR
  // XIL cheklov, faqat UI darajasida).
  const actionOptions = useMemo(() => ([
    ...(triggerType === "customer_inactive"
      ? [{ value: "notify_customer_telegram", label: t("automationRules.action.notify_customer_telegram") }]
      : []),
    ...(triggerType === "slow_moving_product"
      ? [{ value: "apply_discount", label: t("automationRules.action.apply_discount") }]
      : []),
    { value: "alert_manager", label: t("automationRules.action.alert_manager") },
  ]), [t, triggerType]);

  const handleTriggerTypeChange = useCallback((next) => {
    setTriggerType(next);
    setTriggerParams(DEFAULT_TRIGGER_PARAMS[next]);
    // "Mijozga xabar" harakati faqat "mijoz faolsizligi", "Avtomatik
    // chegirma" esa faqat "kam sotilayotgan mahsulot" trigger'i bilan
    // mos - mos kelmaydigan trigger tanlansa, avtomatik "menejerga
    // ogohlantirish"ga o'tkaziladi (foydalanuvchi noto'g'ri kombinatsiya
    // yubormasligi uchun).
    if (next !== "customer_inactive" && actionType === "notify_customer_telegram") {
      setActionType("alert_manager");
    }
    if (next !== "slow_moving_product" && actionType === "apply_discount") {
      setActionType("alert_manager");
    }
  }, [actionType]);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError(t("automationRules.nameRequired"));
      return;
    }

    setCreating(true);
    try {
      const resolvedTriggerParams =
        triggerType === "customer_inactive" ? { days: Number(triggerParams.days) || 30, segment: triggerParams.vipOnly ? "vip" : undefined } :
        triggerType === "order_undelivered" ? { hours: Number(triggerParams.hours) || 72 } :
        triggerType === "low_stock" ? { threshold: Number(triggerParams.threshold) || 5 } :
        triggerType === "slow_moving_product" ? { days: Number(triggerParams.days) || 30 } :
        { hours: Number(triggerParams.hours) || 3 }; // courier_delay

      const resolvedActionParams = actionType === "apply_discount"
        ? { discountPercent: Number(discountPercent) || DEFAULT_DISCOUNT_PERCENT, durationDays: Number(discountDurationDays) || DEFAULT_DISCOUNT_DURATION_DAYS }
        : (message.trim() ? { message: message.trim() } : {});

      await create({ name, triggerType, triggerParams: resolvedTriggerParams, actionType, actionParams: resolvedActionParams });
      setName("");
      setMessage("");
      setDiscountPercent(DEFAULT_DISCOUNT_PERCENT);
      setDiscountDurationDays(DEFAULT_DISCOUNT_DURATION_DAYS);
      setTriggerType("customer_inactive");
      setTriggerParams(DEFAULT_TRIGGER_PARAMS.customer_inactive);
      setActionType("notify_customer_telegram");
    } catch (err) {
      setFormError(err.message || t("automationRules.createError"));
    } finally {
      setCreating(false);
    }
  }, [name, triggerType, triggerParams, actionType, message, discountPercent, discountDurationDays, create, t]);

  const handleToggle = useCallback(async (rule) => {
    setBusyId(rule.id);
    try {
      await toggleActive(rule.id, !rule.isActive);
    } finally {
      setBusyId(null);
    }
  }, [toggleActive]);

  const handleDelete = useCallback(async (ruleId) => {
    setBusyId(ruleId);
    try {
      await remove(ruleId);
    } finally {
      setBusyId(null);
    }
  }, [remove]);

  const describeTrigger = useCallback((rule) => {
    if (rule.triggerType === "customer_inactive") {
      const days = rule.triggerParams?.days || 30;
      const vip = rule.triggerParams?.segment === "vip";
      return t("automationRules.summary.customerInactive", { days }) + (vip ? ` (${t("automationRules.summary.vipOnly")})` : "");
    }
    if (rule.triggerType === "order_undelivered") {
      return t("automationRules.summary.orderUndelivered", { hours: rule.triggerParams?.hours || 72 });
    }
    if (rule.triggerType === "slow_moving_product") {
      return t("automationRules.summary.slowMovingProduct", { days: rule.triggerParams?.days || 30 });
    }
    if (rule.triggerType === "courier_delay") {
      return t("automationRules.summary.courierDelay", { hours: rule.triggerParams?.hours || 3 });
    }
    return t("automationRules.summary.lowStock", { threshold: rule.triggerParams?.threshold || 5 });
  }, [t]);

  if (!isBiznes) {
    return (
      <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">
        <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-white">{t("automationRules.title")}</h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("automationRules.subtitle")}</p>
          </div>
        </div>
        <div className="p-4">
          <button
            type="button"
            onClick={() => navigate("/seller/tariffs")}
            className="w-full flex items-center gap-3 text-left bg-amber-50 dark:bg-amber-500/10 rounded-2xl px-4 py-4 text-sm font-bold text-amber-700 dark:text-amber-400 active:scale-[0.98] transition-transform"
          >
            <Crown size={18} className="shrink-0" />
            <span className="flex-1 leading-relaxed">{t("automationRules.requiresBiznes")}</span>
            <ChevronRight size={16} className="shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
            {t("automationRules.title")} <BiznesBadge size="xs" />
          </h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("automationRules.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Workflow size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">{t("automationRules.newRuleTitle")}</h3>
          </div>

          <input
            type="text"
            disabled={creating}
            placeholder={t("automationRules.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />

          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.whenLabel")}</label>
            <div className="mt-1">
              <CustomSelect value={triggerType} onChange={handleTriggerTypeChange} options={triggerOptions} disabled={creating} />
            </div>
          </div>

          {triggerType === "customer_inactive" && (
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.daysLabel")}</label>
                <input
                  type="number" min={1} max={365} disabled={creating}
                  value={triggerParams.days}
                  onChange={(e) => setTriggerParams((p) => ({ ...p, days: e.target.value }))}
                  className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
              <label className="flex items-center gap-2 h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox" disabled={creating}
                  checked={triggerParams.vipOnly}
                  onChange={(e) => setTriggerParams((p) => ({ ...p, vipOnly: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{t("automationRules.vipOnlyLabel")}</span>
              </label>
            </div>
          )}

          {triggerType === "order_undelivered" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.hoursLabel")}</label>
              <input
                type="number" min={1} max={720} disabled={creating}
                value={triggerParams.hours}
                onChange={(e) => setTriggerParams((p) => ({ ...p, hours: e.target.value }))}
                className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          )}

          {triggerType === "low_stock" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.thresholdLabel")}</label>
              <input
                type="number" min={1} max={1000} disabled={creating}
                value={triggerParams.threshold}
                onChange={(e) => setTriggerParams((p) => ({ ...p, threshold: e.target.value }))}
                className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          )}

          {triggerType === "slow_moving_product" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.slowMovingDaysLabel")}</label>
              <input
                type="number" min={7} max={180} disabled={creating}
                value={triggerParams.days}
                onChange={(e) => setTriggerParams((p) => ({ ...p, days: e.target.value }))}
                className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          )}

          {triggerType === "courier_delay" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.courierDelayHoursLabel")}</label>
              <input
                type="number" min={1} max={72} disabled={creating}
                value={triggerParams.hours}
                onChange={(e) => setTriggerParams((p) => ({ ...p, hours: e.target.value }))}
                className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.thenLabel")}</label>
            <div className="mt-1">
              <CustomSelect value={actionType} onChange={setActionType} options={actionOptions} disabled={creating} />
            </div>
          </div>

          {actionType === "apply_discount" ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.discountPercentLabel")}</label>
                <input
                  type="number" min={5} max={70} disabled={creating}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("automationRules.discountDurationLabel")}</label>
                <input
                  type="number" min={1} max={90} disabled={creating}
                  value={discountDurationDays}
                  onChange={(e) => setDiscountDurationDays(e.target.value)}
                  className="w-full h-10 mt-1 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {actionType === "notify_customer_telegram" ? t("automationRules.messageLabelCustomer") : t("automationRules.messageLabelManager")}
              </label>
              <textarea
                rows={2} disabled={creating}
                placeholder={actionType === "notify_customer_telegram" ? t("automationRules.messagePlaceholderCustomer") : t("automationRules.messagePlaceholderManager")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 resize-none"
              />
              {actionType === "notify_customer_telegram" && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t("automationRules.personalizeHint")}</p>
              )}
            </div>
          )}

          {formError && <p className="text-[11px] text-rose-500 font-semibold">{formError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Workflow size={14} /> {creating ? t("automationRules.creating") : t("automationRules.createButton")}
          </button>
        </form>

        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{t("automationRules.activeRulesTitle")}</h3>

          {loading && <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">{t("automationRules.loading")}</p>}

          {!loading && rules.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">{t("automationRules.noRules")}</p>
          )}

          {!loading && rules.map((rule) => {
            const TriggerIcon = TRIGGER_ICONS[rule.triggerType] || Clock;
            const ActionIcon = ACTION_ICONS[rule.actionType] || Megaphone;
            return (
              <div key={rule.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-white truncate">{rule.name}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      <TriggerIcon size={11} className="shrink-0" />
                      <span className="truncate">{describeTrigger(rule)}</span>
                      <ChevronRight size={11} className="shrink-0" />
                      <ActionIcon size={11} className="shrink-0" />
                      <span className="truncate">{t(`automationRules.action.${rule.actionType}`)}</span>
                    </div>
                    {rule.stats?.firedCount > 0 && (
                      <p className="text-[10px] text-emerald-500 font-bold mt-1">
                        {t("automationRules.firedCount", { count: rule.stats.firedCount })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(rule)}
                      disabled={busyId === rule.id}
                      className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors disabled:opacity-50 ${rule.isActive ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule.id)}
                      disabled={busyId === rule.id}
                      className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 disabled:opacity-50"
                      aria-label={t("automationRules.deleteAria")}
                    >
                      {busyId === rule.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AutomationRulesPage;
