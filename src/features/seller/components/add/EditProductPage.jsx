import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { useLoadProductForEdit } from "@/hooks/seller/useLoadProductForEdit";
import useUpdateProductFull from "@/hooks/seller/useUpdateProductFull";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import { useAIDescription } from "@/hooks/seller/useAIDescription";
import { useSocialPost } from "@/hooks/seller/useSocialPost";
import { getEffectiveCategoriesForStore } from "@/config/categoryCustomization";
import StatusModal from "@/components/ui/StatusModal";

import FormErrors from "./FormErrors";
import AIBanner from "./AIBanner";
import MultiImageUploadCard from "./MultiImageUploadCard";
import BasicInfoCard from "./BasicInfoCard";
import PricingCard from "./PricingCard";
import VariantsCard from "./VariantsCard";
import AttributesCard from "./AttributesCard";
import DescriptionCard from "./DescriptionCard";
import SocialPostGeneratorCard from "./SocialPostGeneratorCard";
import InstagramAdImageCard from "./InstagramAdImageCard";
import StoryAdImageCard from "./StoryAdImageCard";
import SellerReviewsCard from "./SellerReviewsCard";
import SubmitBar from "./SubmitBar";
import StockHistoryPanel from "./StockHistoryPanel";

// OLDIN: mahsulotni tahrirlash faqat pastdan chiqadigan tor modal
// (QuickEditSheet) orqali, faqat narx va stok uchun mumkin edi. Endi
// bu — to'liq, alohida marshrutga ega sahifa (/seller/products/:id/edit),
// AddProductPage bilan bir xil, tanish shaklda — shu jumladan
// "Saqlash" tugmasi ham, formaning ODDIY, TABIIY oxirgi elementi
// sifatida (sun'iy joylashuvsiz, forma bilan birga skroll bo'ladi).
const EditProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
  const { t } = useLanguage();
  const { product, loading: productLoading, error: productError } = useLoadProductForEdit(id);
  const { updateProduct, loading: saving, error: saveError } = useUpdateProductFull();
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
  // ZAXIRA HARAKATI AUDIT JURNALI (2026-09, "ombor nazorati" — haqiqiy
  // muammoni yechish bo'limi): `originalStock` — mahsulot YUKLANGAN
  // paytdagi qiymat (o'zgarmaydi), sotuvchi nechaga o'zgartirganini
  // aniqlash uchun. `stockChangeReason` — `PricingCard.jsx`dagi
  // sabab-tanlash chiplaridan tanlangan qiymat.
  const [originalStock, setOriginalStock] = useState(null);
  const [stockChangeReason, setStockChangeReason] = useState(null);
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([]);
  // 15-NICHE UNIVERSAL PLATFORMA: batafsil izoh - `AddProductPage.jsx`.
  const [attributes, setAttributes] = useState({});
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [notOwner, setNotOwner] = useState(false);
  // Sabab tanlanmagani haqidagi ogohlantirish FAQAT saqlashga
  // URINIB KO'RGANDAN keyin ko'rsatiladi (hali stock maydonini
  // o'zgartirib, chip tanlashga ULGURMAGAN sotuvchini bezovta
  // qilmaslik uchun).
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const { generating: aiGenerating, error: aiError, generate: handleGenerateAI } = useAIDescription({
    productName: title,
    category,
    thumbnailImage: images[0],
    onResult: setDescription,
  });

  const {
    platform: socialPlatform,
    setPlatform: setSocialPlatform,
    postText: socialPostText,
    setPostText: setSocialPostText,
    generating: socialGenerating,
    error: socialError,
    generate: handleGenerateSocialPost,
  } = useSocialPost({
    productName: title,
    description,
    price,
    thumbnailImage: images[0],
  });

  useEffect(() => {
    if (!product) return;

    if (product.sellerId && sellerId && product.sellerId !== sellerId) {
      setNotOwner(true);
      return;
    }

    setTitle(product.name || "");
    setCategory(product.category || getEffectiveCategoriesForStore(store)[0]?.value || "");
    setPrice(String(product.price ?? ""));
    setCostPrice(String(product.costPrice ?? ""));
    setDiscountPrice(product.discountPrice != null ? String(product.discountPrice) : "");
    setStock(String(product.stock ?? ""));
    setOriginalStock(Number(product.stock) || 0);
    setStockChangeReason(null);
    setDescription(product.description || "");
    setVariants(product.variants || []);
    setAttributes(product.attributes || {});

    const existingImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : (product.image ? [product.image] : []);
    initFromUrls(existingImages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, sellerId, store]);

  const handleAddFiles = useCallback(
    (files) => {
      setUploadError(null);
      addFiles(files);
    },
    [addFiles, setUploadError]
  );

  const isGlobalLoading = uploadLoading || saving;

  // ZAXIRA HARAKATI AUDIT JURNALI: zaxira HAQIQATAN o'zgargan, lekin
  // sabab hali TANLANMAGAN bo'lsa - true (submitni bloklaydi, xuddi
  // boshqa "required" maydonlar kabi).
  const stockActuallyChanged = originalStock != null && stock !== "" && Number(stock) !== originalStock;
  const stockReasonMissing = stockActuallyChanged && !stockChangeReason;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (stockReasonMissing) {
        setAttemptedSubmit(true); // Enter orqali submit qilinsa ham, ogohlantirish endi ko'rinadi
        return;
      }
      try {
        const imageUrls = await resolveUploadedUrls(uploadImage, `products/${sellerId}`);
        await updateProduct(id, {
          title,
          category,
          price: Number(price),
          costPrice: Number(costPrice),
          discountPrice: discountPrice !== "" ? Number(discountPrice) : null,
          stock: Number(stock),
          description,
          images: imageUrls,
          variants,
          attributes,
          ...(stockActuallyChanged ? { lastStockChangeReason: stockChangeReason } : {}),
        });
        setShowSavedModal(true);
      } catch (err) {
        console.error("Mahsulotni yangilashda xatolik:", err);
      }
    },
    [
      id, sellerId, resolveUploadedUrls, uploadImage, title, category, price, costPrice, discountPrice, stock,
      description, variants, attributes, updateProduct, stockActuallyChanged, stockChangeReason, stockReasonMissing,
    ]
  );

  if (productLoading) {
    return <FullScreenSpinner />;
  }

  if (productError || notOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F4F5F9] dark:bg-slate-950 px-6 text-center">
        <p className="text-sm font-bold text-slate-800 dark:text-white">
          {notOwner ? t("sellerProductForm.notOwner") : productError}
        </p>
        <button
          onClick={() => navigate("/seller/products")}
          className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
        >
          Ortga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 px-5 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
          onClick={() => navigate("/seller/products")}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{t("sellerProductForm.editTitle")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate max-w-[220px]">{title}</p>
        </div>
      </div>

      <form id="edit-product-form" onSubmit={handleSubmit} className="p-4 pb-36 space-y-4">
        <FormErrors
          uploadError={uploadError}
          dbError={saveError}
          validationError={attemptedSubmit && stockReasonMissing ? t("sellerProductForm.stockChangeReasonRequired") : null}
        />

        <AIBanner generating={aiGenerating} error={aiError} onGenerate={handleGenerateAI} />

        <MultiImageUploadCard
          images={images}
          disabled={isGlobalLoading}
          onAddFiles={handleAddFiles}
          onRemoveImage={removeImage}
          onSetThumbnail={setThumbnail}
        />

        <BasicInfoCard
          title={title}
          category={category}
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
          originalStock={originalStock}
          stockChangeReason={stockChangeReason}
          onStockChangeReasonChange={setStockChangeReason}
        />

        {originalStock != null && (
          <StockHistoryPanel sellerId={sellerId} productId={id} />
        )}

        <VariantsCard
          variants={variants}
          disabled={isGlobalLoading}
          onVariantsChange={setVariants}
        />

        <AttributesCard
          attributes={attributes}
          disabled={isGlobalLoading}
          onAttributesChange={setAttributes}
        />

        <DescriptionCard
          description={description}
          disabled={isGlobalLoading}
          generating={aiGenerating}
          onGenerate={handleGenerateAI}
          onDescriptionChange={setDescription}
        />

        {store?.aiCeoEnabled === true && (
          <SocialPostGeneratorCard
            platform={socialPlatform}
            onPlatformChange={setSocialPlatform}
            postText={socialPostText}
            onPostTextChange={setSocialPostText}
            generating={socialGenerating}
            error={socialError}
            onGenerate={handleGenerateSocialPost}
            productImageUrl={images[0]?.url || null}
          />
        )}

        <InstagramAdImageCard imageUrl={product?.aiAdImageUrl || null} />

        <StoryAdImageCard
          productId={id}
          initialImageUrl={product?.aiStoryImageUrl || null}
          aiCeoEnabled={store?.aiCeoEnabled === true}
        />

        <SellerReviewsCard productId={id} />

        <SubmitBar
          isGlobalLoading={isGlobalLoading}
          uploadLoading={uploadLoading}
          uploadProgress={uploadProgress}
          idleLabel={t("sellerProductForm.saveChanges")}
          savingLabel={t("sellerProductForm.saving")}
        />
      </form>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title={t("sellerProductForm.changesSaved")}
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default EditProductPage;
