import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Settings, Tag, PackagePlus, Flame } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import CouponsSection from "./CouponsSection";
import BundlesSection from "./BundlesSection";
import PromotionsSection from "./PromotionsSection";

/**
 * "MARKETING VA KUPONLAR" — birlashtirilgan markaziy sahifa (2026-09
 * foydalanuvchi so'roviga ko'ra, 8-band).
 *
 * OLDIN: promokodlar (`MarketingCoupons.jsx`), mahsulot bandllari
 * (`BundleManagementPage.jsx`) va aksiyalar (`CreatePromotionPage.jsx`)
 * UCH ALOHIDA sahifa/route edi (`/seller/marketing`, `/seller/bundles`,
 * `/seller/create-promotion`) — mazmunan barchasi "savdoni oshirish"
 * vazifasini bajarsa-da, sotuvchi ular orasida navigatsiya qilish
 * uchun har safar orqaga qaytishga majbur edi. Bundan tashqari,
 * `MarketingCoupons.jsx`ning O'ZIDA ko'plab yoqish-o'chirish
 * sozlamalari (referal, sodiqlik, tug'ilgan kun va h.k.) promokod
 * formasi bilan bitta uzun sahifada aralashib ketgan edi.
 *
 * ENDI: uchalasi HAM shu bitta sahifada, `PaymentAndTariffsPage.jsx`/
 * `DeliverySettingsPage.jsx`da ALLAQACHON ishlatilgan segment-tab
 * naqshi bilan almashtiriladi. Barcha yoqish-o'chirish sozlamalari esa
 * ALOHIDA "Sozlamalar" sahifasiga (`MarketingSettingsPage.jsx`, gear
 * tugmasi orqali - `AiCeoInfoPage.jsx`dagi bilan BIR XIL naqsh)
 * ko'chirilgan.
 *
 * BARCHA ESKI ROUTE'LAR SAQLANGAN ('/seller/marketing', '/seller/bundles',
 * '/seller/create-promotion') - uchalasi ham AYNAN shu komponentga
 * ishora qiladi (navbar'ning markaziy "+" tugmasi va boshqa ko'p joy
 * shu yo'llarga to'g'ridan-to'g'ri havola beradi, ular BUZILMASLIGI
 * kerak) — sahifa qaysi yo'l orqali ochilganiga qarab TO'G'RI tab
 * standart sifatida ochiladi, lekin uchalasi ham bir xil joyda, tab
 * orqali ERKIN almashtiriladi.
 */
const TAB_BY_PATH = [
  { match: "bundles", tab: "bundles" },
  { match: "create-promotion", tab: "promotions" },
];

const MarketingHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState(() => {
    if (["coupons", "bundles", "promotions"].includes(location.state?.initialTab)) {
      return location.state.initialTab;
    }
    const matched = TAB_BY_PATH.find(({ match }) => location.pathname.includes(match));
    return matched ? matched.tab : "coupons";
  });

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-slate-800 dark:text-white truncate">{t("marketing.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{t("marketing.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/seller/marketing/settings")}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-transform shrink-0"
          aria-label={t("marketing.settingsAria")}
        >
          <Settings size={15} />
        </button>
      </div>

      <div className="p-4 pb-0">
        <div className="grid grid-cols-3 gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("coupons")}
            className={`h-10 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-colors ${
              activeTab === "coupons" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Tag size={13} /> {t("marketing.tabCoupons")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bundles")}
            className={`h-10 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-colors ${
              activeTab === "bundles" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <PackagePlus size={13} /> {t("marketing.tabBundles")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("promotions")}
            className={`h-10 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 transition-colors ${
              activeTab === "promotions" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Flame size={13} /> {t("marketing.tabPromotions")}
          </button>
        </div>
      </div>

      {activeTab === "coupons" && <CouponsSection />}
      {activeTab === "bundles" && <BundlesSection />}
      {activeTab === "promotions" && <PromotionsSection />}
    </div>
  );
};

export default MarketingHub;
