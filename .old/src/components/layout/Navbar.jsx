import { NavLink } from "react-router";
import { useAddFavorite } from "../../hooks/useAddFavourite";
import { useAddToCart } from "../../hooks/useAddToCard";
import {
  GoHome,
  LuTextSearch,
  MdOutlineShoppingBag,
  FaRegCircleUser,
  FaRegHeart,
} from "@/constants/icons";

const Navbar = () => {

  const favoritesCount = useAddFavorite().favorites.length
  const cartsCount = useAddToCart().carts.length

    const navData = [
      { id: 1, title: "Asosiy", path: '/', icon: GoHome },
      { id: 2, title: "Katalog", path: '/catalog', icon: LuTextSearch },
      { id: 3, title: "Savatcha", path: '/cart', icon: MdOutlineShoppingBag, notf: cartsCount || 0 },
      { id: 4, title: "Saqlangan", path: '/saved', icon: FaRegHeart, notf: favoritesCount || 0 },
      { id: 5, title: "Kabinet", path: '/cabinet', icon: FaRegCircleUser },
    ];
    return (
      <div className="fixed bottom-2 left-0 right-0 z-1000">
        <nav className="max-w-[440px] mx-auto px-[10px]">
          
          <div className="relative overflow-hidden rounded-[24px]  backdrop-blur-md border border-gray-100 shadow-lg px-[10px] py-4">
            
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600  py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] transition-all duration-300 active:scale-95"></div>
            <ul className="relative flex justify-between py-[10px] items-center">
              {navData.map((item) => {

                return (
                  <NavLink
                    to={item.path}
                    key={item.id}
                    className="relative flex-1 flex justify-center"
                  >
                    {
                      ({isActive}) => (
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

                            {item.notf > 0 && (
                              <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-blue-600">
                                {item.notf}
                              </span>
                            )}
                          </div>

                        </button>
                      ) 
                    }
                  </NavLink>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
    );
};

export default Navbar;