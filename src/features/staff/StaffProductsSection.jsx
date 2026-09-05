import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Package, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffSession } from "@/context/StaffSessionContext";
import getSellerProducts from "@/services/products/getSellerProducts";
import updateProduct from "@/services/products/updateProduct";
import duplicateProduct from "@/services/products/duplicateProduct";
import bulkUpdateProducts from "@/services/products/bulkUpdateProducts";
import { filterAndSortProducts, computeStatusCounts, computeInventoryValue } from "@/utils/productFilters";
import StaffProductsHeader from "./StaffProductsHeader";
import ProductsFilterBar from "@/features/seller/components/products/ProductsFilterBar";
import ProductsList from "@/features/seller/components/products/ProductsList";
import BulkActionBar from "@/features/seller/components/products/BulkActionBar";
import StatusModal from "@/components/ui/StatusModal";
import StaffProductForm from "./StaffProductForm";

/**
 * Xodim Mini App'i — "Mahsulotlar" bo'limi. Faqat `permissions.
 * manageProducts` ruxsatiga ega xodimga ko'rsatiladi (qarang:
 * `StaffHomePage.jsx`dagi tab tanlash mantig'i). Ro'yxat
 * `getSellerProducts` orqali sotuvchining O'ZI ko'radigan mahsulotlar
 * bilan BIR XIL manbadan o'qiladi — `firestore.rules`dagi
 * `staffPermission(sellerId, "manageProducts")` qoidasi bu yozishlarni
 * (qo'shish/tahrirlash/faolsizlantirish/nusxalash) himoyalaydi.
 *
 * 2026-09 punkt-royxati, 9-band: "sotuvchi bilan TO'LIQ PARITET,
 * FAQAT analitikadan tashqari". ILGARI bu bo'lim faqat qo'shish/
 * tahrirlash/faollashtirish-o'chirishni bilardi — qidiruv, filtr,
 * saralash, ichki (inline) narx/stok tahrirlash, nusxalash va
 * ommaviy (bulk) amallar UMUMAN yo'q edi. Endi sotuvchining
 * `Products.jsx`dagi bilan AYNAN BIR XIL "aqlli" (`ProductsFilterBar`/
 * `ProductsList`/`BulkActionBar` — bularning HECH biri `useSession()`/
 * `useNavigate()`ga bog'liq emas, shuning uchun xavfsiz qayta
 * ishlatiladi) komponentlari va sof `utils/productFilters.js`
 * funksiyalari ishlatiladi — FAQAT `StaffProductsHeader.jsx` alohida
 * (Analitika kirish nuqtasisiz, `useSession()`siz LEAN nusxa).
 *
 * ATAYLAB YO'Q (bitta): "O'chirish" (delete) — na yakka, na ommaviy.
 * `firestore.rules`da xodimga (`manageProducts` bilan ham) FAQAT
 * `create`/`update` huquqi berilgan, `delete` ATAYLAB berilmagan
 * (bu xavfsizlik siyosati qarori, xatolik emas) - shuning uchun
 * `ProductsList`/`BulkActionBar`ga `onDelete` UMUMAN uzatilmaydi
 * (ikkalasi ham bu holatda "O'chirish" tugmasini o'zi yashiradi).
 */
const StaffProductsSection = () => {
  const { t } = useLanguage();
  const { sellerId, store, staffId, staffName } = useStaffSession();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState(null); // null | {mode:'add'} | {mode:'edit', product}

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Barchasi");
  const [categoryFilter, setCategoryFilter] = useState("Barchasi");
  const [sortBy, setSortBy] = useState("none");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!sellerId) return undefined;
    const unsubscribe = getSellerProducts(
      sellerId,
      (data) => { setProducts(data); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsubscribe?.();
  }, [sellerId]);

  const inventoryValue = useMemo(() => computeInventoryValue(products), [products]);
  const statusCounts = useMemo(() => computeStatusCounts(products), [products]);

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, { searchQuery, statusFilter, categoryFilter, sortBy }),
    [products, searchQuery, statusFilter, categoryFilter, sortBy]
  );

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleActive = useCallback(async (productId, nextActive) => {
    try {
      await updateProduct(productId, { isActive: nextActive });
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

  const handleDuplicateProduct = useCallback(async (id) => {
    try {
      await duplicateProduct(id, sellerId);
    } catch (err) {
      setActionError(err.message);
    }
  }, [sellerId]);

  // Faqat "activate"/"deactivate" - "delete" bu yerdan UMUMAN
  // chaqirilmaydi (yuqoridagi izohga qarang).
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
    <div className="flex flex-col">
      <StaffProductsHeader
        storeCategory={store?.category}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        productsCount={products.length}
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

      <div className="p-4 space-y-3 pb-24">
        <button
          type="button"
          onClick={() => setFormState({ mode: "add" })}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10"
        >
          <Plus size={15} /> {t("staffApp.addProductButton")}
        </button>

        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            busy={bulkBusy}
            onCancel={() => setSelectedIds(new Set())}
            onActivate={() => handleBulkAction("activate")}
            onDeactivate={() => handleBulkAction("deactivate")}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Package size={36} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">{t("staffApp.emptyProducts")}</p>
          </div>
        ) : (
          <ProductsList
            products={filteredProducts}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onEditProduct={(p) => setFormState({ mode: "edit", product: p })}
            onDuplicate={handleDuplicateProduct}
            onToggleActive={handleToggleActive}
            onInlineUpdate={handleInlineUpdate}
            staffId={staffId}
            staffName={staffName}
          />
        )}
      </div>

      {formState && (
        <StaffProductForm
          mode={formState.mode}
          product={formState.product}
          onClose={() => setFormState(null)}
          onSaved={() => {}}
        />
      )}

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

export default StaffProductsSection;
