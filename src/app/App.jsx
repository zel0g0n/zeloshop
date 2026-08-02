import {AppRoutes} from "@/routes/index.route";
import { store } from "@/store/store";
import { Provider } from "react-redux";
import { SessionProvider } from "@/context/SessionContext";
import SessionGate from "@/context/SessionGate";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Suspense } from "react";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

const App = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <LanguageProvider>
          <SessionProvider>
            <SessionGate>
              <div className="w-full bg-gray-100 dark:bg-slate-950 transition-colors duration-300">
                <Suspense fallback={<FullScreenSpinner />}>
                  <AppRoutes/>
                </Suspense>
              </div>
            </SessionGate>
          </SessionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </Provider>
  )
}

export default App