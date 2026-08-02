import { memo } from "react";

// OLDIN: yuklanish paytida faqat "Yuklanmoqda..." matni ko'rsatilardi —
// bo'sh ekran + matn hunuk va "qotib qolgandek" taassurot qoldiradi.
// Endi haqiqiy kontent qanday ko'rinishiga o'xshash skelet bloklar
// ko'rsatiladi (mashhur saytlarda keng qo'llaniladigan naqsh).

const pulse = "animate-pulse bg-gray-200 dark:bg-slate-800 rounded";

export const CardSkeleton = ({ className = "" }) => (
  <div className={`rounded-2xl border border-gray-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 ${className}`}>
    <div className="flex items-center gap-3">
      <div className={`w-14 h-14 shrink-0 ${pulse}`} />
      <div className="flex-1 space-y-2">
        <div className={`h-3 w-2/3 ${pulse}`} />
        <div className={`h-3 w-1/3 ${pulse}`} />
      </div>
    </div>
  </div>
);

export const ProfileHeaderSkeleton = () => (
  <div className="flex justify-between items-center bg-white dark:bg-slate-900 rounded-b-[32px] p-6 pt-8 border-b border-gray-100 dark:border-slate-800">
    <div className="flex items-center gap-4">
      <div className={`w-16 h-16 rounded-[22px] ${pulse}`} />
      <div className="space-y-2">
        <div className={`h-4 w-32 ${pulse}`} />
        <div className={`h-3 w-24 ${pulse}`} />
        <div className={`h-3 w-20 ${pulse}`} />
      </div>
    </div>
  </div>
);

export const ListSkeleton = ({ count = 3, cardClassName }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} className={cardClassName} />
    ))}
  </div>
);

export const GridSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`w-full aspect-[3/4] ${pulse}`} />
    ))}
  </div>
);

export const ProductDetailSkeleton = () => (
  <div className="pb-[140px] bg-white dark:bg-slate-950 min-h-screen">
    <div className={`h-[430px] rounded-b-[42px] ${pulse}`} />
    <div className="max-w-[440px] mx-auto px-4 space-y-6 mt-6">
      <div className="space-y-3">
        <div className={`h-4 w-24 ${pulse}`} />
        <div className={`h-8 w-3/4 ${pulse}`} />
        <div className={`h-3 w-full ${pulse}`} />
        <div className={`h-3 w-2/3 ${pulse}`} />
      </div>
      <div className={`h-20 w-full rounded-[32px] ${pulse}`} />
    </div>
  </div>
);

export default memo(CardSkeleton);
