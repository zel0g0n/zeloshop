import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import StatusModal from "@/components/ui/StatusModal";

// MAXFIYLIK VA XAVFSIZLIK — PIN kod bilan ilovaga kirishni cheklash.
//
// OLDIN (MUHIM TUZATISH): PIN kod xato ravishda `sellers/{id}`
// hujjatining o'ziga (`updateSeller` orqali) yozilgan edi — bu
// hujjat esa OCHIQ o'qiladi (mijozlar do'kon nomi/logotipini
// ko'rishi uchun kerak edi)! Ya'ni PIN kod amalda HAR KIMGA
// ko'rinadigan bo'lib qolgan edi. Endi PIN kod faqat egasi o'qiy
// oladigan `sellers/{id}/private/security` hujjatida saqlanadi —
// xuddi to'lov ma'lumotlari kabi.
const PrivacySecurityPage = () => {
  const navigate = useNavigate();
  const { sellerId } = useSession();

  const [loading, setLoading] = useState(true);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showSaved, setShowSaved] = useState(false);

  const securityDocRef = doc(db, "sellers", sellerId || "_", "private", "security");

  useEffect(() => {
    if (!sellerId) return;
    let cancelled = false;
    getDoc(doc(db, "sellers", sellerId, "private", "security"))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        setPinEnabled(Boolean(data?.pinLockEnabled));
        setHasExistingPin(Boolean(data?.pinCode));
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const handleToggle = useCallback(async () => {
    const next = !pinEnabled;
    if (!next) {
      setSaving(true);
      try {
        await setDoc(securityDocRef, { pinLockEnabled: false }, { merge: true });
        setPinEnabled(false);
        sessionStorage.removeItem("zeloshop_pin_unlocked");
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else {
      setPinEnabled(true);
    }
  }, [pinEnabled, securityDocRef]);

  const handleSavePin = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN kod aynan 4 ta raqamdan iborat bo'lishi shart.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PIN kodlar mos kelmadi.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(securityDocRef, { pinLockEnabled: true, pinCode: newPin }, { merge: true });
      setHasExistingPin(true);
      setShowSaved(true);
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setError(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }, [newPin, confirmPin, securityDocRef]);

  const needsPinSetup = pinEnabled && !hasExistingPin;

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">Maxfiylik va Xavfsizlik</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">PIN kod himoyasi</p>
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
                <h3 className="text-sm font-black text-slate-800 dark:text-white">PIN kod himoyasi</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">Panelga kirishda 4 xonali kod so'raladi</p>
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
                {needsPinSetup ? "PIN kodni o'rnatish" : "PIN kodni o'zgartirish"}
              </h3>
            </div>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={saving}
              placeholder="Yangi 4 xonali PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              disabled={saving}
              placeholder="PIN kodni takrorlang"
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
              {saving ? "Saqlanmoqda..." : "PIN kodni saqlash"}
            </button>
          </form>
        )}
      </div>

      {showSaved && (
        <StatusModal
          variant="success"
          title="PIN kod o'rnatildi! 🔒"
          message="Endi paneliga kirishda shu kodni kiritishingiz kerak bo'ladi."
          onClose={() => setShowSaved(false)}
        />
      )}
    </div>
  );
};

export default PrivacySecurityPage;
