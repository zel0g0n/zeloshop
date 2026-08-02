import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { useLoadProductForEdit } from "@/hooks/seller/useLoadProductForEdit";
import useUpdateProductFull from "@/hooks/seller/useUpdateProductFull";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import { useAIDescription } from "@/hooks/seller/useAIDescription";
import { getCategoriesForNiche } from "@/constants/productCategories";
import StatusModal from "@/components/ui/StatusModal";

import FormErrors from "./FormErrors";
import AIBanner from "./AIBanner";
import MultiImageUploadCard from "./MultiImageUploadCard";
import BasicInfoCard from "./BasicInfoCard";
import PricingCard from "./PricingCard";
import VariantsCard from "./VariantsCard";
import DescriptionCard from "./DescriptionCard";
import SubmitBar from "./SubmitBar";

// OLDIN: mahsulotni tahrirlash faqat pastdan chiqadigan tor modal
// (QuickEditSheet) orqali, faqat narx va stok uchun mumkin edi. Endi
// bu — to'liq, alohida marshrutga ega sahifa (/seller/products/:id/edit),
// AddProductPage bilan bir xil, tanish shaklda. Sahifa tuzilishi ham
// endi AddProductPage bilan bir xil — flex ustun, forma o'zi skroll
// bo'ladi, "Saqlash" tugmasi oddiy flex elementi (fixed emas) —
// mobil klaviatura muammosini oldini oladi.
const EditProductPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
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
  const [paymentTypes, setPaymentTypes] = useState(["prepay"]);
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([]);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [notOwner, setNotOwner] = useState(false);

  const { generating: aiGenerating, error: aiError, generate: handleGenerateAI } = useAIDescription({
    productName: title,
    category,
    thumbnailImage: images[0],
    onResult: setDescription,
  });

  useEffect(() => {
    if (!product) return;

    if (product.sellerId && sellerId && product.sellerId !== sellerId) {
      setNotOwner(true);
      return;
    }

    setTitle(product.name || "");
    setCategory(product.category || getCategoriesForNiche(store?.category)[0]?.value || "");
    setPrice(String(product.price ?? ""));
    setCostPrice(String(product.costPrice ?? ""));
    setDiscountPrice(product.discountPrice != null ? String(product.discountPrice) : "");
    setPaymentTypes(
      Array.isArray(product.paymentTypes) && product.paymentTypes.length > 0
        ? product.paymentTypes
        : (product.paymentType ? [product.paymentType] : ["prepay"])
    );
    setStock(String(product.stock ?? ""));
    setDescription(product.description || "");
    setVariants(product.variants || []);

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

  const handleTogglePaymentType = useCallback((type) => {
    setPaymentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  const isGlobalLoading = uploadLoading || saving;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const imageUrls = await resolveUploadedUrls(uploadImage, "products");
        await updateProduct(id, {
          title,
          category,
          price: Number(price),
          costPrice: Number(costPrice),
          discountPrice: discountPrice !== "" ? Number(discountPrice) : null,
          paymentTypes,
          stock: Number(stock),
          description,
          images: imageUrls,
          variants,
        });
        setShowSavedModal(true);
      } catch (err) {
        console.error("Mahsulotni yangilashda xatolik:", err);
      }
    },
    [id, resolveUploadedUrls, uploadImage, title, category, price, costPrice, discountPrice, paymentTypes, stock, description, variants, updateProduct]
  );

  if (productLoading) {
    return <FullScreenSpinner />;
  }

  if (productError || notOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F4F5F9] dark:bg-slate-950 px-6 text-center">
        <p className="text-sm font-bold text-slate-800 dark:text-white">
          {notOwner ? "Bu mahsulot sizga tegishli emas." : productError}
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
    <div className="h-screen flex flex-col bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <div className="shrink-0 bg-white dark:bg-slate-900 px-5 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
          onClick={() => navigate("/seller/products")}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Mahsulotni tahrirlash</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate max-w-[220px]">{title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        <FormErrors uploadError={uploadError} dbError={saveError} />

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
          paymentTypes={paymentTypes}
          stock={stock}
          disabled={isGlobalLoading}
          onPriceChange={setPrice}
          onCostPriceChange={setCostPrice}
          onDiscountPriceChange={setDiscountPrice}
          onTogglePaymentType={handleTogglePaymentType}
          onStockChange={setStock}
        />

        <VariantsCard
          variants={variants}
          disabled={isGlobalLoading}
          onVariantsChange={setVariants}
        />

        <DescriptionCard
          description={description}
          disabled={isGlobalLoading}
          generating={aiGenerating}
          onGenerate={handleGenerateAI}
          onDescriptionChange={setDescription}
        />
      </form>

      <div className="shrink-0 px-4 pt-2 pb-24 bg-[#F4F5F9] dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
        <SubmitBar
          isGlobalLoading={isGlobalLoading}
          uploadLoading={uploadLoading}
          uploadProgress={uploadProgress}
          floating={false}
          idleLabel="O'zgarishlarni saqlash"
          savingLabel="Saqlanmoqda..."
        />
      </div>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title="O'zgarishlar saqlandi! ✅"
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default EditProductPage;
