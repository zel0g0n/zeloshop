import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Sparkles, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/context/ThemeContext";
import { useBrandTheme } from "@/context/BrandThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { THEMES, getRecommendedThemeId } from "@/config/themes";
import StatusModal from "@/components/ui/StatusModal";

/**
 * SOTUVCHI PANELI KO'RINISHI — "Theme Engine" sozlash sahifasi
 * (2026-09 punkt-royxati, 12-band). Ikkita MUSTAQIL tanlov:
 *   1. Tema (8 ta brend rangi) — FAQAT shu panelga, sotuvchining
 *      O'ZIGA ko'rinadi (`sellerAppTheme`).
 *   2. Ko'rinish (Light/Dark/System) — neytral kontrast rejimi,
 *      brend rangidan MUSTAQIL (`ThemeContext.jsx`).
 * Batafsil arxitektura izohi: `src/config/themes.js`,
 * `src/context/BrandThemeContext.jsx`.
 */
const AppearanceSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { store } = useSession();
  const { appearanceMode, setAppearanceMode } = useTheme();
  const { sellerAppThemeId, previewSellerAppTheme, saveSellerAppTheme } = useBrandTheme();

  // Sahifa ochilganda joriy SAQLANGAN tema tanlangan holatda boshlanadi.
  // Foydalanuvchi boshqa rangni bossa — DARHOL (butun ilova bo'ylab)
  // qo'llanadi (`previewSellerAppTheme`), lekin "Saqlash" bosilmaguncha
  // Firestore'ga yozilmaydi.
  const [pendingThemeId, setPendingThemeId] = useState(sellerAppThemeId);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { variant: "success" | "error", message } | null

  const recommendedThemeId = useMemo(() => getRecommendedThemeId(store?.category), [store?.category]);
  const hasUnsavedChange = pendingThemeId !== sellerAppThemeId;

  const handlePick = (themeId) => {
    setPendingThemeId(themeId);
    previewSellerAppTheme(themeId);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSellerAppTheme(pendingThemeId);
      setStatus({ variant: "success", message: t("appearanceSettings.saveSuccess") });
    } catch {
      setStatus({ variant: "error", message: t("appearanceSettings.saveError") });
    } finally {
      setSaving(false);
    }
  };

  const appearanceOptions = [
    { id: "light", label: t("appearanceSettings.light"), Icon: Sun },
    { id: "dark", label: t("appearanceSettings.dark"), Icon: Moon },
    { id: "system", label: t("appearanceSettings.system"), Icon: MonitorSmartphone },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-40 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("appearanceSettings.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("appearanceSettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t("appearanceSettings.themeSectionTitle")}</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {THEMES.map((theme) => {
              const isSelected = pendingThemeId === theme.id;
              const isRecommended = recommendedThemeId === theme.id;
              const swatchColor = theme.colors.light.primary;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handlePick(theme.id)}
                  className={`relative text-left p-3 rounded-2xl border-2 transition-all bg-white dark:bg-slate-900 ${
                    isSelected ? "border-brand" : "border-transparent shadow-sm"
                  }`}
                >
                  {isRecommended && (
                    <span className="absolute -top-2 -right-2 flex items-center gap-0.5 bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                      <Sparkles size={9} /> {t("appearanceSettings.recommended")}
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
          {hasUnsavedChange && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pl-1">{t("appearanceSettings.unsavedNotice")}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">{t("appearanceSettings.appearanceSectionTitle")}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {appearanceOptions.map(({ id, label, Icon }) => {
              const isSelected = appearanceMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAppearanceMode(id)}
                  className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 bg-white dark:bg-slate-900 transition-all ${
                    isSelected ? "border-brand text-brand" : "border-transparent text-slate-500 dark:text-slate-400 shadow-sm"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-bold">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={!hasUnsavedChange || saving}
          className="w-full h-12 rounded-2xl bg-brand text-brand-foreground font-bold text-sm shadow-md disabled:opacity-40 transition-opacity"
        >
          {saving ? t("appearanceSettings.saving") : t("appearanceSettings.saveButton")}
        </button>
      </div>

      {status && (
        <StatusModal
          variant={status.variant}
          title={status.variant === "success" ? t("appearanceSettings.saveSuccess") : t("appearanceSettings.saveError")}
          message={status.variant === "error" ? t("appearanceSettings.saveErrorHint") : undefined}
          onClose={() => setStatus(null)}
        />
      )}
    </div>
  );
};

export default AppearanceSettingsPage;
