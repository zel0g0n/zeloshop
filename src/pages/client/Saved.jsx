import ProductList from "@/features/shop/components/product/ProductList";
import {productVerticalListStyle} from "@/constants/custom-css.jsx";
import { useFavoritesList } from "@/hooks/useAddFavourite";

const FavoritesPage = () => {
  const {favorites} = useFavoritesList()

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-24 px-[10px] transition-colors duration-300">
      <div className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-20 border-b border-gray-100 dark:border-slate-800 shadow-xs p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Saqlanganlar</h1>
        <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 text-xs font-bold px-2.5 py-1 rounded-lg">
          {favorites.length} ta saqalangan mahsulotlar
        </span>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <span className="text-4xl mb-2">💙</span>
          <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Hali sevimlilar yo'q</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Yoqtirgan mahsulotlaringizni shu yerga saqlang</p>
        </div>
      ) : (
        <div className="pt-4">
          <ProductList filterTypeStyle={productVerticalListStyle} isHorizontal={false} products={favorites} />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
