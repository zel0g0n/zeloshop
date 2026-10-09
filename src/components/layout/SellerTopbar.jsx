import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Bell, Sun, Moon, ExternalLink, CornerDownLeft, Settings, LogOut, CreditCard } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useNewOrdersCount } from "@/hooks/seller/useNewOrdersCount";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import { buildShopLink } from "@/utils/shareLink";
import { SELLER_NAV_TARGETS, findNavTarget, filterNavTargets } from "@/utils/sellerNavTargets";

const LANGS = [
  { code: "uz", label: "UZ" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

/**
 * Kompyuter (lg+) uchun yuqori panel: sahifa sarlavhasi, bo'limlar
 * bo'yicha tezkor qidiruv (Ctrl/⌘+K), do'kon havolasi, bildirishnoma,
 * til va tema almashtirgich, profil menyusi. Telefonda ko'rinmaydi.
 */
const SellerTopbar = () => {
  const { sellerId, store, isWebSession, logout } = useSession();
  const { t, language, setLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const newOrders = useNewOrdersCount(sellerId);
  const isStart = getEffectiveTariffPlan(store) === "start";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef(null);
  const searchWrapRef = useRef(null);
  const menuRef = useRef(null);

  const labels = useMemo(
    () => Object.fromEntries(SELLER_NAV_TARGETS.map((x) => [x.path, t(x.labelKey)])),
    [t]
  );
  const results = useMemo(
    () => filterNavTargets(SELLER_NAV_TARGETS, query, labels, isStart),
    [query, labels, isStart]
  );
  const current = findNavTarget(pathname);
  const title = current ? labels[current.path] : t("desktop.panelTitle");
  const initial = (store?.storeName || "Z").trim().charAt(0).toUpperCase();
  const shopLink = buildShopLink(sellerId);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (path) => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    inputRef.current?.blur();
    navigate(path);
  };

  const onInputKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor].path); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <header className="seller-topbar hidden lg:flex sticky top-0 z-40 h-16 items-center gap-4 px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800">
      <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight w-56 shrink-0 truncate">{title}</h1>

      <div ref={searchWrapRef} className="relative flex-1 max-w-xl">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKey}
          role="combobox"
          aria-expanded={open}
          aria-controls="seller-topbar-results"
          aria-label={t("desktop.searchPlaceholder")}
          placeholder={t("desktop.searchPlaceholder")}
          className="w-full h-10 pl-10 pr-20 rounded-xl bg-slate-100/80 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none border border-transparent focus:border-[#5346E0]/40 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-[#5346E0]/10 transition"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5 pointer-events-none">Ctrl K</kbd>

        {open && (
          <ul
            id="seller-topbar-results"
            role="listbox"
            className="absolute left-0 right-0 top-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 py-2 max-h-80 overflow-y-auto"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-400">{t("desktop.nothingFound")}</li>
            ) : (
              results.map((r, i) => (
                <li key={r.path} role="option" aria-selected={i === cursor}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r.path)}
                    className={`w-full flex items-center justify-between px-4 h-10 text-sm font-semibold text-left ${
                      i === cursor ? "bg-[#5346E0]/10 text-[#5346E0] dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span>{labels[r.path]}</span>
                    {i === cursor && <CornerDownLeft size={14} />}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {shopLink && (
          <a
            href={shopLink}
            target="_blank"
            rel="noreferrer"
            className="hidden xl:flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ExternalLink size={14} />
            {t("desktop.openStore")}
          </a>
        )}

        <Link
          to="/seller/orders"
          aria-label={t("sellerSidebar.orders")}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Bell size={18} />
          {newOrders > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
              {newOrders}
            </span>
          )}
        </Link>

        <div className="flex items-center h-10 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code)}
              aria-pressed={language === l.code}
              className={`h-8 px-2.5 rounded-lg text-[11px] font-black transition-colors ${
                language === l.code
                  ? "bg-white dark:bg-slate-700 text-[#5346E0] dark:text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t("desktop.lightMode") : t("desktop.darkMode")}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 h-10 pl-1 pr-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {store?.logo ? (
              <img src={store.logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-lg bg-[#5346E0] text-white text-sm font-black flex items-center justify-center">{initial}</span>
            )}
            <span className="hidden 2xl:block text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{store?.storeName || "ZeloShop"}</span>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-12 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 py-2">
              <Link role="menuitem" to="/seller/store-settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 h-10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Settings size={16} /> {t("desktop.navStoreSettings")}
              </Link>
              <Link role="menuitem" to="/seller/tariffs" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 h-10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <CreditCard size={16} /> {t("desktop.navTariffs")}
              </Link>
              {isWebSession && (
                <button role="menuitem" type="button" onClick={() => logout()} className="w-full flex items-center gap-3 px-4 h-10 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <LogOut size={16} /> {t("sellerSidebar.logout")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default SellerTopbar;
