import { useState, memo } from "react";
import { Share2, Star, Heart, Plus, Minus, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useAddFavorite } from "@/hooks/useAddFavourite.jsx";
import { useAddToCart } from "@/hooks/useAddToCard";
import { useSession } from "@/context/SessionContext";
import { shareProductAsPost, PRODUCT_SHARE_BUTTON_ENABLED } from "@/utils/shareProductAsPost";
import { useLanguage } from "@/context/LanguageContext";
import { isDiscountActive } from "@/utils/productPricing";
import { isRecentlyAdded } from "@/utils/productFreshness";


// Butun ilova (checkout, mahsulot sahifasi, sotuvchi paneli) narxlarni
// "so'm" birligida ko'rsatadi, shuning uchun mahsulot kartochkalari
// ham shu formatga mos bo'lishi kerak.
const formatPrice = (value) => `${(Number(value) || 0).toLocaleString()} so'm`;

// Sarlavha uzunligi kartochka balandligiga ta'sir qilmasligi uchun,
// nom matnining o'zi JavaScript darajasida qat'iy belgilar soniga
// kesiladi (ellipsis bilan), CSS `line-clamp` ga to'liq tayanish
// o'rniga. Bu yondashuv CSS qanday render qilinishidan mustaqil —
// kesilgan matn har doim bir xil maksimal uzunlikda, demak bir xil
// balandlikda bo'ladi.
const MAX_NAME_LENGTH = 28;
const truncateName = (name) => {
  if (!name || name.length <= MAX_NAME_LENGTH) return name;
  return `${name.slice(0, MAX_NAME_LENGTH).trimEnd()}…`;
};


