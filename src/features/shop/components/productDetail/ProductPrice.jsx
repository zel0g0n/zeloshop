import { memo, useState } from "react";
import { Timer } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { computeLowStockSignal, computeSoldCountSignal, computeTodaySoldSignal } from "@/utils/productSignals";
import { isDiscountActive } from "@/utils/productPricing";
import { CountdownTimer } from "@/components/ui/CountdownTimer";

// OLDIN: (1) bu komponent `oldPrice` degan maydonni o'qirdi, lekin
// hech qanday xizmat (addProduct/updateProductFull) bunday maydonni
// hech qachon yozmagan — shuning uchun chegirma HECH QACHON
// ko'rsatilmasdi. Haqiqiy chegirma maydoni — `discountPrice`. (2)
// stock=0 bo'lganda ham "Mavjud emas" VA "Zaxirada: 0 ta" ikkalasi
// bir vaqtda ko'rsatilib, bir-biriga zid xabar berardi.
// ENDI: to'g'ri `discountPrice` maydoni ishlatiladi.
//
// OLDIN (2026-09 punkt-royxati): bu yerda mahsulotning to'lov turi
// (oldindan/yetkazilganda) belgilari ko'rsatilardi. ENDI to'lov turi
// BUTUN DO'KON uchun bitta sozlama (`sellers/{id}.paymentTypes`) -
// mahsulot sahifasida ko'rsatish endi ma'nosiz (har doim bir xil
// bo'lardi) va xaridorni checkout'dan OLDIN keraksiz tafsilot bilan
// chalg'itardi. Endi bu FAQAT checkout sahifasida (`Checkout.jsx`),
// haqiqiy tanlov kerak bo'lgan joyda ko'rsatiladi.
export const ProductPrice = memo(({ priceData }) => {
  const { t } = useLanguage();
  const {price, discountPrice, stock, sold, soldTodayCount, soldTodayDate} = priceData || {};
  const safePrice = Number(price) || 0;
  const safeStock = Number(stock) || 0;

  // MUHIM ("vaqtli aksiya"): sotuvchi chegirmaga muddat qo'ygan bo'lishi
  // mumkin (`CreatePromotionPage.jsx`). `expired` - taymer nolga
  // yetganda darhol o'rnatiladi - shu orqali chegirma foydalanuvchi
  // sahifani yangilamasdan ham "tugagan" ko'rinishga o'tadi. `mountedAtMs`
  // - `Checkout.jsx`dagi bilan bir xil naqsh (render vaqtida
  // to'g'ridan-to'g'ri `Date.now()` chaqirilmaydi, faqat mount'da bir
  // marta suratga olinadi - `react-hooks/purity`).
  const [expired, setExpired] = useState(false);
  const [mountedAtMs] = useState(() => Date.now());
  const hasRealDiscount = !expired && isDiscountActive(priceData || {}, mountedAtMs);
  const discountEndMs = priceData?.discountExpiresAt ? new Date(priceData.discountExpiresAt).getTime() : null;
  const displayPrice = hasRealDiscount ? Number(discountPrice) : safePrice;
  // Uchalasi ham HAQIQIY ma'lumotdan - batafsil izoh `utils/productSignals.js`da.
  // "Bugun sotildi" (#119) eng "yangi"/dolzarb signal bo'lgani uchun
  // ustuvor - mavjud bo'lsa, umumiy (lifetime) sotilgan soni belgisi
  // ko'rsatilmaydi (ikkalasi bir vaqtda band ortiqcha bo'lardi).
  const lowStockSignal = computeLowStockSignal(safeStock);
  const todaySoldSignal = computeTodaySoldSignal(soldTodayCount, soldTodayDate);
  const soldSignal = todaySoldSignal ? null : computeSoldCountSignal(sold);

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

          {todaySoldSignal && (
            <p className="mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {t("productDetail.soldTodayCount", { count: todaySoldSignal.count })}
            </p>
          )}

          {soldSignal && (
            <p className="mt-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {t("productDetail.soldCount", { count: soldSignal.count })}
            </p>
          )}

          {hasRealDiscount && discountEndMs != null && !Number.isNaN(discountEndMs) && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-black text-rose-500">
              <Timer size={12} />
              {t("productDetail.discountEndsIn")}{" "}
              <CountdownTimer
                endMs={discountEndMs}
                onExpire={() => setExpired(true)}
                className="font-mono"
              />
            </p>
          )}
        </div>

        <div className="flex flex-col items-end">
          {safeStock > 0 ? (
            <>
              <span className="text-sm text-emerald-500 font-semibold">{t("productDetail.available")}</span>
              {lowStockSignal ? (
                <span className="mt-1 text-xs text-rose-500 font-bold text-right max-w-[140px]">
                  {t("productDetail.lowStockWarning", { count: lowStockSignal.count })}
                </span>
              ) : (
                <span className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t("productDetail.inStockCount")} {safeStock} ta</span>
              )}
            </>
          ) : (
            <span className="text-sm text-rose-500 font-semibold">{t("productDetail.outOfStock")}</span>
          )}
        </div>
      </div>
    </section>
  );
});
