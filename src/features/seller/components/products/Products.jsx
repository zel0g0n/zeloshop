import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PackageSearch } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import updateProduct from "@/services/products/updateProduct";
import deleteProduct from "@/services/products/deleteProduct";
import duplicateProduct from "@/services/products/duplicateProduct";
import bulkUpdateProducts from "@/services/products/bulkUpdateProducts";
import ProductsHeader from "./ProductsHeader";
import ProductsCategoryTabs from "./ProductsCategoryTabs";
import ProductsStatusTabs from "./ProductsStatusTabs";
import ProductsList from "./ProductsList";
import BulkActionBar from "./BulkActionBar";
import ProductsSkeleton from "./ProductsSkeleton";
import StatusModal from "@/components/ui/StatusModal";

const Products = () => {
  const { sellerId } = useSession();
  const navigate = useNavigate();
  const { products: sellerProducts = [], loading, error } = useGetProductsData(sellerId);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Barchasi");
  const [selectedCategory, setSelectedCategory] = useState("Barchasi");
  const [sortBy, setSortBy] = useState("none");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const isLoading = loading;

  const inventoryValue = useMemo(
    () => sellerProducts.reduce((sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0), 0),
    [sellerProducts]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = sellerProducts.filter((prod) => {
      const name = (prod.title || prod.name || "").toLowerCase();
      const brand = (prod.brand || prod.category || "").toLowerCase();
      const matchesSearch = !query || name.includes(query) || brand.includes(query);
      const matchesCategory = selectedCategory === "Barchasi" || prod.category === selectedCategory;

      const isActive = prod.isActive ?? true;
      let matchesTab = true;
      if (activeTab === "Faol") matchesTab = isActive;
      if (activeTab === "Nofaol") matchesTab = !isActive;
      if (activeTab === "KamQolgan") matchesTab = Number(prod.stock) <= 3;

      return matchesSearch && matchesCategory && matchesTab;
    });

    if (sortBy !== "none") {
      const [field, dir] = sortBy.split("-");
      result = [...result].sort((a, b) => {
        const diff = (Number(a[field]) || 0) - (Number(b[field]) || 0);
        return dir === "desc" ? -diff : diff;
      });
    }

    return result;
  }, [sellerProducts, searchQuery, selectedCategory, activeTab, sortBy]);

  const handleEditProduct = useCallback((product) => {
    navigate(`/seller/products/${product.id}/edit`);
  }, [navigate]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(async (id, nextActive) => {
    try {
      await updateProduct(id, { isActive: nextActive });
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleInlineUpdate = useCallback(async (id, fields) => {
    try {
      await updateProduct(id, fields);
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleDeleteProduct = useCallback(async (id) => {
    try {
      await deleteProduct(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleDuplicateProduct = useCallback(async (id) => {
    try {
      await duplicateProduct(id, sellerId);
    } catch (err) {
      setActionError(err.message);
    }
  }, []);

  const handleBulkAction = useCallback(async (action) => {
    setBulkBusy(true);
    try {
      await bulkUpdateProducts(Array.from(selectedIds), action);
      setSelectedIds(new Set());
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds]);

  const activeCount = useMemo(() => sellerProducts.filter((p) => p.isActive ?? true).length, [sellerProducts]);
  const inactiveCount = sellerProducts.length - activeCount;
  const lowStockCount = useMemo(() => sellerProducts.filter((p) => Number(p.stock) <= 3).length, [sellerProducts]);

  return (
    <div className="h-screen flex flex-col bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      <div className="shrink-0 z-40 sticky top-0">
        <ProductsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          productsCount={sellerProducts.length}
          inventoryValue={inventoryValue}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
        <ProductsCategoryTabs selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        <ProductsStatusTabs
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          allCount={sellerProducts.length}
          activeCount={activeCount}
          inactiveCount={inactiveCount}
          lowStockCount={lowStockCount}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-2.5">
        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            busy={bulkBusy}
            onCancel={() => setSelectedIds(new Set())}
            onActivate={() => handleBulkAction("activate")}
            onDeactivate={() => handleBulkAction("deactivate")}
            onDelete={() => handleBulkAction("delete")}
          />
        )}

        {isLoading && <ProductsSkeleton />}
        {error && <div className="text-center py-20 text-rose-500 dark:text-rose-400 text-xs font-medium">Xatolik: {error}</div>}

        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <PackageSearch size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">Mahsulot topilmadi</p>
            <button
              onClick={() => navigate("/seller/add-product")}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Plus size={14} /> Yangi tovar qo'shish
            </button>
          </div>
        )}

        {!isLoading && !error && filteredProducts.length > 0 && (
          <ProductsList
            products={filteredProducts}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onEditProduct={handleEditProduct}
            onDuplicate={handleDuplicateProduct}
            onToggleActive={handleToggleActive}
            onDelete={handleDeleteProduct}
            onInlineUpdate={handleInlineUpdate}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate("/seller/add-product")}
        className="fixed bottom-24 right-4 z-30 h-12 pl-4 pr-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-xl shadow-indigo-600/40 flex items-center gap-2 text-sm font-bold active:scale-95 transition-transform"
      >
        <Plus size={18} /> Yangi Tovar
      </button>

      {actionError && (
        <StatusModal
          variant="error"
          title="Xatolik yuz berdi"
          message={actionError}
          onClose={() => setActionError(null)}
        />
      )}
    </div>
  );
};

export default Products;
