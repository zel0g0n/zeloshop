import { useState, useMemo, useEffect } from 'react'; 
import { useDispatch, useSelector } from 'react-redux';
import { getProductAsyncThunk } from '@/store/slices/product/getProductSlice';

const filterCategory = (data, key) => {
  if (!data) return [];
  switch(key) {
    case 'new':
      return data.filter(p => p.isNew === true); // === ishlatish xavfsizroq
    case 'top':
      return data.filter(p => p.rating > 4.8);
    case 'aksiya': 
      return data.filter(p => p.stock < 10);
    case 'arzon':
      return data.filter(p => p.price < 40);
    default:
      return data;
  }
};

export function useFilterProducts() {
  const dispatch = useDispatch();
  
  const { products = [], loading, error, queryKey, activeCategory } = useSelector((state) => state.products);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    if (products.length === 0) {
      dispatch(getProductAsyncThunk());
    }
  }, [dispatch, products.length]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (queryKey) {
      const searchKey = queryKey.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(searchKey));
    }

    return filterCategory(result, activeCategory);
  }, [products, queryKey, activeCategory]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const recommendedProducts = useMemo(() => products.filter(item => item.tags?.includes("AI Choice")), [products]);
  const trendingProducts = useMemo(() => products.filter(item => item.tags?.includes("Trending")), [products]);
  const bestSellerProducts = useMemo(() => products.filter(item => item.tags?.includes("Best Seller")), [products]);

  const loadMoreProducts = () => {
    setVisibleCount(prevCount => prevCount + 6);
  };

  const hasMore = visibleCount < filteredProducts.length;

  return {
    recommendedProducts,
    trendingProducts,
    bestSellerProducts,
    visibleProducts, 
    filteredProducts,
    loadMoreProducts,
    hasMore,
    products,
    loading, 
    error
  };
}
