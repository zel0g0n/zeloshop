import React, { useState, useRef, useCallback, memo } from "react";
import { Link } from "react-router-dom";

import heroSlider1 from "@/assets/heron1.webp";
import heroSlider2 from "@/assets/heron2.webp";
import heroSlider3 from "@/assets/adviceAI.webp";

const heroSlides = [
  {
    id: 1,
    title: "Premium Collection",
    description: "Yangi mahsulotlarni kashf eting",
    image: heroSlider1,
    href: "/catalog",
  },
  {
    id: 2,
    title: "Mega Sale",
    description: "50% gacha chegirmalar",
    image: heroSlider2,
    href: "/catalog",
  },
  {
    id: 3,
    title: "Smart Shopping",
    description: "Eng ko'p sotiladigan mahsulotlarni ko'ring",
    image: heroSlider3,
    href: "/catalog",
  },
];

// OLDIN: banner faqat prev/next tugmalari bosilganda almashardi —
// telefonda barmoq bilan surish (swipe) ishlamasdi. Endi haqiqiy
// gorizontal scroll-snap karusel (ProductGallery'dagi kabi) — bu
// brauzerning tabiiy teginish (touch) harakatini ishlatadi, alohida
// murakkab teginish hodisalarini qo'lda yozishning hojati yo'q.
export const HeroSlider = memo(() => {
  const scrollRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
    <section className="px-4 mt-6 mb-8">
      <div className="max-w-[440px] mx-auto">

        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-[190px] flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-[28px] shadow-[0_12px_40px_rgba(37,99,235,0.22)]"
          >
            {heroSlides.map((slide) => (
              <Link
                key={slide.id}
                to={slide.href}
                className="relative h-full w-full shrink-0 snap-start block active:scale-[0.99] transition-transform"
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/85 via-blue-800/50 to-purple-500/40" />

                <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 text-white">

                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs mb-3">
                    ⚡ Trending
                  </span>

                  <h2 className="text-2xl font-black leading-tight max-w-[220px] drop-shadow-sm">
                    {slide.title}
                  </h2>

                  <p className="mt-2 text-sm text-blue-100 max-w-[220px] font-medium">
                    {slide.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {heroSlides.length > 1 && (
            <div className="absolute bottom-4 left-5 z-30 flex items-center gap-1.5">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
