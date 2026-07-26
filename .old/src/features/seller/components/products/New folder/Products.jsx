import React, { useState } from "react";
import { useFilterProducts } from "@/hooks/useFilterPriduct";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import useGetOrdersData from '@/hooks/seller/useFilterOrders';
import ProductsList from "./ProductsList";

 // Kengaytirilgan professional mock-ma'lumotlar
const INITIAL_PRODUCTS = [
  {
    id: 1,
    title: "Vitamin C Serum Premium",
    brand: "Zelo Skin",
    category: "Skincare",
    price: 150000,
    stock: 25,
    sold: 142,
    isActive: true,
    image: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=200&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "Hydrating Face Cream Duo",
    brand: "Laneige",
    category: "Skincare",
    price: 120000,
    stock: 2, // Low stock alert beradi
    sold: 98,
    isActive: true,
    image: "https://images.unsplash.com/photo-1608248597481-496100c80836?q=80&w=200&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Matte Liquid Lipstick Nude",
    brand: "YSL Beauty",
    category: "Makeup",
    price: 80000,
    stock: 50,
    sold: 210,
    isActive: true,
    image: "https://images.unsplash.com/photo-1586495777744-4413f21062fa?q=80&w=200&auto=format&fit=crop"
  },
  {
    id: 4,
    title: "Professional Brush Set Pro",
    brand: "Shiseido",
    category: "Tools",
    price: 200000,
    stock: 1, // Low stock alert beradi
    sold: 45,
    isActive: false, // Nofaol holatda
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=200&auto=format&fit=crop"
  },
  {
    id: 5,
    title: "Black Opium Luxury EDP",
    brand: "YSL",
    category: "Perfume",
    price: 350000,
    stock: 12,
    sold: 315,
    isActive: true,
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=200&auto=format&fit=crop"
  }
];

// Mavjud barcha ruknlar (Karusel uchun)
const CATEGORIES = ["Barchasi", "Skincare", "Makeup", "Perfume", "Tools"];

