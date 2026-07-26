import React from "react";
import { NavLink } from "react-router";
import {
  GoHome,
  MdOutlineShoppingBag,
  GoPlusCircle,
  IoSettingsOutline,
  FaList
} from "@/constants/icons";

// OLDIN: aktiv tab lokal useState (`activeTab`) bilan boshqarilardi va
// faqat navbar tugmasi bosilganda yangilanardi. Foydalanuvchi brauzerning
// orqaga/oldinga tugmasi bilan yoki boshqa yo'l bilan (masalan
// "Mahsulot qo'shish"dan qaytganda) sahifani almashtirsa, tanlangan tab
// eski (noto'g'ri) holatda qolib ketardi. Endi Navbar.jsx (shop) dagi kabi
// NavLink'ning o'zidagi `isActive` (joriy URL asosida) ishlatiladi —
// har doim to'g'ri ko'rsatadi va qo'shimcha state ham kerak emas.
const navData = [
  { id: 1, title: "HOME", path: '/seller', icon: GoHome, end: true },
  { id: 2, title: "Products", path: '/seller/products', icon: MdOutlineShoppingBag },
  { id: 3, title: "Qo'shish", path: '/seller/add-product', icon: GoPlusCircle },
  { id: 4, title: "Orders", path: '/seller/orders', icon: FaList },
  { id: 5, title: "More", path: '/seller/functions', icon: IoSettingsOutline },
];

const SellerNavbar = () => {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-1000">
      <nav className="max-w-[440px] mx-auto px-[10px]">
        
        <div className="relative overflow-hidden rounded-[24px]  backdrop-blur-md border border-gray-100 shadow-lg px-[10px] py-4">
          
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600  py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-all duration-300 active:scale-95"></div>
          <ul className="relative flex justify-between items-center py-[10px]">
            {navData.map((item) => (
              <NavLink
                to={item.path}
                key={item.id}
                end={item.end}
                className="relative flex-1 flex justify-center"
              >
                {({ isActive }) => (
                  <button
                    className={`relative flex flex-col items-center justify-center w-full transition-all duration-300 ${
                      isActive
                        ? "scale-105"
                        : "opacity-90 active:scale-85"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute mx-auto w-full h-15 rounded-2xl bg-white/15 backdrop-blur-md border border-white/70 p-1"></div>
                    )}

                    <div className="relative">
                      <item.icon
                        className={`text-[26px] font-bold transition-colors duration-300 ${
                          isActive ? "text-white" : "text-white/80"
                        }`}
                      />
                    </div>
                  </button>
                )}
              </NavLink>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default SellerNavbar;
