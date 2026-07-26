import React, { useState, useEffect } from "react";
import useAddProduct from "@/hooks/seller/useAddProduct";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";

const AddProductPage = () => {
  // Har ikkala hookni ulaymiz
  const { addProduct, loading: dbLoading, success: dbSuccess, error: dbError, resetState } = useAddProduct();
  const { uploadImage, progress: uploadProgress, loading: uploadLoading, error: uploadError, setError: setUploadError } = useUploadImage();

  // Forma uchun lokal statelar
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Skincare");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [description, setDescription] = useState("");
  
  // Rasm vizual ko'rinishi va faylning o'zi uchun statelar
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [variants, setVariants] = useState([]);
  const [currentVariant, setCurrentVariant] = useState("");

  // Redux-dan muvaffaqiyatli saqlanganlik holati kelsa, formani tozalaymiz
  useEffect(() => {
    if (dbSuccess) {
      alert("Mahsulot muvaffaqiyatli saqlandi! 🎉");
      setTitle("");
      setCategory("Skincare");
      setPrice("");
      setCostPrice("");
      setStock("");
      setDescription("");
      setImagePreview(null);
      setImageFile(null);
      setVariants([]);
      resetState();
    }
  }, [dbSuccess, resetState]);

  // Mahalliy rasm tanlash jarayoni
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); // Brauzerda tezkor ko'rsatish
      setUploadError(null); // Eski xatoliklarni tozalash
    }
  };

  // Rasm previewni o'chirish
  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageFile(null);
  };

  // Variant qo'shish (chip ko'rinishida)
  const handleAddVariant = (e) => {
    if (e.key === "Enter" && currentVariant.trim()) {
      e.preventDefault();
      if (!variants.includes(currentVariant.trim())) {
        setVariants([...variants, currentVariant.trim()]);
      }
      setCurrentVariant("");
    }
  };

  const handleRemoveVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Rentabellik kalkulyatori
  const calculatedProfit = price && costPrice ? Number(price) - Number(costPrice) : 0;
  const marginPercentage = price && costPrice ? Math.round((calculatedProfit / Number(price)) * 100) : 0;

  // Umumiy yuklanish holati
  const isGlobalLoading = uploadLoading || dbLoading;

  // Formani topshirish (Meyoriy oqim)
  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalImageUrl = null;

    try {
      // 1. Agar rasm tanlangan bo'lsa, uni sizning hook orqali Storage'ga yuklaymiz
      if (imageFile) {
        // 'products' papkasiga yuklaydi
        finalImageUrl = await uploadImage(imageFile, "products");
      }

      // 2. Firestore'ga yuboriladigan yakuniy ma'lumotlar to'plami
      const finalProductData = {
        title,
        category,
        price: Number(price),
        costPrice: Number(costPrice),
        stock: Number(stock),
        description,
        image: finalImageUrl, // Firebase Storage linki ✅
        variants,
      };

      // 3. Redux Thunk'ni chaqiramiz
      await addProduct(finalProductData);

    } catch (err) {
      console.error("Mahsulot yaratishda xatolik:", err);
    }
  };

  return (
    <div className="bg-[#F4F5F9] min-h-screen text-slate-900 font-sans antialiased pb-32">
      
      {/* HEADER PANEL */}
      <div className="bg-white px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
        <button 
          type="button" 
          className="p-1 text-slate-500 active:scale-95 transition-transform"
          onClick={() => window.history.back()}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 tracking-tight">Yangi mahsulot</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Katalogga tovar qo'shish</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        
        {/* XATOLIKLAR PANELI */}
        {(uploadError || dbError) && (
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-xs font-semibold text-rose-600 space-y-1">
            {uploadError && <p>⚠️ Storage: {uploadError}</p>}
            {dbError && <p>⚠️ Firestore: {dbError?.message || dbError}</p>}
          </div>
        )}

        {/* PREMIUM RASM YUKLASH BOXI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot rasmi</label>
          
          {!imagePreview ? (
            <label className="border-2 border-dashed border-slate-200 rounded-xl h-28 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50/50">
              <span className="text-xl">📸</span>
              <span className="text-xs font-black text-slate-700">Rasm yuklash</span>
              <span className="text-[9px] text-slate-400 font-medium">PNG, JPG, WEBP formatlar</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          ) : (
            <div className="relative w-28 h-28 mx-auto group">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl border border-slate-100 shadow-2xs" />
              {!isGlobalLoading && (
                <button 
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md shadow-rose-500/20 active:scale-90 transition-transform"
                >
                  ✕
                </button>
              )}
              
              {/* Rasm ustida progress chizig'i (Upload bo'layotgan paytda chiqadi) */}
              {uploadLoading && (
                <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-white p-2">
                  <span className="text-[10px] font-bold mb-1">Yuklanmoqda</span>
                  <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-400 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono mt-1">{uploadProgress}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ASOSIY MA'LUMOTLAR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot nomi *</label>
            <input 
              type="text" 
              required
              disabled={isGlobalLoading}
              placeholder="Masalan: Vitamin C Serum"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-transparent disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Kategoriya tanlang</label>
            <div className="relative">
              <select 
                value={category}
                disabled={isGlobalLoading}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-bold text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 disabled:opacity-60"
              >
                <option value="Skincare">Skincare (Krem, Serum)</option>
                <option value="Makeup">Makeup (Kosmetika)</option>
                <option value="Perfume">Perfume (Atirlar)</option>
                <option value="Tools">Tools (Jihozlar)</option>
              </select>
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">🔽</span>
            </div>
          </div>
        </div>

        {/* SMART MOLIYA BLOKI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3.5">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Narx va Stok sozlamalari</label>
            <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-sm">SMART CALCULATOR</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block">Tannarxi *</label>
              <input 
                type="number" 
                required
                disabled={isGlobalLoading}
                placeholder="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block">Sotish narxi *</label>
              <input 
                type="number" 
                required
                disabled={isGlobalLoading}
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-black text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          {calculatedProfit > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center justify-between text-emerald-800">
              <div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sof foyda</div>
                <div className="text-sm font-black mt-0.5">+{calculatedProfit.toLocaleString()} so'm</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Rentabellik</div>
                <div className="text-sm font-black mt-0.5">{marginPercentage}% 🔥</div>
              </div>
            </div>
          )}

          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Ombor qoldig'i *</label>
            <input 
              type="number" 
              required
              disabled={isGlobalLoading}
              placeholder="Masalan: 50"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* QUICK VARIATIONS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot variantlari</label>
            <span className="text-[9px] font-medium text-slate-400">Enter orqali qo'shing</span>
          </div>

          <input 
            type="text" 
            disabled={isGlobalLoading}
            placeholder="Masalan: 50ml, 100ml, Qizil"
            value={currentVariant}
            onChange={(e) => setCurrentVariant(e.target.value)}
            onKeyDown={handleAddVariant}
            className="w-full h-11 px-3 bg-[#F4F5F9] rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />

          {variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {variants.map((v, index) => (
                <span key={index} className="bg-indigo-50 text-[#5346E0] text-[11px] font-black pl-2.5 pr-1.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                  {v}
                  {!isGlobalLoading && (
                    <button type="button" onClick={() => handleRemoveVariant(index)} className="w-4 h-4 rounded-full hover:bg-indigo-100 flex items-center justify-center text-[10px] font-bold">
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* TAVSIF (DESCRIPTION) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Mahsulot tavsifi</label>
            <button 
              type="button"
              disabled={isGlobalLoading}
              onClick={() => setDescription("Ushbu yuqori sifatli mahsulot terini chuqur namlantiradi, unga tabiiy jilo va sog'lom ko'rinish beradi. Kundalik foydalanish uchun juda mos keladi.")}
              className="text-[10px] font-black text-[#5346E0] bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
            >
              ✨ AI bilan to'ldirish
            </button>
          </div>
          <textarea 
            rows="3" 
            disabled={isGlobalLoading}
            placeholder="Mahsulot haqida batafsil ma'lumot yozing..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 bg-[#F4F5F9] rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
          ></textarea>
        </div>

        {/* FIXED FLOATING BUTTON: SAQLASH TUGMASI */}
        <div className="fixed bottom-24 left-0 right-0 px-4 z-40">
          <button 
            type="submit"
            disabled={isGlobalLoading}
            className={`w-full h-11 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 active:scale-98 transition-all ${
              isGlobalLoading 
                ? "bg-slate-400 cursor-not-allowed shadow-none" 
                : "bg-[#5346E0] shadow-indigo-600/20 hover:bg-[#4336c7]"
            }`}
          >
            {isGlobalLoading ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{uploadLoading ? `Rasm yuklanmoqda (${uploadProgress}%)` : "Firestore-ga yozilmoqda..."}</span>
              </div>
            ) : (
              <span>Yaratish va Saqlash ✨</span>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AddProductPage;