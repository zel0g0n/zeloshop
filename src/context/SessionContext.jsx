import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { auth, functions } from "@/firebase/config";
import { getTelegramWebApp, isRunningInTelegram, waitForInitData } from "@/config/telegram";
import { AUTH_RETRY_DELAYS_MS, isLikelyNetworkError } from "@/utils/authErrorClassifier";
import { loginWithPassword, fetchWebSession, logoutWeb } from "@/services/auth/webSession";
import {
  ACTIVITY_WRITE_THROTTLE_MS,
  clearLastActive,
  isIdleExpired,
  readLastActive,
  writeLastActive,
} from "@/utils/webSessionIdle";

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
 *
 * 2026-09 audit qarori — bu Context ATAYLAB BO'LINMADI:
 * `CatalogFilterContext` (qidiruv har harfda) kabi, bu yerda ham
 * "78 ta consumer bitta value ob'ektini ulashadi" degan tashqi ko'rinish
 * bor edi. LEKIN sabab-oqibat butunlay boshqacha: u yerda `queryKey`
 * HAR HARFDA (soniyasiga o'nlab marta) o'zgarardi. Bu yerda esa `state`
 * amalda faqat: (1) ilova ochilganda BIR MARTA (sessiya aniqlanganda),
 * va (2) foydalanuvchi aniq bir amalni bajarganda — sozlamalarni
 * saqlash, mahsulot qo'shish kabi — kamdan-kam marta (`patchStore`/
 * `patchDashboardSummary`/`completeOnboarding` chaqiruvlari, tekshirib
 * chiqilgan: soniyasiga emas, sessiya davomida bir necha marta)
 * o'zgaradi. Ya'ni bu yerda "tez o'zgaruvchi" va "barqaror" maydonlarni
 * ajratish orqali oldini olinadigan HAQIQIY re-render muammosi yo'q —
 * kontekst bo'linsa ham, bo'linmasa ham, 78 ta consumer session
 * davomida bor-yo'g'i bir necha marta qayta render bo'ladi.
 * Buning o'rniga 78 ta chaqiruv joyini (ilovaning ENG xavfsizlikka
 * bog'liq qismi — auth/rol/tenant izolyatsiyasi) qayta yozish katta
 * regressiya xavfi keltirib chiqarardi, lekin o'lchanadigan foyda
 * deyarli nol bo'lardi — bu "kodni keraksiz qayta yozish" bo'lardi.
 * Xulosa: split QILINMADI — bu ataylab, tekshirilgan qaror.
 */
const SessionContext = createContext(null);

/**
 * Brauzer (Telegramsiz) sessiyasini aniqlaydi: Firebase'ning o'zi saqlagan
 * (IndexedDB) kirishni tiklaydi va FAQAT `loginMethod: "password"` tokenli,
 * harakatsizlik muddati o'tmagan sessiyani qabul qiladi.
 */
const loggedOutState = (error = null) => ({
  status: "login-required",
  sellerId: null,
  clientId: null,
  isSeller: false,
  isAdmin: false,
  needsOnboarding: false,
  telegramUser: null,
  security: null,
  dashboardSummary: null,
  store: null,
  deepLinkPath: null,
  sellerInviterId: null,
  isWebSession: true,
  error,
});

const readyWebState = (data) => ({
  status: "ready",
  sellerId: data.sellerId,
  clientId: null,
  isSeller: true,
  isAdmin: false, // parol bilan kirilgan sessiya HECH QACHON admin emas
  needsOnboarding: false,
  telegramUser: { id: data.sellerId, firstName: null, lastName: null, username: null },
  store: data.store,
  security: data.security,
  dashboardSummary: data.dashboardSummary,
  deepLinkPath: null,
  sellerInviterId: null,
  isWebSession: true,
  error: null,
});

