import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { translations, SUPPORTED_LANGUAGES } from "@/i18n/translations";

const STORAGE_KEY = "app_language";

const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {
    // localStorage mavjud bo'lmasa (masalan xususiy rejim), sukut bo'yicha o'zbekchaga qaytamiz
  }
  return "uz";
};

// Ichki kalit yo'li bo'yicha qiymat qidiradi, masalan t("cabinet.wishlist")
const resolveKey = (dict, path) => path.split(".").reduce((acc, part) => acc?.[part], dict);

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // saqlab bo'lmasa ham interfeys shu sessiyada ishlashda davom etadi
    }
  }, []);

  const t = useCallback(
    (key) => {
      const value = resolveKey(translations[language], key);
      if (value !== undefined) return value;
      // Tarjima topilmasa, o'zbekcha nusxaga qaytamiz — bo'sh matn ko'rsatilmaydi
      return resolveKey(translations.uz, key) ?? key;
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage faqat <LanguageProvider> ichida ishlatilishi kerak");
  return ctx;
};
