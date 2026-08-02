import { memo, useState } from "react";
import { useSession } from "@/context/SessionContext";
import useCreateSeller from "@/hooks/seller/useCreateSeller";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { formatUzPhone, isValidUzPhone } from "@/utils/phone";
import { STORE_NICHES } from "@/constants/storeNiches";
import { UZBEKISTAN_REGIONS } from "@/constants/uzbekistanRegions";
import StatusModal from "@/components/ui/StatusModal";

const CreateStoreScreen = ({ onBack }) => {
  const { telegramUser, completeOnboarding } = useSession();
  const { createStore, loading: creating, error: createError } = useCreateSeller();
  const { uploadImage, loading: uploading, progress } = useUploadImage();

  const [formData, setFormData] = useState({
    storeName: "",
    phone: "",
    category: "",
    region: "",
    description: "",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({ ...prev, phone: formatUzPhone(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errors = {};
    if (!formData.storeName.trim()) errors.storeName = "Do'kon nomini kiriting";
    if (!formData.phone.trim()) errors.phone = "Telefon raqamni kiriting";
    else if (!isValidUzPhone(formData.phone)) errors.phone = "To'liq telefon raqam kiriting";
    if (!formData.category) errors.category = "Sohani tanlang";
    if (!formData.region) errors.region = "Joylashuvni tanlang";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || !telegramUser?.id) return;
    setSubmitError(null);

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `store-logos/${telegramUser.id}`);
      }

      await createStore(String(telegramUser.id), {
        storeName: formData.storeName,
        phone: formData.phone,
        category: formData.category,
        region: formData.region,
        description: formData.description,
        logo: logoUrl,
      });

      setDone(true);
    } catch (err) {
      setSubmitError(err.message || "Do'kon yaratishda xatolik yuz berdi");
    }
  };

  const isBusy = creating || uploading;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-12 pt-4 transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#1e293b] dark:text-white">Do'koningizni yarating</h1>
          <p className="text-xs text-gray-400 dark:text-slate-500">Bir necha maydonni to'ldiring, xolos</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        <form onSubmit={handleSubmit} noValidate className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800 space-y-5">

          {/* LOGOTIP */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden text-2xl">
                {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : "🖼️"}
              </div>
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="store-logo-input" />
              <label
                htmlFor="store-logo-input"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs cursor-pointer border-2 border-white dark:border-slate-900"
              >
                ✎
              </label>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">Do'kon logotipi (ixtiyoriy)</p>
            {uploading && <p className="text-[10px] text-blue-500 font-semibold mt-1">Yuklanmoqda: {progress}%</p>}
          </div>

          {/* DO'KON NOMI */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Do'kon nomi</label>
            <input
              type="text"
              name="storeName"
              value={formData.storeName}
              onChange={handleChange}
              placeholder="Masalan: Shahnoza Flowers"
              className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.storeName ? 'border-rose-400' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
            />
            {fieldErrors.storeName && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.storeName}</p>}
          </div>

          {/* TELEFON */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Telefon raqam</label>
            <input
              type="tel"
              inputMode="numeric"
              name="phone"
              value={formData.phone}
              onFocus={() => { if (!formData.phone) setFormData((prev) => ({ ...prev, phone: '+998 ' })); }}
              onChange={handleChange}
              placeholder="+998 90 123 45 67"
              maxLength={17}
              className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.phone ? 'border-rose-400' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
            />
            {fieldErrors.phone && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.phone}</p>}
          </div>

          {/* JOYLASHUV */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Joylashuv (viloyat)</label>
            <div className="relative">
              <select
                name="region"
                value={formData.region}
                onChange={handleChange}
                className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm appearance-none font-medium ${formData.region ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-slate-500'} ${fieldErrors.region ? 'border-rose-400' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
              >
                <option value="" disabled>Viloyatni tanlang</option>
                {UZBEKISTAN_REGIONS.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">🔽</span>
            </div>
            {fieldErrors.region && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.region}</p>}
          </div>

          {/* SOHA */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">Do'koningiz sohasi</label>
            <div className="grid grid-cols-2 gap-2">
              {STORE_NICHES.map((niche) => (
                <button
                  key={niche.value}
                  type="button"
                  onClick={() => { setFormData((prev) => ({ ...prev, category: niche.value })); setFieldErrors((prev) => ({ ...prev, category: null })); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    formData.category === niche.value
                      ? "bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                      : "bg-[#f8fafc] dark:bg-slate-800 border-transparent text-gray-600 dark:text-slate-300"
                  }`}
                >
                  <span>{niche.icon}</span>
                  <span className="truncate">{niche.value}</span>
                </button>
              ))}
            </div>
            {fieldErrors.category && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.category}</p>}
          </div>

          {/* TAVSIF */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Do'kon haqida (ixtiyoriy)</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleChange}
              placeholder="Do'koningiz haqida qisqacha ma'lumot yozing..."
              className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-center text-sm shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {isBusy ? "Yaratilmoqda..." : "Do'konni yaratish"}
          </button>
        </form>
      </div>

      {(submitError || createError) && (
        <StatusModal
          variant="error"
          title="Xatolik yuz berdi"
          message={submitError || createError}
          onClose={() => setSubmitError(null)}
        />
      )}

      {done && (
        <StatusModal
          variant="success"
          title="Do'koningiz muvaffaqiyatli yaratildi! 🎉"
          message="Endi mahsulot qo'shishni boshlashingiz mumkin."
          onClose={completeOnboarding}
        />
      )}
    </div>
  );
};

export default memo(CreateStoreScreen);
