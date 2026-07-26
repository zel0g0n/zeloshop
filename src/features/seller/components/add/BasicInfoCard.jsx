import React from "react";

const CATEGORY_OPTIONS = [
  { value: "Skincare", label: "Skincare (Krem, Serum)" },
  { value: "Makeup", label: "Makeup (Kosmetika)" },
  { value: "Perfume", label: "Perfume (Atirlar)" },
  { value: "Tools", label: "Tools (Jihozlar)" },
];

const BasicInfoCard = ({ title, category, disabled, onTitleChange, onCategoryChange }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
    <div className="space-y-1">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot nomi *</label>
      <input
        type="text"
        required
        disabled={disabled}
        placeholder="Masalan: Vitamin C Serum"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-transparent disabled:opacity-60"
      />
    </div>

    <div className="space-y-1">
      <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Kategoriya tanlang</label>
      <div className="relative">
        <select
          value={category}
          disabled={disabled}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-bold text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 disabled:opacity-60"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">🔽</span>
      </div>
    </div>
  </div>
);

export default React.memo(BasicInfoCard);
