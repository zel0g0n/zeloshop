import { useCallback, useState } from "react";
import updateProductFull from "@/services/products/updateProductFull";

const useUpdateProductFull = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const updateProduct = useCallback(async (productId, productData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updateProductFull(productId, productData);
      setSuccess(true);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetState = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { updateProduct, loading, error, success, resetState };
};

export default useUpdateProductFull;
