import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffSession } from "./StaffSessionContext";

/**
 * `CourierGate.jsx`ning xodim Mini App'i uchun nusxasi. Farqi: kuryerda
 * yo'q bo'lgan uchinchi holat — "inactive" (sotuvchi xodimni
 * faolsizlantirgan yoki o'chirib tashlagan bo'lishi mumkin, buni auth
 * vaqtida HAM, keyinroq jonli obuna orqali HAM aniqlash mumkin — qarang:
 * `StaffSessionContext.jsx`).
 */
const StaffGate = ({ children }) => {
  const { t } = useLanguage();
  const { status, error } = useStaffSession();

  if (status === "loading") {
    return <FullScreenSpinner />;
  }

  if (status === "error") {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-white">{t("staffApp.loginErrorTitle")}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{error || t("staffApp.loginErrorFallback")}</p>
      </div>
    );
  }

  if (status === "inactive") {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-white">{t("staffApp.inactiveTitle")}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{t("staffApp.inactiveDesc")}</p>
      </div>
    );
  }

  return children;
};

export default StaffGate;
