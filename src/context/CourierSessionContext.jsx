import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/firebase/config";
import { getTelegramWebApp, isRunningInTelegram, waitForInitData } from "@/config/telegram";
import { useLanguage } from "@/context/LanguageContext";

/**
 * KURYER SESSIYASI (v39) — `SessionContext.jsx` (sotuvchi/mijoz/admin)
 * BILAN ATAYLAB PARALEL, MUSTAQIL "sessiya daraxti".
 *
 * NEGA ALOHIDA (mavjud SessionContext'ga 4-rol sifatida QO'SHILMAGAN):
 * kuryer Mini App'i BUTUNLAY BOSHQA Telegram botidan (`zeloshop_kuryer_bot`)
 * ochiladi — uning `initData`si BOSHQA token (`COURIER_BOT_TOKEN`)
 * bilan imzolangan bo'ladi, `verifyTelegramAuth` buni tekshira olmaydi
 * (`functions/courierAuth.js`dagi `verifyCourierTelegramAuth`ga
 * qarang). Mavjud, ENG KRITIK auth yo'lini to'rtinchi holat bilan
 * murakkablashtirish o'rniga, butunlay yangi, izolyatsiya qilingan
 * qism qo'shish — mavjud sotuvchi/mijoz/admin oqimini XAVF OSTIGA
 * QO'YMASLIK uchun eng xavfsiz yo'l edi.
 *
 * Qaysi daraxt render qilinishi `src/app/App.jsx`da, URL yo'liga
 * qarab (`/courier` bilan boshlansa) hal qilinadi — `SessionProvider`
 * bu holatda UMUMAN mount qilinmaydi.
 */
const CourierSessionContext = createContext(null);

export const CourierSessionProvider = ({ children }) => {
  const { t } = useLanguage();
  const [state, setState] = useState({
    status: "loading", // 'loading' | 'ready' | 'error'
    courierId: null,
    sellerId: null,
    courierName: null,
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
          setState((prev) => ({
            ...prev,
            status: "error",
            error: t("courierApp.notInTelegram"),
          }));
        }
        return;
      }

      webApp.ready?.();
      webApp.expand?.();

      const initData = await waitForInitData();
      if (!initData) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: t("courierApp.noInitData"),
          }));
        }
        return;
      }

      try {
        const verifyCourierTelegramAuth = httpsCallable(functions, "verifyCourierTelegramAuth");
        const { data } = await verifyCourierTelegramAuth({ initData });

        await signInWithCustomToken(auth, data.token);

        if (!cancelled) {
          setState({
            status: "ready",
            courierId: data.telegramUser.id,
            sellerId: data.courier?.sellerId || null,
            courierName: data.courier?.name || null,
            telegramUser: data.telegramUser,
            store: data.store,
            error: null,
          });
        }
      } catch (err) {
        console.error("Kuryer sessiyasini aniqlashda xatolik:", err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: err.message || t("courierApp.errorAuthGeneric") }));
        }
      }
    };

    resolveSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sessiya faqat MOUNT'da BIR MARTA aniqlanishi kerak (`t` faqat boshlang'ich til bilan ishlatiladi, til o'zgarishi qayta autentifikatsiyani qayta ishga tushirmasligi kerak).
  }, []);

  const value = useMemo(() => ({ ...state }), [state]);

  return (
    <CourierSessionContext.Provider value={value}>{children}</CourierSessionContext.Provider>
  );
};

export const useCourierSession = () => {
  const ctx = useContext(CourierSessionContext);
  if (!ctx) {
    throw new Error("useCourierSession faqat <CourierSessionProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};
