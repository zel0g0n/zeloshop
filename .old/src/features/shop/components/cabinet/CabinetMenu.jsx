import { useNavigate } from 'react-router';
import { FiChevronRight} from "react-icons/fi";
const CabinetMenu = ({section,idx, orders}) => {
  const navigate = useNavigate();
  return (
          <div  key={idx} className="space-y-2">
            <h4 className="text-[11px] uppercase tracking-wider font-black text-gray-400 px-1">
              {section.title}
            </h4>

            
            <div className="bg-white rounded-[24px] border border-gray-100 p-1.5 shadow-xs divide-y divide-gray-50">
              {section.items.map((item) => (
                <div
                  onClick={() => navigate(item.path)}
                  key={item.id}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl active:bg-gray-50/70 transition-all duration-200 group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-100/80 text-gray-500 flex items-center justify-center group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors duration-200">
                      {item.icon}
                    </div>
                    <span className="text-sm font-bold text-gray-700 tracking-tight">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-50 text-blue-600">
                        {item.badge}
                      </span>
                    )}
                    {item.textBadge && (
                      <span className="text-xs font-semibold text-gray-400">
                        {item.textBadge}
                      </span>
                    )}
                    {item.isToggle && (
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    )}
                    
                    {/* O'ngga ko'rsatkich (Toggle bo'lmagan hamma elementlar uchun) */}
                    {!item.isToggle && (
                      <FiChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
  )
}

export default CabinetMenu