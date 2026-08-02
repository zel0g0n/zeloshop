import { useState, Suspense, lazy } from "react";
import WelcomeScreen from "./WelcomeScreen";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";

const CreateStoreScreen = lazy(() => import("./CreateStoreScreen"));

// Bu ikki ekran ataylab React Router'siz, oddiy lokal state bilan
// boshqariladi — chunki bu qisqa, chiziqli oqim (2 qadam) va u butun
// ilova marshrutlashidan TASHQARIDA (SessionGate darajasida) ko'rsatiladi.
const OnboardingFlow = () => {
  const [step, setStep] = useState("welcome"); // 'welcome' | 'create'

  if (step === "create") {
    return (
      <Suspense fallback={<FullScreenSpinner />}>
        <CreateStoreScreen onBack={() => setStep("welcome")} />
      </Suspense>
    );
  }

  return <WelcomeScreen onGetStarted={() => setStep("create")} />;
};

export default OnboardingFlow;
