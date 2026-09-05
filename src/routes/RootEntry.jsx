import { Navigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import HomePage from "@/pages/client/HomePage";

// OLDIN: Telegram Menu tugmasi doim ildiz manzilni ("/") ochadi, va bu
// manzil har doim HomePage (do'kon katalogi)ga mos kelardi — foydalanuvchi
// sotuvchimi yoki mijozmi, farqi yo'q edi. Ya'ni mavjud sotuvchi ham
// har safar Menu tugmasini bosganda o'z Dashboard'i o'rniga katalogni
// ko'rardi va qo'lda "/seller" manziliga o'tishning iloji yo'q edi
// (Telegram Mini App'da manzil satri ko'rinmaydi).
//
// MUHIM QO'SHIMCHA: agar sessiya CHUQUR HAVOLA orqali kirilgan bo'lsa
// (`deepLinkPath` — masalan bitta kategoriyaga to'g'ridan-to'g'ri
// havola orqali), bu HAR QANDAY boshqa yo'naltirishdan USTUN turadi -
// mijoz aynan o'zi bosgan havola olib borishi kerak bo'lgan sahifaga
// tushadi, sotuvchining oddiy Dashboard/Katalog holatiga emas.
const RootEntry = () => {
  const { isSeller, deepLinkPath } = useSession();

  if (deepLinkPath) {
    return <Navigate to={deepLinkPath} replace />;
  }

  if (isSeller) {
    return <Navigate to="/seller" replace />;
  }

  return <HomePage />;
};

export default RootEntry;
