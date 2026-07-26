const ProductItem = ({ prod}) => {
  return (
    <div>
      <div 
        key={prod.id} 
        // onClick={() => openQuickEdit(prod)} // WOW EFFECT: Tezkor tahrirlash oynasini ochadi
        className={`bg-white p-3 rounded-2xl border transition-all flex items-center justify-between active:bg-slate-50 cursor-pointer 
        ${!prod.isActive ? "opacity-60 bg-slate-50/50" : ""}`}
      >
        <div className="flex items-center gap-3">
          {/* Rasm va uning ustidagi kichik ko'rsatkich */}
          <div className="relative">
            <img src={prod.image} alt="" className="w-14 h-14 object-cover rounded-xl bg-slate-50 border border-slate-100" />
            {!prod.isActive && (
              <span className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center text-[8px] font-black text-white uppercase">OFF</span>
            )}
          </div>
          
          <div className="space-y-0.5 max-w-[170px]">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{prod.brand}</span>
            <h4 className="text-xs font-black text-slate-800 truncate leading-tight">{prod.title}</h4>
            <div className="text-xs font-black text-slate-900">{prod.price.toLocaleString()} so'm</div>
            
            {/* WOW EFFECT 4: Analitika va zaxira indikatori */}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm `}>
                Stok: {prod.stock} ta
              </span>
              <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-sm">
                🔥 {prod.sold} sotildi
              </span>
            </div>
          </div>
        </div>

        {/* iOS Style Switch Active Controller */}
        <button
          // onClick={(e) => handleToggleActive(prod.id, e)}
          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
            prod.isActive ? "bg-emerald-500 justify-end" : "bg-slate-200 justify-start"
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white shadow-xs"></span>
        </button>

      </div>
    </div>
  )
}

export default ProductItem