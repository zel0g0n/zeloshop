import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { useLanguage } from "@/context/LanguageContext";
import { useCourierSession } from "./CourierSessionContext";

/**
 * `SessionGate.jsx`ning kuryer Mini App'i uchun soddalashtirilgan
 * nusxasi — faqat ikkita holat bor (yuklanmoqda / xato), admin/
 * onboarding kabi qo'shimcha tarmoqlanish YO'Q (kuryer sessiyasi
 * har doim yoki "tayyor", yoki "xato").
 */
const CourierGate = ({ children }) => {
  const { t } = useLanguage();
  const { status, error } = useCourierSession();

  if (status === "loading") {
    return <FullScreenSpinner />;
  }

  if (status === "error") {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-white">{t("courierApp.loginErrorTitle")}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{error || t("courierApp.loginErrorFallback")}</p>
      </div>
    );
  }

  return children;
};

export default CourierGate;
