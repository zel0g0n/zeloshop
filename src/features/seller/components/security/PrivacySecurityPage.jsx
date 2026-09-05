import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";

// MAXFIYLIK VA XAVFSIZLIK — PIN kod bilan ilovaga kirishni cheklash.
//
// OLDIN (MUHIM TUZATISH): PIN kod xato ravishda `sellers/{id}`
// hujjatining o'ziga (`updateSeller` orqali) yozilgan edi — bu
// hujjat esa OCHIQ o'qiladi (mijozlar do'kon nomi/logotipini
// ko'rishi uchun kerak edi)! Ya'ni PIN kod amalda HAR KIMGA
// ko'rinadigan bo'lib qolgan edi. Endi PIN kod faqat egasi o'qiy
// oladigan `sellers/{id}/private/security` hujjatida saqlanadi —
// xuddi to'lov ma'lumotlari kabi.
//
// FRONTEND CACHE AUDITI (2026-09): OLDIN bu sahifa `security`ni
// (`sellers/{id}/private/security`) O'ZINING ALOHIDA `getDoc()`
// so'rovi orqali qayta yuklardi — bu ORTIQCHA edi, chunki bu ANIQ shu
// ma'lumot `SessionContext`da (`verifyTelegramAuth`ning bir martalik
// javobidan) ALLAQACHON bor edi (`SellerLayout.jsx` PIN qulfi uchun
// aynan shu qiymatni ishlatadi). Endi bu sahifa QO'SHIMCHA Firestore
// so'rovisiz, to'g'ridan-to'g'ri `useSession().security`dan
// boshlang'ich holatni oladi — sahifa ochilishi tezroq (kutish
// spinneri kerak emas, ma'lumot allaqachon tayyor) va bitta Firestore
// o'qish xarajati butunlay yo'qoladi. Saqlashdan keyin `patchSecurity`
// chaqiriladi — bu, `SellerLayout.jsx`dagi PIN qulfi o'zgarishni
// SAHIFANI YANGILAMASDAN, DARHOL ko'rishi uchun kerak (`patchStore`
// bilan bir xil naqsh).
const PrivacySecurityPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, security, patchSecurity } = useSession();

  const [pinEnabled, setPinEnabled] = useState(Boolean(security?.pinLockEnabled));
  const [hasExistingPin, setHasExistingPin] = useState(Boolean(security?.pinCode));
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  const securityDocRef = doc(db, "sellers", sellerId || "_", "private", "security");

  const handleToggle = useCallback(async () => {
    const next = !pinEnabled;
    if (!next) {
      setSaving(true);
      try {
        await setDoc(securityDocRef, { pinLockEnabled: false }, { merge: true });
        setPinEnabled(false);
        patchSecurity({ pinLockEnabled: false });
        sessionStorage.removeItem("zeloshop_pin_unlocked");
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      setPinEnabled(true);
    }
  }, [pinEnabled, securityDocRef, patchSecurity]);

  const handleSavePin = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(newPin)) {
      setError(t("privacy.pinLengthError"));
      return;
    }
    if (newPin !== confirmPin) {
      setError(t("privacy.pinMismatchError"));
      return;
    }

    setSaving(true);
    try {
      await setDoc(securityDocRef, { pinLockEnabled: true, pinCode: newPin }, { merge: true });
      setHasExistingPin(true);
      patchSecurity({ pinLockEnabled: true, pinCode: newPin });
      setShowSaved(true);
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err.message || t("privacy.saveError"));
    } finally {
      setSaving(false);
    }
  }, [newPin, confirmPin, securityDocRef, patchSecurity]);

  const needsPinSetup = pinEnabled && !hasExistingPin;

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("privacy.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("privacy.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("privacy.pinLockTitle")}</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("privacy.pinLockDesc")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={saving}
              className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors disabled:opacity-50 ${pinEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${pinEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>

        {pinEnabled && (
          <form onSubmit={handleSavePin} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3 animate-fade-in">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <ShieldCheck size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">
                {needsPinSetup ? t("privacy.setupTitle") : t("privacy.changeTitle")}
              </h3>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={saving}
              placeholder={t("privacy.newPinPlaceholder")}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={saving}
              placeholder={t("privacy.confirmPinPlaceholder")}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />

            {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl disabled:opacity-60"
            >
              {saving ? t("privacy.saving") : t("privacy.savePinButton")}
            </button>
          </form>
        )}
      </div>

      {showSaved && (
        <StatusModal
          variant="success"
          title={t("privacy.savedTitle")}
          message={t("privacy.savedMessage")}
          onClose={() => setShowSaved(false)}
        />
      )}
    </div>
  );
};

export default PrivacySecurityPage;
