import React, { useState, useMemo, useCallback } from "react";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import updateProductFields from "./updateProductFields";
import { CATEGORIES, LOW_STOCK_THRESHOLD } from "./catalog.js";

import CatalogHeader from "@/features/seller/components/products/CatalogHeader";
import CategoryCarousel from "@/features/seller/components/products/CategoryCarousel";
import StatusTabs from "@/features/seller/components/products/StatusTabs";
import ProductsList from "@/features/seller/components/products/ProductsList";
import QuickEditSheet from "@/features/seller/components/products/QuickEditSheet";
import AddProductFab from "@/features/seller/components/products/AddProductFab";

const SellerProductsPage = ({ sellerID, onAddProduct }) => {
  const { products = [], loading, error } = useGetProductsData(sellerID);

  // Filtrlar
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Barchasi");
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Tahrirlash va Harakatlar State'i
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Handlers
  const handleSelectTab = useCallback((tab) => {
    setActiveTab(tab);
    setOnlyLowStock(false);
  }, []);

  const handleToggleLowStockFilter = useCallback(() => {
    setOnlyLowStock((prev) => !prev);
  }, []);

  const openQuickEdit = useCallback((product) => {
    setEditingProduct(product);
  }, []);

  const closeQuickEdit = useCallback(() => {
    if (savingEdit) return;
    setEditingProduct(null);
  }, [savingEdit]);

  // Tezkor tahrirlashni saqlash (Validatsiya bilan)
  const handleSaveQuickEdit = useCallback(async ({ price, stock }) => {
    if (!editingProduct) return;

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (isNaN(numericPrice) || numericPrice < 0 || isNaN(numericStock) || numericStock < 0) {
      console.warn("Noto'g'ri narx yoki ombor miqdori!");
      return;
    }

    setSavingEdit(true);
    try {
      await updateProductFields(editingProduct.id, {
        price: numericPrice,
        stock: numericStock,
      });
      setEditingProduct(null);
    } catch (err) {
      console.error("Mahsulotni yangilashda xatolik:", err);
    } finally {
      setSavingEdit(false);
    }
  }, [editingProduct]);

  // Active statusini almashtirish
  const handleToggleActive = useCallback(async (product) => {
    setTogglingId(product.id);
    try {
      await updateProductFields(product.id, { isActive: !product.isActive });
    } catch (err) {
      console.error("Statusni almashtirishda xatolik:", err);
    } finally {
      setTogglingId(null);
    }
  }, []);

  // Metrikalar va Filtrlangan ro'yxatni bir martada hisoblash
  const { filteredProducts, countLowStock, activeCount, inactiveCount } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let lowStockCount = 0;
    let activeC = 0;

    const filtered = products.filter((prod) => {
      const isActive = prod.isActive !== false;
      const isLowStock = prod.stock <= LOW_STOCK_THRESHOLD;

      if (isLowStock) lowStockCount++;
      if (isActive) activeC++;

      const name = (prod.title || prod.name || "").toLowerCase();
      const brand = (prod.brand || "").toLowerCase();
      
      const matchesSearch = !query || name.includes(query) || brand.includes(query);
      const matchesCategory = selectedCategory === "Barchasi" || prod.category === selectedCategory;
      const matchesLowStock = !onlyLowStock || isLowStock;

      let matchesTab = true;
      if (activeTab === "Faol") matchesTab = isActive;
      if (activeTab === "Nofaol") matchesTab = !isActive;

      return matchesSearch && matchesCategory && matchesLowStock && matchesTab;
    });

    return {
      filteredProducts: filtered,
      countLowStock: lowStockCount,
      activeCount: activeC,
      inactiveCount: products.length - activeC,
    };
  }, [products, searchQuery, selectedCategory, onlyLowStock, activeTab]);

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased relative">
      <CatalogHeader
        countLowStock={countLowStock}
        onlyLowStock={onlyLowStock}
        onToggleLowStock={handleToggleLowStockFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <CategoryCarousel
        categories={CATEGORIES}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <StatusTabs
        activeTab={activeTab}
        onlyLowStock={onlyLowStock}
        onSelectTab={handleSelectTab}
        totalCount={products.length}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
      />

      <div className="p-4 space-y-2.5 pb-40">
        {loading && <div className="text-center py-20 text-slate-400 text-xs font-semibold">Yuklanmoqda...</div>}
        {!loading && error && <div className="text-center py-20 text-rose-500 text-xs font-semibold">Xatolik: {error}</div>}
        {!loading && !error && (
          <ProductsList
            products={filteredProducts}
            togglingId={togglingId}
            onQuickEdit={openQuickEdit}
            onToggleActive={handleToggleActive}
          />
        )}
      </div>

      {editingProduct && (
        <QuickEditSheet
          product={editingProduct}
          saving={savingEdit}
          onCancel={closeQuickEdit}
          onSave={handleSaveQuickEdit}
        />
      )}

      <AddProductFab onClick={onAddProduct} />
    </div>
  );
};

export default SellerProductsPage;