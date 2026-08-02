import React from "react";

// OLDIN: bu komponent o'zining ALOHIDA (yuqoridagi AI banneridan
// mustaqil) yuklanmoqda/xato holatini saqlardi. Endi ikkalasi
// (banner va bu tugma) BITTA umumiy holatdan (sahifa darajasidagi
// `useAIDescription`) foydalanadi — qaysi biridan chaqirilishidan
// qat'i nazar, natija bir xil bo'ladi.
const DescriptionCard = ({ description, disabled, generating, onGenerate, onDescriptionChange }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Mahsulot tavsifi</label>
        <button
          type="button"
          disabled={disabled || generating}
          onClick={onGenerate}
          className="text-[10px] font-black text-[#5346E0] dark:text-[#8b85f5] bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
        >
          {generating ? "Yaratilmoqda..." : "✨ AI bilan to'ldirish"}
        </button>
      </div>
      <textarea
        rows="3"
        disabled={disabled}
        placeholder="Mahsulot haqida batafsil ma'lumot yozing..."
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
      />
    </div>
  );
};

export default React.memo(DescriptionCard);
