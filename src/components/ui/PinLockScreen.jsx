import React, { useState, useCallback } from "react";
import { Lock, Delete } from "lucide-react";

const PinLockScreen = ({ correctPin, onUnlock }) => {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = useCallback((digit) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setError(false);

    if (next.length === 4) {
      if (next === correctPin) {
        sessionStorage.setItem("zeloshop_pin_unlocked", "true");
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setEntered(""), 400);
      }
    }
  }, [entered, correctPin, onUnlock]);

  const handleBackspace = useCallback(() => {
    setEntered((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#F4F5F9] dark:bg-slate-950 flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
        <Lock size={26} />
      </div>
      <h1 className="text-base font-black text-slate-800 dark:text-white mb-1">PIN kodni kiriting</h1>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Panelga kirish uchun 4 xonali kod</p>

      <div className={`flex items-center gap-3 mb-8 ${error ? "animate-pulse" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              i < entered.length
                ? error
                  ? "bg-rose-500 border-rose-500"
                  : "bg-indigo-600 border-indigo-600"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
        ))}
      </div>

      {error && <p className="text-xs font-semibold text-rose-500 mb-4">Noto'g'ri PIN kod, qayta urinib ko'ring</p>}

      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(String(num))}
            className="h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xl font-black text-slate-800 dark:text-white active:scale-95 transition-transform"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xl font-black text-slate-800 dark:text-white active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-transform"
          aria-label="O'chirish"
        >
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
};

export default PinLockScreen;
