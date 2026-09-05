import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, ChevronUp, ChevronDown, Trash2, Plus, Tag } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoriesForNiche } from "@/config/niches";
import updateSeller from "@/services/sellers/updateSeller";
import StatusModal from "@/components/ui/StatusModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * KATEGORIYALARNI BOSHQARISH (15-NICHE UNIVERSAL PLATFORMA, band #20).
 *
 * OLDIN: sotuvchi mahsulot qo'shishda faqat ERKIN MATN bilan bitta
 * "o'zim yozaman" kategoriya kirita olardi (`BasicInfoCard.jsx`dagi
 * "ownCategory" - hali ham ishlaydi, bu yerdagi funksiya bilan
 * ZIDDIYATSIZ), lekin niche'ning STANDART kategoriyalarini
 * qayta nomlash, yashirish yoki tartiblash imkoniyati UMUMAN yo'q edi.
 *
 * BU SAHIFA sotuvchiga o'z do'koni uchun kategoriyalar ro'yxatini
 * MOSLASHTIRISH imkonini beradi:
 *   - NOM O'ZGARTIRISH: masalan "Yuz parvarishi" o'rniga "Premium
 *     teri parvarishi" (faqat KO'RINADIGAN nom - mavjud mahsulotlar
 *     bog'langan qiymat o'zgarmaydi, hech narsa buzilmaydi).
 *   - YASHIRISH: kerak bo'lmagan kategoriyani yangi mahsulot qo'shish
 *     formasidan chetlatish (mavjud mahsulotlar ishlab turaveradi).
 *   - TARTIBLASH: yuqori/past tugmalari bilan ko'rsatish tartibini
 *     o'zgartirish.
 *   - YANGI (SUB)KATEGORIYA QO'SHISH: niche ro'yxatida yo'q, faqat
 *     shu do'konga xos kategoriya (masalan "Luxury Skincare") - bu
 *     endi AI qoralama tayyorlashda ham HISOBGA OLINADI
 *     (`functions/lib/categoryCustomization.js`).
 *
 * Barcha o'zgarishlar `sellers/{id}.categoryCustomization`da
 * saqlanadi - niche konfiguratsiyasining O'ZI (`config/niches.js`)
 * o'zgarmaydi, shuning uchun BOSHQA sotuvchilarga HECH QANDAY ta'sir
 * qilmaydi (har bir sotuvchi FAQAT o'z do'koni uchun moslashtiradi).
 */
const CategoryManagementPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();

  const baseCategories = useMemo(() => getCategoriesForNiche(store?.category), [store?.category]);
  const baseLabelByValue = useMemo(() => new Map(baseCategories.map((c) => [c.value, c.label])), [baseCategories]);

  // Boshlang'ich holatni niche bazaviy ro'yxati + sotuvchining mavjud
  // moslashtirishidan (agar bo'lsa) quramiz - HAMMASI (yashirilgan
  // ham) shu yerda ko'rsatiladi, chunki tahrirlash ekranida sotuvchi
  // yashirilganini ham qayta ko'rsatishi (unhide) mumkin bo'lishi kerak.
  const buildInitialItems = useCallback(() => {
    const customization = store?.categoryCustomization || {};
    const hiddenValues = new Set(Array.isArray(customization.hiddenValues) ? customization.hiddenValues : []);
    const renamedLabels = customization.renamedLabels && typeof customization.renamedLabels === "object" ? customization.renamedLabels : {};
    const order = Array.isArray(customization.order) ? customization.order : [];
    const customCategories = Array.isArray(customization.customCategories) ? customization.customCategories : [];

    const baseValues = new Set(baseCategories.map((c) => c.value));
    const merged = [
      ...baseCategories.map((c) => ({ value: c.value, label: renamedLabels[c.value] || c.label, isCustom: false, hidden: hiddenValues.has(c.value) })),
      ...customCategories
        .filter((c) => c && c.value && !baseValues.has(c.value))
        .map((c) => ({ value: c.value, label: renamedLabels[c.value] || c.label || c.value, isCustom: true, hidden: hiddenValues.has(c.value) })),
    ];

    if (order.length === 0) return merged;
    const orderIndex = new Map(order.map((value, index) => [value, index]));
    return merged
      .map((item, originalIndex) => ({ item, originalIndex }))
      .sort((a, b) => {
        const aIdx = orderIndex.has(a.item.value) ? orderIndex.get(a.item.value) : order.length + a.originalIndex;
        const bIdx = orderIndex.has(b.item.value) ? orderIndex.get(b.item.value) : order.length + b.originalIndex;
        return aIdx - bIdx;
      })
      .map((entry) => entry.item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCategories]);

  const [items, setItems] = useState(buildInitialItems);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addError, setAddError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const moveItem = (index, direction) => {
    setItems((prev) => {
      const next = prev.slice();
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const toggleHidden = (value) => {
    setItems((prev) => prev.map((item) => (item.value === value ? { ...item, hidden: !item.hidden } : item)));
  };

  const renameItem = (value, label) => {
    setItems((prev) => prev.map((item) => (item.value === value ? { ...item, label } : item)));
  };

  const removeCustomItem = (value) => {
    setItems((prev) => prev.filter((item) => item.value !== value));
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (items.some((item) => item.value.toLowerCase() === trimmed.toLowerCase())) {
      setAddError(t("categoryManagement.duplicateError"));
      return;
    }
    setItems((prev) => [...prev, { value: trimmed, label: trimmed, isCustom: true, hidden: false }]);
    setNewCategoryName("");
    setAddError(null);
  };

  const handleResetToDefault = async () => {
    setResetConfirmOpen(false);
    setSaving(true);
    setError(null);
    try {
      await updateSeller(sellerId, { categoryCustomization: null });
      patchStore({ categoryCustomization: null });
      setItems(baseCategories.map((c) => ({ value: c.value, label: c.label, isCustom: false, hidden: false })));
      setShowSaved(true);
    } catch (err) {
      setError(err.message || t("categoryManagement.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const hiddenValues = items.filter((item) => item.hidden).map((item) => item.value);
      const renamedLabels = {};
      items.forEach((item) => {
        if (!item.isCustom) {
          const originalLabel = baseLabelByValue.get(item.value);
          if (item.label.trim() && item.label !== originalLabel) renamedLabels[item.value] = item.label.trim();
        }
      });
      const order = items.map((item) => item.value);
      const customCategories = items.filter((item) => item.isCustom).map((item) => ({ value: item.value, label: item.label.trim() || item.value }));

      const categoryCustomization = { hiddenValues, renamedLabels, order, customCategories };
      await updateSeller(sellerId, { categoryCustomization });
      patchStore({ categoryCustomization });
      setShowSaved(true);
    } catch (err) {
      setError(err.message || t("categoryManagement.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("categoryManagement.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("categoryManagement.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed px-1">
          {t("categoryManagement.explanation")}
        </p>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
          {items.map((item, index) => (
            <div key={item.value} className={`p-3.5 flex items-center gap-2.5 ${item.hidden ? "opacity-50" : ""}`}>
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                  className="text-slate-400 dark:text-slate-500 disabled:opacity-30 active:scale-90 transition-transform"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                  className="text-slate-400 dark:text-slate-500 disabled:opacity-30 active:scale-90 transition-transform"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <input
                type="text"
                value={item.label}
                onChange={(e) => renameItem(item.value, e.target.value)}
                className="flex-1 min-w-0 h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              {item.isCustom && (
                <span className="shrink-0 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md">
                  {t("categoryManagement.customBadge")}
                </span>
              )}

              <button
                type="button"
                onClick={() => toggleHidden(item.value)}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition-transform"
                title={item.hidden ? t("categoryManagement.showAction") : t("categoryManagement.hideAction")}
              >
                {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              {item.isCustom && (
                <button
                  type="button"
                  onClick={() => removeCustomItem(item.value)}
                  className="shrink-0 w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center active:scale-95 transition-transform"
                  title={t("categoryManagement.deleteAction")}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-2.5">
          <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={12} /> {t("categoryManagement.addCustomLabel")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => { setNewCategoryName(e.target.value); setAddError(null); }}
              placeholder={t("categoryManagement.addCustomPlaceholder")}
              className="flex-1 h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddCustomCategory}
              className="shrink-0 w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus size={18} />
            </button>
          </div>
          {addError && <p className="text-[11px] text-rose-500 font-semibold">{addError}</p>}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
            {t("categoryManagement.addCustomHint")}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
        >
          {saving ? t("categoryManagement.saving") : t("categoryManagement.saveButton")}
        </button>

        <button
          type="button"
          onClick={() => setResetConfirmOpen(true)}
          disabled={saving}
          className="w-full h-11 text-rose-500 dark:text-rose-400 font-bold text-xs disabled:opacity-60"
        >
          {t("categoryManagement.resetButton")}
        </button>
      </div>

      {showSaved && (
        <StatusModal
          variant="success"
          title={t("categoryManagement.savedTitle")}
          onClose={() => setShowSaved(false)}
        />
      )}

      {resetConfirmOpen && (
        <ConfirmDialog
          title={t("categoryManagement.resetConfirmTitle")}
          message={t("categoryManagement.resetConfirmMessage")}
          confirmLabel={t("categoryManagement.resetConfirmLabel")}
          danger
          busy={saving}
          onConfirm={handleResetToDefault}
          onCancel={() => setResetConfirmOpen(false)}
        />
      )}
    </div>
  );
};

export default CategoryManagementPage;
