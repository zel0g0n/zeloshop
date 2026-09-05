import { useState, useEffect, useCallback } from "react";
import { Sparkles, PenLine } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import useAddProduct from "@/hooks/seller/useAddProduct";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { useProductImages } from "@/hooks/seller/useProductImages";
import { useAIDescription } from "@/hooks/seller/useAIDescription";
import StatusModal from "@/components/ui/StatusModal";

import PageHeader from "./PageHeader";
import FormErrors from "./FormErrors";
import QuickAddAICard from "./QuickAddAICard";
import MultiImageUploadCard from "./MultiImageUploadCard";
import BasicInfoCard from "./BasicInfoCard";
import PricingCard from "./PricingCard";
import VariantsCard from "./VariantsCard";
import AttributesCard from "./AttributesCard";
import DescriptionCard from "./DescriptionCard";
import SubmitBar from "./SubmitBar";

// OLDIN (1-bosqich): tugma `position: fixed` orqali ekranga
// mahkamlangan edi — mobil klaviatura ochilganda ba'zi WebView'larda
// noto'g'ri joyda qolib ketishi mumkin edi.
//
// OLDIN (2-bosqich): shu muammoni hal qilish uchun, forma va tugma
// IKKI ALOHIDA skroll hududiga (flex-column) bo'lingan edi — tugma
// har doim ko'rinardi, lekin bu, "tugma forma bilan birga tabiiy
// skroll bo'lishi kerak" talabiga zid edi.
//
// ENDI: eng oddiy, ENG TABIIY yondashuv — butun sahifa (sarlavha +
// forma + tugma) BITTA umumiy hujjat oqimida, oddiy `overflow-y-auto`
// bilan skroll bo'ladi. Tugma — formaning haqiqiy, oxirgi elementi.
const AddProductPage = () => {
  const { sellerId, store, dashboardSummary, patchDashboardSummary } = useSession();
  const isAiCeoEnabled = store?.aiCeoEnabled === true;
  const { t } = useLanguage();
  // MUHIM (2026-09 dizayn tuzatishi): OLDIN "AI yordamida qo'shish"
  // (`QuickAddAICard`) va "Qo'lda to'ldirish" formasi BIR VAQTDA, tepa-
  // past bo'lib (additive stack) ko'rsatilardi - foydalanuvchi buni
  // "tanlov" deb kutgan, lekin aslida ikkalasi ham doim ko'rinardi.
  // ENDI - to'lov sozlamalaridagi "yuridik shaxs"/"jismoniy shaxs"
  // tab-tanlovi bilan BIR XIL naqsh (segmented control): faqat BITTASI
  // faol, ikkinchisi shu payt ko'rinmaydi. Tab-tanlov FAQAT AI CEO
  // yoqilgan sotuvchilar uchun ko'rsatiladi (`isAiCeoEnabled`) - aks
  // holda (Basic tarif) AI varianti umuman yo'q, shuning uchun tab
  // kerak emas, forma to'g'ridan-to'g'ri ko'rinadi (avvalgi xatti-
  // harakat o'zgarmagan).
  const [activeTab, setActiveTab] = useState("manual"); // 'manual' | 'ai'
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
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState([]);
  // 15-NICHE UNIVERSAL PLATFORMA: sohaga (niche) mos dinamik atributlar
  // (masalan Kosmetika uchun "Teri turi", Elektronika uchun "Xotira") -
  // `AttributesCard.jsx`, `src/config/niches.js`.
  const [attributes, setAttributes] = useState({});

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
    setStock("");
    setDescription("");
    setVariants([]);
    setAttributes({});
    resetImages();
  }, [resetImages]);

  const [showSavedModal, setShowSavedModal] = useState(false);

  useEffect(() => {
    if (dbSuccess) {
      setShowSavedModal(true);
      resetForm();
      resetState();
      // Checklistdagi "Birinchi mahsulotingizni qo'shing" bosqichi
      // `dashboardSummary.totalProductsCount`ga qarab hisoblanadi -
      // sahifa yangilanmasdan darhol "bajarilgan" ko'rinishi uchun.
      patchDashboardSummary({ totalProductsCount: (dashboardSummary?.totalProductsCount || 0) + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSuccess, resetState, resetForm]);

  const handleAddFiles = useCallback(
    (files) => {
      setUploadError(null);
      addFiles(files);
    },
    [addFiles, setUploadError]
  );

  const isGlobalLoading = uploadLoading || dbLoading;

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      try {
        const imageUrls = await resolveUploadedUrls(uploadImage, `products/${sellerId}`);

        const finalProductData = {
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
        };

        await addProduct(finalProductData);
      } catch (err) {
        console.error("Mahsulot yaratishda xatolik:", err);
      }
    },
    [sellerId, resolveUploadedUrls, uploadImage, title, category, price, costPrice, discountPrice, stock, description, variants, attributes, addProduct]
  );

  return (
    <div className="h-screen overflow-y-auto bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">
      <PageHeader />

      <div className="p-4 pb-36 space-y-4">
        <FormErrors uploadError={uploadError} dbError={dbError} />

        {isAiCeoEnabled && (
          <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "manual" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <PenLine size={14} /> {t("sellerProductForm.tabManual")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "ai" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Sparkles size={14} /> {t("sellerProductForm.tabAi")}
            </button>
          </div>
        )}

        {isAiCeoEnabled && activeTab === "ai" ? (
          <QuickAddAICard />
        ) : (
          <form id="add-product-form" onSubmit={handleSubmit} className="space-y-4">
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
            />

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
              error={aiError}
              onGenerate={handleGenerateAI}
              onDescriptionChange={setDescription}
            />

            <SubmitBar isGlobalLoading={isGlobalLoading} uploadLoading={uploadLoading} uploadProgress={uploadProgress} />
          </form>
        )}
      </div>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title={t("sellerProductForm.savedTitle")}
          onClose={() => setShowSavedModal(false)}
        />
      )}
    </div>
  );
};

export default AddProductPage;
