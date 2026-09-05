import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock3, PackageSearch, Bike } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetClientOrdersData from "@/hooks/seller/useClientOrder";
import { findLatestActiveOrder } from "@/utils/orderFilters";
import { useLanguage } from "@/context/LanguageContext";

// 2026-09 punkt-royxati, 7-band: mijoz kabinetida "faol buyurtma"
// bannerini ko'rsatish. ILGARI bu komponent butunlay o'chirilgan
// (`HAS_ACTIVE_ORDER_TRACKING = false`) va real ma'lumot bilan
// UMUMAN ULANMAGAN edi — bosilganda hardcoded Yandex kuryer
// havolasini ochardi. Endi haqiqiy buyurtma ma'lumotidan
// (`useGetClientOrdersData`) foydalanadi va `/orders/:id/track`
// sahifasiga (kuryer joylashuvini jonli ko'rsatadigan, bu loyihada
// allaqachon mavjud) yo'naltiradi.
//
// Har bir status uchun alohida rang/ikonka/matn - buyurtma hali
// tasdiqlanmagan ("new") bosqichida kuryer haqida gapirish
// chalkashtirib yuboradi, shuning uchun bosqichga mos xabar
// ko'rsatiladi (`CourierTrackingPage.jsx` esa kuryer hali
// biriktirilmagan holatni o'zi ham to'g'ri ("noCourierYet")
// ko'rsatadi - shu sabab "new"/"processing" holatida ham xavfsiz
// o'sha sahifaga yo'naltirish mumkin).
const ACTIVE_ORDER_BANNER_CONFIG = {
  new: {
    Icon: Clock3,
    titleKey: "orderTracking.activeBannerTitleNew",
    descKey: "orderTracking.activeBannerDescNew",
    accent: "amber",
  },
  processing: {
    Icon: PackageSearch,
    titleKey: "orderTracking.activeBannerTitleProcessing",
    descKey: "orderTracking.activeBannerDescProcessing",
    accent: "blue",
  },
  shipped: {
    Icon: Bike,
    titleKey: "orderTracking.activeBannerTitleShipped",
    descKey: "orderTracking.activeBannerDescShipped",
    accent: "emerald",
  },
};

const ACCENT_CLASSES = {
  amber: {
    wrap: "bg-amber-50 dark:bg-amber-500/10 border-amber-200/30 dark:border-amber-500/20",
    icon: "bg-amber-500",
    chevron: "text-amber-500",
  },
  blue: {
    wrap: "bg-blue-50 dark:bg-blue-500/10 border-blue-200/30 dark:border-blue-500/20",
    icon: "bg-blue-500",
    chevron: "text-blue-500",
  },
  emerald: {
    wrap: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/30 dark:border-emerald-500/20",
    icon: "bg-emerald-500",
    chevron: "text-emerald-500",
  },
};

const ActiveOrder = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { clientId, sellerId } = useSession();
  const { orders } = useGetClientOrdersData(clientId, sellerId);

  const activeOrder = useMemo(() => findLatestActiveOrder(orders), [orders]);

  if (!activeOrder) return null;

  const config = ACTIVE_ORDER_BANNER_CONFIG[activeOrder.status] || ACTIVE_ORDER_BANNER_CONFIG.new;
  const accent = ACCENT_CLASSES[config.accent];
  const { Icon } = config;

  return (
    <div className="block p-4 pb-0">
      <button
        type="button"
        onClick={() => navigate(`/orders/${activeOrder.id}/track`)}
        className={`w-full text-left border rounded-[22px] p-3.5 flex items-center justify-between active:scale-[0.98] transition-transform ${accent.wrap}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${accent.icon}`}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-white">{t(config.titleKey)}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium mt-0.5">{t(config.descKey)}</p>
          </div>
        </div>
        <ChevronRight size={16} className={accent.chevron} />
      </button>
    </div>
  );
};

export default ActiveOrder;
