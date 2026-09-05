import { useState, useEffect } from "react";
import { formatCountdown } from "@/utils/productPricing";

/**
 * "Vaqtli aksiya" mahsulot sahifasidagi orqaga sanoq taymeri.
 *
 * Har soniyada o'zini yangilaydi (`setInterval` - effekt ICHIDA,
 * render vaqtida to'g'ridan-to'g'ri `Date.now()` chaqirilmaydi,
 * `react-hooks/purity` qoidasiga mos). Muddat tugaganda `onExpire`
 * bir marta chaqiriladi - shu orqali ota-komponent (`ProductPrice.jsx`)
 * chegirmani DARHOL (sahifani yangilamasdan) "tugagan" deb hisoblashi
 * mumkin.
 */
export const CountdownTimer = ({ endMs, onExpire, className }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!endMs) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endMs]);

  const remainingMs = endMs ? Math.max(0, endMs - nowMs) : 0;

  useEffect(() => {
    if (endMs && remainingMs <= 0) onExpire?.();
    // faqat "tugadi/tugamadi" chegarasi kesib o'tilganda ishga
    // tushishi kerak - `onExpire` har render'da yangi funksiya
    // bo'lishi mumkin, shuning uchun u dependency sifatida qo'shilmaydi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endMs, remainingMs <= 0]);

  const label = formatCountdown(remainingMs);
  if (!label) return null;

  return <span className={className}>{label}</span>;
};
