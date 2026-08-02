import { memo } from 'react';
import { useNavigate } from 'react-router';
import { FiChevronRight} from "react-icons/fi";

// `isToggle` elementlar uchun bosilganda navigatsiya qilinmaydi — ular
// o'zining `toggled`/`onToggleClick` orqali to'g'ridan-to'g'ri boshqariladi
// (masalan tungi rejimni yoqish/o'chirish uchun sahifaga o'tishning
// hojati yo'q).
const CabinetMenu = ({ section }) => {
  const navigate = useNavigate();
  return (
          <div className="space-y-2">
            <h4 className="text-[11px] uppercase tracking-wider font-black text-gray-400 dark:text-slate-500 px-1">
              {section.title}
            </h4>

            
            <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-gray-100 dark:border-slate-800 p-1.5 shadow-xs divide-y divide-gray-50 dark:divide-slate-800">
              {section.items.map((item) => (
                <div
                  onClick={() => { if (item.isToggle) return; item.onClick ? item.onClick() : navigate(item.path); }}
                  key={item.id}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl active:bg-gray-50/70 dark:active:bg-slate-800/70 transition-all duration-200 group ${item.isToggle ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-100/80 dark:bg-slate-800 text-gray-500 dark:text-slate-300 flex items-center justify-center group-hover:text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 transition-colors duration-200">
                      {item.icon}
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-slate-200 tracking-tight">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        {item.badge}
                      </span>
                    )}
                    {item.textBadge && (
                      <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                        {item.textBadge}
                      </span>
                    )}
                    {item.isToggle && (
                      <label
                        className="relative inline-flex items-center cursor-pointer select-none"
                        onClick={(e) => { e.stopPropagation(); item.onToggleClick?.(); }}
                      >
                        <input type="checkbox" checked={item.toggled} readOnly className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    )}
                    
                    {!item.isToggle && (
                      <FiChevronRight size={16} className="text-gray-300 dark:text-slate-600 group-hover:text-gray-400 transition-colors" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
  )
}

export default memo(CabinetMenu)
