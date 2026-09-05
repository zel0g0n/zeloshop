import { getAttributeDefinition, ATTRIBUTE_TYPES } from "@/config/attributeDictionary";

/**
 * 15-NICHE UNIVERSAL PLATFORMA — mahsulotning dinamik `attributes`
 * obyektini ({skinType: "oily", volume: "50ml"} kabi) xaridorga
 * ko'rsatiladigan {key, labelKey, value, valueKey} yozuvlar
 * ro'yxatiga aylantiradi.
 *
 * `labelKey`/`valueKey` - `useLanguage()`ning `t()` funksiyasiga
 * uzatiladigan TARJIMA KALITLARI (`i18n/translations.js`dagi
 * `productAttributes.*`). "select" turidagi atributlar uchun QIYMAT
 * HAM tarjima qilinadi (`valueKey` mavjud bo'ladi) - masalan
 * `skinType: "oily"` "Yog'li teri"/"Жирная кожа"/"Oily skin" bo'lib
 * ko'rsatiladi, tilga qarab. "text"/"number" turi uchun `valueKey`
 * `null` - qiymat sotuvchi/AI kiritgan XOM matn sifatida ko'rsatiladi
 * (tarjima qilib bo'lmaydi, chunki bu erkin matn).
 *
 * Sof funksiya (UI'dan mustaqil) - to'g'ridan-to'g'ri testlanadi.
 *
 * @param {Object|undefined} attributes
 * @returns {Array<{key: string, labelKey: string, value: string, valueKey: string|null}>}
 */
export function formatProductAttributesForDisplay(attributes) {
  if (!attributes || typeof attributes !== "object") return [];
  return Object.entries(attributes)
    .filter(([, value]) => value !== "" && value != null)
    .map(([key, value]) => {
      const def = getAttributeDefinition(key);
      const isSelect = def?.type === ATTRIBUTE_TYPES.SELECT;
      return {
        key,
        labelKey: `productAttributes.${key}.label`,
        value,
        valueKey: isSelect ? `productAttributes.${key}.options.${value}` : null,
      };
    });
}
