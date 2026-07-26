import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";

import heroSlider1 from "@/assets/heron1.webp";
import heroSlider2 from "@/assets/heron2.webp";
import heroSlider3 from "@/assets/adviceAI.webp";

import { FcPrevious, FcNext } from "@/constants/icons";

const heroSlides = [
  {
    id: 1,
    title: "Premium Collection",
    description: "Yangi mahsulotlarni kashf eting",
    image: heroSlider1,
    href: "/products/premium",
  },
  {
    id: 2,
    title: "Mega Sale",
    description: "50% gacha chegirmalar",
    image: heroSlider2,
    href: "/products/sale",
  },
  {
    id: 3,
    title: "Smart Shopping",
    description: "Kosmetolog AI dan maslahat oling",
    image: heroSlider3,
    href: "/products/ai",
  },
];

export const HeroSlider = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setActiveIndex((prev) =>
      prev === 0 ? heroSlides.length - 1 : prev - 1
    );
  }, []);

  const handleNext = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setActiveIndex((prev) =>
      prev === heroSlides.length - 1 ? 0 : prev + 1
    );
  }, []);

  return (
    <section className="px-4 mt-6 mb-8">
      <div className="max-w-[440px] mx-auto">
        
        <ul className="relative h-[190px] overflow-hidden rounded-[28px] shadow-[0_12px_40px_rgba(37,99,235,0.22)]">
          
          {heroSlides.map((slide, index) => {
            const isActive = activeIndex === index;

            return (
              <li
                key={slide.id}
                className={`absolute inset-0 transition-all duration-500 ${
                  isActive
                    ? "opacity-100 scale-100 z-10"
                    : "opacity-0 scale-105 z-0 pointer-events-none"
                }`}
              >
                <Link
                  to={slide.href}
                  className="relative block w-full h-full active:scale-[0.99] transition-transform"
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-r from-blue-950/80 via-blue-900/40 to-transparent" />

                  <div className="absolute inset-0 bg-blue-500/10" />

                  <div className="absolute left-5 top-1/2 -translate-y-1/2 z-20 text-white">
                    
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-xs mb-3">
                      ⚡ Trending
                    </span>

                    <h2 className="text-2xl font-bold leading-tight max-w-[220px]">
                      {slide.title}
                    </h2>

                    <p className="mt-2 text-sm text-blue-100 max-w-[220px]">
                      {slide.description}
                    </p>
                  </div>

                  <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
                    
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-lg active:scale-95 transition-transform"
                    >
                      <FcPrevious size={18} />
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-lg active:scale-95 transition-transform"
                    >
                      <FcNext size={18} />
                    </button>
                  </div>
                </Link>
              </li>
            );
          })}

          <div className="absolute bottom-5 left-5 z-30 flex items-center gap-2">
            {heroSlides.map((_, index) => (
              <span
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  activeIndex === index
                    ? "w-7 bg-white"
                    : "w-2 bg-white/40"
                }`}
              />
            ))}
          </div>
        </ul>
      </div>
    </section>
  );
};
