import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, PackageSearch, Sparkles } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import useGetProductsData from "@/hooks/seller/useGetSellerProducts";
import { useProductDrafts } from "@/hooks/seller/useProductDrafts";
import updateProduct from "@/services/products/updateProduct";
import deleteProduct from "@/services/products/deleteProduct";
import duplicateProduct from "@/services/products/duplicateProduct";
import bulkUpdateProducts from "@/services/products/bulkUpdateProducts";
import { filterAndSortProducts, computeStatusCounts, computeInventoryValue } from "@/utils/productFilters";
import ProductsHeader from "./ProductsHeader";
import ProductsFilterBar from "./ProductsFilterBar";
import ProductsList from "./ProductsList";
import BulkActionBar from "./BulkActionBar";
import ProductsSkeleton from "./ProductsSkeleton";
import StatusModal from "@/components/ui/StatusModal";

// KATALOG BOSHQARUVI — Senior Level Inventory Management.
//
// MUHIM: rang kombinatsiyasi loyihaning BOSHQA barcha sahifalari
// bilan BIR XIL (theme-aware) — pure-dark emas, foydalanuvchining
// aniq talabiga ko'ra.
//
// OLDIN: status va kategoriya filtrlari IKKI ALOHIDA qatorda edi,
// faol chip esa deyarli oq/xira ko'rinardi. Endi — BITTA birlashgan
// qator, faol chip HAR DOIM to'liq indigo (`ProductsFilterBar.jsx`).
//
// PERFORMANCE: filtrlash/saralash mantig'i sof funksiyaga
// (`utils/productFilters.js`) ajratilgan — bu, ham sinov (test)
// yozishni osonlashtiradi, ham `useMemo` orqali keraksiz qayta
// hisoblashlarning oldini oladi (faqat bog'liqliklar o'zgarganda
// qayta ishlaydi).
const Products = () => {
  const { sellerId, store } = useSession();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { products: sellerProducts = [], loading, error, hasMore, loadMore } = useGetProductsData(sellerId);
  const isAiCeoEnabled = store?.aiCeoEnabled === true;
  // MUHIM: bu hook FAQAT `aiCeoEnabled` sotuvchilar uchun ma'noli -
  // lekin React Hook qoidalariga ko'ra shartli chaqirilmasligi kerak,
  // shuning uchun har doim chaqiriladi, faqat `sellerId` o'rniga
  // `isAiCeoEnabled ? sellerId : null` beriladi - natijada hook
  // ICHKARIDA darhol chiqib ketadi, HECH QANDAY Firestore tinglovchisi
  // ochilmaydi (xarajat nolga teng, boshqa sotuvchilar uchun).
  const { readyForReview } = useProductDrafts(isAiCeoEnabled ? sellerId : null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Barchasi");
  const [categoryFilter, setCategoryFilter] = useState("Barchasi");
  const [sortBy, setSortBy] = useState("none");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const inventoryValue = useMemo(() => computeInventoryValue(sellerProducts), [sellerProducts]);
  const statusCounts = useMemo(() => computeStatusCounts(sellerProducts), [sellerProducts]);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(sellerProducts, { searchQuery, statusFilter, categoryFilter, sortBy }),
    [sellerProducts, searchQuery, statusFilter, categoryFilter, sortBy]
  );

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
  }, [sellerId]);

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
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
        <ProductsFilterBar
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          statusCounts={statusCounts}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-36">
        {/* MUHIM: "Tez qo'shish" (rasm+izoh yuklab AI navbatiga qo'yish)
            kirish nuqtasi bu yerdan olib tashlandi va "Yangi mahsulot"
            sahifasiga ko'chirildi (`AddProductPage.jsx`dagi
            `QuickAddAICard`) - foydalanuvchi so'roviga ko'ra. Bu banner
            endi FAQAT AI allaqachon tayyorlagan qoralamalarni
            ko'rib chiqishga (tasdiqlash ekraniga) taklif qiladi -
            tayyor qoralama yo'q bo'lsa, umuman ko'rinmaydi. */}
        {isAiCeoEnabled && readyForReview.length > 0 && (
          <button
            type="button"
            onClick={() => navigate("/seller/products/drafts")}
            className="w-full mb-4 flex items-center gap-3 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-3.5 text-white shadow-sm active:scale-[0.99] transition-transform"
          >
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </span>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-black">
                {t("productDraftReview.bannerReadyTitle", { count: readyForReview.length })}
              </p>
              <p className="text-[10px] font-medium text-white/70 mt-0.5">
                {t("productDraftReview.bannerReadySubtitle")}
              </p>
            </div>
          </button>
        )}

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

        {loading && <ProductsSkeleton />}
        {error && <div className="text-center py-20 text-rose-500 dark:text-rose-400 text-xs font-medium">{t("sellerProducts.error")} {error}</div>}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <PackageSearch size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">{t("sellerProducts.notFound")}</p>
            <button
              onClick={() => navigate("/seller/add-product")}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 rounded-xl flex items-center gap-1.5"
            >
              <Plus size={14} /> {t("sellerProducts.addNew")}
            </button>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
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

        {!loading && !error && hasMore && (
          <button
            type="button"
            onClick={loadMore}
            className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-2xl active:scale-95 transition-transform"
          >
            {t("sellerProducts.loadMore")}
          </button>
        )}

        {/* MUHIM: bu tugma OLDIN `position: fixed` orqali ekranga
            "yopishtirilgan" edi — bu, pastki Navbar bilan ustma-ust
            tushib qolardi. Endi — oddiy, ro'yxat oqimidagi element,
            ro'yxat oxirida tabiiy ko'rinadi. */}
        {!loading && !error && filteredProducts.length > 0 && (
          <button
            type="button"
            onClick={() => navigate("/seller/add-product")}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/40 flex items-center justify-center gap-2 text-sm font-semibold active:scale-95 transition-transform"
          >
            <Plus size={18} /> {t("sellerProducts.createNew")}
          </button>
        )}
      </div>

      {actionError && (
        <StatusModal
          variant="error"
          title={t("sellerProducts.errorTitle")}
          message={actionError}
          onClose={() => setActionError(null)}
        />
      )}
    </div>
  );
};

export default Products;
