import React from "react";

const AI_SUGGESTION =
  "Ushbu yuqori sifatli mahsulot terini chuqur namlantiradi, unga tabiiy jilo va sog'lom ko'rinish beradi. Kundalik foydalanish uchun juda mos keladi.";

const DescriptionCard = ({ description, disabled, onDescriptionChange }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
    <div className="flex justify-between items-center">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot tavsifi</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDescriptionChange(AI_SUGGESTION)}
        className="text-[10px] font-black text-[#5346E0] bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
      >
        ✨ AI bilan to'ldirish
      </button>
    </div>
    <textarea
      rows="3"
      disabled={disabled}
      placeholder="Mahsulot haqida batafsil ma'lumot yozing..."
      value={description}
      onChange={(e) => onDescriptionChange(e.target.value)}
      className="w-full p-3 bg-[#F4F5F9] rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
    />
  </div>
);

export default React.memo(DescriptionCard);
