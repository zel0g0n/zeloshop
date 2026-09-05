import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, Home, ShoppingCart, User, Star } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/context/ThemeContext";
import { useBrandTheme } from "@/context/BrandThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { THEMES, getRecommendedThemeId, resolveThemeColors, getThemeConfig } from "@/config/themes";
import StatusModal from "@/components/ui/StatusModal";

/**
 * DO'KON (STOREFRONT) KO'RINISHI — Theme Engine, ikkinchi mustaqil
 * tanlov. Sotuvchining O'ZI (`AppearanceSettingsPage.jsx`) emas, balki
 * XARIDORLAR ko'radigan do'kon uchun brend rangini tanlaydi
 * (`storefrontTheme`).
 *
 * MUHIM ARXITEKTURA QARORI — bu sahifadagi "preview" `BrandThemeContext`
 * orqali GLOBAL holatni (`store.storefrontTheme`) UMUMAN o'zgartirmaydi
 * (chunki xaridorlar HOZIR ko'rayotgan haqiqiy do'kon rangi sotuvchi
 * hali saqlamagan tanlovi bilan o'zgarib qolmasligi kerak — talab #16).
 * Buning o'rniga, tanlangan rang FAQAT quyidagi "Ko'rinish namunasi"
 * qutisi ICHIDA, shu qutining ILDIZ elementiga qo'yilgan CSS
 * o'zgaruvchi override'lari orqali qo'llanadi (`style={{"--color-brand":...}}`).
 * Bu HAQIQIY mexanizm: qutining ICHIDAGI elementlar xuddi haqiqiy
 * do'kondagidek bir xil `bg-brand`/`text-brand-foreground`/`bg-brand-soft`
 * Tailwind utility'laridan foydalanadi — CSS kaskadida eng yaqin ajdod
 * qiymati ustunlik qiladi, shuning uchun bu chinakam "real komponent"
 * preview'i, skrinshot yoki soxta rasm emas — lekin butun ilovaga (root
 * elementga) HECH QANDAY ta'sir qilmaydi.
 */
const StoreAppearanceSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();
  const { isDark } = useTheme();
  const { storefrontThemeId, saveStorefrontTheme } = useBrandTheme();

  const [pendingThemeId, setPendingThemeId] = useState(storefrontThemeId);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { variant: "success" | "error", message } | null

  const recommendedThemeId = useMemo(() => getRecommendedThemeId(store?.category), [store?.category]);
  const hasUnsavedChange = pendingThemeId !== storefrontThemeId;

  const previewColors = useMemo(() => resolveThemeColors(pendingThemeId, isDark), [pendingThemeId, isDark]);
  const previewRadius = useMemo(() => getThemeConfig(pendingThemeId).radius, [pendingThemeId]);
  const previewVars = {
    "--color-brand": previewColors.primary,
    "--color-brand-foreground": previewColors.foreground,
    "--color-brand-soft": previewColors.soft,
    "--radius-brand": previewRadius,
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStorefrontTheme(pendingThemeId);
      setStatus({ variant: "success", message: t("storeAppearanceSettings.saveSuccess") });
    } catch {
      setStatus({ variant: "error", message: t("storeAppearanceSettings.saveError") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-40 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("storeAppearanceSettings.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("storeAppearanceSettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* JONLI KO'RINISH NAMUNASI — mahalliy CSS o'zgaruvchi override,
            Firestore'ga hech narsa yozmaydi, root'ga ta'sir qilmaydi. */}
        <section className="space-y-2">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t("storeAppearanceSettings.previewTitle")}</h2>
          <div
            style={previewVars}
            className="rounded-3xl overflow-hidden bg-white dark:bg-slate-900 shadow-md border border-slate-100 dark:border-slate-800"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-[var(--radius-brand)] border border-slate-100 dark:border-slate-800 p-3 shadow-sm">
                <div className="relative w-16 h-16 rounded-[var(--radius-brand)] bg-brand-soft flex items-center justify-center shrink-0">
                  <span className="w-8 h-8 rounded-full bg-brand" />
                  <span className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 bg-brand text-brand-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full">
                    {t("storeAppearanceSettings.previewBadge")}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{t("storeAppearanceSettings.previewProductName")}</p>
                  <div className="flex items-center gap-0.5 my-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm font-black text-brand">{t("storeAppearanceSettings.previewProductPrice")}</p>
                </div>
              </div>

              <button
                type="button"
                disabled
                className="w-full h-11 rounded-[var(--radius-brand)] bg-brand text-brand-foreground font-bold text-sm shadow-sm"
              >
                {t("storeAppearanceSettings.previewButton")}
              </button>
            </div>

            <div className="flex items-center justify-around border-t border-slate-100 dark:border-slate-800 px-2 py-2.5 bg-white dark:bg-slate-900">
              <div className="flex flex-col items-center gap-0.5 text-brand">
                <Home size={16} />
                <span className="text-[9px] font-bold">{t("storeAppearanceSettings.previewNavHome")}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 text-slate-300 dark:text-slate-600">
                <ShoppingCart size={16} />
                <span className="text-[9px] font-bold">{t("storeAppearanceSettings.previewNavCart")}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 text-slate-300 dark:text-slate-600">
                <User size={16} />
                <span className="text-[9px] font-bold">{t("storeAppearanceSettings.previewNavProfile")}</span>
              </div>
            </div>
          </div>
          {hasUnsavedChange && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pl-1">{t("storeAppearanceSettings.unsavedNotice")}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t("storeAppearanceSettings.themeSectionTitle")}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {THEMES.map((theme) => {
              const isSelected = pendingThemeId === theme.id;
              const isRecommended = recommendedThemeId === theme.id;
              const swatchColor = theme.colors.light.primary;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setPendingThemeId(theme.id)}
                  className={`relative text-left p-3 rounded-2xl border-2 transition-all bg-white dark:bg-slate-900 ${
                    isSelected ? "border-brand" : "border-transparent shadow-sm"
                  }`}
                >
                  {isRecommended && (
                    <span className="absolute -top-2 -right-2 flex items-center gap-0.5 bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                      <Sparkles size={9} /> {t("storeAppearanceSettings.recommended")}
                    </span>
                  )}
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-2"
                    style={{ backgroundColor: swatchColor }}
                  >
                    {isSelected && <Check size={16} className="text-white" strokeWidth={3} />}
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{t(theme.nameKey)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{t(theme.descKey)}</p>
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasUnsavedChange || saving}
          style={previewVars}
          className="w-full h-12 rounded-[var(--radius-brand)] bg-brand text-brand-foreground font-bold text-sm shadow-md disabled:opacity-40 transition-opacity"
        >
          {saving ? t("storeAppearanceSettings.saving") : t("storeAppearanceSettings.saveButton")}
        </button>
      </div>

      {status && (
        <StatusModal
          variant={status.variant}
          title={status.variant === "success" ? t("storeAppearanceSettings.saveSuccess") : t("storeAppearanceSettings.saveError")}
          message={status.variant === "error" ? t("storeAppearanceSettings.saveErrorHint") : undefined}
          onClose={() => setStatus(null)}
        />
      )}
    </div>
  );
};

export default StoreAppearanceSettingsPage;
