import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, X, Bot, User } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { askProductQuestion } from "@/services/productAssistant/productAssistantService";

const MAX_QUESTION_LENGTH = 300;

/**
 * "AI Mahsulot Yordamchisi" (ZeloShop TOP 15, #15) — xaridor mahsulot
 * sahifasida savol beradi, javob FAQAT sotuvchi kiritgan mahsulot
 * matnidan olinadi (backend: `functions/productAssistant.js`).
 *
 * MUHIM (honest labeling): pastda doim ko'rinadigan `disclaimer` —
 * xaridor bu "har narsani biladigan AI" emas, balki FAQAT shu
 * mahsulot tavsifi/sharhlariga asoslangan yordamchi ekanini aniq
 * bilishi kerak (haddan tashqari ishonch/noto'g'ri kutish — masalan
 * "sotuvchining o'zi javob berdi" degan taassurot — paydo bo'lmasligi
 * uchun).
 *
 * Suhbat tarixi FAQAT shu sahifa ochiq turgan vaqtda, komponent
 * holatida saqlanadi — Firestore'ga yozilmaydi (bu, sharh yoki
 * buyurtma kabi doimiy saqlanishi shart bo'lgan ma'lumot emas).
 */
const ProductAssistant = ({ product }) => {
  const { t, language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = question.trim();
      if (!trimmed || loading || !product?.id) return;

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setQuestion("");
      setLoading(true);
      setError(null);

      try {
        const result = await askProductQuestion(product.id, trimmed, language);
        const answerText = result.refused ? t("productAssistant.medicalRefusal") : result.answer;
        setMessages((prev) => [...prev, { role: "assistant", text: answerText }]);
      } catch (err) {
        setError(err.message || t("productAssistant.errorGeneric"));
      } finally {
        setLoading(false);
      }
    },
    [question, loading, product, language, t]
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2.5 p-3.5 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 text-left active:scale-[0.99] transition-transform"
      >
        <span className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Sparkles size={16} />
        </span>
        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t("productAssistant.toggleButton")}</span>
      </button>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-500" />
          <h3 className="text-xs font-black text-slate-800 dark:text-white">{t("productAssistant.title")}</h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition-transform"
          aria-label={t("productAssistant.close")}
        >
          <X size={13} />
        </button>
      </div>

      <div className="px-4 pt-2.5">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug">{t("productAssistant.disclaimer")}</p>
      </div>

      <div ref={scrollRef} className="px-4 py-3 space-y-2.5 max-h-72 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">{t("productAssistant.emptyState")}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                m.role === "user"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  : "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
              }`}
            >
              {m.role === "user" ? <User size={11} /> : <Bot size={11} />}
            </span>
            <p
              className={`text-xs leading-relaxed rounded-2xl px-3 py-2 max-w-[80%] ${
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 px-1">
            <Loader2 size={13} className="animate-spin" /> {t("productAssistant.loading")}
          </div>
        )}
      </div>

      {error && <p className="px-4 text-[11px] text-rose-500 font-semibold">{error}</p>}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-slate-100 dark:border-slate-800">
        <input
          type="text"
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          disabled={loading}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("productAssistant.placeholder")}
          className="flex-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
          aria-label={t("productAssistant.send")}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};

export default ProductAssistant;
