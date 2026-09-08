import { useEffect, useState, useCallback, useMemo } from "react";
import { Bike, Plus, Check, Send, Trash2, Loader2, X, PhoneCall } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getTelegramWebApp } from "@/config/telegram";
import { getCourierList } from "@/services/couriers/getCourierList";
import { createCourierInvite, setCourierActive, removeCourier } from "@/services/couriers/courierManagement";
import getOrderData from "@/services/orders/getOrderData";
import { computeCourierPerformance } from "@/utils/courierPerformanceStats";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatUzPhone, isValidUzPhone, hasMeaningfulPhoneDigits } from "@/utils/phone";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import { useExpenses } from "@/hooks/seller/useExpenses";
import PersonPerformancePanel from "@/features/seller/components/shared/PersonPerformancePanel";

/**
 * "Kuryerlar" bo'limining ICHKI KONTENTI — sarlavha/orqaga tugmasi/tashqi
 * to'liq ekran o'rovisiz (ATAYLAB shunday, chunki 2026-09 foydalanuvchi
 * so'roviga ko'ra bu endi IKKI joyda ishlatiladi: (1) mustaqil sahifa
 * sifatida `CourierManagementPage.jsx` orqali - `CourierPickerModal.jsx`
 * kabi joylardan chuqur havola bilan ochilganda, VA (2) `DeliverySettingsPage.jsx`
 * ichida UCHINCHI tab sifatida ("Narxlar"/"Yandex Delivery" bilan bir
 * qatorda) - Sozlamalar (`More.jsx`)dagi "Kuryerlar" alohida bandi
 * ENDI OLIB TASHLANGANI uchun.
 *
 * Mantiqning O'ZI (ro'yxat, taklif yaratish, faollashtirish/o'chirish)
 * `CourierManagementPage.jsx`dan O'ZGARISHSIZ ko'chirilgan - ikki marta
 * yozilmasin deb, `CourierManagementPage.jsx` endi shunchaki shu
 * komponentni sarlavha bilan o'raydi.
 */
