import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ImageOff, Loader2, Link2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import updateSeller from "@/services/sellers/updateSeller";
import StoreLinkPicker from "@/features/seller/components/shared/StoreLinkPicker";
import { getTariffLimits } from "@/utils/tariffLimits";

/**
 * SOTUVCHI BANNER (bosh sahifadagi slayder) BOSHQARUVI.
 *
 * MUHIM TOPILMA: bu funksiya AVVAL UMUMAN MAVJUD EMAS EDI -
 * `HeroSlider.jsx` har doim, HAR BIR sotuvchi uchun, QATTIQ
 * BELGILANGAN (statik) rasm/matnlarni ko'rsatardi - sotuvchi buni
 * o'zgartira olmasdi. Endi sotuvchi o'z banner(lar)ini shu yerdan
 * yuklaydi; `HeroSlider.jsx` esa banner umuman bo'lmasa, HECH NARSA
 * ko'rsatmaydi (bo'sh joy qoldirmaydi).
 */
const BannerSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { uploadImage, progress, loading: uploading } = useUploadImage();

  const [banners, setBanners] = useState(store?.heroBanners || []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [linkPath, setLinkPath] = useState(null);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  // Z-TARIFLAR (2026-09): endi qattiq belgilangan son EMAS - Z-Start
  // tarifda 3 ta, Z-Pro/Z-Biznes'da cheksiz (haqiqiy tekshiruv
  // `firestore.rules`da - bu yerdagi limit faqat UX uchun). `null` =
  // cheksiz.
  const maxBanners = getTariffLimits(store).maxBanners;

  const handlePickImage = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleAdd = useCallback(async () => {
    if (!imageFile || !title.trim()) {
      setError(t("bannerSettings.requiredError"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const imageUrl = await uploadImage(imageFile, `banners/${sellerId}`);
      const newBanner = { id: `banner_${Date.now()}`, imageUrl, title: title.trim(), description: description.trim(), href: linkPath || null };
      const updated = [...banners, newBanner];
      await updateSeller(sellerId, { heroBanners: updated });
      setBanners(updated);
      setTitle("");
      setDescription("");
      setImageFile(null);
      setImagePreview(null);
      setLinkPath(null);
    } catch (err) {
      setError(err.message || t("bannerSettings.saveError"));
    } finally {
      setSaving(false);
    }
  }, [imageFile, title, description, banners, sellerId, uploadImage, linkPath, t]);

  const handleRemove = useCallback(async (bannerId) => {
    const updated = banners.filter((b) => b.id !== bannerId);
    setBanners(updated);
    try {
      await updateSeller(sellerId, { heroBanners: updated });
    } catch (err) {
      setError(err.message || t("bannerSettings.saveError"));
    }
  }, [banners, sellerId, t]);

  const isBusy = saving || uploading;
  const canAddMore = maxBanners === null || banners.length < maxBanners;

  return (
    <div className="h-screen overflow-y-auto bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-black text-slate-800 dark:text-white truncate">{t("bannerSettings.pageTitle")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{t("bannerSettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-36">
        {banners.length > 0 && (
          <div className="space-y-3">
            {banners.map((b) => (
              <div key={b.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff size={16} className="text-slate-300 dark:text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{b.title}</p>
                  {b.description && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{b.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(b.id)}
                  className="shrink-0 w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {banners.length === 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-3.5">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 leading-relaxed">{t("bannerSettings.emptyExplainer")}</p>
          </div>
        )}

        {canAddMore ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("bannerSettings.addTitle")}</h3>

            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt={t("bannerSettings.addTitle")} className="w-full h-32 object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <label className="w-full h-32 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 cursor-pointer">
                <Plus size={20} />
                <span className="text-xs font-bold">{t("bannerSettings.addImage")}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
              </label>
            )}

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("bannerSettings.titlePlaceholder")}
              maxLength={40}
              style={{ fontSize: "12px" }}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("bannerSettings.descriptionPlaceholder")}
              maxLength={60}
              style={{ fontSize: "12px" }}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {/* MUHIM QO'SHIMCHA: banner bosilganda qayerga olib
                borishini SOTUVCHI TANLAYDI (qo'lda havola yozmaydi) -
                `StoreLinkPicker` orqali. Ixtiyoriy - bo'sh qoldirilsa,
                banner shunchaki `/catalog`ga olib boradi
                (`HeroSlider.jsx`dagi standart qiymat). */}
            <button
              type="button"
              onClick={() => setShowLinkPicker(true)}
              className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 rounded-xl flex items-center gap-2 text-left"
            >
              <Link2 size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span style={{ fontSize: "12px" }} className={`font-semibold truncate ${linkPath ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}>
                {linkPath ? t("bannerSettings.linkSelected") : t("bannerSettings.linkPlaceholder")}
              </span>
            </button>

            {uploading && (
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            {error && <p className="text-xs text-rose-500 font-semibold">{error}</p>}

            <button
              type="button"
              onClick={handleAdd}
              disabled={isBusy || !imageFile || !title.trim()}
              className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("bannerSettings.addButton")}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-400 dark:text-slate-500">{t("bannerSettings.maxReached", { max: maxBanners })}</p>
            <button
              type="button"
              onClick={() => navigate("/seller/tariffs")}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 underline underline-offset-2"
            >
              {t("bannerSettings.upgradeLink")}
            </button>
          </div>
        )}
      </div>

      {showLinkPicker && (
        <StoreLinkPicker onSelect={(option) => setLinkPath(option.path)} onClose={() => setShowLinkPicker(false)} />
      )}
    </div>
  );
};

export default BannerSettingsPage;
