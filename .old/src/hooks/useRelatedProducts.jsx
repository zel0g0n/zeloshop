import { useEffect, useMemo, useState } from "react";
import getProducts from "@/services/products/getProducts.js";

export const useRelatedProducts = (product) => {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    const fetchProducts = async () => {
      const data = await getProducts();
      setProducts(data);
    };
    fetchProducts();
  }, [product?.id]);

  const relatedProducts = useMemo(() => {
    try {
      if (!product || !product.tags || !Array.isArray(product.tags)) return [];

      return products.filter((item) => {
        if (String(item.id) === String(product.id)) return false;
      
        if (!item.tags || !Array.isArray(item.tags)) return false;
        return item.tags.some((tag) => product.tags.includes(tag));
      });
    } catch (error) {
      console.error("Xatolik yuz berdi:", error);
      return [];
    }
  }, [product, products]); 

  return relatedProducts;
};