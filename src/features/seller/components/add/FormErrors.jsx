import React from "react";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// `validationError` — ZAXIRA HARAKATI AUDIT JURNALI (2026-09):
// sotuvchi zaxirani o'zgartirib, sababini TANLAMASDAN saqlashga
// urinsa (`EditProductPage.jsx`/`StaffProductForm.jsx`) ko'rsatiladi.
// Boshqa ikkitasidan FARQLI - bu HAQIQIY server/tarmoq xatosi emas,
// oddiy forma validatsiyasi, shuning uchun alohida prop sifatida.
const FormErrors = ({ uploadError, dbError, validationError }) => {
  const { t } = useLanguage();
  if (!uploadError && !dbError && !validationError) return null;

  return (
    <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 space-y-1">
      {uploadError && <p className="flex items-center gap-1"><AlertTriangle size={12} className="shrink-0" /> {t("sellerProductForm.storageError")} {uploadError}</p>}
      {dbError && <p className="flex items-center gap-1"><AlertTriangle size={12} className="shrink-0" /> {t("sellerProductForm.firestoreError")} {dbError?.message || dbError}</p>}
      {validationError && <p className="flex items-center gap-1"><AlertTriangle size={12} className="shrink-0" /> {validationError}</p>}
    </div>
  );
};

export default React.memo(FormErrors);
