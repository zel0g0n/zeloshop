import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

const subscribe = (cb) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/**
 * Kompyuter/noutbuk (lg+, >=1024px) ekranmi? Telefon va Telegram Mini App
 * ko'rinishi O'ZGARMAY qoladi — faqat keng ekranda alohida (jadval,
 * grafik, ko'p ustunli) dizayn render qilinadi.
 */
export const useIsDesktop = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
