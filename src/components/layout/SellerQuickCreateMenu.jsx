import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package, Megaphone, PackagePlus, Tag, Image, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Sheet from "@/components/ui/Sheet";

/**
 * Navbar'ning markaziy "+" tugmasi uchun tezkor yaratish menyusi
 * (2026-09, foydalanuvchi so'roviga ko'ra qo'shildi).
 *
 * OLDIN: "+" tugmasi TO'G'RIDAN-TO'G'RI "Mahsulot qo'shish"
 * sahifasiga (`/seller/add-product`) o'tuvchi oddiy `NavLink` edi —
 * boshqa "yaratish" turlari (aksiya, bandl, promo kod, banner) uchun
 * sotuvchi bu tugmani UMUMAN topa olmasdi (ayniqsa banner — item 7
 * bo'yicha Sozlamalardan olib tashlangan, endi FAQAT shu menyu orqali
 * ochiladi).
 *
 * ENDI: tugma bosilganda shu pastdan chiquvchi menyu ochiladi — 5 ta
 * variantdan biri tanlanganda tegishli sahifaga o'tiladi.
 */
const ITEMS = [
  { id: "add-product", nameKey: "addProductName", descKey: "addProductDesc", icon: Package, path: "/seller/add-product", accent: "indigo" },
  { id: "create-promotion", nameKey: "createPromotionName", descKey: "createPromotionDesc", icon: Megaphone, path: "/seller/create-promotion", accent: "rose" },
  { id: "create-bundle", nameKey: "createBundleName", descKey: "createBundleDesc", icon: PackagePlus, path: "/seller/bundles", accent: "amber" },
  { id: "create-promo-code", nameKey: "createPromoCodeName", descKey: "createPromoCodeDesc", icon: Tag, path: "/seller/marketing", accent: "emerald" },
  { id: "add-banner", nameKey: "addBannerName", descKey: "addBannerDesc", icon: Image, path: "/seller/banners", accent: "sky" },
];

const ACCENT_CLASSES = {
  indigo: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  rose: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

const SellerQuickCreateMenu = ({ onClose }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSelect = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Sheet
      onClose={onClose}
      icon={Plus}
      accent="indigo"
      size="md"
      title={t("sellerQuickCreateMenu.title")}
      subtitle={t("sellerQuickCreateMenu.subtitle")}
    >
      <div className="space-y-2 pb-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.path)}
              className="group w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-slate-800/60 dark:hover:border-slate-700 active:scale-[0.99] transition-all"
            >
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_CLASSES[item.accent]}`}>
                <Icon size={18} />
              </span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[13px] font-black text-slate-800 dark:text-white truncate">{t(`sellerQuickCreateMenu.${item.nameKey}`)}</p>
                <p className="text-[11px] leading-4 text-slate-400 dark:text-slate-500 truncate">{t(`sellerQuickCreateMenu.${item.descKey}`)}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-400 transition-all" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
};

export default memo(SellerQuickCreateMenu);