async function resolveWebSession(isCancelled, setState) {
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) {
      if (!isCancelled()) setState(loggedOutState());
      return;
    }

    // Faqat parol bilan olingan token qabul qilinadi (boshqa har qanday
    // eski/begona sessiya — masalan Telegram tokeni — tozalanadi).
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.loginMethod !== "password") {
      await logoutWeb();
      if (!isCancelled()) setState(loggedOutState());
      return;
    }

    if (isIdleExpired(readLastActive(), Date.now())) {
      await logoutWeb();
      clearLastActive();
      if (!isCancelled()) setState(loggedOutState("idle-expired"));
      return;
    }

    const data = await fetchWebSession();
    if (isCancelled()) return;
    writeLastActive();
    setState(readyWebState(data));
  } catch (err) {
    if (isCancelled()) return;
    const code = err?.code || "";
    // Server sessiyani rad etdi (masalan do'kon o'chirilgan) — tozalab, qayta kirishga yo'naltiramiz.
    if (code.includes("permission-denied") || code.includes("unauthenticated") || code.includes("not-found")) {
      await logoutWeb().catch(() => {});
      setState(loggedOutState(err?.message || null));
      return;
    }
    console.error("Veb sessiyani aniqlashda xatolik:", err);
    setState((prev) => ({
      ...prev,
      isWebSession: true,
      status: isLikelyNetworkError(err) ? "network-error" : "error",
      error: err?.message || "Noma'lum xatolik",
    }));
  }
}