const CourierManagementSection = () => {
  const { t } = useLanguage();
  const { sellerId } = useSession();

  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getCourierList(
      sellerId,
      (data) => { setCouriers(data); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsubscribe?.();
  }, [sellerId]);

  // 2026-09 punkt-royxati, 11-band: har bir kuryer uchun yetkazib
  // berish faoliyati statistikasi — do'konning TO'LIQ buyurtmalar
  // ro'yxatidan (`courierId`/`courierDeliveryStatus` bo'yicha,
  // `computeCourierPerformance`) hisoblanadi.
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getOrderData(sellerId, setOrders, () => setOrders([]));
    return () => unsubscribe?.();
  }, [sellerId]);

  const courierPerformanceById = useMemo(() => {
    const map = new Map();
    couriers.forEach((courier) => map.set(courier.id, computeCourierPerformance(orders, courier.id)));
    return map;
  }, [couriers, orders]);

  // 2026-09 punkt-royxati, 11-band: "batafsil statistika" paneli uchun
  // — `StaffManagementPage.jsx`dagi bilan BIR XIL manba va naqsh
  // (`useExpenses`, `linkedCourierId` bo'yicha mijoz tomonida filtr).
  const { expenses: allExpenses, create: createExpenseRaw } = useExpenses(sellerId);
  const handleAddCourierExpense = useCallback(
    (courierId) => (data) => createExpenseRaw({ ...data, linkedCourierId: courierId }),
    [createExpenseRaw]
  );

  // --- Yangi kuryer qo'shish ---
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newInviteLink, setNewInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCreateInvite = useCallback(async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError(t("courierManagement.errorNameRequired"));
      return;
    }
    // Telefon maydoni Checkout.jsx/EditProfile.jsx/CreateStoreScreen.jsx
    // bilan bir xil `formatUzPhone`/`isValidUzPhone` naqshidan
    // foydalanadi. Maydon ixtiyoriy bo'lgani uchun "998" mamlakat
    // kodidan keyingi raqamlar borligiga qarab tekshiriladi (shunda
    // faqat `onFocus` orqali "+998 " bilan "to'ldirilgan", lekin aslida
    // bo'sh qoldirilgan maydon xato bermaydi); haqiqiy raqam kiritilgan
    // bo'lsa, u to'liq (9 xonali) ekanligi tekshiriladi.
    const hasAnyPhoneDigits = hasMeaningfulPhoneDigits(phone);
    if (hasAnyPhoneDigits && !isValidUzPhone(phone)) {
      setCreateError(t("courierManagement.errorPhoneInvalid"));
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createCourierInvite(name.trim(), hasAnyPhoneDigits ? phone.trim() : "");
      setNewInviteLink(result.inviteLink);
      setName("");
      setPhone("");
    } catch (err) {
      setCreateError(err.message || t("courierManagement.errorCreateGeneric"));
    } finally {
      setCreating(false);
    }
  }, [name, phone, t]);

  const handleCopyInviteLink = useCallback(async () => {
    if (!newInviteLink) return;
    try {
      await navigator.clipboard.writeText(newInviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [newInviteLink]);

  const handleShareInviteLink = useCallback(async () => {
    if (!newInviteLink) return;
    const shareText = t("courierManagement.shareText");
    if (navigator.share) {
      try {
        await navigator.share({ title: t("courierManagement.shareTitle"), text: shareText, url: newInviteLink });
        return;
      } catch {
        return;
      }
    }
    const webApp = getTelegramWebApp();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(newInviteLink)}&text=${encodeURIComponent(shareText)}`;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [newInviteLink, t]);

  // --- Faollashtirish/o'chirish ---
  const [togglingId, setTogglingId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEscapeToClose(() => setNewInviteLink(null), Boolean(newInviteLink));

  const handleToggleActive = useCallback(async (courier) => {
    setTogglingId(courier.id);
    try {
      await setCourierActive(courier.id, courier.status !== "active");
    } catch {
      // Xato bo'lsa ham jim qolamiz - ro'yxat real-vaqtli, holat
      // o'zgarmasa sotuvchi buni ko'radi va qayta urinishi mumkin.
    } finally {
      setTogglingId(null);
    }
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeCourier(removeTarget.id);
      setRemoveTarget(null);
    } catch {
      // Xato bo'lsa modal ochiq qoladi - sotuvchi qayta urinishi mumkin.
    } finally {
      setRemoving(false);
    }
  }, [removeTarget]);

  return (
    <>
      <div className="p-4 space-y-4">
        {/* YANGI KURYER QO'SHISH */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center shrink-0">
              <Bike size={20} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("courierManagement.addCourierDesc")}
            </p>
          </div>

          <form onSubmit={handleCreateInvite} className="space-y-2">
            <input
              type="text"
              disabled={creating}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("courierManagement.namePlaceholder")}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
            />
            <input
              type="tel"
              inputMode="numeric"
              maxLength={17}
              disabled={creating}
              value={phone}
              onFocus={() => { if (!phone) setPhone("+998 "); }}
              onChange={(e) => setPhone(formatUzPhone(e.target.value))}
              placeholder={t("courierManagement.phonePlaceholder")}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
            />
            {createError && <p className="text-[11px] text-rose-500 font-semibold">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? t("courierManagement.creating") : t("courierManagement.createButton")}
            </button>
          </form>
        </div>

        {/* RO'YXAT */}
        <div className="space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
            {t("courierManagement.listTitle")} {couriers.length > 0 ? `(${couriers.length})` : ""}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-teal-500" />
            </div>
          ) : couriers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t("courierManagement.listEmpty")}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
              {couriers.map((courier) => {
                const isActive = courier.status === "active";
                const stats = courierPerformanceById.get(courier.id);
                return (
                  <div key={courier.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center">
                          <Bike size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{courier.name}</h4>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 truncate">
                            {courier.phone ? (<><PhoneCall size={10} /> {courier.phone}</>) : (isActive ? t("courierManagement.statusActive") : t("courierManagement.statusInactive"))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(courier)}
                          disabled={togglingId === courier.id}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${isActive ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                          aria-label={isActive ? t("courierManagement.deactivateAria") : t("courierManagement.activateAria")}
                        >
                          <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${isActive ? "translate-x-5" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(courier)}
                          className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center"
                          aria-label={t("courierManagement.removeAria")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* 2026-09 punkt-royxati, 11-band: "nazorat va
                        boshqarish" — yetkazib berish faoliyati VA shu
                        kuryerga bog'langan xarajatlar (masalan
                        yoqilg'i puli) bitta batafsil panelda. */}
                    <PersonPerformancePanel
                      type="courier"
                      accent="teal"
                      stats={stats}
                      expenses={allExpenses.filter((exp) => exp.linkedCourierId === courier.id)}
                      onAddExpense={handleAddCourierExpense(courier.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {newInviteLink && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center" onClick={() => setNewInviteLink(null)} role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[440px] rounded-t-[28px] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("courierManagement.inviteReadyTitle")}</h3>
              <button type="button" onClick={() => setNewInviteLink(null)} className="text-slate-400 dark:text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
              <span className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{newInviteLink}</span>
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="shrink-0 text-[10px] font-black text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
              >
                {linkCopied ? (<><Check size={11} /> {t("courierManagement.copiedButton")}</>) : t("courierManagement.copyButton")}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("courierManagement.inviteHint")}</p>
            <button
              type="button"
              onClick={handleShareInviteLink}
              className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
            >
              <Send size={14} /> {t("courierManagement.shareButton")}
            </button>
          </div>
        </div>
      )}

      {removeTarget && (
        <ConfirmDialog
          title={t("courierManagement.removeConfirmTitle")}
          message={t("courierManagement.removeConfirmMessage", { name: removeTarget.name })}
          confirmLabel={t("courierManagement.removeConfirmLabel")}
          danger
          busy={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </>
  );
};

export default CourierManagementSection;
