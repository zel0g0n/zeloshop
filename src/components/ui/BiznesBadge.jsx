import { Crown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Z-BIZNES PREMIUM BELGISI (2026-09, foydalanuvchi so'rovi: "Biznes
 * tarifidagi funksiyalar boshqalardan dizayn jihatdan ajralib tursin —
 * sotuvchi shu funksiyadan foydalanayotganda buni Biznes tarifi
 * beráyotganini his qilishi kerak").
 *
 * OLDIN: har bir sahifa "bu Biznesga xos" belgisini o'zicha, turlicha
 * ko'rsatardi — ba'zilari amber rangli Crown ikonka bilan
 * (`CustomerIntelligencePanel.jsx`, `MarketingCoupons.jsx`), ba'zilari
 * esa hatto oddiy INDIGO (ilovaning HAR QANDAY oddiy elementi ishlatgan
 * rang) bilan (`AiCeoInfoPage.jsx`dagi "AI Business Manager" bo'limi) —
 * bu "premium" hissini yo'qqa chiqarardi, chunki indigo hech narsani
 * boshqalardan ajratmaydi. Endi BUTUN ilova bo'ylab BITTA, izchil belgi:
 * oltin/amber gradient fon + qirol toji (Crown), ilovada boshqa hech
 * qayerda ishlatilmagan kombinatsiya — ko'z darhol ilg'aydi.
 *
 * Ishlatilishi: FAQAT chinakam Z-Biznes'ga XOS (boshqa tariflarda
 * UMUMAN yo'q) bo'lim/funksiya sarlavhasi yonida — oddiy "tarif
 * bo'yicha son limiti" (masalan mahsulot soni) uchun EMAS, bu alohida,
 * kamroq "og'ir" tushuncha.
 */
const BiznesBadge = ({ label, size = "sm", className = "" }) => {
  const { t } = useLanguage();
  const text = label || t("tariffs.planBiznesName");
  const isXs = size === "xs";

  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full font-black uppercase tracking-wider text-white bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 shadow-sm shadow-amber-500/30 ${
        isXs ? "text-[8px] px-1.5 py-0.5 gap-0.5" : "text-[9px] px-2 py-1 gap-1"
      } ${className}`}
    >
      <Crown size={isXs ? 9 : 10} strokeWidth={2.5} />
      {text}
    </span>
  );
};

export default BiznesBadge;