export const SessionProvider = ({ children }) => {
  const [state, setState] = useState({
    status: "loading", // 'loading' | 'ready' | 'error' | 'network-error'
    sellerId: null,
    clientId: null,
    isSeller: false,
    isAdmin: false,
    needsOnboarding: false,
    telegramUser: null,
    security: null,
    dashboardSummary: null,
    // Joriy do'konning ommaviy ma'lumoti (nomi, logotipi, telefoni).
    // OLDIN bu Header.jsx o'zining lokal state'ida yuklardi — lekin
    // Header sahifadan sahifaga o'tganda QAYTA MONTAJ qilinadi, shuning
    // uchun har safar avval bo'sh/standart holat ko'rinib, keyin
    // haqiqiy ma'lumotga almashardi. Endi bu ma'lumot shu yerda —
    // SessionProvider darajasida (u ilova ishlagan davomida hech qachon
    // qayta montaj qilinmaydi) — bir marta yuklanadi va keshlanadi.
    store: null,
    // Chuqur havola orqali kirilgan bo'lsa (masalan bitta kategoriyaga
    // to'g'ridan-to'g'ri), shu yerga yoziladi - `DeepLinkRedirector.jsx`
    // sessiya tayyor bo'lgach, buni o'qib, o'sha sahifaga BIR MARTA
    // yo'naltiradi.
    deepLinkPath: null,
    // Sotuvchini taklif qilish havolasi orqali (birinchi marta)
    // ochilgan bo'lsa, shu yerga taklif qilgan sotuvchining ID'si
    // yoziladi - `CreateStoreScreen.jsx` do'kon yaratilganda buni
    // `createSeller()`ga uzatadi (`sellerReferrals.js`ga qarang).
    // Faqat `needsOnboarding: true` bilan birga ma'noli.
    sellerInviterId: null,
    // Brauzerda (Telegramsiz), login/parol bilan kirilgan sessiyami
    // (`functions/webAppAuth.js`). `status: "login-required"` — hali
    // kirilmagan, `SessionGate.jsx` Kirish sahifasini ko'rsatadi.
    isWebSession: false,
    error: null,
  });
  const [loggingIn, setLoggingIn] = useState(false);

  // 2026-09 QO'SHILDI (13/14-band): "Qayta urinish" tugmasi shu sonni
  // oshiradi — bu pastdagi `useEffect`ni qaytadan ishga tushiradi va
  // butun autentifikatsiya jarayoni boshidan boshlanadi.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      const webApp = getTelegramWebApp();
      const inTelegram = isRunningInTelegram();

      // Telegram TASHQARISIDA (oddiy brauzer) — sotuvchi panelini login/parol
      // bilan ochish yo'li (`functions/webAppAuth.js`). OLDIN bu yerda
      // qat'iy yozilgan zaxira (dev-fallback) ID'lar bilan "tizimga
      // kirilgan" deb ko'rsatilardi — productionda bu xavfli edi, endi
      // butunlay olib tashlangan: haqiqiy, server tomonidan tasdiqlangan
      // sessiya bo'lmasa, Kirish sahifasi ko'rsatiladi.
      if (!inTelegram) {
        await resolveWebSession(() => cancelled, setState);
        return;
      }

      // Telegram'ga "ilova tayyor" deb signal beramiz va to'liq ekranga
      // yoyamiz — bu SDK'ning standart, tavsiya etilgan boshlash tartibi.
      webApp.ready?.();
      webApp.expand?.();

      // Sotuvchining shaxsiy (faqat xaridor uchun) boti — Mini App
      // manziliga ATAYLAB o'z sellerId'ini o'rnatib qo'yadi
      // (`?ownerSellerId=...`). Bu — botni HAR QANDAY tarzda (hatto
      // oddiy "Start" tugmasi bilan, `start_param`siz) ochilganda
      // ham, qaysi sotuvchining shaxsiy tokenini sinash kerakligini
      // aniqlash imkonini beradi.
      const urlParams = new URLSearchParams(window.location.search);
      const ownerSellerId = urlParams.get("ownerSellerId") || null;
      // Sotuvchining shaxsiy boti (`customBotWebhook.js`) mahsulotga
      // TO'G'RIDAN-TO'G'RI ochiladigan Mini App tugmasi yuborganda,
      // yo'l shu YERDA, oddiy URL parametri sifatida keladi (Telegram
      // `start_param`i orqali EMAS — chunki bu oddiy `web_app` tugma,
      // `startapp` chuqur havolasi emas, demak `initData`da
      // `start_param` umuman bo'lmaydi). Backend buni bila olmaydi —
      // shuning uchun xavfsizlik tekshiruvi (faqat HAQIQIY, bitta "/"
      // bilan boshlangan ichki yo'l — ochiq yo'naltirish oldini olish
      // uchun) shu yerda, `functions/lib/helpers.js`dagi
      // `decodeDeepLinkPath` bilan BIR XIL mantiqda takrorlanadi.
      const rawOwnerDeepLinkPath = urlParams.get("deepLinkPath") || null;
      const ownerDeepLinkPath =
        rawOwnerDeepLinkPath &&
        rawOwnerDeepLinkPath.startsWith("/") &&
        !(rawOwnerDeepLinkPath.length > 1 && (rawOwnerDeepLinkPath[1] === "/" || rawOwnerDeepLinkPath[1] === "\\"))
          ? rawOwnerDeepLinkPath
          : null;

      // 2026-09 TUZATISH (13/14-band): ILGARI `initData` bo'sh chiqsa
      // yoki `verifyTelegramAuth`/`signInWithCustomToken` BIRON tarmoq
      // xatoligiga uchrasa (masalan Telegram WebView sekin internetda),
      // HECH QANDAY qayta urinishsiz darhol `status: "error"` qo'yilib,
      // foydalanuvchi "Kirishda xatolik yuz berdi" devoriga tiqilib
      // qolardi — sahifani oddiy yangilashning o'zi ham shunga olib
      // kelishi mumkin edi (`waitForInitData()`ning chegaralangan ~2
      // soniyalik kutishi WebView "sovuq" qayta yuklanganda yetmasligi
      // mumkin edi). ENDI: bir necha marta, qisqa oraliqlar bilan qayta
      // uriniladi — FAQAT tarmoqqa o'xshash xatoliklar uchun
      // (`isLikelyNetworkError`). Haqiqiy autentifikatsiya rad etilishi
      // (masalan Telegram imzosi noto'g'ri) qayta urinishsiz darhol
      // to'xtatiladi — buni takrorlash foyda bermaydi.
      let data = null;
      let lastErr = null;
      for (let attempt = 0; attempt < AUTH_RETRY_DELAYS_MS.length; attempt++) {
        if (cancelled) return;
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, AUTH_RETRY_DELAYS_MS[attempt]));
          if (cancelled) return;
        }
        try {
          // `initData` "sovuq" ochilishda bir zumga bo'sh bo'lishi mumkin —
          // shuning uchun har urinishda YANGIDAN kutamiz (ODATDA bir
          // necha millisoniya ichida tayyor bo'ladi).
          const freshInitData = await waitForInitData();
          if (!freshInitData) {
            const emptyErr = new Error(
              "Telegram ma'lumotlarini o'qib bo'lmadi. Ilovani qayta oching."
            );
            emptyErr.isNetworkLike = true;
            throw emptyErr;
          }
          const verifyTelegramAuth = httpsCallable(functions, "verifyTelegramAuth");
          const result = await verifyTelegramAuth({ initData: freshInitData, ownerSellerId });
          await signInWithCustomToken(auth, result.data.token);
          data = result.data;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          // Tarmoqqa o'xshamaydigan (haqiqiy, doimiy) xatolik bo'lsa —
          // qayta urinishning ma'nosi yo'q, darhol to'xtatamiz.
          if (!isLikelyNetworkError(err)) break;
        }
      }

      if (cancelled) return;

      if (!data) {
        console.error(
          "Sessiyani aniqlashda xatolik (barcha urinishlardan keyin):",
          lastErr
        );
        setState((prev) => ({
          ...prev,
          status: isLikelyNetworkError(lastErr) ? "network-error" : "error",
          error: lastErr?.message || "Noma'lum xatolik",
        }));
        return;
      }

      try {
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
              dashboardSummary: null,
              sellerInviterId: null,
              isWebSession: false,
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
              dashboardSummary: null,
              deepLinkPath: data.deepLinkPath || ownerDeepLinkPath || null,
              sellerInviterId: null,
              isWebSession: false,
              error: null,
            });
          }
          return;
        }

        // start_param yo'q => botni to'g'ridan-to'g'ri ochgan. Bu odam
        // ALLAQACHON sotuvchimi (do'koni bormi) — yuqorida paralel
        // tekshirilgan natijadan foydalanamiz. Agar sotuvchini taklif
        // qilish havolasi orqali kirgan bo'lsa (`data.sellerInviterId`),
        // bu FAQAT do'koni hali yo'q ("needsOnboarding") odam uchun
        // ma'noli - `CreateStoreScreen.jsx` shu maydonni o'qib,
        // do'kon yaratilganda "kim taklif qilgan"ligini yozib qo'yadi.
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
            dashboardSummary: data.dashboardSummary,
            sellerInviterId: !sellerDoc ? (data.sellerInviterId || null) : null,
            isWebSession: false,
            error: null,
          });
        }
      } catch (err) {
        console.error("Sessiyani aniqlashda xatolik:", err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, status: "error", error: err.message }));
        }
      }
    };

    resolveSession();
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  // 2026-09 QO'SHILDI (13/14-band): "Qayta urinish" tugmasi
  // (`SessionGate.jsx`dagi tarmoq xatoligi modali) shu funksiyani
  // chaqiradi — holat "loading"ga qaytariladi (shunda modal yopilib,
  // spinner ko'rinadi) va `retryToken` oshiriladi, bu esa yuqoridagi
  // `useEffect`ni qaytadan ishga tushiradi.
  const retrySession = useCallback(() => {
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    setRetryToken((prev) => prev + 1);
  }, []);

  // Ro'yxatdan o'tish (do'kon yaratish) muvaffaqiyatli tugagach chaqiriladi —
  // butun ilovani qayta yuklamasdan, to'g'ridan-to'g'ri sotuvchi panelга
  // o'tish uchun sessiyani yangilaydi.
  //
  // MUHIM TUZATISH: oldin `store` bu yerda YANGILANMASDI — do'kon
  // yaratilgandan keyin ham SessionContext'dagi `store` `null` bo'lib
  // qolardi (chunki u faqat ilk sessiya aniqlanganda, BIR MARTA
  // yuklanadi). Natijada, masalan OnboardingChecklist.jsx "do'kon nomi
  // va logotipi" bosqichini `store` orqali tekshirar edi va u `null`
  // bo'lgani uchun HAR DOIM "bajarilmagan" ko'rinardi — sotuvchi
  // ro'yxatdan o'tishda ALLAQACHON kiritgan ma'lumotini yana bir marta
  // kiritishga undalardi. Endi yangi yaratilgan do'kon ma'lumoti
  // to'g'ridan-to'g'ri shu yerga, `newStore` orqali yoziladi.
  const completeOnboarding = useCallback((newStore) => {
    setState((prev) => ({
      ...prev,
      sellerId: prev.telegramUser?.id || prev.sellerId,
      isSeller: true,
      needsOnboarding: false,
      store: newStore ? { ...(prev.store || {}), ...newStore } : prev.store,
    }));
  }, []);

  // MUHIM TUZATISH: `store`/`dashboardSummary` sessiya boshida BIR
  // MARTA yuklanadi va keyin hech qachon o'zi yangilanmaydi (Firestore
  // real-time listener emas, oddiy bir martalik so'rov natijasi).
  // Shu sababli, sotuvchi masalan do'kon sozlamalarini yoki yetkazib
  // berish narxlarini saqlaganda, `OnboardingChecklist.jsx` kabi shu
  // ma'lumotga tayanadigan joylar buni DARHOL ko'rmasdi — faqat
  // sahifani (butun ilovani) yangilagandan keyingina to'g'ri holat
  // ko'rinardi. `patchStore`/`patchDashboardSummary` — mos joyларда
  // muvaffaqiyatli saqlashdan so'ng chaqirilib, sessiyadagi nusxani
  // ham DARHOL (qo'shimcha so'rovsiz) yangilaydi.
  const patchStore = useCallback((patch) => {
    setState((prev) => ({ ...prev, store: { ...(prev.store || {}), ...patch } }));
  }, []);

  const patchDashboardSummary = useCallback((patch) => {
    setState((prev) => ({ ...prev, dashboardSummary: { ...(prev.dashboardSummary || {}), ...patch } }));
  }, []);

  // FRONTEND CACHE AUDITI (2026-09): `patchStore`/`patchDashboardSummary`
  // bilan BIR XIL naqsh - `PrivacySecurityPage.jsx` PIN-kod sozlamasini
  // (`sellers/{id}/private/security`) saqlagach, buni SESSIYADA ham
  // DARHOL yangilaydi. OLDIN bu sahifa `security`ni SessionContext'dan
  // OLDIN allaqachon bor bo'lgan holda ham QAYTA, alohida `getDoc()`
  // orqali o'qirdi (ortiqcha, xarajatli Firestore so'rovi) - endi
  // `useSession()`dagi qiymatning O'ZINI o'qiydi, bu esa SellerLayout'ning
  // PIN qulfi (`security.pinLockEnabled`) o'zgarishni DARHOL, sahifani
  // yangilamasdan ko'rishi uchun ham zarur (avval bu faqat to'liq
  // reload'dan keyin ko'rinardi, chunki eski kodda umuman patch
  // qilinmasdi).
  const patchSecurity = useCallback((patch) => {
    setState((prev) => ({ ...prev, security: { ...(prev.security || {}), ...patch } }));
  }, []);

  // --- Brauzer (veb) sessiyasi: kirish / chiqish / harakatsizlik ---
  const login = useCallback(async (loginCode, password) => {
    setLoggingIn(true);
    try {
      await loginWithPassword(loginCode, password);
      const data = await fetchWebSession();
      writeLastActive();
      setState(readyWebState(data));
    } catch (err) {
      // Foydalanuvchiga tushunarli, umumiy xabar (server ichki tafsilotni oshkor qilmaydi).
      const code = err?.code || "";
      let message = "Kirishda xatolik yuz berdi. Qayta urinib ko'ring.";
      if (code.includes("permission-denied")) message = "Login yoki parol noto'g'ri.";
      else if (code.includes("resource-exhausted")) message = "Juda ko'p urinish. Bir ozdan so'ng qayta urinib ko'ring.";
      else if (code.includes("invalid-argument")) message = "Login va parolni to'g'ri kiriting.";
      else if (code.includes("not-found")) message = err?.message || message;
      else if (isLikelyNetworkError(err)) message = "Internet aloqasi sust. Qayta urinib ko'ring.";
      await logoutWeb().catch(() => {});
      throw new Error(message, { cause: err });
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async (reason = null) => {
    try {
      await logoutWeb();
    } catch (err) {
      console.error("Chiqishda xatolik:", err);
    }
    clearLastActive();
    try {
      sessionStorage.removeItem("zeloshop_pin_unlocked");
    } catch {
      // jim
    }
    setState(loggedOutState(reason));
  }, []);

  const isReadyWebSession = state.isWebSession && state.status === "ready";
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // Boshqa tabda chiqilsa — bu tabda ham darhol chiqamiz (Firebase auth
  // holati tablar orasida umumiy).
  useEffect(() => {
    if (!isReadyWebSession) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) logoutRef.current();
    });
    return unsubscribe;
  }, [isReadyWebSession]);

  // Harakatsizlik: so'nggi faollik vaqtini (cheklangan tezlikda) yozib
  // boramiz va muddati o'tsa avtomatik chiqamiz.
  useEffect(() => {
    if (!isReadyWebSession) return undefined;
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite = now;
      writeLastActive(now);
    };
    const checkIdle = () => {
      if (isIdleExpired(readLastActive(), Date.now())) logoutRef.current("idle-expired");
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") checkIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkIdle, 60 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [isReadyWebSession]);

  const value = useMemo(
    () => ({ ...state, loggingIn, login, logout, completeOnboarding, patchStore, patchDashboardSummary, patchSecurity, retrySession }),
    [state, loggingIn, login, logout, completeOnboarding, patchStore, patchDashboardSummary, patchSecurity, retrySession]
  );

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
