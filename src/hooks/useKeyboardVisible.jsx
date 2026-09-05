import { useState, useEffect } from "react";

/**
 * Virtual (ekrandagi) klaviatura ochiq/yopiqligini aniqlaydi.
 *
 * SABAB: mobil brauzer/WebView'larda `position: fixed` elementlar
 * (bizning holatda — pastki Navbar) klaviatura ochilganda, ekran
 * balandligi qisqarishi bilan birga "yuqoriga suzib chiqib qoladi" —
 * chunki `fixed` pozitsiya YANGI (qisqargan) balandlikka nisbatan
 * hisoblanadi, lekin vizual ravishda bu, klaviatura USTIDA
 * "muallaq" ko'rinadi.
 *
 * YECHIM: `window.visualViewport` orqali haqiqiy ko'rinadigan
 * balandlikni kuzatamiz. Agar u boshlang'ich balandlikdan SEZILARLI
 * darajada (150px+) kichik bo'lsa — demak klaviatura ochiq, va
 * chaqiruvchi komponent Navbar'ni vaqtincha yashirishi mumkin.
 *
 * Eski brauzerlarda (`visualViewport` qo'llab-quvvatlanmasa) —
 * har doim `false` qaytaradi, ya'ni Navbar odatdagidek ko'rinishda
 * qoladi (xavfsiz standart holat).
 */
export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const baselineHeight = window.innerHeight;

    const handleResize = () => {
      const heightDiff = baselineHeight - viewport.height;
      setIsKeyboardVisible(heightDiff > 150);
    };

    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);

  return isKeyboardVisible;
}
