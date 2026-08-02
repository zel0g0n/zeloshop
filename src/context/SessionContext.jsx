import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/firebase/config";
import {
  getTelegramWebApp,
  isRunningInTelegram,
  waitForInitData,
  DEV_FALLBACK_SELLER_ID,
  DEV_FALLBACK_CLIENT_ID,
} from "@/config/telegram";

/**
 * SessionContext — butun ilova uchun BITTA joriy sotuvchi/mijoz manbai.
 *
 * ILGARI: sellerId/clientId `window.Telegram.WebApp.initDataUnsafe`dan
 * TO'G'RIDAN-TO'G'RI, HECH TASDIQLANMASDAN o'qilardi. Bu — "unsafe" so'zi
 * nomida bejiz emas: brauzer konsolidan har kim uni o'zgartira olardi.
 *
 * ENDI: xom `initData` (imzolangan qator) Cloud Function'ga
 * (`verifyTelegramAuth`) yuboriladi, u yerda bot tokeni bilan raqamli
 * imzo tekshiriladi va SHUNDAGINA Firebase custom auth token beriladi.
 * `sellerId`/`clientId` endi `auth.currentUser.uid`dan (server tomonidan
 * tasdiqlangan) olinadi — Firestore Security Rules ham aynan shu
 * `request.auth.uid`ga tayanadi (`firestore.rules` faylига qarang).
 *
 * YANGI: start_param yo'q holatda (botni to'g'ridan-to'g'ri ochganda)
 * endi shunchaki "bu sotuvchi" deb hisoblanmaydi — avval Firestore'dan
 * `sellers/{uid}` hujjati haqiqatan mavjudligi tekshiriladi. Mavjud
 * bo'lmasa, `needsOnboarding: true` bilan qaytariladi — bu ZeloShop
 * "do'kon yaratuvchi platforma" ekanligini aks ettiradi: har kim botni
 * ochganda avtomatik sotuvchi panelга tushib qolmasligi kerak.
 */
