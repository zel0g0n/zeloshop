import React from "react";

const VariantsCard = ({ variants, currentVariant, disabled, onCurrentVariantChange, onAddVariant, onRemoveVariant }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot variantlari</label>
      <span className="text-[9px] font-medium text-slate-400">Enter orqali qo'shing</span>
    </div>

    <input
      type="text"
      disabled={disabled}
      placeholder="Masalan: 50ml, 100ml, Qizil"
      value={currentVariant}
      onChange={(e) => onCurrentVariantChange(e.target.value)}
      onKeyDown={onAddVariant}
      className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
    />

    {variants.length > 0 && (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {variants.map((v, index) => (
          // Index emas, variant qiymatining o'zi key sifatida ishlatildi —
          // ro'yxat o'rtasidan biror element o'chirilganda React noto'g'ri
          // elementni qayta ishlatmaydi (variantlar unique, chunki qo'shishda tekshiriladi)
          <span key={v} className="bg-indigo-50 text-[#5346E0] text-[11px] font-black pl-2.5 pr-1.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
            {v}
            {!disabled && (
              <button type="button" onClick={() => onRemoveVariant(index)} className="w-4 h-4 rounded-full hover:bg-indigo-100 flex items-center justify-center text-[10px] font-bold">
                ✕
              </button>
            )}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default React.memo(VariantsCard);
