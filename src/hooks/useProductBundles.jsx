import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { getDocs } from "firebase/firestore";
import { productBundlesQuery } from "@/services/bundles/bundles";
import getSingleProduct from "@/services/products/getSingleProduct";

/**
 * Mahsulot detail sahifasida shu MAHSULOT ishtirok etadigan FAOL
 * combo takliflarni topadi. Har bir combo uchun, combo'ga kiruvchi
 * QOLGAN mahsulotlarning to'liq hujjatlarini ham yuklaydi (nom,
 * rasm, narx ko'rsatish uchun) — joriy mahsulot allaqachon
 * `product` orqali mavjud bo'lgani uchun, u qayta yuklanmaydi.
 *
 * Bir martalik `getDocs()` (onSnapshot EMAS) — combo ro'yxati
 * sahifa ochilganda bir marta ko'rinsa yetarli, real vaqtda
 * yangilanib turishi shart emas (xuddi shu loyihadagi boshqa
 * "IXTIYORIY qulaylik" ma'lumotlar bilan bir xil, xarajatni
 * cheklash falsafasiga mos).
 *
 * FRONTEND CACHE AUDITI (2026-09): "boshqa mahsulotlar"ni yuklashda
 * OLDIN har doim, hech narsani tekshirmasdan, alohida `getSingleProduct`
 * (`getDoc`) chaqirilardi — hattoki o'sha mahsulot allaqachon
 * `state.products.products` Redux keshida (butun katalog sahifasidan
 * kelgan, `singleProductAsyncThunk`dagi bilan BIR XIL manba) mavjud
 * bo'lsa ham. Endi avval shu keshdan qidiriladi — topilsa, Firestore'ga
 * UMUMAN so'rov yuborilmaydi. Kesh bo'sh bo'lsa (masalan foydalanuvchi
 * katalogni ko'rmasdan, to'g'ridan-to'g'ri chuqur havola orqali kirgan
 * bo'lsa) — xatti-harakat ESKISI BILAN BIR XIL (xavfsiz zaxira sifatida
 * `getSingleProduct` chaqiriladi).
 */
export const useProductBundles = (sellerId, product) => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const catalogProducts = useSelector((state) => state.products?.products);

  useEffect(() => {
    const productId = product?.id;
    if (!sellerId || !productId) {
      setBundles([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const resolveProduct = (id) => {
      const cached = catalogProducts?.find((p) => String(p.id) === String(id));
      if (cached) return Promise.resolve(cached);
      return getSingleProduct(id).catch(() => null);
    };

    getDocs(productBundlesQuery(sellerId, productId))
      .then(async (snapshot) => {
        const rawBundles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (rawBundles.length === 0) return [];

        const enriched = await Promise.all(
          rawBundles.map(async (bundle) => {
            const otherIds = (bundle.productIds || []).filter((id) => id !== productId);
            const otherProducts = await Promise.all(otherIds.map(resolveProduct));
            const validOtherProducts = otherProducts.filter(Boolean);
            // Combo'dagi mahsulotlardan biri o'chirilgan/topilmasa -
            // bu combo endi ko'rsatilmaydi (yaroqsiz taklif).
            if (validOtherProducts.length !== otherIds.length) return null;
            return { ...bundle, products: [product, ...validOtherProducts] };
          })
        );
        return enriched.filter(Boolean);
      })
      .then((result) => { if (!cancelled) setBundles(result); })
      .catch(() => { if (!cancelled) setBundles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `product` obyektining o'zi emas, faqat combo natijasiga ta'sir qiluvchi maydonlari kuzatiladi
  }, [sellerId, product?.id, product?.price, product?.discountPrice, catalogProducts]);

  return { bundles, loading };
};
