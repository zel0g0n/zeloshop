import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useStaffSession } from "@/context/StaffSessionContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import addProduct from "@/services/products/addProduct";
import updateProductFull from "@/services/products/updateProductFull";
import StatusModal from "@/components/ui/StatusModal";
import MultiImageUploadCard from "@/features/seller/components/add/MultiImageUploadCard";
import PricingCard from "@/features/seller/components/add/PricingCard";
import StockHistoryPanel from "@/features/seller/components/add/StockHistoryPanel";
import FormErrors from "@/features/seller/components/add/FormErrors";
import StaffBasicInfoCard from "./StaffBasicInfoCard";
import StaffDescriptionCard from "./StaffDescriptionCard";

/**
 * Xodim Mini App'i — mahsulot QO'SHISH/TAHRIRLASH sahifasi.
 *
 * `AddProductPage.jsx`/`EditProductPage.jsx` bilan BIR XIL naqsh, lekin
 * bir nechta ATAYLAB QILINGAN farq bilan:
 *
 * 1. Redux'ga BOG'LIQ bo'lgan `useAddProduct`/`useUpdateProductFull`
 *    hooklari O'RNIGA, `services/products/addProduct.js` va
 *    `updateProductFull.js`dagi SOF (Redux'siz) funksiyalar
 *    to'g'ridan-to'g'ri chaqiriladi — xodim Mini App'ida Redux `store`
 *    umuman mavjud emas (`StaffApp.jsx`ga qarang).
 * 2. `BasicInfoCard`/`DescriptionCard` O'RNIGA, ularning `useSession()`
 *    talab qilmaydigan va (Description uchun) AI tugmasi BUTUNLAY
 *    yo'q bo'lgan LEAN nusxalari (`StaffBasicInfoCard`/
 *    `StaffDescriptionCard`) ishlatiladi.
 * 3. `VariantsCard` ATAYLAB YO'Q — xodim variantlarni ko'rmaydi/
 *    o'zgartirmaydi; tahrirlashda mavjud `variants` massivi
 *    o'zgarishsiz, aynan qanday kelgan bo'lsa, shundayligicha qayta
 *    yuboriladi (pastdagi `handleSubmit`ga qarang).
 * 4. Rasm yuklash `products/${sellerId}` papkasiga boradi (xodimning
 *    O'ZINING emas) — `storage.rules`dagi `staffCanManageProducts()`
 *    funksiyasi buni ANIQ ruxsat beradi.
 * 5. `isActive`ni O'ZGARTIRMAYDI — mavjud faollik holati (agar
 *    tahrirlanayotgan bo'lsa) o'zgarishsiz qoladi (bu maydon alohida,
 *    ro'yxatdagi yoqish/o'chirish tugmasi orqali boshqariladi).
 */
