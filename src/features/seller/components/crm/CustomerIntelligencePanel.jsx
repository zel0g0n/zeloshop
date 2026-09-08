import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown, Star, Gem, Moon, AlertTriangle, Clock, Sparkles, RefreshCw,
  Percent, Flame, ChevronRight, X, Phone, MessageCircle, Loader2, RotateCw,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import useCustomerIntelligence from "@/hooks/seller/useCustomerIntelligence";
import { filterClassifiedCustomers } from "@/utils/customerIntelligence";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import BiznesBadge from "@/components/ui/BiznesBadge";

const SEGMENT_ICONS = {
  all: Crown, vip: Star, high_value: Gem, sleeping: Moon, churn_risk: AlertTriangle,
  at_risk: Clock, new: Sparkles, returning: RefreshCw,
};

const SEGMENT_STYLE = {
  vip: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  high_value: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
  sleeping: "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  churn_risk: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
  at_risk: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  new: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  returning: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const TAG_ICONS = { discount_hunter: Percent, high_intent: Flame };
const TAG_STYLE = {
  discount_hunter: "bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30",
  high_intent: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
};

/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — CRM Hub'ning YUQORIDAGI, Z-Pro
 * 4-segmentli (`SEGMENT_META`/`useCustomerSegments`) bo'limidan
 * ATAYLAB ALOHIDA, QO'SHIMCHA panel. Ular BIRLASHTIRILMAGAN (ustiga
 * qurilmagan) — ikkalasi ham mustaqil ishlaydi, chunki bu yerdagi
 * 7-segment+2-belgi tasnifi FAQAT server tomonida (`getCustomerIntelligence`
 * onCall, batafsil izoh: `useCustomerIntelligence` hook'i) hisoblanadi
 * ("high_intent" belgisi uchun `carts`/`favorites`ni o'qish kerak,
 * ular esa sotuvchiga ham yopiq).
 *
 * Shu sababli bu panelning O'Z, sodda mijoz kartochkasi/tafsilot
 * ko'rinishi bor (izohlar/xaridlar tarixisiz — ular kerak bo'lsa,
 * sotuvchi yuqoridagi asosiy ro'yxatdan o'sha mijozni topishi mumkin)
 * — mavjud, ishlab turgan CRM modalini qayta qurish/murakkablashtirish
 * o'rniga.
 */
