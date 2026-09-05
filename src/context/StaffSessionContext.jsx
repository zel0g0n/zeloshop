import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/firebase/config";
import { getTelegramWebApp, isRunningInTelegram, waitForInitData } from "@/config/telegram";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToStaffDoc } from "@/services/staff/getStaffList";
import { normalizeStaffPermissions, normalizeStaffRole } from "@/utils/staffRoles";

/**
 * XODIM SESSIYASI — `CourierSessionContext.jsx` BILAN AYNAN BIR XIL
 * naqsh, `SessionContext.jsx` (sotuvchi/mijoz/admin)dan ATAYLAB ALOHIDA,
 * MUSTAQIL "sessiya daraxti".
 *
 * NEGA ALOHIDA: xodim Mini App'i BUTUNLAY BOSHQA Telegram botidan
 * (foydalanuvchi o'zi yaratadigan "xodim boti") ochiladi — uning
 * `initData`si BOSHQA token (`STAFF_BOT_TOKEN`) bilan imzolangan
 * bo'ladi, `verifyTelegramAuth` buni tekshira olmaydi (qarang:
 * `functions/staffAuth.js`dagi `verifyStaffTelegramAuth`). Mavjud, ENG
 * KRITIK auth yo'lini (sotuvchi/mijoz/admin) to'rtinchi/beshinchi holat
 * bilan murakkablashtirish o'rniga, kuryer uchun qilingani kabi,
 * butunlay yangi, izolyatsiya qilingan qism qo'shildi.
 *
 * Qaysi daraxt render qilinishi `src/app/App.jsx`da, URL yo'liga qarab
 * (`/staff` bilan boshlansa) hal qilinadi.
 *
 * `permissions` maydoni — sotuvchi tomonidan belgilangan ruxsatlar
 * (2026-09 punkt-royxati, 2-band "Advanced Team & RBAC"dan keyin — 6
 * ta kalit: `manageProducts`/`manageOrders`/`manageCouriers`/
 * `manageCustomers`/`viewFinance`/`manageStaff`, batafsil izoh:
 * `src/utils/staffRoles.js`) — Mini App'ning qaysi bo'limlari
 * ko'rsatilishini boshqaradi (`StaffHomePage.jsx`ga qarang). `role`
 * maydoni — FAQAT ko'rsatish uchun YORLIQ (haqiqiy kirish nazorati
 * doim `permissions`ga tayanadi). Sessiya ochilgach ham JONLI
 * kuzatiladi (`subscribeToStaffDoc`) — sotuvchi ruxsatni o'zgartirsa
 * yoki xodimni faolsizlantirsa, Mini App darhol (sahifani
 * yangilamasdan) buni ko'radi.
 *
 * ATAYLAB YO'Q: bu yerda hech qanday "AI CEO" bilan bog'liq maydon,
 * chaqiruv yoki marshrut yo'q — xodim bu funksiyaga hech qachon kira
 * olmaydi (ruxsat ro'yxatida ham bunday variant mavjud emas).
 */
const StaffSessionContext = createContext(null);

export const StaffSessionProvider = ({ children }) => {
  const { t } = useLanguage();
  const [state, setState] = useState({
    status: "loading", // 'loading' | 'ready' | 'error' | 'inactive'
    staffId: null,
    sellerId: null,
    staffName: null,
    staffPhone: null,
    permissions: normalizeStaffPermissions(null),
    role: null,
    telegramUser: null,
    store: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const webApp = getTelegramWebApp();

      if (!isRunningInTelegram()) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: t("staffApp.notInTelegram") }));
        }
        return;
      }

      webApp.ready?.();
      webApp.expand?.();

      const initData = await waitForInitData();
      if (!initData) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: t("staffApp.noInitData") }));
        }
        return;
      }

      try {
        const verifyStaffTelegramAuth = httpsCallable(functions, "verifyStaffTelegramAuth");
        const { data } = await verifyStaffTelegramAuth({ initData });

        await signInWithCustomToken(auth, data.token);

        if (!cancelled) {
          setState({
            status: data.staff?.status === "active" ? "ready" : "inactive",
            staffId: data.telegramUser.id,
            sellerId: data.staff?.sellerId || null,
            staffName: data.staff?.name || null,
            staffPhone: data.staff?.phone || null,
            permissions: normalizeStaffPermissions(data.staff?.permissions),
            role: normalizeStaffRole(data.staff?.role),
            telegramUser: data.telegramUser,
            store: data.store,
            error: null,
          });
        }
      } catch (err) {
        console.error("Xodim sessiyasini aniqlashda xatolik:", err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: err.message || t("staffApp.errorAuthGeneric") }));
        }
      }
    };

    resolveSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessiya faqat MOUNT'da BIR MARTA aniqlanishi kerak.
  }, []);

  // Sessiya "ready" bo'lgach — o'z hujjatiga jonli obuna, ruxsat/status
  // o'zgarishlarini real-vaqtda ilova qilish uchun (qarang: fayl izohi).
  useEffect(() => {
    if (!state.staffId || state.status === "loading" || state.status === "error") return undefined;

    const unsubscribe = subscribeToStaffDoc(
      state.staffId,
      (staffData) => {
        if (!staffData) return;
        setState((prev) => ({
          ...prev,
          status: staffData.status === "active" ? "ready" : "inactive",
          staffName: staffData.name || prev.staffName,
          staffPhone: staffData.phone || prev.staffPhone,
          permissions: normalizeStaffPermissions(staffData.permissions),
          role: normalizeStaffRole(staffData.role),
        }));
      },
      () => {
        // Jim qolamiz - dastlabki auth natijasi kuchda qoladi.
      }
    );
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat staffId o'zgarganda qayta obuna bo'lish kerak.
  }, [state.staffId]);

  const value = useMemo(() => ({ ...state }), [state]);

  return (
    <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
  );
};

export const useStaffSession = () => {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) {
    throw new Error("useStaffSession faqat <StaffSessionProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};
