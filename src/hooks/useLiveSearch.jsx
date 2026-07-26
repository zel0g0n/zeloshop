import { useDispatch, useSelector } from "react-redux";
import { liveSearchProduct } from "@/store/slices/product/getProductSlice";
const useLiveSearch = () => {
  const dispatch = useDispatch();
  
  const {searchQuery} = useSelector((state) => state.products);

  const handleSearchChange = (value) => {
    dispatch(liveSearchProduct(value));
  };

  const clearSearch = () => {
    dispatch(liveSearchProduct(""));
  };

  return {
    searchQuery,
    handleSearchChange,
    clearSearch
  };
};

export default useLiveSearch;