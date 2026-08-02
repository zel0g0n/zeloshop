import { memo, useState } from "react";
import { buildShopLink } from "@/utils/shareLink";
import { getTelegramWebApp } from "@/config/telegram";

const ShareStoreModal = ({ sellerId, storeName, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shopLink = buildShopLink(sellerId);

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

  const handleShare = () => {
    const webApp = getTelegramWebApp();
    const shareText = storeName
      ? `${storeName} do'konini ko'ring!`
      : "Mening do'konimni ko'ring!";
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Do'koningiz havolasi</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">Mijozlar bilan ulashing</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
          <span className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{shopLink}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg"
          >
            {copied ? "Nusxalandi ✓" : "Nusxalash"}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Ushbu havolani mijozlaringizga yuboring — ular bosganda to'g'ridan-to'g'ri sizning do'koningizga tushishadi.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onClose}
            className="h-11 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
          >
            Yopish
          </button>
          <button
            onClick={handleShare}
            className="h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <span>✈️</span> Ulashish
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ShareStoreModal);
