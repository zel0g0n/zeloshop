import { useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, ImageOff } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import SellerTrustBadges from "@/components/shared/SellerTrustBadges";

/**
 * "BIZ HAQIMIZDA" — mijozga do'kon ma'lumotlarini ko'rsatadigan
 * sahifa (logotip, nomi, telefon, joylashuv, tavsif). Barcha
 * ma'lumot ALLAQACHON sessiyada mavjud (`store` obyekti) - yangi
 * Firestore so'rovi UMUMAN kerak emas.
 */
const StoreInfoPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">{t("storeInfo.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        {/* LOGOTIP + NOM - hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] p-6 text-white text-center shadow-lg shadow-blue-600/20">
          <div className="w-20 h-20 rounded-3xl bg-white/15 flex items-center justify-center mx-auto mb-3 overflow-hidden border-2 border-white/30">
            {store?.logo ? (
              <img src={store.logo} alt={store.storeName} className="w-full h-full object-cover" />
            ) : (
              <ImageOff size={24} className="text-white/60" />
            )}
          </div>
          <h2 className="text-lg font-black">
            {store?.storeName || t("storeInfo.unnamedStore")}
          </h2>
          {/* HAQIQIY ishonch nishonlari (v39.13) - avvalgi har doim
              ko'rinadigan dekorativ "tasdiqlangan" belgisi o'rniga,
              faqat sotuvchi HAQIQATAN qozongan bo'lsa ko'rinadi. */}
          <SellerTrustBadges store={store} variant="full" className="justify-center mt-2" />
        </div>

        {/* TAVSIF */}
        {store?.description && (
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("storeInfo.descriptionLabel")}</span>
            <p className="text-xs font-medium text-gray-600 dark:text-slate-300 leading-relaxed mt-2">{store.description}</p>
          </div>
        )}

        {/* ALOQA MA'LUMOTLARI */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl divide-y divide-gray-100 dark:divide-slate-800">
          {store?.phone && (
            <a href={`tel:${store.phone}`} className="flex items-center gap-3 p-4 active:bg-gray-50 dark:active:bg-slate-800 transition-colors">
              <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Phone size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("storeInfo.phoneLabel")}</p>
                <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{store.phone}</p>
              </div>
            </a>
          )}
          {store?.region && (
            <div className="flex items-center gap-3 p-4">
              <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <MapPin size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("storeInfo.locationLabel")}</p>
                <p className="text-xs font-bold text-gray-800 dark:text-white mt-0.5">{store.region}</p>
              </div>
            </div>
          )}
          {!store?.phone && !store?.region && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-6">{t("storeInfo.noContactInfo")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoreInfoPage;
