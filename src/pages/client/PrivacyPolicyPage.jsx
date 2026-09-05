import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Maxfiylik siyosati sahifasi.
 *
 * Diqqat: bu matn umumiy, standart e-commerce shabloni bo'lib,
 * huquqiy maslahat hisoblanmaydi. Foydalanishdan oldin uni o'z
 * biznesi va O'zbekiston qonunchiligiga (masalan "Shaxsiy
 * ma'lumotlar to'g'risida"gi qonun) moslashtirib tahrirlash tavsiya
 * etiladi — ayniqsa to'lov/yetkazib berish tafsilotlari va kontakt
 * ma'lumotlari (pastda ko'rsatilgan) haqiqiy bo'lishi kerak.
 */
const SECTION_KEYS = [
  "collect", "use", "share", "storage", "rights", "cookies", "changes", "contact",
];

const PrivacyPolicyPage = () => {
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
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">{t("privacyPolicy.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] p-6 text-white text-center shadow-lg shadow-blue-600/20">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <Shield size={26} />
          </div>
          <h2 className="text-base font-black">{store?.storeName || t("storeInfo.unnamedStore")}</h2>
          <p className="text-xs font-medium text-white/80 mt-1.5 leading-relaxed">{t("privacyPolicy.heroSubtitle")}</p>
        </div>

        {SECTION_KEYS.map((key) => (
          <div key={key} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-black text-gray-800 dark:text-white mb-2">{t(`privacyPolicy.${key}Title`)}</h3>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{t(`privacyPolicy.${key}Body`)}</p>
            {/* "Sizning huquqlaringiz" bo'limida matn ichida aytilgan
                "quyidagi kontakt" — shu joyda haqiqiy, bosiladigan
                `tel:` havolasi orqali ko'rsatiladi. */}
            {key === "rights" && (
              <a
                href="tel:+998978020180"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400"
              >
                +998 97 802 01 80
              </a>
            )}
          </div>
        ))}

        <p className="text-center text-[10px] text-gray-300 dark:text-slate-600 font-medium pt-2">
          {t("privacyPolicy.lastUpdatedLabel")}: {new Date().toLocaleDateString("uz-UZ")}
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