const CustomerIntelligencePanel = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";

  const { data, loading, error, refetch } = useCustomerIntelligence(isBiznes);
  const [activeSegment, setActiveSegment] = useState("all");
  const [activeTag, setActiveTag] = useState(null);
  const [selected, setSelected] = useState(null);
  useEscapeToClose(() => setSelected(null), Boolean(selected));

  const visibleCustomers = useMemo(
    () => filterClassifiedCustomers(data?.customers, { segment: activeSegment, tag: activeTag }),
    [data, activeSegment, activeTag]
  );

  const SEGMENT_KEYS = ["all", "vip", "high_value", "sleeping", "churn_risk", "at_risk", "new", "returning"];
  const TAG_KEYS = ["discount_hunter", "high_intent"];

  if (!isBiznes) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Crown size={13} className="text-amber-500" /> {t("customerIntelligence.title")}
        </h3>
        <button
          type="button"
          onClick={() => navigate("/seller/tariffs")}
          className="w-full flex items-center gap-2 text-left bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 active:scale-[0.98] transition-transform"
        >
          <Crown size={13} className="shrink-0" />
          <span className="flex-1 leading-relaxed">{t("customerIntelligence.requiresBiznes")}</span>
          <ChevronRight size={12} className="shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {t("customerIntelligence.title")} <BiznesBadge size="xs" />
        </h3>
        <button
          type="button"
          onClick={refetch}
          disabled={loading}
          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-500 disabled:opacity-50 transition-colors"
          aria-label={t("customerIntelligence.refresh")}
        >
          <RotateCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed -mt-1.5">{t("customerIntelligence.subtitle")}</p>

      {error && <p className="text-[11px] text-rose-400 font-semibold">{error}</p>}

      {loading && !data && <GridSkeleton count={2} />}

      {data && (
        <>
          {data.isApproximate && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 rounded-xl px-3 py-2">
              {t("customerIntelligence.approximateNotice")}
            </div>
          )}

          {/* SEGMENT CHIPS */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {SEGMENT_KEYS.map((key) => {
              const Icon = SEGMENT_ICONS[key];
              const isActive = activeSegment === key;
              const count = key === "all" ? data.counts.all : data.counts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSegment(key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                  }`}
                >
                  <Icon size={13} />
                  <span className="text-[11px] font-bold whitespace-nowrap">{t(`customerIntelligence.segment.${key}`)} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* TAG TOGGLES */}
          <div className="flex items-center gap-1.5">
            {TAG_KEYS.map((key) => {
              const Icon = TAG_ICONS[key];
              const isActive = activeTag === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTag(isActive ? null : key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${
                    isActive ? TAG_STYLE[key] : "bg-[#F4F5F9] dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800"
                  }`}
                >
                  <Icon size={13} />
                  <span className="text-[11px] font-bold whitespace-nowrap">
                    {t(`customerIntelligence.tag.${key}`)} ({data.tagCounts[key] || 0})
                  </span>
                </button>
              );
            })}
          </div>

          {/* CUSTOMER LIST */}
          <div className="space-y-2">
            {visibleCustomers.length === 0 && (
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">{t("customerIntelligence.noCustomers")}</p>
            )}
            {visibleCustomers.slice(0, 50).map((c) => {
              const initial = (c.fullName || "?").trim().charAt(0).toUpperCase();
              return (
                <div
                  key={c.clientId}
                  onClick={() => setSelected(c)}
                  className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.fullName}</p>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${SEGMENT_STYLE[c.primarySegment]}`}>
                          {t(`customerIntelligence.segment.${c.primarySegment}`)}
                        </span>
                        {c.tags.map((tag) => (
                          <span key={tag} className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${TAG_STYLE[tag]}`}>
                            {t(`customerIntelligence.tag.${tag}`)}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {c.orderCount} {t("crmHub.orderCountSuffix")} · {c.daysSinceLastOrder} {t("crmHub.daysAgoSuffix")}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-400 shrink-0">{c.ltv.toLocaleString()} so'm</span>
                </div>
              );
            })}
            {visibleCustomers.length > 50 && (
              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                {t("customerIntelligence.andMore", { count: visibleCustomers.length - 50 })}
              </p>
            )}
          </div>
        </>
      )}

      {/* DETAIL FLYOUT */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-t-3xl p-4 pb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-indigo-500/15 text-indigo-400 font-black text-base flex items-center justify-center shrink-0">
                  {(selected.fullName || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selected.fullName}</p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${SEGMENT_STYLE[selected.primarySegment]}`}>
                      {t(`customerIntelligence.segment.${selected.primarySegment}`)}
                    </span>
                    {selected.tags.map((tag) => (
                      <span key={tag} className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${TAG_STYLE[tag]}`}>
                        {t(`customerIntelligence.tag.${tag}`)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="h-10 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Phone size={13} /> {t("crmHub.callBtn")}
                </a>
              )}
              <a href={`tg://user?id=${selected.clientId}`} className="h-10 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <MessageCircle size={13} /> {t("crmHub.telegramBtn")}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.totalSpent")}</p>
                <p className="text-sm font-black text-emerald-400">{selected.ltv.toLocaleString()} so'm</p>
              </div>
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.ordersLabel")}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{selected.orderCount} ta</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && data && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 py-1">
          <Loader2 size={11} className="animate-spin" /> {t("customerIntelligence.refreshing")}
        </div>
      )}
    </div>
  );
};

export default CustomerIntelligencePanel;
