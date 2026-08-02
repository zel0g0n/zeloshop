import { memo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAddFavorite } from "@/hooks/useAddFavourite";
import {
  IoArrowBack,
  FaRegHeart,
} from "@/constants/icons";

// OLDIN: mahsulot 4 tagacha rasmga ega bo'lishi mumkin bo'lsa ham,
// bu yerda faqat BITTA (asosiy/thumbnail) rasm ko'rsatilardi — qolgan
// rasmlar hech qayerda ko'rinmasdi. Endi barcha rasmlar gorizontal
// surilib (swipe) ko'rish mumkin bo'lgan karuselda, pastida nuqta
// ko'rsatkichlari bilan ko'rsatiladi. Eski, bitta rasmli mahsulotlar
// uchun ham ishlaydi (`images` bo'lmasa `image`ga qaytadi).
export const ProductGallery = memo(({ product }) => {
  const { isFavorite, toggleFavorite } = useAddFavorite(product);
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : [product?.image].filter(Boolean);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }, []);

  const goToIndex = (index) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="relative">
      
      <div className="relative h-[430px] overflow-hidden rounded-b-[42px] bg-gradient-to-br from-blue-100 to-slate-100 dark:from-slate-800 dark:to-slate-900 shadow-[0_15px_60px_rgba(37,99,235,0.18)]">

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        >
          {images.length > 0 ? (
            images.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`Mahsulot rasmi ${index + 1}`}
                className="h-full w-full object-cover shrink-0 snap-start"
              />
            ))
          ) : (
            <div className="h-full w-full shrink-0 flex items-center justify-center text-6xl">📦</div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        <div className="absolute left-0 top-0 z-30 flex w-full items-center justify-between px-5 pt-6">
          
          <div
            onClick={() => navigate(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/20 text-white backdrop-blur-xl"
          >
            <IoArrowBack className="text-[22px]" />
          </div>

          <button
            type="button"
            onClick={toggleFavorite}
            className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-75 ${
              isFavorite ? "bg-blue-600 text-white shadow-md" : "bg-white/95 dark:bg-slate-800/95 text-slate-400"
          }`}
          >
            <FaRegHeart className="text-[20px]" />
          </button>
        </div>

      </div>
    </section>
  );
});
