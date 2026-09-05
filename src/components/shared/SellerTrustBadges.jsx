import { Star, Package, ShieldCheck, Clock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { computeSellerTrustBadges } from "@/utils/sellerTrustBadges";

// Har bir nishon KALITI uchun mos lucide-react ikonkasi - loyihaning
// "faqat lucide-react, emoji YO'Q" konventsiyasiga mos
// (`ESTABLISHED PATTERNS` xotira yozuvi).
const BADGE_ICONS = {
  highRating: Star,
  orderVolume: Package,
  trustedSeller: ShieldCheck,
  activeSinceMonths: Clock,
  activeSinceYears: Clock,
};

/**
 * Sotuvchining HAQIQIY ishonch nishonlarini ko'rsatadi
 * (`utils/sellerTrustBadges.js` - hisoblash mantig'i, hech qanday
 * raqam o'ylab topilmaydi). `store` — odatda `useSession()`dan kelgan
 * to'liq sotuvchi hujjati.
 *
 * `variant="compact"` — faqat ENG KUCHLI bitta nishonni ko'rsatadi
 * (masalan `Header.jsx`da joy tejash uchun). `variant="full"` —
 * barcha qozonilgan nishonlarni ro'yxat sifatida ko'rsatadi (masalan
 * `StoreInfoPage.jsx`da). Hech qanday nishon qozonilmagan bo'lsa (yangi
 * sotuvchi) — HECH NARSA render qilinmaydi (soxta boshlang'ich nishon
 * ko'rsatilmaydi).
 */
const SellerTrustBadges = ({ store, variant = "full", className = "" }) => {
  const { t } = useLanguage();
  const badges = computeSellerTrustBadges(store);
  if (badges.length === 0) return null;

  // Compact rejimda ustuvorlik: "Ishonchli sotuvchi" (eng yig'ma
  // signal) > yuqori reyting > buyurtma hajmi > faollik muddati.
  const priority = ["trustedSeller", "highRating", "orderVolume", "activeSinceMonths", "activeSinceYears"];
  const visibleBadges = variant === "compact"
    ? badges.slice().sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key)).slice(0, 1)
    : badges;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visibleBadges.map((badge) => {
        const Icon = BADGE_ICONS[badge.key];
        return (
          <span
            key={badge.key}
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
          >
            {Icon && <Icon size={11} />}
            {t(`trustBadges.${badge.key}`, badge.params)}
          </span>
        );
      })}
    </div>
  );
};

export default SellerTrustBadges;
