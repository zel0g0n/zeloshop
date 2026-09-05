import { useEffect } from "react";

/**
 * Modalni/oynani klaviaturaning "Escape" tugmasi bilan yopish imkonini
 * beradi (2026-09 audit, "UX/accessibility" bo'limi).
 *
 * NEGA QO'SHILDI: loyihada 20 dan ortiq modal/pastdan chiqadigan oyna
 * (`fixed inset-0` + `onClose`) bor edi, lekin ULARNING HECH BIRI
 * Escape tugmasiga javob bermas edi — faqat sichqoncha/barmoq bilan
 * fon qismini bosib yoki "X" tugmasini bosib yopish mumkin edi. Bu,
 * klaviatura orqali ishlaydigan (yoki ekran o'quvchisi ishlatadigan)
 * foydalanuvchilar uchun standart, KUTILGAN xulq-atvor emas (WCAG
 * "yopish uchun Escape" talabi).
 *
 * XAVFSIZ TOZALASH: effekt komponent unmount bo'lganda avtomatik
 * o'chiriladi (`removeEventListener`) — memory leak yo'q. `onClose`
 * o'zgarsa (masalan yangi closure), eski listener olib tashlanib,
 * yangisi ulanadi.
 *
 * Ishlatish: modal komponentining tepasida, boshqa hook'lar bilan
 * bir qatorda — `useEscapeToClose(onClose);`
 *
 * `enabled` (ixtiyoriy, standart `true`): ba'zi panellar (masalan
 * `FilterPanel.jsx`) `isOpen` bo'lmasa ham JSX'da `return null`
 * qiladi, LEKIN komponentning O'ZI daraxtda qolaveradi (hook'lar HAR
 * SAFAR chaqiriladi — React Hook qoidasi). Agar bu holatda listener
 * SHARTSIZ ulansa, panel yopiq turganda ham Escape bosilsa
 * `onClose()` chaqirilib qolardi. Shuning uchun chaqiruvchi
 * `useEscapeToClose(onClose, isOpen)` orqali listenerni FAQAT
 * haqiqatda ochiq bo'lganda ulaydi.
 */
export const useEscapeToClose = (onClose, enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, enabled]);
};
