import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { getCloudStorageItem, setCloudStorageItem } from "@/services/telegram/cloudStorage";

const STORAGE_KEY = "app_theme";
// Telegram CloudStorage'dagi kalit — `LanguageContext.jsx`dagi bilan
// BIR XIL versiyalash konvensiyasi (`cache:v1:...`).
const CLOUD_STORAGE_KEY = "cache:v1:theme";

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage mavjud bo'lmasa, tizim (OS) sozlamasiga qaraymiz
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  // FRONTEND CACHE AUDITI (2026-09, Telegram DeviceStorage/CloudStorage
  // integratsiyasi): `LanguageContext.jsx`dagi BILAN AYNAN BIR XIL
  // stale-while-revalidate naqsh — tema (dark/light) ham, til kabi,
  // sensitiv BO'LMAGAN foydalanuvchi sozlamasi, shuning uchun
  // CloudStorage'ga to'liq mos keladi. `localStorage`dagi qiymat
  // DARHOL, sinxron holda qo'llaniladi (yuqoridagi `useState`
  // initializeri), FONDA esa CloudStorage tekshiriladi — agar
  // foydalanuvchi temani BOSHQA qurilmada o'zgartirgan bo'lsa
  // (masalan ish stoli Telegram'ida), shu yerda sinxronlanadi.
  // Telegram tashqarisida yoki eski mijozda `getCloudStorageItem`
  // xavfsiz `null` qaytaradi — bu holda faqat OS/localStorage
  // ustuvorligi ishlashda davom etadi (xatti-harakat o'zgarmaydi).
  useEffect(() => {
    let cancelled = false;
    getCloudStorageItem(CLOUD_STORAGE_KEY).then((cloudTheme) => {
      if (cancelled) return;
      if (cloudTheme !== "light" && cloudTheme !== "dark") return;
      setThemeState((current) => (current === cloudTheme ? current : cloudTheme));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // `.dark` klassini <html> elementiga qo'yamiz/olib tashlaymiz — CSS'dagi
  // `@custom-variant dark` shu klassga bog'langan (index.css'ga qarang).
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (next !== "light" && next !== "dark") return;
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // saqlab bo'lmasa ham shu sessiyada ishlaydi
    }
    // Best-effort: Telegram tashqarisida yoki eski mijozda jim
    // o'tkazib yuboriladi (`setCloudStorageItem` xato tashlamaydi).
    setCloudStorageItem(CLOUD_STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, isDark: theme === "dark" }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme faqat <ThemeProvider> ichida ishlatilishi kerak");
  return ctx;
};
