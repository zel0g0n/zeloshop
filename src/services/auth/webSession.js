import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth, functions } from "@/firebase/config";

/**
 * Brauzer (Telegramsiz) sotuvchi sessiyasi — backend: `functions/webAppAuth.js`.
 *
 * 1) `loginWithPassword` — bot bergan login+parolni tekshirtirib, Firebase
 *    custom token bilan tizimga kiradi.
 * 2) `fetchWebSession` — kirgandan so'ng do'kon/xavfsizlik/dashboard
 *    ma'lumotini oladi (Telegram'da buni `verifyTelegramAuth` beradi).
 * 3) `logoutWeb` — haqiqiy chiqish (Telegram Mini App'dan farqli o'laroq,
 *    brauzerda `signOut` HAQIQATAN ishlaydi — qayta avtomatik kirish yo'q).
 */
export const loginWithPassword = async (login, password) => {
  const callable = httpsCallable(functions, "webAppLogin");
  const { data } = await callable({ login, password });
  await signInWithCustomToken(auth, data.customToken);
  return data;
};

export const fetchWebSession = async () => {
  const callable = httpsCallable(functions, "getWebSession");
  const { data } = await callable();
  return data;
};

export const logoutWeb = async () => {
  await signOut(auth);
};