const StaffProductForm = ({ mode, product, onClose, onSaved }) => {
  const { t } = useLanguage();
  const { sellerId, store, staffId, staffName, permissions } = useStaffSession();
  const isEdit = mode === "edit";
  // KORPORATIV RBAC (2026-09): `manageProducts` huquqi katalogni
  // boshqarishga ruxsat beradi, lekin TANNARX/FOYDA — bu MOLIYAVIY
  // ma'lumot, `viewFinance` huquqiga tegishli. Shu ikkisi ATAYLAB
  // ALOHIDA — masalan, Marketing Menejer/Ombor mahsulot tahrirlay
  // olsin, lekin foyda margasini KO'RMASIN.
  const canViewCost = permissions?.viewFinance === true;

  const {
    uploadImage,
    progress: uploadProgress,
    loading: uploadLoading,
    error: uploadError,
    setError: setUploadError,
  } = useUploadImage();
  const { images, addFiles, removeImage, setThumbnail, initFromUrls, resolveUploadedUrls } = useProductImages();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("");
  // ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati"): batafsil
  // izoh - `EditProductPage.jsx` (bir xil naqsh, xodim uchun HAM
  // MAJBURIY - aynan ko'p xodimli hisobdorlik shu YERDA eng muhim).
  const [originalStock, setOriginalStock] = useState(null);
  const [stockChangeReason, setStockChangeReason] = useState(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showSavedModal, setShowSavedModal] = useState(false);

  useEffect(() => {
    if (!isEdit || !product) return;
    setTitle(product.name || "");
    setCategory(product.category || "");
    setPrice(String(product.price ?? ""));
    setCostPrice(String(product.costPrice ?? ""));
    setDiscountPrice(product.discountPrice != null ? String(product.discountPrice) : "");
    setStock(String(product.stock ?? ""));
    setOriginalStock(Number(product.stock) || 0);
    setStockChangeReason(null);
    setDescription(product.description || "");
    setVariants(product.variants || []);
    const existingImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : (product.image ? [product.image] : []);
    initFromUrls(existingImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, product]);

  const handleAddFiles = useCallback((files) => {
    setUploadError(null);
    addFiles(files);
  }, [addFiles, setUploadError]);

  const isGlobalLoading = uploadLoading || saving;

  // ZAXIRA HARAKATI AUDIT JURNALI: batafsil izoh - `EditProductPage.jsx`.
  const stockActuallyChanged = isEdit && originalStock != null && stock !== "" && Number(stock) !== originalStock;
  const stockReasonMissing = stockActuallyChanged && !stockChangeReason;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (stockReasonMissing) {
      setAttemptedSubmit(true);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const imageUrls = await resolveUploadedUrls(uploadImage, `products/${sellerId}`);
      const payload = {
        title,
        category,
        price: Number(price),
        // `canViewCost === false` bo'lsa, `costPrice` payload'ga UMUMAN
        // qo'shilmaydi — mavjud mahsulotni tahrirlashda
        // `updateProductFull`ga bu maydon "berilmagan" deb yuboriladi,
        // shunda u eskisini SAQLAB QOLADI (0ga aylantirib qo'ymaydi).
        // Yangi mahsulot yaratishda esa `addProduct` uni standart 0
        // qiladi — `firestore.rules` ham buni serverda mustaqil
        // ravishda talab qiladi (`isCostPriceOk`).
        ...(canViewCost ? { costPrice: Number(costPrice) } : {}),
        discountPrice: discountPrice !== "" ? Number(discountPrice) : null,
        stock: Number(stock),
        description,
        images: imageUrls,
        variants, // tahrirlashda O'ZGARISHSIZ qayta yuboriladi, qo'shishda bo'sh massiv
        ...(stockActuallyChanged
          ? { lastStockChangeReason: stockChangeReason, lastStockChangeByStaffId: staffId, lastStockChangeByStaffName: staffName }
          : {}),
      };

      if (isEdit) {
        await updateProductFull(product.id, payload);
      } else {
        await addProduct(payload, sellerId);
      }
      setShowSavedModal(true);
    } catch (err) {
      console.error("Xodim — mahsulotni saqlashda xatolik:", err);
      setSaveError(err.message || t("sellerProductForm.firestoreError"));
    } finally {
      setSaving(false);
    }
  }, [
    isEdit, product, sellerId, resolveUploadedUrls, uploadImage, title, category, price, costPrice, discountPrice,
    stock, description, variants, t, stockActuallyChanged, stockChangeReason, stockReasonMissing, staffId, staffName,
    canViewCost,
  ]);

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white overflow-y-auto">
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 px-5 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={onClose} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">
            {isEdit ? t("sellerProductForm.editTitle") : t("sellerProductForm.newProductTitle")}
          </h1>
          {isEdit && <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate max-w-[220px]">{title}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 pb-36 space-y-4">
        <FormErrors
          uploadError={uploadError}
          dbError={saveError}
          validationError={attemptedSubmit && stockReasonMissing ? t("sellerProductForm.stockChangeReasonRequired") : null}
        />

        <MultiImageUploadCard
          images={images}
          disabled={isGlobalLoading}
          onAddFiles={handleAddFiles}
          onRemoveImage={removeImage}
          onSetThumbnail={setThumbnail}
        />

        <StaffBasicInfoCard
          title={title}
          category={category}
          storeCategory={store?.category}
          disabled={isGlobalLoading}
          onTitleChange={setTitle}
          onCategoryChange={setCategory}
        />

        <PricingCard
          price={price}
          costPrice={costPrice}
          discountPrice={discountPrice}
          stock={stock}
          disabled={isGlobalLoading}
          onPriceChange={setPrice}
          onCostPriceChange={setCostPrice}
          onDiscountPriceChange={setDiscountPrice}
          onStockChange={setStock}
          originalStock={isEdit ? originalStock : null}
          stockChangeReason={stockChangeReason}
          onStockChangeReasonChange={setStockChangeReason}
          showCostPrice={canViewCost}
        />

        {isEdit && originalStock != null && (
          <StockHistoryPanel sellerId={sellerId} productId={product.id} />
        )}

        <StaffDescriptionCard
          description={description}
          disabled={isGlobalLoading}
          onDescriptionChange={setDescription}
        />

        <button
          type="submit"
          disabled={isGlobalLoading}
          className={`w-full h-12 text-white font-semibold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
            isGlobalLoading ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed shadow-none" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
          }`}
        >
          {isGlobalLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{uploadLoading ? t("sellerProductForm.uploadingImage", { percent: uploadProgress }) : t("sellerProductForm.saving")}</span>
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2.5} />
              <span>{isEdit ? t("sellerProductForm.saveChanges") : t("sellerProductForm.createAndSave")}</span>
            </>
          )}
        </button>
      </form>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title={isEdit ? t("sellerProductForm.changesSaved") : t("sellerProductForm.savedTitle")}
          onClose={() => { setShowSavedModal(false); onSaved?.(); onClose(); }}
        />
      )}
    </div>
  );
};

export default StaffProductForm;
