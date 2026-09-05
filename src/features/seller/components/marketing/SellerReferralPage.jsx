import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Send, Gift, Users, Sparkles } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { buildSellerInviteLink } from "@/utils/shareLink";
import { getTelegramWebApp } from "@/config/telegram";
import getSellerReferrals from "@/services/sellers/getSellerReferrals";

// MUHIM: bu qiymat `functions/sellerReferrals.js`dagi
// `REFERRALS_NEEDED_FOR_REWARD` bilan ANIQ mos kelishi kerak - bu
// yerda faqat progress-ko'rsatkichni chizish uchun ishlatiladi
// (haqiqiy hisoblash har doim serverda amalga oshadi).
const REFERRALS_NEEDED_FOR_REWARD = 3;

/**
 * SOTUVCHINING "BOSHQA SOTUVCHINI TAKLIF QILING" SAHIFASI.
 *
 * Mijozlar uchun mo'ljallangan `ReferralPage.jsx`ga vizual jihatdan
 * o'xshash - lekin bu yerda (a) havola formati boshqacha (`_i`,
 * "do'kon ko'rish" emas - `buildSellerInviteLink`), va (b) mukofot
 * pul/chegirma emas, balki AI CEO (Pro) funksiyasiga vaqtinchalik
 * bepul kirish (batafsil izoh: `functions/sellerReferrals.js`).
 *
 * MUHIM (v2): mukofot endi "birinchi mahsulot qo'shish"ga EMAS,
 * balki taklif qilingan sotuvchining HAQIQIY, PULLIK Pro obunasi
 * TASDIQLANISHIGA bog'liq (admin tomonidan tasdiqlanadi, chunki
 * platformada hali markazlashtirilgan to'lov tizimi yo'q) - VA buning
 * uchun BITTA emas, KAMIDA 3 TA sotuvchi shunday tasdiqlangan
 * bo'lishi kerak. Shuning uchun statistika endi ikki qatlamli:
 * "necha kishi taklif qilingan/obuna bo'lgan" (referral hujjatlaridan)
 * va "jami necha marta mukofot olingan" (`store.sellerReferralRewardsCount`,
 * chunki bitta mukofot 3 ta alohida taklifga tegishli, individual
 * "referral" yozuviga emas).
 *
 * Mijozlar sahifasidan farqli, bu yerda HAQIQIY statistika ko'rsatiladi
 * - sotuvchi buni doimiy ochib TEKSHIRMAYDI (bir martalik o'qish,
 * ilova ochilganda EMAS - faqat shu sahifaga kirilganda).
 */
const SellerReferralPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  const inviteLink = buildSellerInviteLink(sellerId);

  useEffect(() => {
    let cancelled = false;
    if (!sellerId) return undefined;
    getSellerReferrals(sellerId)
      .then((list) => { if (!cancelled) setReferrals(list); })
      .catch(() => { if (!cancelled) setReferrals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sellerId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [inviteLink]);

  const handleShare = useCallback(() => {
    const webApp = getTelegramWebApp();
    const shareText = t("sellerReferral.shareText");
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;

    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }
  }, [inviteLink, t]);

  // "subscribed" - taklif qilingan sotuvchining Pro obunasi admin
  // tomonidan tasdiqlangan (`onSellerAiCeoAccessChanged` trigger).
  const subscribedCount = referrals.filter((r) => r.status === "subscribed").length;
  // Mukofotlar soni - AGGREGAT qiymat (referrerning o'z hujjatida
  // saqlanadi), chunki bitta mukofot 3 ta ALOHIDA taklifga tegishli,
  // yakka referral yozuviga emas.
  const rewardsEarnedCount = Number(store?.sellerReferralRewardsCount) || 0;
  const paidCount = Number(store?.sellerReferralPaidCount) || 0;
  const progressInCycle = paidCount % REFERRALS_NEEDED_FOR_REWARD;

  const trialActive = store?.aiCeoGrantedViaReferral === true && store?.aiCeoEnabled === true;
  const trialExpiresAt = store?.aiCeoTrialExpiresAt;

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
        <h1 className="text-lg font-bold text-[#1e293b] dark:text-white flex-1 text-center mr-10">{t("sellerReferral.pageTitle")}</h1>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-4">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[28px] p-6 text-white text-center shadow-lg shadow-indigo-600/20">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <Gift size={26} />
          </div>
          <h2 className="text-base font-black">{t("sellerReferral.heroTitle")}</h2>
          <p className="text-xs font-medium text-white/80 mt-1.5 leading-relaxed">{t("sellerReferral.heroSubtitle")}</p>
        </div>

        {trialActive && trialExpiresAt && (
          <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-3.5">
            <Sparkles size={18} className="text-emerald-500 shrink-0" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {t("sellerReferral.trialActive", { date: new Date(trialExpiresAt).toLocaleDateString("uz-UZ") })}
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("sellerReferral.linkLabel")}</span>
          <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 flex items-center gap-2">
            <span className="flex-1 text-xs font-mono text-gray-600 dark:text-slate-300 truncate">{inviteLink}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
            >
              {copied ? (<><Check size={11} /> {t("sellerReferral.copied")}</>) : t("sellerReferral.copy")}
            </button>
          </div>
          <button
            onClick={handleShare}
            className="w-full h-12 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Send size={15} /> {t("sellerReferral.shareButton")}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-gray-800 dark:text-white">{loading ? "…" : referrals.length}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{t("sellerReferral.statInvited")}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-gray-800 dark:text-white">{loading ? "…" : subscribedCount}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{t("sellerReferral.statSubscribed")}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-gray-800 dark:text-white">{loading ? "…" : rewardsEarnedCount}</p>
            <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">{t("sellerReferral.statRewarded")}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">{t("sellerReferral.progressLabel")}</span>
            <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{progressInCycle}/{REFERRALS_NEEDED_FOR_REWARD}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${(progressInCycle / REFERRALS_NEEDED_FOR_REWARD) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            <Users size={12} /> {t("sellerReferral.howItWorksLabel")}
          </span>
          <div className="space-y-2.5">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0">1</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("sellerReferral.step1")}</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0">2</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("sellerReferral.step2")}</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 leading-relaxed">{t("sellerReferral.step3")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerReferralPage;
