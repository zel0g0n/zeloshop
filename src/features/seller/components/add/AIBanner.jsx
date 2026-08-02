import React, { memo } from "react";

const AIBanner = ({ generating, error, onGenerate }) => (
  <div>
    <button
      type="button"
      onClick={onGenerate}
      disabled={generating}
      className="w-full p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/20 flex items-center gap-3 active:scale-[0.98] transition-transform disabled:opacity-70"
    >
      <span className="text-2xl shrink-0">{generating ? "⏳" : "✨"}</span>
      <div className="text-left">
        <p className="text-sm font-black">
          {generating ? "Tavsif yaratilmoqda..." : "AI yordamida to'ldirish"}
        </p>
        <p className="text-[11px] text-white/80 font-medium">
          Nom va rasm asosida tavsifni avtomatik yozamiz
        </p>
      </div>
    </button>
    {error && <p className="text-[11px] text-rose-500 font-semibold mt-1.5 pl-1">{error}</p>}
  </div>
);

export default memo(AIBanner);
