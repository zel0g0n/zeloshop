import { Suspense, lazy } from "react";
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
 */
const SessionGate = ({ children }) => {
  const { status, error, isAdmin, needsOnboarding } = useSession();

  if (status === "loading") {
    return <FullScreenSpinner />;
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
