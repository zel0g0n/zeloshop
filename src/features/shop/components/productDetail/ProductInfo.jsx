import { memo } from "react";
import { Star } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatProductAttributesForDisplay } from "@/utils/formatProductAttributes";
import { computeLowStockSignal, computeSoldCountSignal, computeTodaySoldSignal } from "@/utils/productSignals";

export const ProductInfo = memo(({info}) => {
  const { t } = useLanguage();
  const { name, brand, description, rating, tags, category, variants, attributes, stock, sold, soldTodayCount, soldTodayDate } = info || {};
  // MUHIM (2026-09 dizayn tuzatishi): "kam qoldi"/"bugun sotildi"/
  // "N+ marta sotilgan" belgilari OLDIN mahsulot KARTOCHKASIDA
  // ko'rsatilardi — endi kartochkadan olib tashlanib, shu yerga,
  // mahsulot SAHIFASIGA ko'chirildi (bir xil sof hisoblash funksiyalari,
  // `utils/productSignals.js` — batafsil izoh o'sha faylda). Faqat
  // BITTASI ko'rsatiladi (kam qoldiq > bugun sotildi > umumiy sotilgan
  // soni ustuvorlik tartibida).
  const lowStockSignal = computeLowStockSignal(stock);
  const todaySoldSignal = !lowStockSignal ? computeTodaySoldSignal(soldTodayCount, soldTodayDate) : null;
  const soldSignal = !lowStockSignal && !todaySoldSignal ? computeSoldCountSignal(sold) : null;
  // 15-NICHE UNIVERSAL PLATFORMA: sotuvchi/AI kiritgan dinamik
  // atributlar (masalan teri turi, o'lcham, xotira) - har qanday
  // niche uchun avtomatik ko'rsatiladi, qattiq kodlangan maydon
  // nomlarisiz (batafsil izoh: `utils/formatProductAttributes.js`).
  const attributeEntries = formatProductAttributesForDisplay(attributes);

  // ESKI mahsulotlar `variants`ni tekis massiv sifatida saqlagan
  // ("50ml", "Qizil"), YANGI mahsulotlar esa guruhlangan holda
  // ({name: "O'lcham", values: [...]}) — ikkalasini ham to'g'ri
  // ko'rsatish uchun formatni tekshiramiz.
  const isGroupedVariants = Array.isArray(variants) && variants.length > 0 && typeof variants[0] === "object";

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2">
        {tags && tags.map((tag, index) => (
          <span key={index} className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 text-xs font-semibold">
            {tag}
          </span>
        ))}

        {
          rating ? (
            <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 text-xs font-semibold flex items-center gap-1">
              <Star size={11} fill="currentColor" /> {rating}
            </span>
          ) : ''
        }

        {lowStockSignal && (
          <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 text-xs font-semibold">
            {t("productCard.lowStockBadge", { count: lowStockSignal.count })}
          </span>
        )}
        {todaySoldSignal && (
          <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            {t("productCard.soldTodayBadge", { count: todaySoldSignal.count })}
          </span>
        )}
        {soldSignal && (
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            {t("productCard.soldCountBadge", { count: soldSignal.count })}
          </span>
        )}

      </div>

      <div className="mt-4">
        {brand ? (
          <p className="uppercase tracking-[0.28em] text-sm text-blue-500 dark:text-blue-400 font-semibold">
            {brand}
          </p>
        ):''}
        

        <h1 className="mt-3 text-[34px] leading-[1.1] font-black text-slate-900 dark:text-white">
          {name || "Nomsiz mahsulot"}
        </h1>

        <p className="mt-4 text-[15px] leading-7 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>

      {isGroupedVariants && (
        <div className="mt-5 space-y-3">
          {variants.map((group) => (
            <div key={group.name}>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{group.name}</p>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => (
                  <span
                    key={value}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold bg-white dark:bg-slate-900"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Eski formatdagi (tekis massiv) mahsulotlar uchun zaxira ko'rinish */}
      {!isGroupedVariants && Array.isArray(variants) && variants.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {variants.map((value) => (
            <span
              key={value}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold bg-white dark:bg-slate-900"
            >
              {value}
            </span>
          ))}
        </div>
      )}

      {
        category ? (
          <div className="mt-5 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 text-xs font-semibold">
                {category}
              </span>
          </div>
        ): ''
      }

      {attributeEntries.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t("productDetail.specificationsLabel")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {attributeEntries.map((entry) => (
              <div key={entry.key} className="flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate">{t(entry.labelKey)}</span>
                <span className="text-xs text-slate-700 dark:text-slate-200 font-bold truncate">
                  {entry.valueKey ? t(entry.valueKey) : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});
