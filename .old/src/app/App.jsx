import {AppRoutes} from "@/routes/index.route";
import seedProducts from "../firebase/product/seedProduct";
import { store } from "@/store/store";
import { useEffect } from "react";
import { Provider } from "react-redux";
const App = () => {
  useEffect(() => {
    // seedProducts();
  }, []);
  return (

  <Provider store={store}>
    <div className="w-full bg-gray-100">
      <AppRoutes/>
    </div>
  </Provider>

  )
}

export default App