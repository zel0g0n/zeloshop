import { createContext, useContext, useMemo } from "react";
import {
  getSellerIdFromTelegram,
  getTelegramUser,
  isRunningInTelegram,
  DEV_FALLBACK_SELLER_ID,
  DEV_FALLBACK_CLIENT_ID,
} from "@/config/telegram";

/**
 * SessionContext — butun ilova uchun BITTA joriy sotuvchi/mijoz manbai.
 *
 * OLDIN: sellerId="yGsq7Cmn2C3IF103gtGm" va clientId="QdPK91xipZh6c6JHaupV"
 * kabi qatorlar 8 ta turli faylda (Checkout, EditProfile, Products,
 * OrderSection, OrdersList, useGetClientData, addProduct...) qo'lda
 * qaytarilgan edi. Bu degani — ilova aslida hech qachon "multi-tenant"
 * bo'lmagan: barcha foydalanuvchilar bitta xil sotuvchi/mijozga yozardi.
 *
 * ENDI: ID'lar shu yerda, Telegram WebApp orqali (yoki lokal test uchun
 * zaxira qiymatlar bilan) BIR MARTA aniqlanadi va butun ilova bo'ylab
 * useSession() orqali ishlatiladi.
 */
const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const value = useMemo(() => {
    const telegramUser = getTelegramUser();
    const inTelegram = isRunningInTelegram();

    const sellerId = getSellerIdFromTelegram() || DEV_FALLBACK_SELLER_ID;

    // Mijoz ID'si sifatida Telegram foydalanuvchi ID'sini ishlatamiz.
    // Firestore hujjat ID'lari bilan mos kelishi uchun hozircha lokal
    // test muhitida zaxira qiymat ishlatiladi (Telegram tashqarisida).
    const clientId = telegramUser?.id
      ? String(telegramUser.id)
      : DEV_FALLBACK_CLIENT_ID;

    return {
      sellerId,
      clientId,
      telegramUser,
      isTelegram: inTelegram,
    };
  }, []);

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
