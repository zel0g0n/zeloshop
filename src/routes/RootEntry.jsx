import { Navigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import HomePage from "@/pages/client/HomePage";

// OLDIN: Telegram Menu tugmasi doim ildiz manzilni ("/") ochadi, va bu
// manzil har doim HomePage (do'kon katalogi)ga mos kelardi — foydalanuvchi
// sotuvchimi yoki mijozmi, farqi yo'q edi. Ya'ni mavjud sotuvchi ham
// har safar Menu tugmasini bosganda o'z Dashboard'i o'rniga katalogni
// ko'rardi va qo'lda "/seller" manziliga o'tishning iloji yo'q edi
// (Telegram Mini App'da manzil satri ko'rinmaydi).
const RootEntry = () => {
  const { isSeller } = useSession();

  if (isSeller) {
    return <Navigate to="/seller" replace />;
  }

  return <HomePage />;
};

export default RootEntry;
