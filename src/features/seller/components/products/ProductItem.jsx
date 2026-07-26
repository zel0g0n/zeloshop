import React, { memo } from "react";

// Eslatma: bu komponent avval faqat mock-data shakliga (title/brand/isActive)
// mos edi. Lekin Firestore'ga addProduct.js orqali yoziladigan haqiqiy
// mahsulot hujjatida bu maydonlar boshqacha nomlangan (name, category) va
// isActive maydoni umuman yo'q. Shu sabab har ikkala shaklni ham qo'llab-
// quvvatlash uchun fallback qo'shildi — aks holda seller o'z mahsulotlarini
// ochganda "undefined" xatoliklar chiqardi.
const ProductItem = ({ prod }) => {
  const title = prod.title || prod.name || "Nomsiz mahsulot";
  const brand = prod.brand || prod.category || "";
  const isActive = prod.isActive ?? true;
  const price = Number(prod.price) || 0;
  const stock = Number(prod.stock) || 0;
  const sold = Number(prod.sold) || 0;

  return (
    <div
      className={`bg-white p-3 rounded-2xl border transition-all flex items-center justify-between active:bg-slate-50
      ${!isActive ? "opacity-60 bg-slate-50/50" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <img src={prod.image} alt="" className="w-14 h-14 object-cover rounded-xl bg-slate-50 border border-slate-100" />
          {!isActive && (
            <span className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center text-[8px] font-black text-white uppercase">OFF</span>
          )}
        </div>

        <div className="space-y-0.5 max-w-[170px]">
          {brand && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{brand}</span>}
          <h4 className="text-xs font-black text-slate-800 truncate leading-tight">{title}</h4>
          <div className="text-xs font-black text-slate-900">{price.toLocaleString()} so'm</div>

          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${stock <= 3 ? "text-rose-600 bg-rose-50" : "text-slate-500"}`}>
              Stok: {stock} ta
            </span>
            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-sm">
              🔥 {sold} sotildi
            </span>
          </div>
        </div>
      </div>

      <span
        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
          isActive ? "bg-emerald-500 justify-end" : "bg-slate-200 justify-start"
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-white shadow-xs"></span>
      </span>
    </div>
  );
};

export default memo(ProductItem);
