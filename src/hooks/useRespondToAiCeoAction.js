import { useCallback, useState } from "react";
import { respondToAiCeoPendingAction } from "@/services/ai/aiCeoInsights";

/**
 * AI CEO'ning tasdiq kutayotgan harakatini (`aiCeoPendingActions`)
 * tasdiqlash/rad etish uchun UMUMIY holat+mantiq — ILGARI faqat
 * `InboxPage.jsx` ichida edi, endi Biznes Buyruq Markazi
 * (`BusinessCommandCenterPage.jsx`) ham AYNAN SHU tasdiqlash oqimini
 * (bir xil callable, bir xil xato boshqaruvi) ishlatishi kerak bo'lgani
 * uchun (2026-09, foydalanuvchi so'rovi: "qani buyruqlar, bu yerda
 * hisobotdan bolak hech narsa yoqku") umumiy hook'ga chiqarildi —
 * ikkala joyda ham BIR XIL xulq-atvor kafolatlanadi.
 */
export function useRespondToAiCeoAction(t) {
  const [respondingId, setRespondingId] = useState(null);
  const [respondErrors, setRespondErrors] = useState({});

  const handleRespond = useCallback(
    async (actionId, approve) => {
      setRespondingId(actionId);
      setRespondErrors((prev) => ({ ...prev, [actionId]: null }));
      try {
        await respondToAiCeoPendingAction(actionId, approve);
        // Yangi holat (`executed`/`rejected`) Firestore JONLI tinglovchi
        // orqali o'zi keladi - qo'lda holat yangilash shart emas.
      } catch (err) {
        setRespondErrors((prev) => ({ ...prev, [actionId]: err.message || t("inbox.respondError") }));
      } finally {
        setRespondingId(null);
      }
    },
    [t]
  );

  return { respondingId, respondErrors, handleRespond };
}
