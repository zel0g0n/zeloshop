import { Routes, Route, NavLink } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import AdminSellersPage from "./AdminSellersPage";

// Admin panel — SessionGate orqali oddiy sotuvchi/mijoz marshrutlaridan
// TASHQARIDA ko'rsatiladi (faqat `admins/{uid}` hujjati mavjud
// foydalanuvchilar uchun). O'zining alohida, sodda navigatsiyasi bor.
const navItems = [
  { path: "/", label: "Bosh sahifa", icon: "📊", end: true },
  { path: "/sellers", label: "Sotuvchilar", icon: "🏪" },
];

const AdminApp = () => {
  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 transition-colors duration-300 pb-20">
      <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">ZeloShop Admin</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Boshqaruv paneli</p>
        </div>
        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full">
          SUPER ADMIN
        </span>
      </div>

      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/sellers" element={<AdminSellersPage />} />
      </Routes>

      <div className="fixed bottom-4 left-0 right-0 z-40">
        <nav className="max-w-[440px] mx-auto px-[10px]">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-lg border border-gray-100 dark:border-slate-800 px-2 py-2 flex justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className="flex-1"
              >
                {({ isActive }) => (
                  <div
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl transition-all ${
                      isActive ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-slate-500"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-[10px] font-bold">{item.label}</span>
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default AdminApp;
