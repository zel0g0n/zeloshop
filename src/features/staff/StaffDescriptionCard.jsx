import React from "react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * `add/DescriptionCard.jsx`ning xodim Mini App'i uchun LEAN nusxasi.
 * YAGONA, ATAYLAB QILINGAN FARQ: "AI bilan to'ldirish" tugmasi BUTUNLAY
 * OLIB TASHLANGAN (asl komponentda bu tugmani yashirish uchun hech
 * qanday prop yo'q edi). Xodim hech qachon AI CEO funksiyalariga
 * (shu jumladan AI tavsif generatori) kira olmasligi kerak — bu talab
 * shu yerda, componentning O'ZIDA, strukturaviy tarzda ta'minlanadi.
 */
const StaffDescriptionCard = ({ description, disabled, onDescriptionChange }) => {
  const { t } = useLanguage();
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("sellerProductForm.descriptionLabel")}</label>
      <textarea
        rows="3"
        disabled={disabled}
        placeholder={t("sellerProductForm.descriptionPlaceholder")}
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
      />
    </div>
  );
};

export default React.memo(StaffDescriptionCard);
