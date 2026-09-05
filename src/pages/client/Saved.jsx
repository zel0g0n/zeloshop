import { useNavigate } from "react-router-dom";
import ProductList from "@/features/shop/components/product/ProductList";
import {productVerticalListStyle} from "@/constants/custom-css.jsx";
import { useFavoritesList } from "@/hooks/useAddFavourite";
import { ArrowLeft, Heart } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const FavoritesPage = () => {
  const {favorites} = useFavoritesList()
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="bg-gray-50/50 dark:bg-slate-950 min-h-screen pb-36 px-[10px] transition-colors duration-300">
      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 z-20 border-b border-gray-100 dark:border-slate-800 shadow-xs p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight flex-1">{t("favorites.title")}</h1>
        {/* MUHIM TUZATISH: OLDIN bu belgi qizil (`rose`) rangda edi -
            "xato/ogohlantirish" degan taassurot berib, sahifa
            dizaynini buzardi (saqlanganlar ro'yxati - hech qanday
            salbiy holat emas). Endi ilovaning umumiy asosiy rangiga
            (ko'k) mos qilib o'zgartirildi. */}
        <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0">
          {favorites.length} {t("favorites.count")}
        </span>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <Heart size={36} className="text-gray-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-bold text-gray-700 dark:text-slate-200">{t("favorites.emptyTitle")}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("favorites.emptySubtitle")}</p>
        </div>
      ) : (
        <div className="pt-4">
          <ProductList filterTypeStyle={productVerticalListStyle} isHorizontal={false} products={favorites} />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
