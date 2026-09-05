import { useState } from "react";
import { X, Check, Loader2, Globe, SunMoon, LogOut } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { updateCourierProfile, removeCourier } from "@/services/couriers/courierManagement";
import { getTelegramWebApp, triggerHaptic } from "@/config/telegram";
import { formatUzPhone, isValidUzPhone, hasMeaningfulPhoneDigits } from "@/utils/phone";
import ThemeModal from "@/components/ui/ThemeModal";
import LanguageModal from "@/components/ui/LanguageModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

/**
 * KURYER Mini App'ining "Profil va sozlamalar" modali — foydalanuvchi
 * so'rovi (item 3, 4, 5): til/ko'rinish rejimi almashtirish, ism/
 * telefon raqamini tahrirlash, va "kuryerlikni to'xtatish" (o'zini
 * ro'yxatdan o'chirish) — barchasi BITTA joyda.
 *
 * MUHIM: `ThemeModal`/`LanguageModal` — allaqachon ROLGA BOG'LIQ
 * BO'LMAGAN, umumiy komponentlar (`useTheme`/`useLanguage`dan
 * foydalanadi), va `ThemeProvider`/`LanguageProvider` ALLAQACHON
 * `/courier` yo'l daraxtini o'rab turibdi (`App.jsx`) — shuning
 * uchun ular BEVOSITA shu yerda, o'zgarishsiz ishlatiladi.
 *
 * Ism/telefon tahrirlash formasi sotuvchining `CourierManagementPage.jsx`
 * dagi kuryer qo'shish formasi BILAN BIR XIL validatsiya/formatlash
 * naqshini (`formatUzPhone`/`isValidUzPhone`/`hasMeaningfulPhoneDigits`)
 * ishlatadi — foydalanuvchi tajribasi ikkala tomonda ham izchil bo'lishi
 * uchun.
 *
 * Saqlangan o'zgarishlar darhol UI'da ko'rinadi — bu modal HECH
 * QANDAY qo'shimcha holatni yuqoriga "ko'tarmaydi" (lifting state up),
 * chunki `CourierOrdersPage.jsx`dagi `subscribeToCourierStatus` jonli
 * obunasi buni allaqachon o'zi qiladi.
 */
const CourierProfileModal = ({ courierId, name: initialName, phone: initialPhone, onClose }) => {
  const { t, language } = useLanguage();
  const { theme } = useTheme();

  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState(null);
  const [stopped, setStopped] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError(t("courierManagement.errorNameRequired"));
      return;
    }
    // MUHIM: `CourierManagementPage.jsx`dagi BILAN BIR XIL mantiq —
    // telefon IXTIYORIY, faqat kiritilgan bo'lsa TO'LIQ (9 xonali)
    // bo'lishi tekshiriladi.
    const hasAnyPhoneDigits = hasMeaningfulPhoneDigits(phone);
    if (hasAnyPhoneDigits && !isValidUzPhone(phone)) {
      setSaveError(t("courierManagement.errorPhoneInvalid"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateCourierProfile(name.trim(), hasAnyPhoneDigits ? phone.trim() : "");
      triggerHaptic("notification", "success");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      triggerHaptic("notification", "error");
      setSaveError(err.message || t("courierApp.profileUpdateError"));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStop = async () => {
    setStopping(true);
    setStopError(null);
    try {
      // `removeCourier`ning "sotuvchi YOKI o'zi" ruxsat naqshi
      // (`functions/couriers.js`) - bu yerda kuryer O'ZINING ID'sini
      // yuboradi, va endi u O'ZINI o'chirishga ruxsatga ega.
      await removeCourier(courierId);
      triggerHaptic("notification", "success");
      setStopped(true);
      setTimeout(() => {
        getTelegramWebApp()?.close?.();
      }, 1500);
    } catch (err) {
      triggerHaptic("notification", "error");
      setStopError(err.message || t("courierApp.stopCourierError"));
      setStopping(false);
      setConfirmingStop(false);
    }
  };

  useEscapeToClose(onClose, !saving);

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-end justify-center animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100 dark:border-slate-800 max-h-[88vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("courierApp.profileAria")}</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("courierApp.profileTitle")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center"
          >
            <X size={13} />
          </button>
        </div>

        {stopped ? (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <Check size={22} className="text-emerald-500" />
            </div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t("courierApp.stopCourierSuccess")}</p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {t("courierApp.nameFieldLabel")}
              </label>
              <input
                type="text"
                disabled={saving}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("courierManagement.namePlaceholder")}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
              />
              <input
                type="tel"
                inputMode="numeric"
                maxLength={17}
                disabled={saving}
                value={phone}
                onFocus={() => { if (!phone) setPhone("+998 "); }}
                onChange={(e) => setPhone(formatUzPhone(e.target.value))}
                placeholder={t("courierManagement.phonePlaceholder")}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-60"
              />
              {saveError && <p className="text-[11px] text-rose-500 font-semibold">{saveError}</p>}
              <button
                type="submit"
                disabled={saving}
                className={`w-full h-11 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${
                  saved ? "bg-emerald-500" : "bg-teal-600 hover:bg-teal-700"
                }`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
                {saving ? t("common.loading") : saved ? t("courierApp.profileUpdateSuccess") : t("common.save")}
              </button>
            </form>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLanguageModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60"
              >
                <span className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                    <Globe size={15} />
                  </span>
                  {t("cabinet.language")}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{language}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowThemeModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60"
              >
                <span className="flex items-center gap-3 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                    <SunMoon size={15} />
                  </span>
                  {t("cabinet.theme")}
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  {theme === "dark" ? t("cabinet.themeDark") : t("cabinet.themeLight")}
                </span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmingStop(true)}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-rose-500 font-bold text-xs bg-rose-50 dark:bg-rose-500/10"
              >
                <LogOut size={14} /> {t("courierApp.stopCourierButton")}
              </button>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center leading-relaxed">
                {t("courierApp.stopCourierDesc")}
              </p>
              {stopError && <p className="text-[11px] text-rose-500 font-semibold text-center mt-1">{stopError}</p>}
            </div>
          </>
        )}
      </div>

      {showLanguageModal && <LanguageModal onClose={() => setShowLanguageModal(false)} />}
      {showThemeModal && <ThemeModal onClose={() => setShowThemeModal(false)} />}
      {confirmingStop && (
        <ConfirmDialog
          title={t("courierApp.stopCourierButton")}
          message={t("courierApp.stopCourierConfirmMessage")}
          confirmLabel={t("courierApp.stopCourierConfirmLabel")}
          cancelLabel={t("common.cancel")}
          danger
          busy={stopping}
          onConfirm={handleConfirmStop}
          onCancel={() => setConfirmingStop(false)}
        />
      )}
    </div>
  );
};

export default CourierProfileModal;
