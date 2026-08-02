import { memo, useEffect } from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo } from "react-icons/fi";

// OLDIN: muvaffaqiyat/xato/ma'lumot xabarlari brauzerning standart
// `alert()` oynasi orqali ko'rsatilardi — bu ilova dizayniga mos
// kelmaydi, brauzer tomonidan bloklanishi mumkin, va Telegram Mini
// App ichida ba'zan umuman ko'rinmasligi mumkin. Endi barcha holatlar
// uchun (muvaffaqiyat, xato, ma'lumot) shu bitta, dizaynga mos modal
// ishlatiladi — xuddi profil tahrirlashdagi "Muvaffaqiyatli saqlandi"
// oynasi kabi.
const VARIANTS = {
  success: { Icon: FiCheckCircle, color: "text-green-500" },
  error: { Icon: FiAlertCircle, color: "text-rose-500" },
  info: { Icon: FiInfo, color: "text-blue-500" },
};

const StatusModal = ({ variant = "info", title, message, onClose, autoCloseMs }) => {
  const { Icon, color } = VARIANTS[variant] || VARIANTS.info;

  useEffect(() => {
    if (!autoCloseMs) return;
    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onClose]);

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-200 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-xl flex flex-col items-center max-w-xs text-center">
        <Icon size={44} className={`${color} mb-3`} />
        {title && <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">{title}</h3>}
        {message && <p className="text-xs text-gray-500 dark:text-slate-400">{message}</p>}
        {!autoCloseMs && (
          <button
            onClick={onClose}
            className="mt-4 w-full h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl active:scale-95 transition-transform"
          >
            Tushunarli
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(StatusModal);
