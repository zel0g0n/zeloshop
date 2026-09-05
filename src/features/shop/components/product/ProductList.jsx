import { memo } from 'react';
import ProductCard from './ProductCard';

// `contain-intrinsic-size` — brauzerga elementning hali render
// qilinmagan holatidagi taxminiy o'lchamini aytadi
// (`content-visibility-auto` bilan birga ishlaydi, uzoqdagi
// elementlarni render qilishni kechiktirib, tezlik uchun). Bu qiymat
// `ProductCard.jsx`ning haqiqiy balandligiga (300px) mos bo'lishi
// kerak — mos kelmasa, element birinchi marta ko'rinishga kirganda
// bir lahzalik o'lcham sakrashiga (joy o'zgarishi) sabab bo'ladi.
//
// Gorizontal skroll qatorida (bosh sahifadagi "Ko'p sotilganlar"/
// "Yangi qo'shilganlar" kabi) wrapper aniq, qat'iy `width` oladi
// (`shrink-0` bilan — flex uni siqib kichraytirmasligi uchun) —
// faqat `min-w` belgilash yetarli emas, chunki flex qatorida aniq
// `width` bo'lmasa, brauzer har bir elementning kengligini uning
// ichidagi kontent asosida ("auto" flex-basis) hisoblaydi, bu esa
// kartochkadan-kartochkaga farq qilib ketishi mumkin. Aniq `width`
// bilan barcha kartochkalar kontentidan qat'i nazar bir xil
// kenglikda bo'ladi.
const ProductList = memo(({ products, filterTypeStyle, isHorizontal = true }) => {
  return (
    <div className="w-full mb-8">
      <div className={filterTypeStyle}>
        {products.map((product) => (
          <div
            key={product.id}
            className={`
              content-visibility-auto
              contain-intrinsic-size-[280px_302px]
              ${isHorizontal
                ? "w-[240px] xs:w-[280px] shrink-0 snap-start snap-always"
                : "w-full"
              }
            `}
          >
            <ProductCard product={product} />
          </div>
        ))}
        {isHorizontal && <div className="min-w-[20px] h-full flex-shrink-0" />}
      </div>
    </div>
  );
});

ProductList.displayName = "ProductList";
export default ProductList;