import { useState, useEffect, useCallback } from "react";
import { Check, X, Clock, Settings2, Save } from "lucide-react";
import useManualTariffPayments from "@/hooks/admin/useManualTariffPayments";
import getManualTariffPaymentInfo from "@/services/tariffs/getManualTariffPaymentInfo";
import updateManualTariffPaymentSettings from "@/services/admin/updateManualTariffPaymentSettings";
import { ListSkeleton } from "@/components/ui/Skeleton";

const PLAN_LABELS = { start: "Z-Start", pro: "Z-Pro", biznes: "Z-Biznes" };

function formatRequestTime(createdAt) {
  if (!createdAt) return "hozirgina";
  const date = typeof createdAt.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "hozirgina";
  return date.toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Admin panelidagi "To'lov tekshiruvi" bo'limi (2026-09-25) —
 * `AdminTariffRequestsPage.jsx`dagi eski, chekvsiz "qiziqish
 * bildirish" oqimidan BUTUNLAY ALOHIDA: bu yerda sotuvchi HAQIQATAN
 * ZeloShop kartasiga o'tkazma qilib, to'lov chekining skrinshotini
 * yuklagan — admin shu chekni ko'rib, o'z kartasiga pul tushganini
 * TASHQARIDA (bank ilovasi) tekshirib, so'ng tasdiqlaydi yoki rad
 * etadi. Batafsil izoh: `functions/manualTariffPayments.js`.
 *
 * Ikki qism: (1) yuqorida — ZeloShop'ning qo'lda-to'lov uchun karta
 * raqami/egasi F.I.SH.ini sozlash formasi (bir marta kiritiladi,
 * keyin kerak bo'lganda yangilanadi), (2) pastda — ko'rib chiqilishi
 * kerak bo'lgan to'lovlar ro'yxati (chek skrinshoti bilan).
 */
const AdminManualTariffPaymentsPage = () => {
  const { payments, loading, error, resolvingId, resolveError, resolve } = useManualTariffPayments();

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getManualTariffPaymentInfo()
      .then((info) => {
        if (cancelled) return;
        setCardNumber(info.cardNumber || "");
        setCardHolderName(info.cardHolderName || "");
        setEnabled(info.cardNumber ? info.enabled : true);
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveSettings = useCallback(
    async (e) => {
      e.preventDefault();
      setSettingsSaving(true);
      setSettingsError(null);
      setSettingsSaved(false);
      try {
        await updateManualTariffPaymentSettings({ cardNumber, cardHolderName, enabled });
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2500);
      } catch (err) {
        setSettingsError(err.message || "Sozlamani saqlab bo'lmadi.");
      } finally {
        setSettingsSaving(false);
      }
    },
    [cardNumber, cardHolderName, enabled]
  );

  const handleApprove = useCallback(
    (payment) => {
      resolve(payment, "approve");
    },
    [resolve]
  );

  const handleReject = useCallback(
    (payment) => {
      resolve(payment, "reject", rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason("");
    },
    [resolve, rejectReason]
  );

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider">Qo'lda to'lov uchun karta</h3>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
          Bu yerda kiritilgan karta raqami va F.I.Sh. sotuvchilarga "Tariflar" sahifasida ko'rsatiladi — ular shu kartaga o'tkazma qilib, tarif to'laydi.
        </p>

        {settingsLoading ? (
          <p className="text-xs text-gray-400 dark:text-slate-500">Yuklanmoqda...</p>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Karta raqami</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="8600 1234 1234 1234"
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-mono font-bold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">Karta egasi F.I.Sh.</label>
              <input
                type="text"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value)}
                placeholder="ALIYEV ALI"
                className="w-full h-11 px-3.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-bold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-100 dark:border-slate-800"
            >
              <span className="text-xs font-bold text-gray-600 dark:text-slate-300">Sotuvchilarga ko'rsatilsin</span>
              <span className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${enabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}>
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </span>
            </button>
            {settingsError && <p className="text-[11px] text-rose-500 font-semibold">{settingsError}</p>}
            <button
              type="submit"
              disabled={settingsSaving}
              className="w-full h-10 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Save size={13} /> {settingsSaving ? "Saqlanmoqda..." : settingsSaved ? "Saqlandi!" : "Saqlash"}
            </button>
          </form>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider px-1">Ko'rib chiqilishi kerak</h3>

        {loading && <ListSkeleton count={3} />}

        {!loading && error && <div className="text-center py-16 text-sm text-rose-500 font-medium">Xatolik: {error}</div>}

        {!loading && !error && payments.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 dark:text-slate-500">Hozircha ko'rib chiqilishi kerak bo'lgan to'lov yo'q</div>
        )}

        {resolveError && <p className="text-xs text-rose-500 font-semibold text-center">{resolveError}</p>}

        {!loading && !error && payments.length > 0 && (
          <div className="space-y-3">
            {payments.map((payment) => {
              const isResolving = resolvingId === payment.id;
              const isRejecting = rejectingId === payment.id;
              return (
                <div key={payment.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{payment.storeName || "Nomsiz do'kon"}</h3>
                      <p className="text-[11px] text-gray-400 dark:text-slate-500">{payment.sellerPhone || "Telefon yo'q"}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-black px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Clock size={10} /> {formatRequestTime(payment.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white">{PLAN_LABELS[payment.plan] || payment.plan}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {(payment.amountSom || 0).toLocaleString()} so'm
                    </span>
                  </div>

                  {payment.receiptUrl && (
                    <button type="button" onClick={() => setPreviewUrl(payment.receiptUrl)} className="block">
                      <img
                        src={payment.receiptUrl}
                        alt="To'lov cheki"
                        className="w-28 h-28 object-cover rounded-xl border border-gray-200 dark:border-slate-700"
                      />
                    </button>
                  )}

                  {isRejecting ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rad etish sababi (ixtiyoriy)"
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setRejectingId(null); setRejectReason(""); }}
                          className="flex-1 h-9 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(payment)}
                          disabled={isResolving}
                          className="flex-1 h-9 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
                        >
                          {isResolving ? "..." : "Rad etishni tasdiqlash"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingId(payment.id)}
                        disabled={isResolving}
                        className="flex-1 h-9 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <X size={13} /> Rad etish
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApprove(payment)}
                        disabled={isResolving}
                        className="flex-1 h-9 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Check size={13} /> {isResolving ? "..." : "Tasdiqlash"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
          role="button"
          tabIndex={0}
        >
          <img src={previewUrl} alt="To'lov cheki" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
};

export default AdminManualTariffPaymentsPage;
