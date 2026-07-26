import { useDispatch, useSelector } from "react-redux";
import { filterCategory } from "@/store/slices/product/getProductSlice";
const useChangeCategory = () => {
  const dispatch = useDispatch()
  const {activeCategory} = useSelector(state => state.products)
  const changeCategory = (specialKey) => {
    dispatch(filterCategory(specialKey))
  }
  return {changeCategory}

}
export default useChangeCategory