import React from "react";
import { Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// OLDIN: bu tugma yoki `position: fixed` orqali ekranga sun'iy
// yopishtirilgan, yoki alohida (`floating=false`) holatda formaning
// TASHQARISIDA, lekin baribir doim ko'rinadigan pastki panelda edi.
//
// ENDI: bu — formaning ODDIY, TABIIY oxirgi elementi. Forma bilan
// birga skroll bo'ladi, hech qanday sun'iy joylashuv yo'q — sahifa
// pastigacha o'qib borgan foydalanuvchi uni ko'radi, xolos.
const SubmitBar = ({ isGlobalLoading, uploadLoading, uploadProgress, idleLabel, savingLabel, formId }) => {
  const { t } = useLanguage();
  return (
  <button
    type="submit"
    form={formId}
    disabled={isGlobalLoading}
    className={`w-full h-12 text-white font-semibold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
      isGlobalLoading
        ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed shadow-none"
        : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
    }`}
  >
    {isGlobalLoading ? (
      <>
        <Loader2 size={16} className="animate-spin" />
        <span>{uploadLoading ? t("sellerProductForm.uploadingImage", { percent: uploadProgress }) : (savingLabel || t("sellerProductForm.saving"))}</span>
      </>
    ) : (
      <>
        <Check size={16} strokeWidth={2.5} />
        <span>{idleLabel || t("sellerProductForm.createAndSave")}</span>
      </>
    )}
  </button>
  );
};

export default React.memo(SubmitBar);
