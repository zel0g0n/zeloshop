import { useState, useMemo, useEffect } from 'react'; 
import { useDispatch, useSelector } from 'react-redux';
import { getProductAsyncThunk } from '@/store/slices/product/getProductSlice';
import { useSession } from '@/context/SessionContext';

// OLDIN: bu hook ham Bosh sahifa, ham Katalog sahifasi tomonidan
// ishlatilardi, va ikkalasi ham bitta umumiy (Redux'dagi) qidiruv/
// filtr holatidan foydalanardi — bu ikkalasini keraksiz bog'lab
// qo'yardi (Katalogdagi qidiruv Bosh sahifaga ham "sizib o'tardi").
//
// ENDI: bu hook FAQAT Bosh sahifa uchun — u yerda hech qanday
// qidiruv/filtr yo'q, faqat sahifalab ko'rsatish (pagination). Katalog
// sahifasining o'z qidiruv/filtr holati endi alohida
// (`CatalogFilterContext.jsx`) da yashaydi.
export function useFilterProducts() {
  const dispatch = useDispatch();
  const { sellerId } = useSession();
  
  const { products = [], loading, error, loadedForSellerId } = useSelector((state) => state.products);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    if (sellerId && loadedForSellerId !== sellerId && !loading) {
      dispatch(getProductAsyncThunk(sellerId));
    }
  }, [dispatch, sellerId, loadedForSellerId, loading]);

  const visibleProducts = useMemo(() => {
    return products.slice(0, visibleCount);
  }, [products, visibleCount]);

  const recommendedProducts = useMemo(() => products.filter(item => item.tags?.includes("AI Choice")), [products]);
  const trendingProducts = useMemo(() => products.filter(item => item.tags?.includes("Trending")), [products]);
  const bestSellerProducts = useMemo(() => products.filter(item => item.tags?.includes("Best Seller")), [products]);

  const loadMoreProducts = () => {
    setVisibleCount(prevCount => prevCount + 6);
  };

  const hasMore = visibleCount < products.length;

  return {
    recommendedProducts,
    trendingProducts,
    bestSellerProducts,
    visibleProducts,
    loadMoreProducts,
    hasMore,
    products,
    loading, 
    error
  };
}
