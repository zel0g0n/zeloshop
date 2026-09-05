import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Send, Gift, Users, Trophy, Loader2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { buildReferralLink } from "@/utils/shareLink";
import { getTelegramWebApp } from "@/config/telegram";
import getReferralLeaderboard from "@/services/sellers/getReferralLeaderboard";

/**
 * MIJOZNING "DO'STLARNI TAKLIF QILING" SAHIFASI.
 *
 * MUHIM DIZAYN QARORI (Firebase xarajatlarini nazarda tutib): bu
 * sahifa HECH QANDAY Firestore so'rovi qilmaydi - "necha ta do'stingiz
 * xarid qildi" kabi jonli statistika ATAYLAB qo'shilmagan. Havola va
 * mukofot tushuntirishi statik matn - hisob-kitob kerak emas. Agar
 * kelajakda jonli statistika kerak bo'lsa, buni alohida (va aniq
 * cheklangan) so'rov bilan qo'shish mumkin.
 *
 * MUKOFOT MEXANIZMI (server tomonida, `functions/orders.js`da amalga
 * oshirilgan): do'stingiz shu havola orqali kirib, birinchi
 * buyurtmasini bersa - IKKALANGIZ HAM foyda ko'rasiz: do'stingiz
 * birinchi buyurtmasiga avtomatik chegirma oladi, sizga esa keyingi
 * xaridingiz uchun promokod beriladi.
 */
const ReferralPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, clientId, store } = useSession();
  const [copied, setCopied] = useState(false);

  // REYTING (leaderboard) - ATAYLAB avtomatik yuklanmaydi (yuqoridagi
  // fayl darajasidagi izohga qarang, Firebase o'qish xarajatini
  // nazorat qilish uchun) - faqat xaridor ANIQ tugma bosganda.
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardOpened, setLeaderboardOpened] = useState(false);

  const handleLoadLeaderboard = useCallback(async () => {
    setLeaderboardOpened(true);
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const data = await getReferralLeaderboard(sellerId);
      setLeaderboardData(data);
    } catch (err) {
      setLeaderboardError(err.message || t("referral.leaderboardError"));
    } finally {
      setLeaderboardLoading(false);
    }
  }, [sellerId, t]);

  const referralLink = buildReferralLink(sellerId, clientId);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz, havolani qo'lda belgilab nusxalash mumkin.
    }
  }, [referralLink]);

  const handleShare = useCallback(() => {
    const webApp = getTelegramWebApp();
    const shareText = t("referral.shareText", { storeName: store?.storeName || "" });
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [referralLink, store?.storeName, t]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white flex-1 text-center mr-10">{t("referral.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[28px] p-6 text-white text-center shadow-lg shadow-blue-600/20">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <Gift size={26} />
          </div>
          <h2 className="text-base font-black">{t("referral.heroTitle")}</h2>
          <p className="text-xs font-medium text-white/80 mt-1.5 leading-relaxed">{t("referral.heroSubtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("referral.linkLabel")}</span>
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
            <span className="flex-1 text-xs font-mono text-gray-600 dark:text-slate-300 truncate">{referralLink}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
            >
              {copied ? (<><Check size={11} /> {t("referral.copied")}</>) : t("referral.copy")}
            </button>
          </div>
          <button
            onClick={handleShare}
            className="w-full h-12 bg-blue-600 text-white font-black text-sm rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Send size={15} /> {t("referral.shareButton")}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            <Users size={12} /> {t("referral.howItWorksLabel")}
          </span>
          <div className="space-y-2.5">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center shrink-0">1</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("referral.step1")}</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center shrink-0">2</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("referral.step2")}</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-black flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("referral.step3")}</p>
            </div>
          </div>
        </div>

        {/* REYTING (leaderboard) - gamifikatsiya orqali ulashishni
            rag'batlantirish uchun. Faqat shu tugma bosilgandagina
            so'rov yuboriladi. */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            <Trophy size={12} /> {t("referral.leaderboardTitle")}
          </span>

          {!leaderboardOpened && (
            <button
              type="button"
              onClick={handleLoadLeaderboard}
              className="w-full h-11 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Trophy size={14} /> {t("referral.leaderboardButton")}
            </button>
          )}

          {leaderboardLoading && (
            <p className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-400 dark:text-slate-500 py-4">
              <Loader2 size={14} className="animate-spin" /> {t("referral.leaderboardLoading")}
            </p>
          )}

          {leaderboardError && !leaderboardLoading && (
            <p className="text-xs font-semibold text-rose-500 text-center py-2">{leaderboardError}</p>
          )}

          {leaderboardData && !leaderboardLoading && !leaderboardError && (
            <div className="space-y-2">
              {leaderboardData.leaderboard.length === 0 ? (
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 text-center py-4">{t("referral.leaderboardEmpty")}</p>
              ) : (
                <div className="space-y-1.5">
                  {leaderboardData.leaderboard.map((entry) => (
                    <div
                      key={entry.rank}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                        entry.isYou ? "bg-blue-50 dark:bg-blue-500/10" : "bg-gray-50 dark:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-[10px] font-black flex items-center justify-center shrink-0">
                          {entry.rank}
                        </span>
                        <span className={`text-xs font-bold ${entry.isYou ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-slate-300"}`}>
                          {entry.isYou ? t("referral.leaderboardYou") : t("referral.anonymousEntryLabel")}
                        </span>
                      </div>
                      <span className="text-xs font-black text-gray-800 dark:text-white">
                        {entry.count} {t("referral.leaderboardCountSuffix")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-1 border-t border-gray-100 dark:border-slate-800">
                {leaderboardData.myRank ? (
                  <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 text-center pt-2">
                    {t("referral.yourRankLabel")}: #{leaderboardData.myRank} ({leaderboardData.myCount} {t("referral.leaderboardCountSuffix")})
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 text-center pt-2">{t("referral.notRankedYet")}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
