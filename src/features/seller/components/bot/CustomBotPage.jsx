import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Check, ExternalLink, Loader2, Unlink } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { connectCustomBot, disconnectCustomBot } from "@/services/settings/customBot";
import { buildShopLink } from "@/utils/shareLink";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";

// SOTUVCHINING O'Z (FAQAT XARIDORLAR UCHUN) BOTINI ULASH.
//
// HALOL IZOH: bu — sotuvchi PANELINI boshqarishga aloqasi yo'q (u
// hamon platformaning umumiy botida ochiladi). Bu yerda ulangan bot
// — FAQAT xaridorlar buyurtma berishi uchun. Bot yaratish (BotFather
// orqali) — sotuvchining O'ZI, Telegram orqali qo'lda bajaradigan
// qadam; buni Cloud Function orqali avtomatlashtirib bo'lmaydi.
const CustomBotPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();

  const [botToken, setBotToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(null);
  const [connectedUsername, setConnectedUsername] = useState(store?.customBotUsername || null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleConnect = useCallback(async (e) => {
    e.preventDefault();
    if (!botToken.trim()) {
      setError(t("customBot.tokenRequired"));
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const result = await connectCustomBot(botToken.trim());
      setConnectedUsername(result.botUsername);
      setBotToken("");
      setShowSuccess(true);
    } catch (err) {
      setError(err.message || t("customBot.connectError"));
    } finally {
      setConnecting(false);
    }
  }, [botToken]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await disconnectCustomBot();
      setConnectedUsername(null);
    } catch (err) {
      setError(err.message || t("customBot.disconnectError"));
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("customBot.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("customBot.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">

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
              href={buildShopLink(sellerId)}
              target="_blank" rel="noreferrer"
              className="w-full h-10 bg-[#F4F5F9] dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 mb-2"
            >
              <ExternalLink size={13} /> {t("customBot.viewShopLink")}
            </a>
            <button
              type="button"
              onClick={handleDisconnect}
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

              {/* MUHIM YAXSHILANISH: OLDIN faqat 2 ta juda qisqa qadam
                  bor edi - sotuvchi BotFather bilan qanday gaplashishni
                  aniq bilmasdi. Endi - BotFather'ning HAQIQIY savol-
                  javob oqimiga mos, 5 ta aniq qadam + BotFather'ni
                  TO'G'RIDAN-TO'G'RI ochadigan tugma.
                  HALOL ESLATMA: Telegram havola orqali `/newbot`
                  buyrug'ini AVTOMATIK yubormaydi (BotFather bunday
                  ishlashni rasmiy qo'llab-quvvatlamaydi) - sotuvchi
                  ochilgan suhbatda buyruqni O'ZI yozishi kerak, lekin
                  hech bo'lmasa to'g'ri suhbatga bir bosishda tushadi. */}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="w-full h-11 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} /> {t("customBot.openBotFather")}
              </a>

              <ol className="space-y-2.5 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                <li className="flex gap-2">
                  <span className="font-black text-indigo-500 shrink-0">1.</span>
                  {t("customBot.guideStep1")}
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-indigo-500 shrink-0">2.</span>
                  {t("customBot.guideStep2")}
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-indigo-500 shrink-0">3.</span>
                  {t("customBot.guideStep3")}
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-indigo-500 shrink-0">4.</span>
                  {t("customBot.guideStep4")}
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-indigo-500 shrink-0">5.</span>
                  {t("customBot.guideStep5")}
                </li>
              </ol>
            </div>

            <form onSubmit={handleConnect} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
              <input
                type="text"
                disabled={connecting}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:AAExample-BotToken"
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
              {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
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

      {showSuccess && (
        <StatusModal
          variant="success"
          title={t("customBot.connectedTitle")}
          message={t("customBot.connectedMessage", { username: connectedUsername })}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
};

export default CustomBotPage;
