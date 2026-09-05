import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import {
  ArrowLeft, Bot, Check, ExternalLink, Loader2, Unlink, Hash, X, Send,
} from "lucide-react";
import { functions } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import { connectCustomBot, disconnectCustomBot } from "@/services/settings/customBot";
import updateSeller from "@/services/sellers/updateSeller";
import { buildShopLink } from "@/utils/shareLink";
import { getTelegramWebApp } from "@/config/telegram";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";

// Ulanishlar — birlashtirilgan sahifa: do'kon havolasi, shaxsiy bot ulash
// va Telegram kanaliga ulash bir xil mavzuga tegishli ("do'kon bilan
// qanday bog'lanish mumkin"), shuning uchun barchasi bitta sahifada,
// oddiy vertikal scroll bilan (tablar emas) ko'rsatiladi: do'kon havolasi
// tepada — darhol ko'rinadi va nusxalanadi, so'ng bot ulash, so'ng kanal
// ulash bo'limlari keladi.
const ConnectionsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();

  // --- Do'kon havolasi ---
  const [linkCopied, setLinkCopied] = useState(false);
  const shopLink = buildShopLink(sellerId);

  const markShared = useCallback(() => {
    if (!sellerId || store?.onboardingSharedAt) return;
    const sharedAt = Date.now();
    updateSeller(sellerId, { onboardingSharedAt: sharedAt }).catch(() => {});
    patchStore({ onboardingSharedAt: sharedAt });
  }, [sellerId, store?.onboardingSharedAt, patchStore]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shopLink);
      setLinkCopied(true);
      markShared();
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [shopLink, markShared]);

  const handleShareLink = useCallback(async () => {
    markShared();
    const shareText = store?.storeName
      ? t("shareStoreModal.shareTextTemplate", { storeName: store.storeName })
      : t("shareStoreModal.shareTextDefault");

    if (navigator.share) {
      try {
        await navigator.share({ title: store?.storeName || t("shareStoreModal.title"), text: shareText, url: shopLink });
        return;
      } catch {
        return;
      }
    }
    const webApp = getTelegramWebApp();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shopLink)}&text=${encodeURIComponent(shareText)}`;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [shopLink, store, t, markShared]);

  // --- Shaxsiy bot ulash ---
  const [botToken, setBotToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [botError, setBotError] = useState(null);
  const [connectedUsername, setConnectedUsername] = useState(store?.customBotUsername || null);
  const [showBotSuccess, setShowBotSuccess] = useState(false);

  const handleConnectBot = useCallback(async (e) => {
    e.preventDefault();
    if (!botToken.trim()) {
      setBotError(t("customBot.tokenRequired"));
      return;
    }
    setConnecting(true);
    setBotError(null);
    try {
      const result = await connectCustomBot(botToken.trim());
      setConnectedUsername(result.botUsername);
      setBotToken("");
      setShowBotSuccess(true);
    } catch (err) {
      setBotError(err.message || t("customBot.connectError"));
    } finally {
      setConnecting(false);
    }
  }, [botToken, t]);

  const handleDisconnectBot = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectCustomBot();
      setConnectedUsername(null);
    } catch (err) {
      setBotError(err.message || t("customBot.disconnectError"));
    } finally {
      setDisconnecting(false);
    }
  }, [t]);

  // --- Telegram kanaliga ulash ---
  const [channelUsername, setChannelUsername] = useState("");
  const [channelConnecting, setChannelConnecting] = useState(false);
  const [channelError, setChannelError] = useState(null);
  const [connectedChannel, setConnectedChannel] = useState(store?.connectedChannelUsername || null);
  const [channelDisconnecting, setChannelDisconnecting] = useState(false);

  const handleConnectChannel = useCallback(async () => {
    if (!channelUsername.trim()) {
      setChannelError(t("channelSettings.usernameRequiredError"));
      return;
    }
    setChannelConnecting(true);
    setChannelError(null);
    try {
      const connectChannel = httpsCallable(functions, "connectChannel");
      const { data } = await connectChannel({ channelUsername: channelUsername.trim() });
      setConnectedChannel(data.channelUsername);
      setChannelUsername("");
    } catch (err) {
      setChannelError(err.message || t("channelSettings.connectError"));
    } finally {
      setChannelConnecting(false);
    }
  }, [channelUsername, t]);

  const handleDisconnectChannel = useCallback(async () => {
    setChannelDisconnecting(true);
    try {
      const disconnectChannel = httpsCallable(functions, "disconnectChannel");
      await disconnectChannel();
      setConnectedChannel(null);
    } catch (err) {
      setChannelError(err.message || t("channelSettings.connectError"));
    } finally {
      setChannelDisconnecting(false);
    }
  }, [t]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("connections.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("connections.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* DO'KON HAVOLASI */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("shareStoreModal.linkLabel")}</span>
            <h3 className="font-black text-sm text-slate-800 dark:text-white">{t("shareStoreModal.title")}</h3>
          </div>
          <div className="bg-[#F4F5F9] dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
            <span className="flex-1 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{shopLink}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
            >
              {linkCopied ? (<><Check size={11} /> {t("shareStoreModal.copied")}</>) : t("shareStoreModal.copy")}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("shareStoreModal.hint")}</p>
          <button
            type="button"
            onClick={handleShareLink}
            className="w-full h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> {t("shareStoreModal.share")}
          </button>
        </div>

        {/* SHAXSIY BOT ULASH */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">{t("customBot.title")}</h3>

          {connectedUsername ? (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                  <Check size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("customBot.connectedLabel")}</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white">@{connectedUsername}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">{t("customBot.connectedDesc")}</p>
              <a
                href={shopLink}
                target="_blank" rel="noreferrer"
                className="w-full h-10 bg-[#F4F5F9] dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 mb-2"
              >
                <ExternalLink size={13} /> {t("customBot.viewShopLink")}
              </a>
              <button
                type="button"
                onClick={handleDisconnectBot}
                disabled={disconnecting}
                className="w-full h-10 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Unlink size={13} /> {disconnecting ? t("customBot.disconnecting") : t("customBot.disconnectButton")}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                    <Bot size={20} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t("customBot.introText")}</p>
                </div>

                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-11 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} /> {t("customBot.openBotFather")}
                </a>

                <ol className="space-y-2.5 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                  <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">1.</span>{t("customBot.guideStep1")}</li>
                  <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">2.</span>{t("customBot.guideStep2")}</li>
                  <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">3.</span>{t("customBot.guideStep3")}</li>
                  <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">4.</span>{t("customBot.guideStep4")}</li>
                  <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">5.</span>{t("customBot.guideStep5")}</li>
                </ol>
              </div>

              <form onSubmit={handleConnectBot} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
                <input
                  type="text"
                  disabled={connecting}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:AAExample-BotToken"
                  className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
                {botError && <p className="text-[11px] text-rose-500 font-semibold">{botError}</p>}
                <button
                  type="submit"
                  disabled={connecting}
                  className="w-full h-11 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  {connecting ? t("customBot.checking") : t("customBot.connectButton")}
                </button>
              </form>
            </>
          )}
        </div>

        {/* TELEGRAM KANALIGA ULASH */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">{t("channelSettings.title")}</h3>

          {connectedChannel ? (
            <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">{t("channelSettings.connectedLabel")}</p>
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate">{connectedChannel}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("channelSettings.connectedDesc")}</p>
              <button
                type="button"
                onClick={handleDisconnectChannel}
                disabled={channelDisconnecting}
                className="w-full h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {channelDisconnecting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                {t("channelSettings.disconnectButton")}
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{t("channelSettings.step1")}</p>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{t("channelSettings.step2")}</p>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{t("channelSettings.step3")}</p>
              </div>

              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={channelUsername}
                  onChange={(e) => setChannelUsername(e.target.value)}
                  disabled={channelConnecting}
                  placeholder={t("channelSettings.usernamePlaceholder")}
                  className="w-full h-11 pl-9 pr-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
                />
              </div>

              {channelError && <p className="text-[11px] text-rose-500 font-semibold">{channelError}</p>}

              <button
                type="button"
                onClick={handleConnectChannel}
                disabled={channelConnecting || !channelUsername.trim()}
                className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {channelConnecting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {channelConnecting ? t("channelSettings.checking") : t("channelSettings.connectButton")}
              </button>
            </div>
          )}

          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3.5 rounded-2xl">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>{t("channelSettings.limitationLabel")}:</strong> {t("channelSettings.limitationText")}
            </p>
          </div>
        </div>
      </div>

      {showBotSuccess && (
        <StatusModal
          variant="success"
          title={t("customBot.connectedTitle")}
          message={t("customBot.connectedMessage", { username: connectedUsername })}
          onClose={() => setShowBotSuccess(false)}
        />
      )}
    </div>
  );
};

export default ConnectionsPage;
