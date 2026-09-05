import { useEffect } from "react";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";

const Toast = ({ message, onDone, duration = 2000 }) => {
  // MUHIM: boshqa fixed-pozitsiyali elementlar (navbar, Checkout
  // tugmasi) bilan bir xil sabab — agar klaviatura hali ochiq bo'lsa
  // (masalan CRM'da izoh saqlash tugmasi bosilganda), toast
  // klaviatura ustida "muallaq" ko'rinib qolmasligi uchun, shu
  // holatda pastroq (klaviaturadan yuqorida, ammo tabiiy) joylashadi.
  const isKeyboardVisible = useKeyboardVisible();

  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg animate-fade-in whitespace-nowrap transition-all duration-200 ${isKeyboardVisible ? "bottom-4" : "bottom-28"}`}>
      {message}
    </div>
  );
};

export default Toast;
