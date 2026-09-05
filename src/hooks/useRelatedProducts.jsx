import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useSession } from "@/context/SessionContext";
import { useLiveShopProducts } from "@/hooks/useLiveShopProducts";
import { pickRelatedProducts } from "@/utils/productRecommendations";

// OLDIN: bu hook har bir mahsulot sahifasi ochilganda getProducts() orqali
// "products" kolleksiyasini TO'LIQ (barcha sotuvchilarning) qayta o'qirdi.
// ENDI: allaqachon Redux'da (state.products.products) mavjud bo'lgan,
// JORIY sotuvchiga tegishli, JONLI yangilanadigan ro'yxatdan foydalanamiz.
//
// MUHIM TUZATISH (v39.13): OLDIN bu yerda `product.tags` maydoniga
// asoslangan moslik tekshirilardi - lekin hech qanday mahsulot
// yaratish/tahrirlash oqimi bu maydonni yozmaydi, shuning uchun bu
// bo'lim AMALDA HAR DOIM bo'sh edi (o'lik funksiya). Endi hisoblash
// mantig'i `utils/productRecommendations.js`ga (sof, sinaladigan) -
// HAQIQIY kategoriya/reyting va (mavjud bo'lsa) HAQIQIY xarid
// tarixidan hisoblangan "birga sotib olingan" statistikasiga
// asoslanadi.
// MUHIM (2026-09 dizayn tuzatishi): mahsulot sahifasidagi tavsiyalar
// bo'limi ENDI vertikal 2-ustunli grid ko'rinishida (gorizontal skroll
// o'rniga) ko'rsatiladi — shu sababli natijalar soni 8 dan 6 taga
// tushirildi (`RelatedProducts.jsx`), 2 ustunda 6 ta = aniq 3 qator,
// "yarim qator" bo'lib qolmaydi.
const MAX_RELATED_RESULTS = 6;

export const useRelatedProducts = (product, options = {}) => {
  const { sellerId, store } = useSession();
  useLiveShopProducts(sellerId);

  const { products } = useSelector((state) => state.products);
  const maxResults = options.maxResults ?? MAX_RELATED_RESULTS;

  return useMemo(() => {
    try {
      // 15-NICHE UNIVERSAL PLATFORMA: `nicheId` (store.category) 3-daraja
      // ("bog'liq kategoriya") zaxirasi uchun uzatiladi - batafsili
      // `productRecommendations.js`da.
      return pickRelatedProducts(products, product, { nicheId: store?.category, maxResults });
    } catch (error) {
      console.error("O'xshash mahsulotlarni hisoblashda xatolik:", error);
      return { items: [], basis: "none" };
    }
  }, [product, products, store?.category, maxResults]);
};
