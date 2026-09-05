import { useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { Sparkles, Copy, Check, Loader2, Instagram, Send } from "lucide-react";
import { functions } from "@/firebase/config";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * AI CEO — 3-BOSQICH: ijtimoiy tarmoq posti generatori. FAQAT
 * `aiCeoEnabled` sotuvchilarga ko'rinadi (ota komponent tekshiradi).
 *
 * MUHIM: Instagram/TikTok uchun HAMON avtomatik joylash tugmasi
 * YO'Q (Telegram Bot API bu ijtimoiy tarmoqlarga post qo'shishni
 * QO'LLAB-QUVVATLAMAYDI - bu, Instagram/TikTok'ning O'Z texnik
 * cheklovi). LEKIN, agar sotuvchi o'z Telegram KANALINI ulagan
 * bo'lsa ("10-band"), yangi qo'shilgan "Kanalga joylashtirish"
 * tugmasi orqali TAYYOR matnni to'g'ridan-to'g'ri O'SHA KANALGA
 * (Telegram) yuborish mumkin - bu haqiqiy, ishlaydigan avtomatik
 * joylash.
 */
const SocialPostGeneratorCard = ({ platform, onPlatformChange, postText, onPostTextChange, generating, error, onGenerate, productImageUrl }) => {
  const { t } = useLanguage();
  const { store } = useSession();
  const [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [postError, setPostError] = useState(null);

  const connectedChannel = store?.connectedChannelUsername || null;

  const handleCopy = useCallback(async () => {
    if (!postText) return;
    try {
      await navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API mavjud bo'lmasa - jim qolamiz.
    }
  }, [postText]);

  const handlePostToChannel = useCallback(async () => {
    if (!postText) return;
    setPosting(true);
    setPostError(null);
    try {
      const postToChannel = httpsCallable(functions, "postToChannel");
      await postToChannel({ caption: postText, imageUrl: productImageUrl || null });
      setPosted(true);
      setTimeout(() => setPosted(false), 2500);
    } catch (err) {
      setPostError(err.message || t("socialPost.postError"));
    } finally {
      setPosting(false);
    }
  }, [postText, productImageUrl, t]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-indigo-500">
        <Instagram size={13} />
        <h3 className="text-xs font-black uppercase tracking-wider">{t("socialPost.title")}</h3>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("socialPost.subtitle")}</p>

      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg w-fit">
        {["instagram", "tiktok"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPlatformChange(p)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
              platform === p ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {p === "instagram" ? "Instagram" : "TikTok"}
          </button>
        ))}
      </div>

      {postText ? (
        <div className="space-y-2">
          <textarea
            value={postText}
            onChange={(e) => onPostTextChange(e.target.value)}
            rows={6}
            className="w-full px-3 py-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("socialPost.copied") : t("socialPost.copyButton")}
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="flex-1 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {t("socialPost.regenerateButton")}
            </button>
          </div>

          {connectedChannel && (
            <button
              type="button"
              onClick={handlePostToChannel}
              disabled={posting}
              className="w-full h-10 rounded-xl bg-[#2AABEE] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {posting ? <Loader2 size={13} className="animate-spin" /> : posted ? <Check size={13} /> : <Send size={13} />}
              {posting ? t("socialPost.posting") : posted ? t("socialPost.posted") : t("socialPost.postToChannelButton", { channel: connectedChannel })}
            </button>
          )}
          {postError && <p className="text-[11px] text-rose-500 font-semibold">{postError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? t("socialPost.generating") : t("socialPost.generateButton")}
        </button>
      )}

      {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
    </div>
  );
};

export default SocialPostGeneratorCard;
