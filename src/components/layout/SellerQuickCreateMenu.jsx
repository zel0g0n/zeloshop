import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Package, Megaphone, PackagePlus, Tag, Image, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

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

  useEscapeToClose(onClose);

  const handleSelect = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 z-[60] flex items-end justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[28px] p-5 pb-8 space-y-3 shadow-xl border-t border-slate-100 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-sm font-black text-slate-800 dark:text-white">{t("sellerQuickCreateMenu.title")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-full flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.path)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#F4F5F9] dark:bg-slate-800 active:scale-[0.98] transition-transform"
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_CLASSES[item.accent]}`}>
                  <Icon size={18} />
                </span>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 dark:text-white truncate">{t(`sellerQuickCreateMenu.${item.nameKey}`)}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t(`sellerQuickCreateMenu.${item.descKey}`)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(SellerQuickCreateMenu);
