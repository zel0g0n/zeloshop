import { memo, useState } from "react";
import { X, Check, Send } from "lucide-react";
import { buildShopLink, buildSellerBotDeepLink } from "@/utils/shareLink";
import { getTelegramWebApp } from "@/config/telegram";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

// FOYDALANUVCHI SO'ROVI BILAN QO'SHILDI (2026-09): "Do'konni ulashish"
// havolasi ENDI, agar sotuvchi shaxsiy botini ulagan bo'lsa
// (`customBotUsername`), O'SHA botga ochiladi — ZeloShop umumiy boti
// EMAS, sellerning O'Z brendi (bot nomi/rasmi) ko'rinadi. Ulanmagan
// bo'lsa avvalgidek ZeloShop umumiy botiga (`buildShopLink`) tushiladi.
const ShareStoreModal = ({ sellerId, storeName, customBotUsername, onClose }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const shopLink = buildSellerBotDeepLink(customBotUsername) || buildShopLink(sellerId);

  useEscapeToClose(onClose);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shopLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa (ba'zi eski WebView'lar) — jim
      // qolamiz, foydalanuvchi havolani qo'lda belgilab nusxalay oladi.
    }
  };

  // MUHIM YAXSHILANISH: OLDIN faqat Telegram'ning o'ziga (`t.me/share`)
  // ulashilardi - Instagram, SMS kabi boshqa ilovalarga ulashish
  // IMKONI YO'Q edi. Endi, AVVAL brauzerning O'ZINING native "ulashish"
  // oynasi (`navigator.share()`) SINALADI - bu, QURILMADA O'RNATILGAN
  // BARCHA ilovalarni (Telegram, Instagram, SMS, WhatsApp va h.k.)
  // ko'rsatadi, chunki bu - OPERATSION TIZIM darajasidagi imkoniyat,
  // bizning kodimiz FAQAT unga ma'lumot beradi. Agar bu ISHLAMASA
  // (ba'zi eski WebView'larda qo'llab-quvvatlanmaydi), ESKI, Telegram'ga
  // xos usul ZAXIRA sifatida ishlatiladi.
  const handleShare = async () => {
    const shareText = storeName
      ? t("shareStoreModal.shareTextTemplate", { storeName })
      : t("shareStoreModal.shareTextDefault");

    if (navigator.share) {
      try {
        await navigator.share({ title: storeName || t("shareStoreModal.title"), text: shareText, url: shopLink });
        return;
      } catch {
        // Foydalanuvchi ulashishni BEKOR QILGAN bo'lishi mumkin (bu -
        // xato emas, oddiy holat) - shunchaki hech narsa qilmaymiz,
        // pastdagi Telegram-zaxira usuliga O'TMAYMIZ (aks holda ikki
        // marta ulashish oynasi ochilib ketardi).
        return;
      }
    }

    const webApp = getTelegramWebApp();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shopLink)}&text=${encodeURIComponent(shareText)}`;

    // Telegram ichida bo'lsak, uning o'z "ulashish" ekranini ochamiz —
    // bu eng tabiiy, tanish tajriba beradi (kontakt/guruh tanlash).
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/55 z-50 flex items-end justify-center animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("shareStoreModal.linkLabel")}</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("shareStoreModal.title")}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
          <span className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{shopLink}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
          >
            {copied ? (<><Check size={11} /> {t("shareStoreModal.copied")}</>) : t("shareStoreModal.copy")}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          {t("shareStoreModal.hint")}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onClose}
            className="h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
          >
            {t("shareStoreModal.close")}
          </button>
          <button
            onClick={handleShare}
            className="h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> {t("shareStoreModal.share")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ShareStoreModal);
