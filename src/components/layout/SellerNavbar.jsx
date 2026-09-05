import { NavLink } from "react-router";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useNewOrdersCount } from "@/hooks/seller/useNewOrdersCount";
import { useSession } from "@/context/SessionContext";
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
const SellerNavbar = () => {
  // MUHIM TUZATISH: klaviatura ochilganda, Navbar "muallaq" ko'rinib
  // qolmasligi uchun, silliq (`translate-y`) animatsiya bilan pastga
  // yashiriladi — klaviatura yopilganda esa xuddi shunday silliq
  // qaytib chiqadi. Dizayn butunlay o'zgarishsiz qoladi, faqat
  // vaqtincha ko'rinmay turadi.
  const isKeyboardVisible = useKeyboardVisible();

  // MUHIM QO'SHIMCHA: mijoz tomonidagi Navbar'da savat/sevimlilar
  // soni JONLI ko'rsatiladi (`Navbar.jsx`dagi `notf` maydoni) - endi
  // sotuvchi tomonida ham xuddi shunday, "Buyurtmalar" tabida
  // yangi (hali ko'rilmagan) buyurtmalar soni JONLI ko'rsatiladi -
  // yangi buyurtma kelishi bilan, sahifani qayta yuklamasdan,
  // DARHOL yangilanadi.
  const { sellerId } = useSession();
  const newOrdersCount = useNewOrdersCount(sellerId);

  const navData = [
    { id: 1, title: "HOME", path: '/seller', icon: GoHome, end: true },
    { id: 2, title: "Products", path: '/seller/products', icon: MdOutlineShoppingBag },
    { id: 3, title: "Qo'shish", path: '/seller/add-product', icon: GoPlusCircle },
    { id: 4, title: "Orders", path: '/seller/orders', icon: FaList, notf: newOrdersCount || 0 },
    { id: 5, title: "More", path: '/seller/functions', icon: IoSettingsOutline },
  ];

  return (
    <div
      className={`fixed bottom-4 left-0 right-0 z-40 transition-transform duration-200 ${
        isKeyboardVisible ? "translate-y-[calc(100%+2rem)]" : "translate-y-0"
      }`}
    >
      <nav className="max-w-[440px] mx-auto px-[10px]">
        
        <div className="relative overflow-hidden rounded-[24px] shadow-lg px-[10px] py-4">
          
          <div className="absolute inset-0 rounded-2xl bg-[#5346E0] py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(83,70,224,0.35)] transition-all duration-300 active:scale-95"></div>
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
                      <div className="absolute mx-auto w-full h-15 rounded-2xl bg-white/20 border border-white/70 p-1"></div>
                    )}

                    <div className="relative">
                      <item.icon
                        className={`text-[26px] font-bold transition-colors duration-300 ${
                          isActive ? "text-white" : "text-white/80"
                        }`}
                      />
                      {item.notf > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[#5346E0]">
                          {item.notf}
                        </span>
                      )}
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
