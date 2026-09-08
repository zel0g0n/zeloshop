import { Suspense, lazy } from "react";
import { WifiOff } from "lucide-react";
import { useSession } from "./SessionContext";
import OnboardingFlow from "@/features/onboarding/OnboardingFlow";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

// Admin panel — mijoz/sotuvchi sessiyalarining aksariyati buni hech
// qachon ko'rmaydi, shuning uchun uni ham dangasa (lazy) yuklaymiz.
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));

/**
 * Sessiya hali aniqlanmagan bo'lsa (Cloud Function javob kutilmoqda),
 * butun ilova o'rniga oddiy yuklanish ekranini ko'rsatadi. Shu bilan
 * sellerId/clientId hali `null` bo'lganida components noto'g'ri
 * (bo'sh) Firestore so'rovlari yubormaydi.
 *
 * Bundan tashqari:
 * - Agar foydalanuvchi admin bo'lsa, butun ilova o'rniga admin panel
 *   ko'rsatiladi.
 * - Agar foydalanuvchi hali do'kon ochmagan bo'lsa (`needsOnboarding`),
 *   butun ilova o'rniga xush kelibsiz/ro'yxatdan o'tish oqimi
 *   ko'rsatiladi — ZeloShop "tayyor do'kon" emas, balki "do'kon
 *   yaratuvchi platforma" ekanligini aks ettiradi.
 *
 * 2026-09 QO'SHILDI (13/14-band): ILGARI istalgan autentifikatsiya
 * xatoligi (hatto oddiy, vaqtinchalik tarmoq uzilishi ham) bir xil
 * "Kirishda xatolik yuz berdi" DEVORIGA olib kelardi — chiqish yo'li
 * yo'q, faqat ilovani qo'lda qayta ochish qolardi. Endi
 * `SessionContext.jsx` xatolikni ikkiga ajratadi:
 * - `status === "network-error"` — tarmoqqa o'xshash, VAQTINCHALIK
 *   xatolik (masalan sekin internet). Foydalanuvchi TIZIMDAN
 *   CHIQARILMAYDI — shu o'rniga qayta urinish tugmasi bilan ogohlantirish
 *   ko'rsatiladi.
 * - `status === "error"` — haqiqiy, doimiy rad etilish (masalan
 *   Telegram imzosi noto'g'ri). Bu holatda avvalgidek dead-end devor
 *   qoladi, chunki qayta urinish yordam bermaydi.
 */
const SessionGate = ({ children }) => {
  const { status, error, isAdmin, needsOnboarding, retrySession } = useSession();

  if (status === "loading") {
    return <FullScreenSpinner />;
  }

  if (status === "network-error") {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-950 px-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl flex flex-col items-center max-w-xs text-center">
          <WifiOff size={44} className="text-amber-500 mb-3" />
          <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">Internet aloqasi sust</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Ilovaga ulanib bo'lmadi. Internet aloqangizni tekshirib, qayta urinib ko'ring.
          </p>
          <button
            type="button"
            onClick={retrySession}
            className="mt-4 w-full h-11 bg-[#5346E0] text-white font-bold text-xs rounded-xl active:scale-95 transition-transform"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-950 px-6 text-center gap-2">
        <p className="text-sm font-bold text-gray-800 dark:text-white">Kirishda xatolik yuz berdi</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{error || "Iltimos, ilovani qayta oching."}</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<FullScreenSpinner />}>
        <AdminApp />
      </Suspense>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow />;
  }

  return children;
};

export default SessionGate;
