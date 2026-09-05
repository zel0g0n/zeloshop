import { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ChevronRight } from "lucide-react";
import updateSeller from "@/services/sellers/updateSeller";
import { useLanguage } from "@/context/LanguageContext";

/**
 * AI CEO — sotuvchi tomonidagi sozlama kartasi. FAQAT admin
 * `aiCeoEnabled: true` qilib qo'ygan sotuvchilarga ko'rinadi
 * (ota komponent - Dashboard.jsx - buni tekshirib, shart bo'lmasa
 * umuman render qilmaydi).
 *
 * MUHIM QO'SHIMCHA: butun karta endi BOSILADIGAN - bosilganda
 * `AiCeoInfoPage.jsx`ga o'tadi (AI CEO nima ekani, qanday 4 ta
 * vazifani bajarishi haqida to'liq ma'lumot). Yoqish/o'chirish
 * TUGMASI esa MUSTAQIL ishlaydi - uni bosganda `e.stopPropagation()`
 * orqali routing ISHGA TUSHMAYDI (aks holda sotuvchi sozlamani
 * o'zgartirmoqchi bo'lib, tasodifan boshqa sahifaga o'tib qolardi).
 */
const AiCeoSettingsCard = ({ sellerId, store }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(store?.aiCeoDigestEnabled !== false);
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(async (e) => {
    e.stopPropagation();
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await updateSeller(sellerId, { aiCeoDigestEnabled: next });
    } catch {
      setEnabled(!next); // xatolik bo'lsa, eski holatga qaytaramiz
    } finally {
      setSaving(false);
    }
  }, [enabled, sellerId]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/seller/ai-ceo")}
      onKeyDown={(e) => { if (e.key === "Enter") navigate("/seller/ai-ceo"); }}
      className="w-full bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
    >
      <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
        <Sparkles size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black">{t("aiCeo.dashboardCardTitle")}</p>
        <p className="text-[10px] font-medium text-white/70 mt-0.5">{t("aiCeo.dashboardCardSubtitle")}</p>
      </div>
      <ChevronRight size={14} className="text-white/50 shrink-0" />
      <span
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === "Enter") handleToggle(e); }}
        aria-disabled={saving}
        className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${saving ? "opacity-60" : ""} ${enabled ? "bg-white/90 justify-end" : "bg-white/20 justify-start"}`}
      >
        <span className={`w-5 h-5 rounded-full shadow-sm ${enabled ? "bg-indigo-600" : "bg-white"}`} />
      </span>
    </div>
  );
};

export default memo(AiCeoSettingsCard);
