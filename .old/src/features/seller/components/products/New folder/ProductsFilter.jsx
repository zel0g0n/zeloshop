import { useState } from 'react';
import { useSelector } from 'react-redux';
const CATEGORIES = ["Barchasi", "Skincare", "Makeup", "Perfume", "Tools"];

const ProductsFilter = () => {
  const allProducts = useSelector(state => state.sellerProductsList.products);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Barchasi"); // Barchasi, Faol, Nofaol
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [onlyLowStock, setOnlyLowStock] = useState(false); // Kam qolganlarni filtrlash switchi

  const [editingProduct, setEditingProduct] = useState(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  return (
    <div>
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
    </div>
  )
}

export default ProductsFilter