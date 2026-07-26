import { 
  FiShoppingBag, FiGlobe, FiLogOut,
  FiHeart, FiSun, FiShield, FiInfo 
} from "react-icons/fi";
import CabinetMenu from "@/features/shop/components/cabinet/CabinetMenu";
import CabinetHeader from "@/features/shop/components/cabinet/CabinetHeader";
import ActiveOrder from "@/features/shop/components/order/ActiveOrder";
import { useSelector } from "react-redux";

const ProfilePage = () => {
  const wishlist = useSelector(state => state.favorites.items)
  const ordersList = useSelector(state => state.orders)
  const menuSections = [
    {
      title: "Shaxsiy Ma'lumotlar",
      items: [
        { id: "wishlist", title: "Mening istaklarim (Wishlist)", icon: <FiHeart size={18} />, badge: `${wishlist.length}`, path: `/saved` },
        { id: "orders", title: "Buyurtmalar tarixi (Orders)", icon: <FiShoppingBag size={18} />, path: `/orders` },
        // { id: "addresses", title: "Yetkazib berish manzillari", icon: <FiMapPin size={18} />, path: "/addresses" },
      ]
    },
    {
      title: "Hisob Sozlamalari (Account Settings)",
      items: [
        { id: "language", title: "Ilova tili (Language)", icon: <FiGlobe size={18} />, textBadge: "O'zbekcha", path: "/language" },
        { id: "theme", title: "Yorqin rejim (Light Theme)", icon: <FiSun size={18} />, isToggle: true, path: "/theme" },
      ]
    },
    {
      title: "Ilova va Qo'llab-quvvatlash",
      items: [
        // { id: "rate", title: "Ilovani baholang", icon: <FiStar size={18} />, path: "/rate" },
        // { id: "invite", title: "Do'stlarni taklif qilish", icon: <FiUsers size={18} />, path: "/invite" },
        { id: "privacy", title: "Maxfiylik siyosati", icon: <FiShield size={18} />, path: "/privacy" },
        { id: "about", title: "Biz haqimizda", icon: <FiInfo size={18} />, path: "/about" },
      ]
    }
  ];

  

  return (
    <div className="bg-gray-50/50 min-h-screen pb-32">
      <CabinetHeader/>
      <ActiveOrder />
      <div className="p-4 space-y-5">
        {menuSections.map((section, idx) => (
          <CabinetMenu orders={ordersList} key={idx} section={section} />
        ))}

        <button className="w-full mt-2 bg-red-50/40 hover:bg-red-50 border border-red-100/50 text-red-500 font-bold h-12 rounded-[20px] flex items-center justify-center gap-2 text-xs active:scale-95 transition-all duration-200 shadow-2xs">
          <FiLogOut size={14} />
          <span>Tizimdan chiqish (Log out)</span>
        </button>

        <p className="text-center text-[10px] text-gray-300 font-medium pt-2">
          Cosmetics App v2.4.0 • Built for Premium Experience
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;