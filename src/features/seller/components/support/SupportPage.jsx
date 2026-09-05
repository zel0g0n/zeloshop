import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Headphones, Send } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import StatusModal from "@/components/ui/StatusModal";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";

const SUBJECT_KEYS = ["subjectTechnical", "subjectQuestion", "subjectSuggestion", "subjectOther"];

const SupportPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [subjectKey, setSubjectKey] = useState(SUBJECT_KEYS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError(t("support.messageRequired"));
      return;
    }

    setSending(true);
    setError(null);
    try {
      const contactAdmin = httpsCallable(functions, "contactAdmin");
      await contactAdmin({ category: "support", subject: t(`support.${subjectKey}`), message: message.trim() });
      setShowSuccess(true);
      setMessage("");
    } catch (err) {
      setError(err.message || t("support.sendError"));
    } finally {
      setSending(false);
    }
  }, [subjectKey, message, t]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("support.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("support.subtitle")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
            <Headphones size={20} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t("support.introText")}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("support.subjectLabel")}</label>
            <CustomSelect
              disabled={sending}
              value={subjectKey}
              onChange={setSubjectKey}
              options={SUBJECT_KEYS.map((key) => ({ value: key, label: t(`support.${key}`) }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{t("support.messageLabel")}</label>
            <textarea
              rows="5"
              disabled={sending}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("support.messagePlaceholder")}
              className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            />
          </div>

          {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={sending}
          className="w-full h-12 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Send size={15} />
          {sending ? t("support.sending") : t("support.sendButton")}
        </button>
      </form>

      {showSuccess && (
        <StatusModal
          variant="success"
          title={t("support.sentTitle")}
          message={t("support.sentMessage")}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
};

export default SupportPage;
