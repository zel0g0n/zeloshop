import { memo, useMemo, useState } from "react";
import { X, Check, Clock3 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { dayKeyOf, hourLabelOf, formatDeliveryDayLabel } from "@/utils/deliverySlots";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * Checkout'da "Yetkazib berish vaqti" bosqichi - `MonthPickerSheet.jsx`
 * bilan BIR XIL bottom-sheet vizual naqshi (2026-09 punkt-royxati,
 * 15-band). Kunlar gorizontal chip qatorida (Bugun/Ertaga/sana),
 * tanlangan kun ostida esa shu kunning bo'sh 1-soatlik oraliqlari
 * panjara (grid) ko'rinishida.
 *
 * `slots` — `generateDeliverySlots()` (`src/utils/deliverySlots.js`)
 * natijasi, ALLAQACHON minimal kutish vaqti + do'kon ish vaqti bilan
 * FILTRLANGAN holda keladi - bu komponent faqat kun bo'yicha
 * GURUHLAYDI va tanlash UX'ini beradi, o'zi hech qanday qo'shimcha
 * filtr qo'llamaydi.
 */
// `todayKey` — chaqiruvchidan (`Checkout.jsx`, uning barqaror
// `mountedAtMs`idan hisoblangan) MAJBURIY beriladi, komponentning O'ZI
// `Date.now()`ni render vaqtida chaqirmaydi (`react-hooks/purity`).
const DeliverySlotSheet = ({ slots = [], selected, todayKey, onSelect, onClose }) => {
  const { t } = useLanguage();

  useEscapeToClose(onClose);

  const days = useMemo(() => {
    const map = new Map();
    slots.forEach((slot) => {
      const key = dayKeyOf(slot.startMs);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(slot);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([key, daySlots]) => ({ key, slots: daySlots }));
  }, [slots]);

  const selectedKey = selected ? dayKeyOf(selected.startMs) : null;
  const [activeDayKey, setActiveDayKey] = useState(selectedKey ?? days[0]?.key ?? null);
  const activeDay = days.find((d) => d.key === activeDayKey) || days[0];

  const dayLabel = (key) => formatDeliveryDayLabel(key, todayKey, t);

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-end justify-center animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-3 shadow-xl border-t border-slate-100 dark:border-slate-800 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 sticky -top-5 bg-white dark:bg-slate-900 pt-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock3 size={15} />
            </span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("checkout.deliverySlotSheetTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center shrink-0"
          >
            <X size={13} />
          </button>
        </div>

        {days.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">{t("checkout.deliverySlotEmpty")}</p>
        ) : (
          <>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {days.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActiveDayKey(d.key)}
                  className={`shrink-0 h-9 px-3.5 rounded-xl text-[11px] font-bold transition-colors ${
                    activeDayKey === d.key ? "bg-indigo-600 text-white" : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {dayLabel(d.key)}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {(activeDay?.slots || []).map((slot) => {
                const isSelected = selected?.startMs === slot.startMs;
                return (
                  <button
                    key={slot.startMs}
                    type="button"
                    onClick={() => { onSelect(slot); onClose(); }}
                    className={`flex items-center justify-center gap-1 h-11 rounded-xl border text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {isSelected && <Check size={11} strokeWidth={3} />}
                    {hourLabelOf(slot.startMs)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(DeliverySlotSheet);
