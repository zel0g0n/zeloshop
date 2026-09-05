import { memo } from "react";
import { useRelatedProducts } from "@/hooks/useRelatedProducts";
import { useProductDetail } from "@/hooks/useProductDetails";
import { productVerticalListStyle } from "@/constants/custom-css";
import { useNavigate } from "react-router";
import ProductList from "../product/ProductList";
import { useLanguage } from "@/context/LanguageContext";

// MUHIM (2026-09 dizayn tuzatishi): bu bo'lim OLDIN gorizontal skroll
// ko'rinishida edi, va HAR BIR mahsulot uchun ALOHIDA `ProductList`
// render qilinardi (`products={[item]}`) — bu keraksiz, chalkash
// ichma-ich wrapper'larga olib kelardi. ENDI — katalog/bosh sahifadagi
// bilan AYNAN BIR XIL vertikal 2-ustunli grid dizayni (bitta
// `ProductList` chaqiruvi, `isHorizontal={false}`), shunday qilib
// mahsulot kartochkalari BUTUN ilova bo'ylab bir xil ko'rinishga ega
// bo'ladi.
export const RelatedProducts = memo(() => {
  const { t } = useLanguage();
  const { product } = useProductDetail();
  const { items: relatedProducts, basis } = useRelatedProducts(product);
  const navigate = useNavigate();

  // Bo'sh bo'lsa, sarlavhasi bilan bo'sh joy qoldirish o'rniga butunlay yashiramiz
  if (relatedProducts.length === 0) return null;

  // Sarlavha HALOL tanlanadi: agar HAQIQIY xarid tarixidan hisoblangan
  // "birga sotib olingan" signali yetarli bo'lsa - shunga mos sarlavha
  // ("Ko'pincha birga sotib olinadi"), aks holda kategoriya-zaxirasi
  // uchun neytral "O'xshash mahsulotlar" (`utils/productRecommendations.js`).
  const titleKey = basis === "cooccurrence" ? "productDetail.relatedTitleFrequentlyBought" : "productDetail.relatedTitle";

  return (
    <section className="mt-6 mb-[120px]">
      <h3 className="text-[24px] font-bold text-slate-900 dark:text-white">
        {t(titleKey)}
      </h3>

      <ProductList products={relatedProducts} filterTypeStyle={productVerticalListStyle} isHorizontal={false} />

      {/* "Barchasi" tugmasi ENDI ro'yxatning PASTKI qismida — hozircha
          bu tavsiyalar uchun alohida "hammasini ko'rish" sahifasi
          yo'q, shuning uchun umumiy katalogga olib boradi. */}
      <button
        onClick={() => navigate('/catalog')}
        className="mt-1 w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-blue-600 dark:text-blue-400 active:scale-[0.98] transition-transform"
      >
        {t("productDetail.relatedAll")}
      </button>
    </section>
  );
});
