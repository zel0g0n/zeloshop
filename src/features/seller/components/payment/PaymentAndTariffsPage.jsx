import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Zap, CreditCard } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import PaymentSettingsSection from "./PaymentSettingsSection";
import TariffsSection from "./TariffsSection";

/**
 * "To'lov va Tariflar" — birlashtirilgan sahifa (2026-09 foydalanuvchi
 * so'roviga ko'ra).
 *
 * OLDIN: "To'lov tizimlari" (`PaymentSettingsPage.jsx`, Click/Payme/
 * jismoniy shaxs sozlamalari) va "To'lovlar va Tariflar"
 * (`TariffsPage.jsx`, tarif rejalari) IKKI ALOHIDA sahifa/route edi
 * (`/seller/payment-settings` va `/seller/tariffs`) — mazmunan chambar-
 * chas bog'liq (ikkalasi ham "pul" mavzusida) bo'lsa-da, sotuvchi
 * ular orasida orqaga-oldinga navigatsiya qilishga majbur edi.
 *
 * ENDI: ikkalasi HAM shu bitta sahifada, `DeliverySettingsPage.jsx`da
 * ALLAQACHON ishlatilgan segment-tab naqshi bilan almashtiriladi.
 * Mantiqning O'ZI ikkalasida ham O'ZGARISHSIZ - faqat
 * `PaymentSettingsSection.jsx`/`TariffsSection.jsx`ga ko'chirilgan.
 *
 * IKKALA ESKI ROUTE HAM ('/seller/payment-settings' va '/seller/tariffs')
 * SAQLANGAN - ikkalasi ham AYNAN shu komponentga ishora qiladi (boshqa
 * sahifalardan "Tariflarni yangilang" devor havolalari ko'p joyda
 * '/seller/tariffs'ga ishora qiladi, ular BUZILMASLIGI kerak) — sahifa
 * qaysi yo'l orqali ochilganiga qarab TO'G'RI tab standart sifatida
 * ochiladi, lekin ikkalasi ham bir xil joyda, tab orqali ERKIN
 * almashtiriladi.
 */
const PaymentAndTariffsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState(() => {
    if (location.state?.initialTab === "payment" || location.state?.initialTab === "tariffs") {
      return location.state.initialTab;
    }
    return location.pathname.includes("tariffs") ? "tariffs" : "payment";
  });

  return (
    <div className="bg-[#F4F5F9] dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white pb-36 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("paymentAndTariffs.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("paymentAndTariffs.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 pb-0">
        <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("payment")}
            className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "payment" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <CreditCard size={14} /> {t("paymentAndTariffs.tabPayment")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tariffs")}
            className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "tariffs" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Zap size={14} /> {t("paymentAndTariffs.tabTariffs")}
          </button>
        </div>
      </div>

      {activeTab === "payment" ? <PaymentSettingsSection /> : <TariffsSection />}
    </div>
  );
};

export default PaymentAndTariffsPage;
