import { useEffect, useState } from "react";
import getSingleProduct from "@/services/products/getSingleProduct";

// Sotuvchi tahrirlash sahifasi uchun alohida, lokal state bilan
// ishlaydigan yuklovchi — mijoz tomonidagi mahsulot tafsiloti Redux
// slice'i (state.singleProduct) bilan aralashib ketmasligi uchun
// ataylab alohida qilingan.
export const useLoadProductForEdit = (productId) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!productId) return;

    setLoading(true);
    getSingleProduct(productId)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setError("Mahsulot topilmadi.");
        } else {
          setProduct(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { product, loading, error };
};
