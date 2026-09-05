import { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { translations, SUPPORTED_LANGUAGES } from "@/i18n/translations";
import { getCloudStorageItem, setCloudStorageItem } from "@/services/telegram/cloudStorage";

const STORAGE_KEY = "app_language";
// Telegram CloudStorage'dagi kalit — versiyalangan (`cache:v1:...`),
// kelajakda formatini o'zgartirishga to'g'ri kelsa, eski qiymatlar
// bilan chalkashib ketmasligi uchun.
const CLOUD_STORAGE_KEY = "cache:v1:language";

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

  // STALE-WHILE-REVALIDATE (Telegram DeviceStorage/CloudStorage
  // audit, 2026-09): `localStorage`dagi til DARHOL, sinxron holda
  // ko'rsatiladi (yuqoridagi `useState` initializeri) — foydalanuvchi
  // hech qanday kutishsiz o'z tilini ko'radi. Shu bilan bir vaqtda,
  // FONDA Telegram CloudStorage'dan tekshiriladi: agar foydalanuvchi
  // tilni BOSHQA qurilmada (masalan telefon) o'zgartirgan bo'lsa, shu
  // yerda sinxronlanadi. Bu — sensitiv bo'lmagan foydalanuvchi
  // sozlamasi, shuning uchun CloudStorage'ga mos keladi (parol/token
  // kabi narsalar HECH QACHON bu yerga qo'yilmaydi).
  //
  // Telegram tashqarisida (oddiy brauzer) yoki eski Telegram
  // mijozida `getCloudStorageItem` xavfsiz `null` qaytaradi — bu
  // holda faqat localStorage'dagi qiymat ishlatilishda davom etadi.
  useEffect(() => {
    let cancelled = false;
    getCloudStorageItem(CLOUD_STORAGE_KEY).then((cloudLanguage) => {
      if (cancelled) return;
      if (!cloudLanguage || !SUPPORTED_LANGUAGES.includes(cloudLanguage)) return;
      setLanguageState((current) => (current === cloudLanguage ? current : cloudLanguage));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // saqlab bo'lmasa ham interfeys shu sessiyada ishlashda davom etadi
    }
    // Best-effort: Telegram tashqarisida yoki eski mijozda jim
    // o'tkazib yuboriladi (`setCloudStorageItem` xato tashlamaydi).
    setCloudStorageItem(CLOUD_STORAGE_KEY, lang);
  }, []);

  const t = useCallback(
    (key, params) => {
      const value = resolveKey(translations[language], key);
      // Tarjima topilmasa, o'zbekcha nusxaga qaytamiz — bo'sh matn ko'rsatilmaydi
      const raw = value !== undefined ? value : (resolveKey(translations.uz, key) ?? key);
      if (!params || typeof raw !== "string") return raw;
      // Shablon almashtirish: "{amount} so'm" + {amount: 5000} -> "5000 so'm"
      return Object.keys(params).reduce(
        (str, paramKey) => str.replace(`{${paramKey}}`, params[paramKey]),
        raw
      );
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
