import React, { useEffect } from "react";

const Toast = ({ message, onDone, duration = 2000 }) => {
  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [onDone, duration]);

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg animate-fade-in whitespace-nowrap">
      {message}
    </div>
  );
};

export default Toast;
