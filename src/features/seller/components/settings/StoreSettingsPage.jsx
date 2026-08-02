import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store as StoreIcon } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import updateSeller from "@/services/sellers/updateSeller";
import { STORE_NICHES } from "@/constants/storeNiches";
import { UZBEKISTAN_REGIONS } from "@/constants/uzbekistanRegions";
import { formatUzPhone, isValidUzPhone } from "@/utils/phone";
import StatusModal from "@/components/ui/StatusModal";

// OLDIN: sotuvchi o'z do'kon ma'lumotlarini (nomi, logotipi, telefon,
// soha, joylashuv, tavsif) FAQAT ro'yxatdan o'tishda, bir marta
// kiritar edi — keyinchalik hech qanday o'zgartirish imkoniyati
// yo'q edi. Bu — allaqachon aniqlangan, muhim bo'shliq edi.
const StoreSettingsPage = () => {
  const navigate = useNavigate();
  const { sellerId, store } = useSession();
  const { uploadImage, loading: uploading, progress: uploadProgress } = useUploadImage();

  const [storeName, setStoreName] = useState(store?.storeName || "");
  const [phone, setPhone] = useState(store?.phone || "");
  const [category, setCategory] = useState(store?.category || STORE_NICHES[0].value);
  const [region, setRegion] = useState(store?.region || "");
  const [description, setDescription] = useState(store?.description || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(store?.logo || null);

  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!store) return;
    setStoreName(store.storeName || "");
    setPhone(store.phone || "");
    setCategory(store.category || STORE_NICHES[0].value);
    setRegion(store.region || "");
    setDescription(store.description || "");
    setLogoPreview(store.logo || null);
  }, [store]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errors = {};
    if (!storeName.trim()) errors.storeName = "Do'kon nomini kiriting";
    if (!phone.trim()) errors.phone = "Telefon raqamni kiriting";
    else if (!isValidUzPhone(phone)) errors.phone = "To'liq telefon raqam kiriting";
    if (!region) errors.region = "Joylashuvni tanlang";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      let logoUrl = store?.logo || null;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `store-logos/${sellerId}`);
      }

      await updateSeller(sellerId, {
        storeName: storeName.trim(),
        phone: phone.trim(),
        category,
        region,
        description: description.trim() || null,
        logo: logoUrl,
      });
      setShowSaved(true);
    } catch (err) {
      setError(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName, phone, category, region, description, logoFile, sellerId, store]);

  const isBusy = saving || uploading;

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-32 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">Do'kon sozlamalari</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Logotip, nomi va bio ma'lumotlar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-[#F4F5F9] dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden text-slate-400 dark:text-slate-500">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <StoreIcon size={26} />
              )}
            </div>
            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="store-logo-edit-input" disabled={isBusy} />
            <label
              htmlFor="store-logo-edit-input"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs cursor-pointer border-2 border-white dark:border-slate-900"
            >
              ✎
            </label>
          </div>
          {uploading && <p className="text-[10px] text-indigo-500 font-semibold mt-2">Yuklanmoqda: {uploadProgress}%</p>}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Do'kon nomi</label>
            <input
              type="text"
              disabled={isBusy}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className={`w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 ${fieldErrors.storeName ? "ring-1 ring-rose-400" : ""}`}
            />
            {fieldErrors.storeName && <p className="text-[11px] text-rose-500 font-semibold">{fieldErrors.storeName}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Telefon raqam</label>
            <input
              type="tel"
              inputMode="numeric"
              disabled={isBusy}
              value={phone}
              onChange={(e) => setPhone(formatUzPhone(e.target.value))}
              maxLength={17}
              className={`w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 ${fieldErrors.phone ? "ring-1 ring-rose-400" : ""}`}
            />
            {fieldErrors.phone && <p className="text-[11px] text-rose-500 font-semibold">{fieldErrors.phone}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Joylashuv</label>
            <select
              disabled={isBusy}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={`w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 ${fieldErrors.region ? "ring-1 ring-rose-400" : ""}`}
            >
              <option value="" disabled>Viloyatni tanlang</option>
              {UZBEKISTAN_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {fieldErrors.region && <p className="text-[11px] text-rose-500 font-semibold">{fieldErrors.region}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Soha</label>
            <select
              disabled={isBusy}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-semibold text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            >
              {STORE_NICHES.map((niche) => (
                <option key={niche.value} value={niche.value}>{niche.icon} {niche.value}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Do'kon haqida</label>
            <textarea
              rows="3"
              disabled={isBusy}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do'koningiz haqida qisqacha ma'lumot..."
              className="w-full p-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-medium text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none disabled:opacity-60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="w-full h-12 bg-[#5346E0] hover:bg-[#4336c7] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
        >
          {isBusy ? "Saqlanmoqda..." : "O'zgarishlarni saqlash"}
        </button>
      </form>

      {showSaved && (
        <StatusModal
          variant="success"
          title="Do'kon ma'lumotlari yangilandi! ✅"
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default StoreSettingsPage;
