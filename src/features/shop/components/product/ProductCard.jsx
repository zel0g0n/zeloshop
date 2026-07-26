import { useState, memo } from "react";
import { FaHeart, FaRegHeart, FaPlus, FaMinus } from "react-icons/fa";
import { MdOutlineShoppingBag } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom"; 
import { useAddFavorite } from "@/hooks/useAddFavourite.jsx";
import { useAddToCart } from "@/hooks/useAddToCard"; // 🚨 Sening loyihangdagi to'g'ri yo'l

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

const ProductCard = memo(({ product }) => {
  const { id, name, price, oldPrice, image, isNew, type } = product;
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isFavorite, toggleFavorite } = useAddFavorite(product);
  
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

  return (
    <Link to={`/product/${id}`} className="h-[400px] block transform-gpu">
      <motion.article
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="group relative overflow-hidden rounded-[28px] border border-slate-100 bg-slate-50/90 shadow-md transition-all duration-300 active:scale-[0.98]"
      >
        {/* BADGES & LIKES */}
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
          {isNew && (
            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
              YANGI
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleLike}
          className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-75 ${
            isFavorite ? "bg-blue-600 text-white shadow-md" : "bg-white/95 text-slate-400"
          }`}
        >
          {isFavorite ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
        </button>

        <div className="relative aspect-[4/5] w-full overflow-hidden h-[250px] rounded-b-[20px] bg-slate-200">
          {!imageLoaded && <div className="absolute inset-0 bg-slate-200" />} 
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-transform duration-500 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          />
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-slate-100 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            <span className="text-[10px] font-black tracking-widest text-blue-700 uppercase">{type}</span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="text-[14px] font-bold text-slate-900 mb-1">
            {name.length > 20 ? `${name.substring(0, 15)}...` : name}
          </h3>

          <div className="flex flex-col gap-2 justify-between">
            <div className="w-full">
              <span className="text-[20px] font-black tracking-tighter mr-4 text-blue-700">{priceFormatter.format(price)}</span>
              {oldPrice && <span className="text-[14px] font-medium text-slate-400 line-through decoration-red-400/40">{priceFormatter.format(oldPrice)}</span>}
            </div>

            
            <div className="h-12 w-full relative">
              <AnimatePresence mode="wait">
                {isInCart ? (
                  // SAVATDA TOVAR BOR BO'LSA: ILOMINGIZ DIZAYNIGA MOS MINIMALIST COUNTER
                  <motion.div
                    key="counter"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-full w-full items-center justify-between rounded-2xl bg-slate-100/80 border border-slate-200/50 p-1.5"
                  >
                    <button
                      type="button"
                      onClick={handleMinusClick}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm active:scale-90 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      <FaMinus size={10} />
                    </button>
                    
                    <div className="flex flex-col items-center justify-center flex-1">
                      <span className="text-sm font-black text-slate-800 tracking-tight leading-none">
                        {quantity} ta
                      </span>
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                        Savatda
                      </span>
                    </div>
                    
                    {/* PLYUS TUGMASI */}
                    <button
                      type="button"
                      onClick={handlePlusClick}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/10 active:scale-90 hover:bg-blue-700 transition-all cursor-pointer"
                    >
                      <FaPlus size={10} />
                    </button>
                  </motion.div>
                ) : (
                  // SAVATDA TOVAR YO'Q BO'LSA: ODDIY "SAVATGA" TUGMASI
                  <motion.button
                    key="add-button"
                    type="button"
                    onClick={handleAddToCartClick}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-[0_10px_25px_rgba(37,99,235,0.25)] active:scale-95 transition-all cursor-pointer"
                  >
                    <MdOutlineShoppingBag size={20} className="mr-2" />
                    <span>Savatga</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>


          </div>
        </div>
      </motion.article>
    </Link>
  );
});

ProductCard.displayName = "ProductCard";
export default memo(ProductCard);
