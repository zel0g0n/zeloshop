import { memo, useState } from "react";
import { ArrowLeft, ImagePlus, Pencil, MapPin } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import useCreateSeller from "@/hooks/seller/useCreateSeller";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import { formatUzPhone, isValidUzPhone } from "@/utils/phone";
import { UZBEKISTAN_REGIONS } from "@/constants/uzbekistanRegions";
import CustomSelect from "@/components/ui/CustomSelect";
import StatusModal from "@/components/ui/StatusModal";
import LocationPickerModal from "@/components/ui/LocationPickerModal";
import { saveYandexDeliveryConfig } from "@/services/delivery/yandexDeliveryConfig";
import recordSellerReferral from "@/services/sellers/recordSellerReferral";
import { useLanguage } from "@/context/LanguageContext";
import { NICHE_IDS, getNicheConfig } from "@/config/niches";

// YANGILANDI (15-niche universal platforma): platforma endi 15 xil
// sohani qo'llab-quvvatlaydi (`src/config/niches.js`) — shuning uchun
// "Do'koningiz sohasi" tanlash maydoni QAYTARILDI. Standart tanlov
// ("Kosmetika") saqlanadi (birinchi variant sifatida ko'rsatiladi),
// chunki platforma shu sohadan boshlangan va ko'pchilik hozirgi
// foydalanuvchilar shu bilan tanish — lekin endi sotuvchi istalgan
// boshqa 14 ta sohani ham tanlashi mumkin.
const DEFAULT_NICHE = "Kosmetika";