const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [state, setState] = useState({
    status: "loading", // 'loading' | 'ready' | 'error'
    sellerId: null,
    clientId: null,
    isSeller: false,
    isAdmin: false,
    needsOnboarding: false,
    telegramUser: null,
    security: null,
    // Joriy do'konning ommaviy ma'lumoti (nomi, logotipi, telefoni).
    // OLDIN bu Header.jsx o'zining lokal state'ida yuklardi — lekin
    // Header sahifadan sahifaga o'tganda QAYTA MONTAJ qilinadi, shuning
    // uchun har safar avval bo'sh/standart holat ko'rinib, keyin
    // haqiqiy ma'lumotga almashardi. Endi bu ma'lumot shu yerda —
    // SessionProvider darajasida (u ilova ishlagan davomida hech qachon
    // qayta montaj qilinmaydi) — bir marta yuklanadi va keshlanadi.
    store: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      // MUHIM DIAGNOSTIKA (vaqtinchalik): sahifa navigatsiyasi
      // boshlanishidan (index.html'dagi eng birinchi belgidan) shu
      // qatorgacha qancha vaqt o'tganini ko'rsatadi — bu, JS
      // fayllarining yuklanishi/ochilishi/bajarilishi uchun ketgan,
      // hozirgacha o'lchanmagan vaqt.
      if (window.__appLoadStart !== undefined) {
        console.log(
          "0️⃣ Sahifa boshidan SessionContext ishga tushgunicha (JS yuklanish/bajarilish):",
          (performance.now() - window.__appLoadStart).toFixed(2),
          "ms"
        );
      }
      console.time("⏱️ TOTAL sessiya aniqlash");
      const webApp = getTelegramWebApp();
      const inTelegram = isRunningInTelegram();

      // Telegram tashqarisida (masalan localhost'da test qilinayotganda) —
      // Cloud Function'ni chaqirishning ma'nosi yo'q (initData bo'lmaydi).
      // Lokal test uchun zaxira ID'lar ishlatiladi.
      if (!inTelegram) {
        if (!cancelled) {
          setState({
            status: "ready",
            sellerId: DEV_FALLBACK_SELLER_ID,
            clientId: DEV_FALLBACK_CLIENT_ID,
            isSeller: true,
            isAdmin: false,
            needsOnboarding: false,
            telegramUser: null,
            store: null,
            security: null,
            error: null,
          });
        }
        console.timeEnd("⏱️ TOTAL sessiya aniqlash");
        return;
      }

      // Telegram'ga "ilova tayyor" deb signal beramiz va to'liq ekranga
      // yoyamiz — bu SDK'ning standart, tavsiya etilgan boshlash tartibi.
      webApp.ready?.();
      webApp.expand?.();

      // `initData` "sovuq" ochilishda bir zumga bo'sh bo'lishi mumkin —
      // shuning uchun uni to'ldirilishini biroz kutamiz (ODATDA bir
      // necha millisoniya ichida tayyor bo'ladi). Sahifani yangilashda
      // muammo ko'rinmasligining sababi ham shu edi — refresh paytida
      // Telegram allaqachon tayyor holatda edi.
      console.time("1️⃣ waitForInitData");
      const initData = await waitForInitData();
      console.timeEnd("1️⃣ waitForInitData");

      if (!initData) {
        console.error("Telegram initData ko'rinmadi (kutishdan keyin ham bo'sh).");
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: "Telegram ma'lumotlarini o'qib bo'lmadi. Ilovani qayta oching.",
          }));
        }
        console.timeEnd("⏱️ TOTAL sessiya aniqlash");
        return;
      }

      try {
        console.time("2️⃣ verifyTelegramAuth (Cloud Function)");
        const verifyTelegramAuth = httpsCallable(functions, "verifyTelegramAuth");
        const { data } = await verifyTelegramAuth({ initData });
        console.timeEnd("2️⃣ verifyTelegramAuth (Cloud Function)");

        console.time("3️⃣ signInWithCustomToken");
        await signInWithCustomToken(auth, data.token);
        console.timeEnd("3️⃣ signInWithCustomToken");

        const ownUid = data.telegramUser.id;
        const startParam = data.startParam;

        // Admin va sotuvchi/do'kon hujjatini PARALEL (bir vaqtda)
        // OLDIN: bu yerda mijoz o'zining Firestore SDK'i orqali
        // admin+do'kon hujjatlarini ALOHIDA so'rar edi — bu, diagnostika
        // ko'rsatganidek, Telegram WebView'da ~4.8 soniyagacha vaqt
        // olishi mumkin edi (SDK'ning ulanish turini aniqlashi tufayli).
        // ENDI: bu ma'lumot `verifyTelegramAuth` javobining o'zida
        // (server tomonida, Admin SDK orqali, tezkor) allaqachon
        // keladi — qo'shimcha so'rov shart emas.
        const isAdmin = Boolean(data.isAdmin);
        const sellerDoc = data.store;

        // Admin holati eng birinchi tekshiriladi — agar bu odam admin
        // bo'lsa, qanday havola orqali kirganidan qat'i nazar, doim
        // admin panelga yo'naltiriladi (bu alohida, alohida boshqariladigan
        // rol).
        if (isAdmin) {
          if (!cancelled) {
            setState({
              status: "ready",
              sellerId: null,
              clientId: null,
              isSeller: false,
              isAdmin: true,
              needsOnboarding: false,
              telegramUser: data.telegramUser,
              store: null,
              security: null,
              error: null,
            });
          }
          return;
        }

        // start_param bor => bu foydalanuvchi biror sotuvchining do'kon
        // havolasi orqali MIJOZ sifatida kirgan (t.me/bot?start=SELLER_UID).
        if (startParam) {
          if (!cancelled) {
            setState({
              status: "ready",
              sellerId: startParam,
              clientId: ownUid,
              isSeller: false,
              isAdmin: false,
              needsOnboarding: false,
              telegramUser: data.telegramUser,
              store: sellerDoc,
              security: null,
              error: null,
            });
          }
          return;
        }

        // start_param yo'q => botni to'g'ridan-to'g'ri ochgan. Bu odam
        // ALLAQACHON sotuvchimi (do'koni bormi) — yuqorida paralel
        // tekshirilgan natijadan foydalanamiz.
        if (!cancelled) {
          setState({
            status: "ready",
            sellerId: sellerDoc ? ownUid : null,
            clientId: null,
            isSeller: Boolean(sellerDoc),
            isAdmin: false,
            needsOnboarding: !sellerDoc,
            telegramUser: data.telegramUser,
            store: sellerDoc,
            security: data.security,
            error: null,
          });
        }
      } catch (err) {
        console.error("Sessiyani aniqlashda xatolik:", err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: err.message }));
        }
      } finally {
        console.timeEnd("⏱️ TOTAL sessiya aniqlash");
      }
    };

    resolveSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ro'yxatdan o'tish (do'kon yaratish) muvaffaqiyatli tugagach chaqiriladi —
  // butun ilovani qayta yuklamasdan, to'g'ridan-to'g'ri sotuvchi panelга
  // o'tish uchun sessiyani yangilaydi.
  const completeOnboarding = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sellerId: prev.telegramUser?.id || prev.sellerId,
      isSeller: true,
      needsOnboarding: false,
    }));
  }, []);

  const value = useMemo(() => ({ ...state, completeOnboarding }), [state, completeOnboarding]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSession = () => {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession faqat <SessionProvider> ichida ishlatilishi kerak");
  }
  return ctx;
};