const Products = () => {
  const sellerID = 'yGsq7Cmn2C3IF103gtGm';
  const allProducts = useFilterProducts().filteredProducts; 
  const sellersProducts = useGetProductsData(sellerID);
   // Kelajakda auth-dan olinadi
  const { orders = [], loading, error, ordersCounter } = useGetOrdersData(sellerID);
  console.log("Sotuvchining mahsulotlari:", sellersProducts.products);
  console.log("Buyurtmalar ro'yxati", orders)
  console.log("Redux-dan olingan mahsulotlar:", allProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Barchasi"); // Barchasi, Faol, Nofaol
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [onlyLowStock, setOnlyLowStock] = useState(false); // Kam qolganlarni filtrlash switchi

  const [editingProduct, setEditingProduct] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  // 1. Aktivlikni o'zgartirish (Toggle)
  const handleToggleActive = (id, e) => {
    e.stopPropagation(); // Buton bosilganda kartaning umumiy klik hodisasi (Quick Edit) ishlab ketmasligi uchun
  };

  // 2. Tezkor tahrirlash oynasini ochish
  const openQuickEdit = (product) => {
    setEditingProduct(product);
    setEditPrice(product.price);
    setEditStock(product.stock);
  };

  // 3. Tezkor tahrirlangan ma'lumotni saqlash
  const handleSaveQuickEdit = () => {
    
    setEditingProduct(null);
  };

  // 4. Hisoblagichlar (Badge counters)
  const countLowStock = allProducts.filter(p => p.stock <= 3).length;

  // 5. MUKAMMAL MULTI-FILTRATSIYA MANTIQI
  const filteredProducts = allProducts.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Barchasi" || prod.category === selectedCategory;
    const matchesLowStock = !onlyLowStock || prod.stock <= 3;
    
    let matchesTab = true;
    if (activeTab === "Faol") matchesTab = prod.isActive;
    if (activeTab === "Nofaol") matchesTab = !prod.isActive;

    return matchesSearch && matchesCategory && matchesLowStock && matchesTab;
  });

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased relative">
      

      <div className="bg-white px-4 pt-4 pb-3 sticky top-0 z-30 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">Katalog boshqaruvi</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ombor qoldig'i real-time</p>
          </div>
          
          {/* Smart Alert Widget: Omborda yuk tugayotgan bo'lsa sarg'ish signal beradi */}
          {countLowStock > 0 && (
            <button 
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className={`flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full transition-all border ${
                onlyLowStock 
                  ? "bg-rose-500 text-white border-rose-600 animate-none" 
                  : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
              }`}
            >
              ⚠️ {countLowStock} ta tugamoqda
            </button>
          )}
        </div>

        {/* Qidiruv inputi */}
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Nomi yoki brendi bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 bg-[#F4F5F9] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ==========================================
          WOW EFFECT 1: GORIZONTAL KATEGORIYALAR (CAROUSEL)
         ========================================== */}
      <div className="px-4 mt-3 flex gap-2 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-105"
                : "bg-white text-slate-400 border border-slate-100"
            }`}
          >
            {cat === "Barchasi" ? "📦 Barchasi" : cat}
          </button>
        ))}
      </div>

      {/* ==========================================
          STATUS TABLARI: FAOL / NOFAOL
         ========================================== */}
      <div className="px-4 mt-3 flex items-center gap-1.5 text-[11px] font-bold">
        <button
          onClick={() => { setActiveTab("Barchasi"); setOnlyLowStock(false); }}
          className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Barchasi" && !onlyLowStock ? "bg-white text-indigo-600 shadow-xs border border-indigo-100" : "text-slate-400"}`}
        >
          Hammasi ({allProducts.length})
        </button>
        <span className="text-slate-200">|</span>
        <button
          onClick={() => { setActiveTab("Faol"); setOnlyLowStock(false); }}
          className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Faol" ? "bg-white text-emerald-600 shadow-xs border border-emerald-100" : "text-slate-400"}`}
        >
          Faol ({allProducts.filter(p=>p.isActive).length})
        </button>
        <span className="text-slate-200">|</span>
        <button
          onClick={() => { setActiveTab("Nofaol"); setOnlyLowStock(false); }}
          className={`px-3 py-1 rounded-lg transition-all ${activeTab === "Nofaol" ? "bg-white text-rose-600 shadow-xs border border-rose-100" : "text-slate-400"}`}
        >
          Nofaol ({allProducts.filter(p=>!p.isActive).length})
        </button>
      </div>

      {/* ==========================================
          MAHSULOTLAR LISTI (BENTO STYLE KARTALAR)
         ========================================== */}
      <div className="p-4 space-y-2.5 pb-40">
        <ProductsList/>
      </div>

      {/* ==========================================
          WOW EFFECT 3: QUICK EDIT INLINE BOTTOM SHEET
         ========================================== */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-end justify-center animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[28px] p-5 space-y-4 shadow-xl border-t border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tezkor tahrirlash</span>
                <h3 className="font-black text-sm text-slate-800 truncate max-w-[28px]:">{editingProduct.title}</h3>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                className="w-7 h-7 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Narxni o'zgartirish inputi */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Mahsulot narxi (so'm)</label>
              <input 
                type="number" 
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Qoldiq miqdorini o'zgartirish inputi */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Ombor qoldig'i (Stok)</label>
              <input 
                type="number" 
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
                className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Amallar tugmasi */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button 
                onClick={() => setEditingProduct(null)}
                className="h-11 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
              >
                Bekor qilish
              </button>
              <button 
                onClick={handleSaveQuickEdit}
                className="h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/10"
              >
                Yangilash ✨
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          FIXED FLOATING BUTTON: MAHSULOT QO'SHISH
         ========================================== */}
      <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
        <button className="w-full h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <span>+ Yangi mahsulot qo'shish</span>
        </button>
      </div>

    </div>
  );
};

export default Products;