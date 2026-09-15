import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown, Star, Gem, Moon, AlertTriangle, Clock, Sparkles, RefreshCw,
  Percent, Flame, ChevronRight, X, Phone, MessageCircle, Loader2, RotateCw, Search, ListFilter,
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { filterClassifiedCustomers } from "@/utils/customerIntelligence";
import { getCustomerNote, saveCustomerNote } from "@/services/crm/customerNotes";
import { getCustomerOrderHistory } from "@/services/orders/getOrderData";
import { GridSkeleton } from "@/components/ui/Skeleton";
import CustomSelect from "@/components/ui/CustomSelect";
import Toast from "@/components/ui/Toast";
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

const SEGMENT_KEYS = ["all", "vip", "high_value", "sleeping", "churn_risk", "at_risk", "new", "returning"];
const TAG_KEYS = ["discount_hunter", "high_intent"];

/**
 * MIJOZLAR RAZVEDKASI (Advanced Customer Intelligence, Z-Biznes,
 * 2026-09 punkt-royxati, 9-band) — CRM Hub'ning YAGONA mijozlar
 * ro'yxati/tafsilot ko'rinishi.
 *
 * 2026-09 UX TUZATISHI (foydalanuvchi so'rovi): OLDIN bu panel VA
 * `CrmHub.jsx`ning O'ZI (Z-Pro'ning eski 4-segmentli qidiruv+tab+
 * ro'yxati) BIR SAHIFADA ikki marta, ketma-ket mijozlar ro'yxatini
 * ko'rsatardi - chalkash, dizaynni buzuvchi holat edi. Endi bu panel
 * YAGONA ro'yxat: qidiruv maydoni ENDI shu yerda (avval faqat
 * `CrmHub.jsx`da edi), va mijoz tafsiloti oynasi ham TO'LIQ (qo'ng'iroq/
 * Telegram, LTV/buyurtmalar, IZOH va XARIDLAR TARIXI bilan) - avvalgi
 * `CrmHub.jsx`ning "Customer Detail Modal"idan shu yerga ko'chirildi
 * (chunki endi mijozni bosishning YAGONA yo'li shu yerdan).
 *
 * Segment/belgi filtrlari ENDI select (tanlash) dizaynida - avvalgi
 * gorizontal skrol qiluvchi tab-tugmalar juda uzun bo'lib ketgani
 * uchun (2026-09, foydalanuvchi so'rovi).
 *
 * `data`/`loading`/`error`/`refetch`/`isBiznes` — YUQORIDAN
 * (`CrmHub.jsx`) beriladi: shu bir xil `useCustomerIntelligence`
 * natijasi endi "Mijozlarga xabar yuborish" auditoriyasini tanlashda
 * HAM ishlatiladi (3-band), shuning uchun hook faqat BIR MARTA,
 * ota komponentda chaqiriladi - ikki marta server so'rovi yubormaslik
 * uchun.
 */