const ProductCard = ({ product }) => {
  const { t } = useLanguage();
  const { id, name, price, discountPrice, image, createdAt, averageRating, reviewCount } = product;
  const displayName = truncateName(name);
  // HAQIQIY sharh reytingi (`functions/reviews.js`dagi trigger orqali
  // hisoblanadi) - kamida bitta sharh bo'lmasa ko'rsatilmaydi (0.0
  // ko'rsatish "hech kim sharh qoldirmagan"dek emas, "past baholangan"
  // taassurot qoldiradi, bu noto'g'ri).
  const hasRating = Number(reviewCount) > 0 && Number(averageRating) > 0;
  // MUHIM ("vaqtli aksiya"): sotuvchi chegirmaga muddat qo'ygan
  // bo'lishi mumkin (`CreatePromotionPage.jsx`) - muddati o'tgan
  // chegirma bu yerda ENDI ko'rsatilmaydi (batafsil izoh -
  // `utils/productPricing.js`dagi `isDiscountActive`).
  const hasActiveDiscount = isDiscountActive(product);
  // MUHIM (2026-09 dizayn tuzatishi): "YANGI" belgisi ENDI
  // `product.isNew` STATIK bayrog'idan EMAS, `createdAt`dan REAL
  // VAQTDA hisoblanadi — mahsulot qo'shilganiga 48 soatdan kam vaqt
  // o'tgan bo'lsagina ko'rsatiladi, aks holda o'z-o'zidan yo'qoladi
  // (batafsil izoh: `utils/productFreshness.js`).
  const isNew = isRecentlyAdded(createdAt);
  // MUHIM (2026-09 dizayn tuzatishi): "kam qoldi"/"bugun sotildi"/
  // "N+ marta sotilgan" belgilari kartochkadan OLIB TASHLANDI — bu
  // ma'lumot endi mahsulot SAHIFASIDA (`ProductInfo.jsx`) ko'rsatiladi,
  // kartochka esa faqat "YANGI" belgisini saqlab qoladi.
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { isFavorite, toggleFavorite } = useAddFavorite(product);
  const { sellerId } = useSession();

  const { isInCart, quantity, toggleCart, incrementQuantity, decrementQuantity } = useAddToCart(product);


  const handleAddToCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCart();
  };


  const handlePlusClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    incrementQuantity(); // Hook ichidagi dispatch ishlaydi
  };


  const handleMinusClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    decrementQuantity(); // Hook ichidagi dispatch ishlaydi
  };


  const handleLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite();
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Rasm+matn "post" ko'rinishida ulashiladi (mumkin bo'lganda) -
    // batafsil izoh: `shareProductAsPost.js`.
    await shareProductAsPost(product, sellerId);
  };


  return (
    <Link to={`/product/${id}`} className="w-full block transform-gpu">
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        // Balandlik Tailwind'ning "arbitrary value" sinflari o'rniga
        // to'g'ridan-to'g'ri inline style orqali beriladi
        // (`style={{height: ...}}`) - bu brauzerda eng yuqori CSS
        // ustuvorlikka ega va Tailwind qurilish jarayonidagi sinf
        // generatsiyasiga bog'liq emas, shuning uchun balandlik har
        // doim aniq piksel qiymatida bo'ladi. 302px qiymati pastdagi
        // ichki bloklarning yig'indisiga (rasm 180px + p-3 padding
        // 12+12px + sarlavha 18px + mb-1 4px + narx-tugma bloki
        // gap-2 bilan 20+8+48px) aniq mos keladi, shuning uchun
        // hech qanday element kesilib qolmaydi.
        style={{ height: "302px" }}
        className="group relative w-full flex flex-col overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 shadow-md transition-all duration-300 active:scale-[0.98]"
      >
        {/* BADGES & LIKES */}
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
          {isNew && (
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
              {t("productCard.new")}
            </span>
          )}
        </div>

        {/* Mahsulotni ulashish tugmasi bosilganda, qurilma darajasidagi
            "ulashish" oynasi ochiladi (Telegram, Instagram, SMS va h.k.),
            tayyor matn bilan birga. Tugma rasm konteyneri ichida,
            `bottom-3 right-3` bilan joylashgan, shu orqali rasmning
            pastki-o'ng burchagiga aniq mos keladi. */}

        <motion.button
          type="button"
          onClick={handleLike}
          aria-label={isFavorite ? `${name} - ${t("productCard.removeFromWishlist")}` : `${name} - ${t("productCard.addToWishlist")}`}
          whileTap={{ scale: 0.7 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            isFavorite ? "bg-blue-600 text-white shadow-md" : "bg-white/95 dark:bg-slate-800/95 text-slate-400"
          }`}
        >
          <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
        </motion.button>


        <div style={{ height: "180px" }} className="relative w-full rounded-b-xl bg-slate-200 dark:bg-slate-800">
          {!imageLoaded && !imageError && <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse" />}
          {imageError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
              <ShoppingBag size={32} />
            </div>
          ) : (
            <img
              src={image}
              alt={name}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`h-full w-full object-cover transition-transform duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* HAQIQIY sharh reytingi - rasm ustida, pastki-chap
              burchakda (yuqoridagi badge'lar - "yangi"/"kam
              qoldi"/"ko'p sotilgan" - bilan bir joyga to'planib
              qolmasligi uchun, va kartochkaning qat'iy hisoblangan
              balandligiga (`ProductList.jsx`dagi izohga qarang)
              ta'sir qilmasligi uchun - u ham xuddi shu rasm
              konteyneri ichida, `absolute` joylashgan). */}
          {hasRating && (
            <span className="absolute left-3 bottom-3 z-20 flex items-center gap-1 rounded-full bg-white/95 dark:bg-slate-800/95 px-2 py-1 text-[10px] font-black text-slate-700 dark:text-slate-200 shadow-sm">
              <Star size={10} className="text-amber-400" fill="currentColor" />
              {Number(averageRating).toFixed(1)}
            </span>
          )}

          {PRODUCT_SHARE_BUTTON_ENABLED && (
            <button
              type="button"
              onClick={handleShare}
              aria-label={t("productCard.share")}
              className="absolute right-3 bottom-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 dark:bg-slate-800/95 text-slate-500 dark:text-slate-300 shadow-sm active:scale-90 transition-transform"
            >
              <Share2 size={13} />
            </button>
          )}
        </div>


        {/* Bu qism qat'iy (`shrink-0`) balandlikka ega — sarlavha
            `line-clamp-1` bilan doim bitta qatorga cheklangan, narx
            qismi ham doim bitta qatorlik joy oladi (chegirma
            bor-yo'qligidan qat'i nazar) — shu orqali barcha
            kartochkalarning pastki qismi bir xil balandlikda bo'ladi. */}
        <div className="p-3 shrink-0">
          <h3 style={{ height: "18px" }} className="text-[14px] font-bold text-slate-900 dark:text-white mb-1 line-clamp-1 overflow-hidden">
            {displayName}
          </h3>


          <div className="flex flex-col gap-2 justify-between">
            <div style={{ height: "20px" }} className="w-full overflow-hidden">
              <span className="text-[16px] font-black tracking-tighter mr-2 text-blue-700 dark:text-blue-400">
                {formatPrice(hasActiveDiscount ? discountPrice : price)}
              </span>
              {hasActiveDiscount && (
                <span className="text-[13px] font-medium text-slate-400 line-through decoration-red-400/40">{formatPrice(price)}</span>
              )}
            </div>


            <div style={{ height: "48px" }} className="w-full relative">
              <AnimatePresence mode="wait">
                {isInCart ? (
                  <motion.div
                    key="counter"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-full w-full items-center justify-between rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 p-1.5"
                  >
                    <button
                      type="button"
                      onClick={handleMinusClick}
                      aria-label={`${name} - ${t("productCard.decreaseQty")}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm active:scale-90 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Minus size={10} />
                    </button>

                    <div className="flex flex-col items-center justify-center flex-1">
                      <span className="text-sm font-black text-slate-800 dark:text-white tracking-tight leading-none">
                        {quantity} ta
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePlusClick}
                      aria-label={`${name} - ${t("productCard.increaseQty")}`}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/10 active:scale-90 hover:bg-blue-700 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Plus size={10} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add-button"
                    type="button"
                    onClick={handleAddToCartClick}
                    aria-label={`${name} - ${t("productCard.addToCart")}`}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.25)] active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <ShoppingBag size={20} className="mr-2" />
                    <span>{t("productCard.addToCart")}</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
};


ProductCard.displayName = "ProductCard";
export default memo(ProductCard);