const CreateStoreScreen = ({ onBack }) => {
  const { t } = useLanguage();
  const { telegramUser, completeOnboarding, sellerInviterId } = useSession();
  const { createStore, loading: creating, error: createError } = useCreateSeller();
  const { uploadImage, loading: uploading, progress } = useUploadImage();

  const [formData, setFormData] = useState({
    storeName: "",
    phone: "",
    region: "",
    description: "",
    category: DEFAULT_NICHE,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  // DO'KON MANZILI — kuryer (Yandex Delivery) mahsulotni aynan shu
  // nuqtadan olib ketadi. Bu ma'lumot `sellers/{id}/private/yandexDelivery`
  // ichida saqlanadi (`YandexPickupLocationCard.jsx` bilan BIR XIL joy,
  // "Do'kon sozlamalari" VA "Yetkazib berish" sahifalarida qayta
  // ishlatiladi) — shu sababli, sotuvchi keyinchalik Yandex Delivery'ni
  // yoqmoqchi bo'lganda, manzilni QAYTADAN kiritishi SHART EMAS, u
  // allaqachon to'ldirilgan holda kutib turadi.
  const [pickupLocation, setPickupLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(false);
  // Yaratilgan do'kon ma'lumoti — muvaffaqiyat modali yopilganda
  // `completeOnboarding`ga uzatiladi, shunda SessionContext'dagi
  // `store` DARHOL to'ladi (pastdagi izohga qarang).
  const [createdStore, setCreatedStore] = useState(null);

  const handlePickupConfirm = (location) => {
    setPickupLocation(location);
    setPickupAddress(`${t("yandexDelivery.mapAddressPrefix")} ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    setShowMapPicker(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({ ...prev, phone: formatUzPhone(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev));
  };

  const handleRegionChange = (value) => {
    setFormData((prev) => ({ ...prev, region: value }));
    setFieldErrors((prev) => (prev.region ? { ...prev, region: null } : prev));
  };

  const handleNicheChange = (value) => {
    setFormData((prev) => ({ ...prev, category: value }));
  };

  // Tanlash komponenti uchun {value,label} juftliklari — nom i18n
  // orqali (`niches.<id>`) barcha 3 tilda ko'rsatiladi.
  const nicheOptions = NICHE_IDS.map((id) => ({ value: id, label: t(getNicheConfig(id).nameKey) }));

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

      const uid = String(telegramUser.id);

      await createStore(uid, {
        storeName: formData.storeName,
        phone: formData.phone,
        category: formData.category || DEFAULT_NICHE,
        region: formData.region,
        description: formData.description,
        logo: logoUrl,
      });

      // Manzil (kuryer olib ketadigan nuqta) — ixtiyoriy, tanlangan
      // bo'lsagina Yandex Delivery'ning shaxsiy sozlamalar hujjatiga
      // oldindan yozib qo'yiladi (o'chirilmagan/xatolik holatida ham
      // do'kon yaratish jarayonini TO'XTATMAYDI — bu qo'shimcha qulaylik,
      // asosiy oqim emas).
      if (pickupLocation) {
        saveYandexDeliveryConfig(uid, {
          pickupAddress,
          pickupLat: pickupLocation.lat,
          pickupLng: pickupLocation.lng,
          enabled: false,
          oauthToken: "",
        }).catch(() => {});
      }

      // Sotuvchini taklif qilish havolasi orqali kelgan bo'lsa - kim
      // taklif qilganini yozib qo'yamiz (`sellerReferrals.js`).
      // Ixtiyoriy/fon jarayoni - xato bo'lsa ham do'kon yaratish
      // muvaffaqiyati buzilmaydi.
      if (sellerInviterId) {
        recordSellerReferral(sellerInviterId).catch(() => {});
      }

      setCreatedStore({
        storeName: formData.storeName.trim(),
        phone: formData.phone.trim(),
        category: formData.category || DEFAULT_NICHE,
        region: formData.region,
        description: formData.description?.trim() || null,
        logo: logoUrl,
        status: "active",
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
          className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center shadow-sm active:scale-95 transition-all text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft size={18} />
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
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden text-slate-400 dark:text-slate-500">
                {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <ImagePlus size={26} />}
              </div>
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="store-logo-input" />
              <label
                htmlFor="store-logo-input"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center cursor-pointer border-2 border-white dark:border-slate-900"
              >
                <Pencil size={12} />
              </label>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">Do'kon logotipi (ixtiyoriy)</p>
            {uploading && <p className="text-[10px] text-blue-500 font-semibold mt-1">Yuklanmoqda: {progress}%</p>}
          </div>

          {/* DO'KON SOHASI (NICHE) — tanlangan sohaga qarab kategoriyalar,
              atributlar, filterlar, AI kontekst va qidiruv avtomatik
              moslashadi (`src/config/niches.js`). */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">{t("onboarding.nicheLabel")}</label>
            <CustomSelect
              value={formData.category}
              onChange={handleNicheChange}
              options={nicheOptions}
              placeholder={t("onboarding.nichePlaceholder")}
            />
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

          {/* JOYLASHUV — endi zamonaviy, ilovaning o'z uslubidagi
              tanlash komponenti (native <select> o'rniga) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Joylashuv (viloyat)</label>
            <CustomSelect
              value={formData.region}
              onChange={handleRegionChange}
              options={UZBEKISTAN_REGIONS}
              placeholder="Viloyatni tanlang"
              error={Boolean(fieldErrors.region)}
            />
            {fieldErrors.region && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.region}</p>}
          </div>

          {/* DO'KON MANZILI (kuryer olib ketadigan manzil) — xaritadan
              tanlash, YandexPickupLocationCard.jsx bilan bir xil uslubda */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">
              Do'kon manzili (kuryer olib ketadigan manzil)
            </label>
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-left"
            >
              <MapPin size={16} className="text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                {pickupLocation ? pickupAddress : "Xaritadan belgilang (ixtiyoriy)"}
              </span>
            </button>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 pl-1">
              Bu manzil Yandex Delivery kuryeri mahsulotni olib ketadigan nuqta sifatida ishlatiladi. Keyinroq sozlamalardan ham o'zgartirishingiz mumkin.
            </p>
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
          title="Do'koningiz muvaffaqiyatli yaratildi!"
          message="Endi mahsulot qo'shishni boshlashingiz mumkin."
          onClose={() => completeOnboarding(createdStore)}
        />
      )}

      {showMapPicker && (
        <LocationPickerModal
          initialLocation={pickupLocation}
          onConfirm={handlePickupConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  );
};

export default memo(CreateStoreScreen);
