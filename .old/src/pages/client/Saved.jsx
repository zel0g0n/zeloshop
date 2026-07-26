import ProductList from "@/features/shop/components/product/ProductList";
import {productVerticalListStyle} from "@/constants/custom-css.jsx";
import { useAddFavorite } from "@/hooks/useAddFavourite";



const FavoritesPage = () => {

  
  const {favorites} = useAddFavorite()


  return (
    <div className="bg-gray-50/50 min-h-screen pb-24 px-[10px]">
      <div className="sticky top-0 backdrop-blur-md z-20 border-b border-gray-100 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">Saqlanganlar</h1>
        <span className="bg-rose-50 text-rose-500 text-xs font-bold px-2.5 py-1 rounded-lg">
          {favorites.length} ta saqalangan mahsulotlar
        </span>
      </div>

      <ProductList filterTypeStyle={productVerticalListStyle} isHorizontal={false} products={favorites}  />
    </div>
  );
};

export default FavoritesPage;