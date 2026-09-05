import { useMemo, useState } from "react";
import { getTelegramWebApp } from "@/config/telegram";
import {
  ShoppingBag, Globe, LogOut, TrendingUp,
  Heart, Moon, Sun, Shield, Info, Gift
} from "lucide-react";
import CabinetMenu from "@/features/shop/components/cabinet/CabinetMenu";
import CabinetHeader from "@/features/shop/components/cabinet/CabinetHeader";
import ActiveOrder from "@/features/shop/components/order/ActiveOrder";
import LanguageModal from "@/components/ui/LanguageModal";
import ThemeModal from "@/components/ui/ThemeModal";
import { useFavoritesList } from "@/hooks/useAddFavourite";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { translations } from "@/i18n/translations";

const ProfilePage = () => {
  const { favorites } = useFavoritesList();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const [openModal, setOpenModal] = useState(null); // 'language' | 'theme' | null

  const menuSections = useMemo(() => [
    {
      title: t("cabinet.personalInfo"),
      items: [
        { id: "wishlist", title: t("cabinet.wishlist"), icon: <Heart size={18} />, badge: `${favorites.length}`, path: `/saved` },
        { id: "orders", title: t("cabinet.orders"), icon: <ShoppingBag size={18} />, path: `/orders` },
        { id: "spending", title: t("cabinet.mySpending"), icon: <TrendingUp size={18} />, path: `/my-spending` },
        { id: "referral", title: t("cabinet.referral"), icon: <Gift size={18} />, path: `/referral` },
      ]
    },
    {
      title: t("cabinet.accountSettings"),
      items: [
        { id: "language", title: t("cabinet.language"), icon: <Globe size={18} />, textBadge: translations[language].language_name, onClick: () => setOpenModal("language") },
        { id: "theme", title: t("cabinet.theme"), icon: isDark ? <Moon size={18} /> : <Sun size={18} />, textBadge: isDark ? t("cabinet.themeDark") : t("cabinet.themeLight"), onClick: () => setOpenModal("theme") },
      ]
    },
    {
      title: t("cabinet.appSupport"),
      items: [
        { id: "store-info", title: t("cabinet.storeInfo"), icon: <Info size={18} />, path: `/store-info` },
        { id: "privacy", title: t("cabinet.privacy"), icon: <Shield size={18} />, path: `/privacy` },
      ]
    }
  ], [favorites.length, t, language, isDark]);

  // MUHIM TUZATISH (haqiqiy, sezilmagan xato): OLDIN bu tugma
  // Firebase `signOut()` + sahifani qayta yuklashni bajarardi. LEKIN
  // bu ilova — Telegram orqali AVTOMATIK autentifikatsiya qilinadi
  // (`SessionContext.jsx`, `signInWithCustomToken`) - sahifa qayta
  // yuklanganda, Telegram YANA o'sha foydalanuvchi sifatida DARHOL
  // qayta kirgizib qo'yardi! Ya'ni foydalanuvchi "chiqaman" deb
  // bossa ham, ILOVA ICHIDA turib "chiqish" IMKONSIZ edi - u faqat
  // bir lahzalik "yonib-o'chish" ko'rar, keyin darhol yana o'zi
  // sifatida ekanini ko'rardi.
  //
  // TO'G'RI YECHIM: Telegram Mini App kontekstida "chiqish"ning
  // yagona mazmunli ekvivalenti - ILOVANI YOPISH (`WebApp.close()`).
  // Foydalanuvchi hisobidan "chiqmaydi" (bu texnik jihatdan imkonsiz),
  // balki ilovani yopib chiqadi - "Chiqish" tugmasining aslida
  // anglatgan narsasi ham shu edi.
  const handleLogout = () => {
    const webApp = getTelegramWebApp();
    if (webApp?.close) {
      webApp.close();
    } else {
      // Telegram tashqarisida (lokal test) - shunchaki bosh sahifaga
      // qaytaramiz, chunki `WebApp.close()` mavjud emas.
      window.location.href = "/";
    }
  };

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-36 transition-colors duration-300">
      <CabinetHeader/>
      <ActiveOrder />
      <div className="p-4 space-y-5">
        {menuSections.map((section, idx) => (
          <CabinetMenu key={idx} section={section} />
        ))}

        <button
          onClick={handleLogout}
          className="w-full mt-2 bg-red-50/40 dark:bg-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/20 border border-red-100/50 dark:border-red-500/20 text-red-500 font-bold h-12 rounded-[20px] flex items-center justify-center gap-2 text-xs active:scale-95 transition-all duration-200 shadow-2xs"
        >
          <LogOut size={14} />
          <span>{t("common.logout")}</span>
        </button>

        <p className="text-center text-[10px] text-gray-300 dark:text-slate-600 font-medium pt-2">
          Cosmetics App v2.4.0 • Built for Premium Experience
        </p>
      </div>

      {openModal === "language" && <LanguageModal onClose={() => setOpenModal(null)} />}
      {openModal === "theme" && <ThemeModal onClose={() => setOpenModal(null)} />}
    </div>
  );
};

export default ProfilePage;
