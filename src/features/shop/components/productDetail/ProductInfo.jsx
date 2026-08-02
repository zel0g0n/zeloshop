import { memo } from "react";

export const ProductInfo = memo(({info}) => {
  const { name, brand, description, rating, tags, category, variants } = info || {};

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
            <span className="px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 text-xs font-semibold">
              ⭐ {rating}
            </span>
          ) : ''
        }
        
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
    </section>
  );
});
