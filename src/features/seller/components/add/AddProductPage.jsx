import React, { useState, useEffect, useCallback, useRef } from "react";
import useAddProduct from "@/hooks/seller/useAddProduct";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";

import PageHeader from "./PageHeader";
import FormErrors from "./FormErrors";
import ImageUploadCard from "./ImageUploadCard";
import BasicInfoCard from "./BasicInfoCard";
import PricingCard from "./PricingCard";
import VariantsCard from "./VariantsCard";
import DescriptionCard from "./DescriptionCard";
import SubmitBar from "./SubmitBar";

const AddProductPage = () => {
  const { addProduct, loading: dbLoading, success: dbSuccess, error: dbError, resetState } = useAddProduct();
  const {
    uploadImage,
    progress: uploadProgress,
    loading: uploadLoading,
    error: uploadError,
    setError: setUploadError,
  } = useUploadImage();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Skincare");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [variants, setVariants] = useState([]);
  const [currentVariant, setCurrentVariant] = useState("");

  // Joriy blob URL'ni kuzatib boramiz, shunda uni har doim to'g'ri
  // vaqtda (almashtirilganda / o'chirilganda / unmountda) revoke qila olamiz.
  const previewUrlRef = useRef(null);

  useEffect(() => {
    // Komponent unmount bo'lganda oxirgi blob URL tozalansin
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setCategory("Skincare");
    setPrice("");
    setCostPrice("");
    setStock("");
    setDescription("");
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImagePreview(null);
    setImageFile(null);
    setVariants([]);
  }, []);

  useEffect(() => {
    if (dbSuccess) {
      alert("Mahsulot muvaffaqiyatli saqlandi! 🎉");
      resetForm();
      resetState();
    }
  }, [dbSuccess, resetState, resetForm]);

  const handleImageChange = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Eski blob URL bo'lsa, xotira sizib chiqmasligi uchun avval uni tozalaymiz
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(file);
      previewUrlRef.current = nextUrl;

      setImageFile(file);
      setImagePreview(nextUrl);
      setUploadError(null);
    },
    [setUploadError]
  );

  const handleRemoveImage = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImagePreview(null);
    setImageFile(null);
  }, []);

  const handleAddVariant = useCallback((e) => {
    if (e.key !== "Enter") return;
    const value = e.target.value.trim();
    if (!value) return;

    e.preventDefault();
    setVariants((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCurrentVariant("");
  }, []);

  const handleRemoveVariant = useCallback((index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const isGlobalLoading = uploadLoading || dbLoading;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      let finalImageUrl = null;

      try {
        if (imageFile) {
          finalImageUrl = await uploadImage(imageFile, "products");
        }

        const finalProductData = {
          title,
          category,
          price: Number(price),
          costPrice: Number(costPrice),
          stock: Number(stock),
          description,
          image: finalImageUrl,
          variants,
        };

        await addProduct(finalProductData);
      } catch (err) {
        console.error("Mahsulot yaratishda xatolik:", err);
      }
    },
    [imageFile, uploadImage, title, category, price, costPrice, stock, description, variants, addProduct]
  );

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased pb-32">
      <PageHeader />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <FormErrors uploadError={uploadError} dbError={dbError} />

        <ImageUploadCard
          imagePreview={imagePreview}
          uploadLoading={uploadLoading}
          uploadProgress={uploadProgress}
          isGlobalLoading={isGlobalLoading}
          onImageChange={handleImageChange}
          onRemoveImage={handleRemoveImage}
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
          stock={stock}
          disabled={isGlobalLoading}
          onPriceChange={setPrice}
          onCostPriceChange={setCostPrice}
          onStockChange={setStock}
        />

        <VariantsCard
          variants={variants}
          currentVariant={currentVariant}
          disabled={isGlobalLoading}
          onCurrentVariantChange={setCurrentVariant}
          onAddVariant={handleAddVariant}
          onRemoveVariant={handleRemoveVariant}
        />

        <DescriptionCard description={description} disabled={isGlobalLoading} onDescriptionChange={setDescription} />

        <SubmitBar isGlobalLoading={isGlobalLoading} uploadLoading={uploadLoading} uploadProgress={uploadProgress} />
      </form>
    </div>
  );
};

export default AddProductPage;
