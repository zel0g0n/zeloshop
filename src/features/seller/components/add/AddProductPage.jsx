import React, { useState, useEffect, useCallback } from "react";
import useAddProduct from "@/hooks/seller/useAddProduct";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import { useAIDescription } from "@/hooks/seller/useAIDescription";
import StatusModal from "@/components/ui/StatusModal";

import PageHeader from "./PageHeader";
import FormErrors from "./FormErrors";
import AIBanner from "./AIBanner";
import MultiImageUploadCard from "./MultiImageUploadCard";
import BasicInfoCard from "./BasicInfoCard";
import PricingCard from "./PricingCard";
import VariantsCard from "./VariantsCard";
import DescriptionCard from "./DescriptionCard";
import SubmitBar from "./SubmitBar";

// OLDIN: butun sahifa oddiy `min-h-screen` bilan tabiiy skroll qilardi,
// "Yaratish va Saqlash" tugmasi esa `position: fixed` orqali ekranga
// mahkamlangan edi. Mobil klaviatura ochilganda, ba'zi WebView'larda
// `fixed` elementlar noto'g'ri joyda qolib ketishi (yoki klaviatura
// ostida yashirinib qolishi) mumkin edi.
//
// ENDI: butun sahifa FLEX USTUN (h-screen flex flex-col) tuzilishida —
// forma o'zi (`flex-1 overflow-y-auto`) skroll bo'ladi, "Saqlash"
// tugmasi esa oddiy flex elementi sifatida DOIM pastda, forma tagida
// turadi (fixed emas) — bu klaviatura muammosini tub sababidan hal
// qiladi, chunki brauzer buni tabiiy layout deb hisoblaydi.
const AddProductPage = () => {
  const { addProduct, loading: dbLoading, success: dbSuccess, error: dbError, resetState } = useAddProduct();
  const {
    uploadImage,
    progress: uploadProgress,
    loading: uploadLoading,
    error: uploadError,
    setError: setUploadError,
  } = useUploadImage();

  const { images, addFiles, removeImage, setThumbnail, resolveUploadedUrls, reset: resetImages } = useProductImages();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [paymentTypes, setPaymentTypes] = useState(["prepay"]);
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([]);

  const { generating: aiGenerating, error: aiError, generate: handleGenerateAI } = useAIDescription({
    productName: title,
    category,
    thumbnailImage: images[0],
    onResult: setDescription,
  });

  const resetForm = useCallback(() => {
    setTitle("");
    setCategory("");
    setPrice("");
    setCostPrice("");
    setDiscountPrice("");
    setPaymentTypes(["prepay"]);
    setStock("");
    setDescription("");
    setVariants([]);
    resetImages();
  }, [resetImages]);

  const [showSavedModal, setShowSavedModal] = useState(false);

  useEffect(() => {
    if (dbSuccess) {
      setShowSavedModal(true);
      resetForm();
      resetState();
    }
  }, [dbSuccess, resetState, resetForm]);

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

  const isGlobalLoading = uploadLoading || dbLoading;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      try {
        const imageUrls = await resolveUploadedUrls(uploadImage, "products");

        const finalProductData = {
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
        };

        await addProduct(finalProductData);
      } catch (err) {
        console.error("Mahsulot yaratishda xatolik:", err);
      }
    },
    [resolveUploadedUrls, uploadImage, title, category, price, costPrice, discountPrice, paymentTypes, stock, description, variants, addProduct]
  );

  return (
    <div className="h-screen flex flex-col bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <div className="shrink-0">
        <PageHeader />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        <FormErrors uploadError={uploadError} dbError={dbError} />

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
        <SubmitBar isGlobalLoading={isGlobalLoading} uploadLoading={uploadLoading} uploadProgress={uploadProgress} floating={false} />
      </div>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title="Mahsulot muvaffaqiyatli saqlandi! 🎉"
          onClose={() => setShowSavedModal(false)}
        />
      )}
    </div>
  );
};

export default AddProductPage;
