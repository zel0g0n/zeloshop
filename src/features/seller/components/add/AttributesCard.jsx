import React from "react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getAttributeKeysForNiche } from "@/config/niches";
import { getAttributeDefinition, ATTRIBUTE_TYPES } from "@/config/attributeDictionary";

/**
 * DINAMIK MAHSULOT ATRIBUTLARI (15-niche universal platforma).
 *
 * Sotuvchining do'kon sohasiga (`store.category`) qarab, FAQAT shu
 * sohaga tegishli maydonlar ko'rsatiladi (masalan Kosmetika sotuvchisiga
 * "Teri turi"/"SPF", Elektronika sotuvchisiga "Xotira"/"RAM",
 * Avtoehtiyot qismlari sotuvchisiga "Avtomobil brendi"/"Yil" va h.k.).
 * Bitta universal komponent — har bir soha uchun alohida forma YO'Q
 * (loyihaning asosiy arxitektura talabi).
 *
 * Barcha qiymatlar IXTIYORIY — sotuvchi bo'sh qoldirishi mumkin.
 * Bo'sh/ishlatilmagan maydonlar Firestore'ga UMUMAN yozilmaydi
 * (`AddProductPage.jsx`/`EditProductPage.jsx`dagi tozalash mantig'i).
 */
const AttributesCard = ({ attributes, disabled, onAttributesChange }) => {
  const { store } = useSession();
  const { t } = useLanguage();
  const attributeKeys = getAttributeKeysForNiche(store?.category);

  if (attributeKeys.length === 0) return null;

  const handleChange = (key, value) => {
    onAttributesChange({ ...attributes, [key]: value });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
      <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        {t("sellerProductForm.attributesLabel")}
      </label>

      <div className="grid grid-cols-2 gap-3">
        {attributeKeys.map((key) => {
          const def = getAttributeDefinition(key);
          if (!def) return null;
          const attrLabel = t(`productAttributes.${key}.label`);
          const value = attributes?.[key] ?? "";

          if (def.type === ATTRIBUTE_TYPES.SELECT) {
            return (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block truncate">{attrLabel}</label>
                <select
                  disabled={disabled}
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full h-10 px-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-transparent disabled:opacity-60"
                >
                  <option value="">{t("sellerProductForm.attributeNotSet")}</option>
                  {(def.options || []).map((o) => (
                    <option key={o.value} value={o.value}>{t(`productAttributes.${key}.options.${o.value}`)}</option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={key} className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block truncate">{attrLabel}</label>
              <input
                type={def.type === ATTRIBUTE_TYPES.NUMBER ? "number" : "text"}
                disabled={disabled}
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full h-10 px-2.5 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-transparent disabled:opacity-60"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(AttributesCard);
