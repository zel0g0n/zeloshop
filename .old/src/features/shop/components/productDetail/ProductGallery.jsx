import { useNavigate } from "react-router-dom";
import { useAddFavorite } from "@/hooks/useAddFavourite";
import {
  IoArrowBack,
  FaRegHeart,
} from "@/constants/icons";



export const ProductGallery = ({ image, product }) => {
  const { isFavorite, toggleFavorite } = useAddFavorite(product);
  
  let navigate = useNavigate();
  
  return (
    <section className="relative">
      
      <div className="relative h-[430px] overflow-hidden rounded-b-[42px] bg-gradient-to-br from-blue-100 to-slate-100 shadow-[0_15px_60px_rgba(37,99,235,0.18)]">
        
        <img
          src={image}
          alt="product"
          className="h-full w-full object-cover transition-all duration-500"

        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

        <div className="absolute left-0 top-0 z-30 flex w-full items-center justify-between px-5 pt-6">
          
          <div
            onClick={() => navigate(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/20 text-white backdrop-blur-xl"
          >
            <IoArrowBack className="text-[22px]" />
          </div>

          <button
            type="button"
            onClick={toggleFavorite}
            className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-75 ${
              isFavorite ? "bg-blue-600 text-white shadow-md" : "bg-white/95 text-slate-400"
          }`}
          >
            <FaRegHeart className="text-[20px]" />
          </button>
        </div>

      </div>
    </section>
  );
};
