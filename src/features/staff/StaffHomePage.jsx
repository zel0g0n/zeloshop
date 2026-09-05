import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserRoundCog, Store, ClipboardList, Package, Users, Wallet, ShieldCheck, ShieldAlert, Settings } from "lucide-react";
import { useStaffSession } from "@/context/StaffSessionContext";
import { useLanguage } from "@/context/LanguageContext";
import StaffOrdersSection from "./StaffOrdersSection";
import StaffProductsSection from "./StaffProductsSection";
import StaffCustomersSection from "./StaffCustomersSection";
import StaffFinanceSection from "./StaffFinanceSection";
import StaffTeamSection from "./StaffTeamSection";
import StaffProfileModal from "./StaffProfileModal";

// Har bir mumkin bo'lgan bo'lim — ruxsat kaliti + ikonka + tab-nomi
// i18n kaliti + render qilinadigan komponent shu bitta jadvalda (2026-09
// punkt-royxati, 2-band "Advanced Team & RBAC": 2 tadan 5 taga
// kengaytirildi — yangi qo'shish endi shu yerga bitta qator qo'shish
// bilan cheklanadi).
const TAB_DEFS = [
  { key: "orders", permKey: "manageOrders", Icon: ClipboardList, labelKey: "tabOrders", Component: StaffOrdersSection },
  { key: "products", permKey: "manageProducts", Icon: Package, labelKey: "tabProducts", Component: StaffProductsSection },
  { key: "customers", permKey: "manageCustomers", Icon: Users, labelKey: "tabCustomers", Component: StaffCustomersSection },
  { key: "finance", permKey: "viewFinance", Icon: Wallet, labelKey: "tabFinance", Component: StaffFinanceSection },
  { key: "team", permKey: "manageStaff", Icon: ShieldCheck, labelKey: "tabTeam", Component: StaffTeamSection },
];

/**
 * Xodim Mini App'ining YAGONA sahifasi — `CourierOrdersPage.jsx` bilan
 * BIR XIL falsafa ("bitta sahifa, tezkorlik"), lekin bo'limlar
 * (Buyurtmalar/Mahsulotlar/Mijozlar/Moliya/Jamoa — 2026-09 punkt-
 * royxati, 2-band "Advanced Team & RBAC"dan keyin 2 tadan 5 taga
 * kengaytirildi) o'rtasida TAB orqali almashtiriladi, chunki
 * (kuryerdan farqli o'laroq) xodimning bir nechta MUSTAQIL ruxsati
 * bo'lishi mumkin.
 *
 * ENG MUHIM QISM — RUXSATGA QARAB KO'RSATISH: har bir bo'lim FAQAT
 * sotuvchi (yoki `manageStaff`ga ega "Admin" xodim) shu xodimga ANIQ
 * shu ruxsatni bergan bo'lsagina ko'rinadi (`TAB_DEFS` jadvalidagi
 * `permKey`, `StaffSessionContext.jsx`dan JONLI keladi — ruxsat
 * istalgan payt o'zgartirilsa, bu yerda darhol aks etadi, sahifani
 * yangilash shart emas). Agar birorta ham ruxsat yo'q bo'lsa
 * (nazariy jihatdan sodir bo'lmasligi kerak — `createStaffInvite`
 * kamida bittasini talab qiladi — lekin sotuvchi KEYINROQ hammasini
 * ham o'chirib qo'yishi mumkin), aniq tushunarli xabar ko'rsatiladi.
 *
 * ATAYLAB HECH QANDAY "AI CEO" bilan bog'liq tab/bo'lim/marshrut YO'Q
 * — bu funksiya ro'yxatida UMUMAN mavjud emas, shuning uchun xodim
 * unga hech qanday yo'l bilan kira olmaydi.
 */
const StaffHomePage = () => {
  const { t } = useLanguage();
  const { staffId, staffName, staffPhone, store, permissions } = useStaffSession();
  const [searchParams] = useSearchParams();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const availableTabDefs = TAB_DEFS.filter((tab) => permissions[tab.permKey]);
  const availableTabs = availableTabDefs.map((tab) => tab.key);

  // Telegram bot xabaridagi "🗂 Buyurtmalarni ochish"/"Mahsulotlar" tugmasi
  // `?tab=orders` (yoki `?tab=products`) parametri bilan to'g'ridan-
  // to'g'ri kerakli bo'limni ochishi uchun (8-band, 2026-09
  // punkt-royxati) - lekin faqat xodimda shu bo'limga ruxsat bo'lsa.
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && availableTabs.includes(requestedTab) ? requestedTab : availableTabs[0] || null
  );

  // Ruxsatlar to'plami (`permissions`) o'zgarishi bilan qayta
  // tekshiriladi — massiv o'zi HAR RENDER'da qayta yaratilgani uchun
  // (yuqorida `.filter(...)`), bevosita bog'liqlik sifatida
  // ishlatilsa cheksiz aylanishga olib kelardi; shuning uchun uning
  // ICHIDAGI qiymatlar (qaysi ruxsat true/false) solishtiriladi.
  const permissionsSignature = TAB_DEFS.map((tab) => (permissions[tab.permKey] ? "1" : "0")).join("");
  useEffect(() => {
    if (activeTab && availableTabs.includes(activeTab)) return;
    setActiveTab(availableTabs[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat `permissionsSignature` o'zgarganda tekshiriladi
  }, [permissionsSignature]);

  const ActiveComponent = availableTabDefs.find((tab) => tab.key === activeTab)?.Component || null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-950 font-sans">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <UserRoundCog size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black text-slate-800 dark:text-white truncate">{staffName || t("staffApp.defaultStaffName")}</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate">
              <Store size={11} /> {store?.storeName || t("staffApp.defaultStoreName")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            aria-label={t("staffApp.settingsAria")}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          >
            <Settings size={16} />
          </button>
        </div>

        {/* 2026-09 punkt-royxati, 2-band: 2 tadan 5 tagacha (Buyurtmalar/
            Mahsulotlar/Mijozlar/Moliya/Jamoa) bo'lim bo'lishi mumkin
            bo'lgani uchun, endi qat'iy 2-ustunli katak o'rniga, gorizontal
            aylantiriladigan qator ishlatiladi — necha tab bo'lishidan
            qat'i nazar to'g'ri sig'adi. */}
        {availableTabDefs.length > 1 && (
          <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar">
            {availableTabDefs.map(({ key, Icon, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`shrink-0 h-9 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === key ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                <Icon size={13} /> {t(`staffApp.${labelKey}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {ActiveComponent && <ActiveComponent />}

      {!activeTab && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-2 px-6">
          <ShieldAlert size={36} className="text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t("staffApp.noPermissionsTitle")}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("staffApp.noPermissionsDesc")}</p>
        </div>
      )}

      {showProfileModal && (
        <StaffProfileModal
          staffId={staffId}
          name={staffName}
          phone={staffPhone}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
};

export default StaffHomePage;
