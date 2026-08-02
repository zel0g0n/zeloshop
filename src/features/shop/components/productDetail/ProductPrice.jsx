import { memo } from "react";

// OLDIN: (1) bu komponent `oldPrice` degan maydonni o'qirdi, lekin
// hech qanday xizmat (addProduct/updateProductFull) bunday maydonni
// hech qachon yozmagan — shuning uchun chegirma HECH QACHON
// ko'rsatilmasdi. Haqiqiy chegirma maydoni — `discountPrice`. (2)
// stock=0 bo'lganda ham "Mavjud emas" VA "Zaxirada: 0 ta" ikkalasi
// bir vaqtda ko'rsatilib, bir-biriga zid xabar berardi.
// ENDI: to'g'ri `discountPrice` maydoni ishlatiladi, va xaridorga
// to'lov turi (oldindan/yetkazilganda) haqida ham aniq signal beriladi.
export const ProductPrice = memo(({ priceData }) => {
  const {price, discountPrice, stock, paymentTypes, paymentType} = priceData || {};
  const safePrice = Number(price) || 0;
  const safeStock = Number(stock) || 0;
  const hasRealDiscount = discountPrice && Number(discountPrice) > 0 && Number(discountPrice) < safePrice;
  const displayPrice = hasRealDiscount ? Number(discountPrice) : safePrice;

  // Eski mahsulotlarda yakka `paymentType` (matn), yangilarida
  // `paymentTypes` (massiv, bir nechtasi bo'lishi mumkin) bo'lishi mumkin.
  const enabledTypes = Array.isArray(paymentTypes) && paymentTypes.length > 0
    ? paymentTypes
    : (paymentType ? [paymentType] : ["prepay"]);

  return (
    <section className="mt-6 space-y-2">
      <div className="flex items-center justify-between rounded-[32px] bg-white dark:bg-slate-900 p-5 shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
        
        <div>
          {hasRealDiscount && (
            <p className="text-sm text-slate-400 dark:text-slate-500 line-through">
              {safePrice.toLocaleString()} so'm
            </p>
          )}

          <div className="flex items-end gap-3 mt-1">
            <h2 className="text-[24px] font-black text-blue-600 dark:text-blue-400 leading-none">
              {displayPrice.toLocaleString()} so'm
            </h2>
          </div>
        </div>

        <div className="flex flex-col items-end">
          {safeStock > 0 ? (
            <>
              <span className="text-sm text-emerald-500 font-semibold">Mavjud</span>
              <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">Zaxirada: {safeStock} ta</span>
            </>
          ) : (
            <span className="text-sm text-rose-500 font-semibold">Tugagan</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 px-1">
        {enabledTypes.includes("prepay") && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs">💳</span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Oldindan to'lov</span>
          </div>
        )}
        {enabledTypes.includes("cod") && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📦</span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Yetib borganda</span>
          </div>
        )}
      </div>
    </section>
  );
});
