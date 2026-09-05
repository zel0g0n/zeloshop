import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, Hash, Check, Loader2, X, ExternalLink } from "lucide-react";
import { functions } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * KANAL ULASH SAHIFASI — "10-band"ning "post qo'shish" qismi.
 *
 * MUHIM, OCHIQ CHEKLOV: bu — FAQAT kanalga POST QO'SHISH imkonini
 * beradi. Kanal/guruhdagi izohlarga AVTOMATIK JAVOB BERISH -
 * BUTUNLAY BOSHQA, ancha katta infratuzilma (Telegram WEBHOOK'i)
 * talab qiladi va HOZIRCHA QURILMAGAN - bu, kelajakdagi alohida
 * loyiha.
 */
const ChannelSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();

  const [channelUsername, setChannelUsername] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [connectedChannel, setConnectedChannel] = useState(store?.connectedChannelUsername || null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (!channelUsername.trim()) {
      setError(t("channelSettings.usernameRequiredError"));
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const connectChannel = httpsCallable(functions, "connectChannel");
      const { data } = await connectChannel({ channelUsername: channelUsername.trim() });
      setConnectedChannel(data.channelUsername);
      setChannelUsername("");
    } catch (err) {
      setError(err.message || t("channelSettings.connectError"));
    } finally {
      setConnecting(false);
    }
  }, [channelUsername, t]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const disconnectChannel = httpsCallable(functions, "disconnectChannel");
      await disconnectChannel();
      setConnectedChannel(null);
    } catch (err) {
      setError(err.message || t("channelSettings.connectError"));
    } finally {
      setDisconnecting(false);
    }
  }, [t]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("channelSettings.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("channelSettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
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
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {disconnecting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
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
                disabled={connecting}
                placeholder={t("channelSettings.usernamePlaceholder")}
                className="w-full h-11 pl-9 pr-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}

            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || !channelUsername.trim()}
              className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {connecting ? t("channelSettings.checking") : t("channelSettings.connectButton")}
            </button>
          </div>
        )}

        {/* HALOL, OCHIQ CHEKLOV */}
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-3.5 rounded-2xl">
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>{t("channelSettings.limitationLabel")}:</strong> {t("channelSettings.limitationText")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsPage;
