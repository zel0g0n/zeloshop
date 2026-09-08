import React from "react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { getAttributeKeysForNiche } from "@/config/niches";
import { getAttributeDefinition, ATTRIBUTE_TYPES } from "@/config/attributeDictionary";
import CustomSelect from "@/components/ui/CustomSelect";

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
            // FOYDALANUVCHI SO'ROVI (2026-09): brauzerning standart
            // (native) <select>i o'rniga ilovaning boshqa qismlarida
            // (masalan `DeliverySettingsPage.jsx`) ALLAQACHON
            // ishlatiladigan zamonaviy `CustomSelect` komponenti
            // ishlatiladi — ko'rinishi ilovaning qolgan qismi bilan
            // mos bo'lishi uchun. "Tanlanmagan" (bo'sh qiymat) ham
            // avvalgidek RO'YXATNING BIRINCHI, tanlanadigan varianti
            // sifatida saqlanadi.
            const selectOptions = [
              { value: "", label: t("sellerProductForm.attributeNotSet") },
              ...(def.options || []).map((o) => ({
                value: o.value,
                label: t(`productAttributes.${key}.options.${o.value}`),
              })),
            ];
            return (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block truncate">{attrLabel}</label>
                <CustomSelect
                  disabled={disabled}
                  value={value}
                  onChange={(v) => handleChange(key, v)}
                  options={selectOptions}
                />
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
