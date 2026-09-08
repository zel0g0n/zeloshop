import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import CourierManagementSection from "./CourierManagementSection";

/**
 * Sotuvchi — "Kuryerlar" MUSTAQIL sahifasi (o'z URL'i, `/seller/couriers`).
 *
 * 2026-09 foydalanuvchi so'roviga ko'ra, "Kuryerlar" endi Sozlamalar
 * (`More.jsx`) ro'yxatidan OLIB TASHLANDI va o'rniga Yetkazib berish
 * sozlamalari (`DeliverySettingsPage.jsx`) ichida UCHINCHI tab sifatida
 * ko'rsatiladi. LEKIN bu sahifaning O'ZI butunlay o'chirilmadi — chunki
 * `CourierPickerModal.jsx` (buyurtmaga kuryer tayinlashda, hali birorta
 * ham kuryer qo'shilmagan bo'lsa) shu YERGA chuqur havola beradi. Shu
 * sabab, asosiy mantiq (`CourierManagementSection.jsx`) ikkalasida ham
 * QAYTA ISHLATILADI — faqat shu yerda sarlavha/orqaga tugmasi qo'shiladi.
 */
const CourierManagementPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("courierManagement.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("courierManagement.subtitle")}</p>
        </div>
      </div>

      <CourierManagementSection />
    </div>
  );
};

export default CourierManagementPage;
