import { useMemo, useState } from "react";
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { 
  FiShoppingBag, FiGlobe, FiLogOut,
  FiHeart, FiMoon, FiSun, FiShield, FiInfo 
} from "react-icons/fi";
import CabinetMenu from "@/features/shop/components/cabinet/CabinetMenu";
import CabinetHeader from "@/features/shop/components/cabinet/CabinetHeader";
import ActiveOrder from "@/features/shop/components/order/ActiveOrder";
import LanguageModal from "@/components/ui/LanguageModal";
import ThemeModal from "@/components/ui/ThemeModal";
import StatusModal from "@/components/ui/StatusModal";
import { useFavoritesList } from "@/hooks/useAddFavourite";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { translations } from "@/i18n/translations";

const ProfilePage = () => {
  const { favorites } = useFavoritesList();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const [openModal, setOpenModal] = useState(null); // 'language' | 'theme' | null
  const [comingSoonName, setComingSoonName] = useState(null);
  const [logoutError, setLogoutError] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  // OLDIN: "Maxfiylik siyosati" va "Biz haqimizda" `/privacy` va
  // `/about` marshrutlariga havola qilardi — bunday sahifalar ilovada
  // UMUMAN yo'q edi, bosilganda bo'sh sahifa chiqardi. Endi seller
  // panelidagi bilan bir xil "Tez orada" naqshi ishlatiladi.
  const menuSections = useMemo(() => [
    {
      title: t("cabinet.personalInfo"),
      items: [
        { id: "wishlist", title: t("cabinet.wishlist"), icon: <FiHeart size={18} />, badge: `${favorites.length}`, path: `/saved` },
        { id: "orders", title: t("cabinet.orders"), icon: <FiShoppingBag size={18} />, path: `/orders` },
      ]
    },
    {
      title: t("cabinet.accountSettings"),
      items: [
        { id: "language", title: t("cabinet.language"), icon: <FiGlobe size={18} />, textBadge: translations[language].language_name, onClick: () => setOpenModal("language") },
        { id: "theme", title: t("cabinet.theme"), icon: isDark ? <FiMoon size={18} /> : <FiSun size={18} />, textBadge: isDark ? t("cabinet.themeDark") : t("cabinet.themeLight"), onClick: () => setOpenModal("theme") },
      ]
    },
    {
      title: t("cabinet.appSupport"),
      items: [
        { id: "privacy", title: t("cabinet.privacy"), icon: <FiShield size={18} />, onClick: () => setComingSoonName(t("cabinet.privacy")) },
        { id: "about", title: t("cabinet.about"), icon: <FiInfo size={18} />, onClick: () => setComingSoonName(t("cabinet.about")) },
      ]
    }
  ], [favorites.length, t, language, isDark]);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      setLogoutError(err.message);
      setSigningOut(false);
    }
  };

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-32 transition-colors duration-300">
      <CabinetHeader/>
      <ActiveOrder />
      <div className="p-4 space-y-5">
        {menuSections.map((section, idx) => (
          <CabinetMenu key={idx} section={section} />
        ))}

        <button
          onClick={handleLogout}
          disabled={signingOut}
          className="w-full mt-2 bg-red-50/40 dark:bg-red-500/10 hover:bg-red-50 dark:hover:bg-red-500/20 border border-red-100/50 dark:border-red-500/20 text-red-500 font-bold h-12 rounded-[20px] flex items-center justify-center gap-2 text-xs active:scale-95 transition-all duration-200 shadow-2xs disabled:opacity-60"
        >
          <FiLogOut size={14} />
          <span>{signingOut ? "Chiqilmoqda..." : t("common.logout")}</span>
        </button>

        <p className="text-center text-[10px] text-gray-300 dark:text-slate-600 font-medium pt-2">
          Cosmetics App v2.4.0 • Built for Premium Experience
        </p>
      </div>

      {openModal === "language" && <LanguageModal onClose={() => setOpenModal(null)} />}
      {openModal === "theme" && <ThemeModal onClose={() => setOpenModal(null)} />}

      {comingSoonName && (
        <StatusModal
          variant="info"
          title="Tez orada"
          message={`"${comingSoonName}" bo'limi hali ishlab chiqilmoqda.`}
          onClose={() => setComingSoonName(null)}
        />
      )}

      {logoutError && (
        <StatusModal
          variant="error"
          title="Tizimdan chiqishda xatolik"
          message={logoutError}
          onClose={() => setLogoutError(null)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
