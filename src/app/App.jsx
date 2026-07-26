import {AppRoutes} from "@/routes/index.route";
import { store } from "@/store/store";
import { Provider } from "react-redux";
import { SessionProvider } from "@/context/SessionContext";

const App = () => {
  return (
    <Provider store={store}>
      <SessionProvider>
        <div className="w-full bg-gray-100">
          <AppRoutes/>
        </div>
      </SessionProvider>
    </Provider>
  )
}

export default App