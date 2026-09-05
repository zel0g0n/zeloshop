import { useMemo } from 'react'; 
import { useSelector } from 'react-redux';
import { useSession } from '@/context/SessionContext';
import { useLiveShopProducts } from '@/hooks/useLiveShopProducts';
import { isDiscountActive } from '@/utils/productPricing';

// OLDIN: bu hook ham Bosh sahifa, ham Katalog sahifasi tomonidan
// ishlatilardi, va ikkalasi ham bitta umumiy (Redux'dagi) qidiruv/
// filtr holatidan foydalanardi — bu ikkalasini keraksiz bog'lab
// qo'yardi (Katalogdagi qidiruv Bosh sahifaga ham "sizib o'tardi").
//
// ENDI: bu hook FAQAT Bosh sahifa uchun — u yerda hech qanday
// qidiruv/filtr yo'q. Katalog sahifasining o'z qidiruv/filtr holati
// endi alohida (`CatalogFilterContext.jsx`) da yashaydi.
//
// MUHIM TUZATISH (haqiqiy, sezilmagan xato): bo'limlar (eng ko'p
// sotilgan/aksiyadagi/yangi) OLDIN mahsulotning `tags` massividagi
// ("Best Seller", "Trending", "AI Choice") QO'LDA belgilanadigan
// yorliqlarga tayanardi - lekin "Yangi mahsulot" formasida bu
// yorliqlarni belgilashning HECH QANDAY yo'li yo'q edi! Natijada bu
// bo'limlar HAR DOIM, HAR BIR sotuvchi uchun bo'sh bo'lib qolardi -
// bu, ilovada sezilmagan, jimgina "ishlamayotgan" funksiya edi. Endi
// bu bo'limlar HAQIQIY, allaqachon mavjud ma'lumotdan (sotilgan soni,
// haqiqiy chegirma narxi, qo'shilgan sana) avtomatik hisoblanadi -
// sotuvchi hech narsa qo'lda belgilashi shart emas.
const HOME_PREVIEW_COUNT = 8;
const SECTION_ITEM_COUNT = 10;

export function useFilterProducts() {
  const { sellerId } = useSession();
  useLiveShopProducts(sellerId);

  const { products = [], loading, error } = useSelector((state) => state.products);

  const homePreviewProducts = useMemo(() => products.slice(0, HOME_PREVIEW_COUNT), [products]);
  const hasMoreThanPreview = products.length > HOME_PREVIEW_COUNT;

  // ENG KO'P SOTILGAN — haqiqiy `sold` soniga qarab, kamayish
  // tartibida. Hech narsa sotilmagan mahsulotlar (sold=0) chiqarib
  // tashlanadi - "eng ko'p sotilgan" ro'yxatida 0 sonli mahsulotning
  // turishi mantiqsiz.
  const bestSellerProducts = useMemo(() => {
    return [...products]
      .filter((p) => (Number(p.sold) || 0) > 0)
      .sort((a, b) => (Number(b.sold) || 0) - (Number(a.sold) || 0))
      .slice(0, SECTION_ITEM_COUNT);
  }, [products]);

  // AKSIYADAGI — faqat HAQIQIY, HALI AMAL QILAYOTGAN (muddati
  // o'tmagan) chegirma bor mahsulotlar (`isDiscountActive` -
  // `ProductCard.jsx` ishlatadigan bilan BIR XIL tekshiruv,
  // izchillik uchun).
  const onSaleProducts = useMemo(() => {
    return products
      .filter((p) => isDiscountActive(p))
      .slice(0, SECTION_ITEM_COUNT);
  }, [products]);

  // YANGI QO'SHILGAN — `createdAt` bo'yicha eng so'nggilari. Sana
  // formati turlicha bo'lishi mumkin (ISO satr yoki millisekund) -
  // `new Date(x).getTime()` ikkalasini ham to'g'ri qabul qiladi.
  const newArrivalProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, SECTION_ITEM_COUNT);
  }, [products]);

  return {
    homePreviewProducts,
    hasMoreThanPreview,
    bestSellerProducts,
    onSaleProducts,
    newArrivalProducts,
    products,
    loading, 
    error
  };
}
