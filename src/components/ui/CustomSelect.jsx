import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Zamonaviy, o'zimiz loyihalagan tanlash (select) komponenti —
 * brauzerning standart `<select>` uslubiga bog'liq emas, ilovaning
 * boshqa qismlari (masalan mahsulot kategoriyasi tanlash) bilan bir
 * xil dizaynda.
 *
 * `options` — ikkita shaklni qabul qiladi:
 *   - oddiy satrlar massivi: ["Toshkent", "Andijon", ...]
 *   - { value, label } obyektlar massivi
 */
const CustomSelect = ({ value, onChange, options, placeholder = "Tanlang", disabled, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const normalizedOptions = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none transition-all text-sm font-medium flex items-center justify-between disabled:opacity-60 ${
          isOpen ? "border-blue-500" : error ? "border-rose-400" : "border-gray-100 dark:border-slate-700"
        } ${selectedOption ? "text-gray-800 dark:text-white" : "text-gray-400 dark:text-slate-500"}`}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={`shrink-0 ml-2 text-gray-400 dark:text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 py-1.5 max-h-64 overflow-y-auto">
          {normalizedOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold ${
                value === opt.value
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
