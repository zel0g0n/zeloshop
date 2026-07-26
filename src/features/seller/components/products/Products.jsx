import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import ProductsHeader from "./ProductsHeader";
import ProductsCategoryTabs from "./ProductsCategoryTabs";
import ProductsStatusTabs from "./ProductsStatusTabs";
import ProductsList from "./ProductsList";
import QuickEditSheet from "./QuickEditSheet";

// OLDIN: bu sahifa `useFilterProducts()` (barcha sotuvchilarning umumiy
// mahsulot ro'yxati, shop-side Redux slice) dan foydalangan va sotuvchining
// haqiqiy mahsulotlarini olib keluvchi `useGetProductsData(sellerID)` esa
// faqat console.log uchun chaqirilgan — ya'ni real-time listener ochilgan,
// lekin natijasi ekranga chiqarilmagan. Bundan tashqari sahifa yana
// `useGetOrdersData(sellerID)` orqali BUYURTMALARNI ham (foydasiz) real-time
// tinglagan. Natijada: (1) sotuvchi boshqa sotuvchilarning mahsulotlarini
// ko'rardi, (2) sahifa 2 ta keraksiz Firestore real-time listener ochardi.
//
// ENDI: faqat shu sotuvchiga tegishli mahsulotlar (Firestore darajasida
// `where("sellerId","==",...)` bilan filtrlangan) ishlatiladi, ortiqcha
// listener olib tashlandi.
const Products = () => {
  const { sellerId } = useSession();
  const { products: sellerProducts = [], loading, error } = useGetProductsData(sellerId);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Barchasi");
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const countLowStock = useMemo(
    () => sellerProducts.filter((p) => Number(p.stock) <= 3).length,
    [sellerProducts]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sellerProducts.filter((prod) => {
      const name = (prod.title || prod.name || "").toLowerCase();
      const brand = (prod.brand || prod.category || "").toLowerCase();
      const matchesSearch = !query || name.includes(query) || brand.includes(query);
      const matchesCategory = selectedCategory === "Barchasi" || prod.category === selectedCategory;
      const matchesLowStock = !onlyLowStock || Number(prod.stock) <= 3;

      const isActive = prod.isActive ?? true;
      let matchesTab = true;
      if (activeTab === "Faol") matchesTab = isActive;
      if (activeTab === "Nofaol") matchesTab = !isActive;

      return matchesSearch && matchesCategory && matchesLowStock && matchesTab;
    });
  }, [sellerProducts, searchQuery, selectedCategory, onlyLowStock, activeTab]);

  const handleToggleLowStock = useCallback(() => setOnlyLowStock((v) => !v), []);
  const handleChangeStatusTab = useCallback((tab) => {
    setActiveTab(tab);
    setOnlyLowStock(false);
  }, []);

  const activeCount = useMemo(() => sellerProducts.filter((p) => p.isActive ?? true).length, [sellerProducts]);
  const inactiveCount = sellerProducts.length - activeCount;

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased relative">
      <ProductsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        countLowStock={countLowStock}
        onlyLowStock={onlyLowStock}
        onToggleLowStock={handleToggleLowStock}
      />

      <ProductsCategoryTabs selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />

      <ProductsStatusTabs
        activeTab={activeTab}
        onChangeTab={handleChangeStatusTab}
        allCount={sellerProducts.length}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
      />

      <div className="p-4 space-y-2.5 pb-40">
        {loading && <div className="text-center py-20 text-slate-400 text-xs animate-pulse">Yuklanmoqda...</div>}
        {error && <div className="text-center py-20 text-rose-500 text-xs font-medium">Xatolik: {error}</div>}
        {!loading && !error && (
          <ProductsList products={filteredProducts} onEditProduct={setEditingProduct} />
        )}
      </div>

      {editingProduct && (
        <QuickEditSheet product={editingProduct} onClose={() => setEditingProduct(null)} />
      )}

      <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
        <Link
          to="/seller/add-product"
          className="w-full h-11 bg-[#5346E0] text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <span>+ Yangi mahsulot qo'shish</span>
        </Link>
      </div>
    </div>
  );
};

export default Products;
