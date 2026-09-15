import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Foydalanish shartlari (ommaviy oferta) sahifasi.
 *
 * Diqqat: bu matn O'zbekiston Respublikasining amaldagi qonunchiligiga
 * (jumladan "Elektron tijorat to'g'risida"gi Qonun — 2022-yil
 * 29-sentabr, O'RQ-792; "Iste'molchilarning huquqlarini himoya qilish
 * to'g'risida"gi Qonun; "Shaxsga doir ma'lumotlar to'g'risida"gi Qonun —
 * 2019-yil, O'RQ-547) asoslanib tayyorlangan, lekin baribir UMUMIY
 * shablon hisoblanadi va professional yurist tomonidan ko'rib
 * chiqilishini almashtirmaydi — ayniqsa har bir sotuvchining aniq
 * biznes-modeliga moslashtirish uchun.
 *
 * MUHIM (2025-yil 1-iyuldan kuchga kirgan talab): Vazirlar Mahkamasining
 * 2024-yil 26-dekabrdagi 885-sonli qarori bilan elektron tijorat
 * operatorlari (jumladan onlayn-do'kon platformalari) e-tijorat.uz
 * davlat reyestrida RO'YXATDAN O'TISHI SHART — ro'yxatdan o'tmagan
 * platforma faoliyati taqiqlangan. Bu talab ushbu sahifa matniga
 * KIRITILMAGAN (chunki ro'yxatga OLUVCHI shaxs — ZeloShop platformasi
 * yoki har bir sotuvchi alohida — hali aniqlanmagan), lekin loyiha
 * egasi tomonidan alohida tekshirilishi SHART.
 */
const SECTION_KEYS = [
  "accept",
  "platformRole",
  "sellerDuties",
  "buyerRules",
  "payments",
  "returns",
  "intellectualProperty",
  "liability",
  "dataProtection",
  "changes",
  "disputes",
  "contact",
];

const TermsOfServicePage = () => {
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
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">{t("termsOfService.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] p-6 text-white text-center shadow-lg shadow-blue-600/20">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <FileText size={26} />
          </div>
          <h2 className="text-base font-black">{store?.storeName || t("storeInfo.unnamedStore")}</h2>
          <p className="text-xs font-medium text-white/80 mt-1.5 leading-relaxed">{t("termsOfService.heroSubtitle")}</p>
        </div>

        {SECTION_KEYS.map((key) => (
          <div key={key} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-black text-gray-800 dark:text-white mb-2">{t(`termsOfService.${key}Title`)}</h3>
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{t(`termsOfService.${key}Body`)}</p>
            {/* "Bog'lanish" bo'limida matn ichida aytilgan Telegram
                orqali bog'lanish — haqiqiy, bosiladigan `tel:` havolasi
                bilan ham qo'llab-quvvatlanadi (Maxfiylik siyosati
                sahifasidagi bilan bir xil kontakt raqami). */}
            {key === "contact" && (
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
          {t("termsOfService.lastUpdatedLabel")}: {new Date().toLocaleDateString("uz-UZ")}
        </p>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
