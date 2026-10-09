import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Send, ShieldCheck } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { BOT_USERNAME } from "@/config/telegram";
import { SUPPORTED_LANGUAGES } from "@/i18n/translations";

/**
 * Brauzerda (Telegramsiz) sotuvchi paneliga kirish sahifasi.
 *
 * Login/parol ZeloShop bot orqali beriladi (`functions/webAppAuth.js`).
 * Responsive: telefonda — bitta ustun; katta ekranda (lg+) — chapda
 * ko'rsatma paneli, o'ngda forma.
 *
 * XAVFSIZLIK: parol maydoni `type="password"` (ko'rsatish tugmasi bilan),
 * brauzer parol menejeri ishlashi uchun `autoComplete` to'g'ri
 * qo'yilgan; xato xabarlari login mavjudligini oshkor qilmaydi (server
 * har doim bir xil "noto'g'ri" javob beradi).
 */
const WebLoginPage = () => {
  const { login, loggingIn, error: sessionError } = useSession();
  const { t, language, setLanguage } = useLanguage();
  const [loginCode, setLoginCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!loginCode.trim() || !password.trim()) {
      setFormError(t("webLogin.fillBoth"));
      return;
    }
    try {
      await login(loginCode, password);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const idleNotice = sessionError === "idle-expired" ? t("webLogin.idleExpired") : null;
  const otherSessionError = sessionError && sessionError !== "idle-expired" ? sessionError : null;
  const errorText = formError || otherSessionError;

  const steps = [t("webLogin.step1"), t("webLogin.step2"), t("webLogin.step3")];

  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-slate-950 flex items-stretch justify-center lg:items-center lg:p-8">
      <div className="w-full lg:max-w-4xl lg:rounded-[32px] lg:overflow-hidden lg:shadow-2xl lg:grid lg:grid-cols-2 bg-white dark:bg-slate-900">
        {/* Chap panel — brend + ko'rsatma */}
        <div className="bg-gradient-to-br from-[#5346E0] to-[#4338CA] text-white px-6 py-8 lg:p-10 flex flex-col justify-between gap-8">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mb-4">
              <span className="text-2xl font-black">Z</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{t("webLogin.title")}</h1>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70 mt-1">{t("webLogin.subtitle")}</p>
          </div>

          <div>
            <h2 className="text-sm font-black mb-3">{t("webLogin.howTitle")}</h2>
            <ol className="space-y-2.5">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3 text-xs leading-relaxed text-white/90">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-white/20 text-[10px] font-black flex items-center justify-center mt-px">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#4338CA] text-xs font-black hover:bg-white/90 transition-colors"
            >
              <Send size={14} />
              {t("webLogin.openBot")}
            </a>
          </div>
        </div>

        {/* O'ng panel — forma */}
        <div className="px-6 py-8 lg:p-10 flex flex-col justify-center">
          <div className="flex justify-end gap-1 mb-6">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2.5 h-7 rounded-lg text-[10px] font-black uppercase transition-colors ${
                  language === lang
                    ? "bg-[#5346E0] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto lg:mx-0 space-y-4" noValidate>
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-[#5346E0]" />
              <h2 className="text-lg font-black text-slate-800 dark:text-white">{t("webLogin.submit")}</h2>
            </div>

            {idleNotice && (
              <p role="status" className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2.5 leading-relaxed">
                {idleNotice}
              </p>
            )}

            <div>
              <label htmlFor="web-login" className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                {t("webLogin.loginLabel")}
              </label>
              <input
                id="web-login"
                type="text"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                placeholder={t("webLogin.loginPlaceholder")}
                autoComplete="username"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={32}
                className="w-full h-12 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-semibold tracking-wider outline-none focus:ring-2 focus:ring-[#5346E0]/40 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="web-password" className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                {t("webLogin.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="web-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value.toUpperCase())}
                  placeholder={t("webLogin.passwordPlaceholder")}
                  autoComplete="current-password"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  className="w-full h-12 pl-4 pr-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-semibold tracking-wider outline-none focus:ring-2 focus:ring-[#5346E0]/40 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("webLogin.hidePassword") : t("webLogin.showPassword")}
                  className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorText && (
              <p role="alert" className="text-xs font-semibold text-rose-500 text-center">
                {errorText}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full h-12 rounded-2xl bg-[#5346E0] hover:bg-[#4338CA] text-white font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-70 active:scale-[0.99]"
            >
              {loggingIn ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("webLogin.submitting")}
                </>
              ) : (
                t("webLogin.submit")
              )}
            </button>

            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500 pt-2">
              <ShieldCheck size={14} className="shrink-0 mt-px" />
              <span>{t("webLogin.securityNote")}</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WebLoginPage;