const CustomerIntelligencePanel = ({ data, loading, error, refetch, isBiznes }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId } = useSession();

  const [searchText, setSearchText] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");
  const [activeTag, setActiveTag] = useState("none");
  const [selected, setSelected] = useState(null);
  useEscapeToClose(() => setSelected(null), Boolean(selected));

  // Mijoz kartochkasi bosilganda, o'sha mijoz haqidagi saqlangan izoh
  // va to'liq xarid tarixi talab bo'yicha yuklanadi (`CrmHub.jsx`dagi
  // AVVALGI mantiq bilan BIR XIL - endi shu yerga ko'chirilgan).
  const [customerNote, setCustomerNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteToast, setNoteToast] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);

  useEffect(() => {
    if (!selected || !sellerId) return;
    let cancelled = false;
    setNoteLoading(true);
    getCustomerNote(sellerId, selected.clientId)
      .then((note) => { if (!cancelled) setCustomerNote(note); })
      .catch(() => { if (!cancelled) setCustomerNote(""); })
      .finally(() => { if (!cancelled) setNoteLoading(false); });
    return () => { cancelled = true; };
  }, [selected, sellerId]);

  useEffect(() => {
    if (!selected || !sellerId) {
      setCustomerOrders([]);
      setCustomerOrdersLoading(false);
      return;
    }
    setCustomerOrdersLoading(true);
    const unsubscribe = getCustomerOrderHistory(
      sellerId,
      selected.clientId,
      (orders) => {
        setCustomerOrders(orders);
        setCustomerOrdersLoading(false);
      },
      () => {
        setCustomerOrders([]);
        setCustomerOrdersLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selected, sellerId]);

  const handleSaveNote = useCallback(async () => {
    if (!selected) return;
    setNoteSaving(true);
    try {
      await saveCustomerNote(sellerId, selected.clientId, customerNote);
      setNoteToast(t("crmHub.noteSaved"));
    } catch {
      setNoteToast(t("crmHub.noteSaveFailed"));
    } finally {
      setNoteSaving(false);
    }
  }, [sellerId, selected, customerNote, t]);

  const visibleCustomers = useMemo(
    () => filterClassifiedCustomers(data?.customers, {
      segment: activeSegment,
      tag: activeTag === "none" ? null : activeTag,
      searchText,
    }),
    [data, activeSegment, activeTag, searchText]
  );

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

  const segmentOptions = SEGMENT_KEYS.map((key) => ({
    value: key,
    label: `${t(`customerIntelligence.segment.${key}`)} (${data ? (key === "all" ? data.counts.all : data.counts[key] || 0) : 0})`,
    icon: SEGMENT_ICONS[key],
  }));
  const tagOptions = [
    { value: "none", label: t("customerIntelligence.tagNone"), icon: ListFilter },
    ...TAG_KEYS.map((key) => ({
      value: key,
      label: `${t(`customerIntelligence.tag.${key}`)} (${data?.tagCounts?.[key] || 0})`,
      icon: TAG_ICONS[key],
    })),
  ];

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

          {/* QIDIRUV — avval faqat `CrmHub.jsx`ning eski (endi olib
              tashlangan) ro'yxatida edi, endi shu yerga ko'chirilgan. */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t("crmHub.searchPlaceholder")}
              className="w-full h-10 pl-9 pr-3 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* SEGMENT/BELGI FILTRLARI — gorizontal skrol qiluvchi
              tab-tugmalar o'rniga, ikonkalar bilan SELECT (2026-09,
              foydalanuvchi so'rovi: "gorizontal skrol juda uzun"). */}
          <div className="grid grid-cols-2 gap-2">
            <CustomSelect value={activeSegment} onChange={setActiveSegment} options={segmentOptions} />
            <CustomSelect value={activeTag} onChange={setActiveTag} options={tagOptions} />
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

      {/* MIJOZ TAFSILOTI (to'liq) — qo'ng'iroq/Telegram, LTV/buyurtmalar,
          IZOH va XARIDLAR TARIXI (avvalgi `CrmHub.jsx`ning "Customer
          Detail Modal"idan shu yerga ko'chirilgan). */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-t-3xl p-4 pb-8 max-h-[85vh] overflow-y-auto animate-fade-in">
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

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.totalSpent")}</p>
                <p className="text-sm font-black text-emerald-400">{selected.ltv.toLocaleString()} so'm</p>
              </div>
              <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t("crmHub.ordersLabel")}</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{selected.orderCount} ta</p>
              </div>
            </div>

            {/* ADMIN IZOHI (Notes) */}
            <div className="mb-4">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">{t("crmHub.noteLabel")}</label>
              <textarea
                rows="2"
                disabled={noteLoading}
                placeholder={noteLoading ? t("crmHub.noteLoadingPlaceholder") : t("crmHub.notePlaceholder")}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="w-full p-2.5 bg-[#F4F5F9] dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving || noteLoading}
                className="mt-1.5 text-[10px] font-bold text-indigo-400 disabled:opacity-50"
              >
                {noteSaving ? t("crmHub.noteSaving") : t("crmHub.noteSaveBtn")}
              </button>
            </div>

            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t("crmHub.purchaseHistory")}</h4>
            <div className="space-y-2">
              {customerOrdersLoading && <GridSkeleton count={2} />}
              {!customerOrdersLoading && customerOrders.length === 0 && (
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">{t("crmHub.noOrdersYet")}</p>
              )}
              {!customerOrdersLoading && customerOrders.map((o) => (
                <div key={o.id} className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">#{o.id.slice(0, 6)}</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{Number(o.totalAmount || 0).toLocaleString()} so'm</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("uz-UZ") : ""}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 capitalize">{t(`orderStatus.${o.status}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {noteToast && <Toast message={noteToast} onDone={() => setNoteToast(null)} duration={1500} />}

      {loading && data && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 py-1">
          <Loader2 size={11} className="animate-spin" /> {t("customerIntelligence.refreshing")}
        </div>
      )}
    </div>
  );
};

export default CustomerIntelligencePanel;
