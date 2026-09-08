import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lightbulb, CreditCard, Landmark, Package, Check, AlertTriangle } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import FullScreenSpinner from "@/components/ui/FullScreenSpinner";
import { usePaymentConfig } from "@/hooks/seller/usePaymentConfig";
import updateSeller from "@/services/sellers/updateSeller";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";

// 16 xonali karta raqamini "0000 0000 0000 0000" ko'rinishida
// formatlaydi - faqat UI uchun, saqlashda `paymentConfig.js` ichida
// tozalanadi (faqat raqamlar qoladi).
const formatCardNumber = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
};

// Sotuvchi bu yerda ikkita usuldan birini (yoki ikkalasini) sozlaydi:
// "Jismoniy shaxs" — shaxsiy kartaga to'g'ridan-to'g'ri to'lov (ATMOS
// hali ulanmagani uchun asosiy yechim, 2026-09 punkt-royxati 2/14-band),
// va "Yuridik shaxs" — Click/Payme kabi to'lov tizimlari orqali biznes
// hisobiga tushadigan to'lovlar. Bu ma'lumotlar `sellers/{id}/private/...`
// da, hech kimga (mijozlarga ham) ko'rinmaydigan joyda saqlanadi -
// "Jismoniy shaxs" tabidagi karta+F.I.SH BUNDAN MUSTASNO: checkout
// paytida `getSellerPaymentCardInfo` Cloud Function orqali ATAYLAB
// mijozga ko'rsatiladi (shu maqsad uchun kiritilgan).
const PaymentSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();
  const { config, loading, saving, error, save } = usePaymentConfig(sellerId);

  // "Checkout'da to'lov usullari" — 2026-09 punkt-royxati: OLDIN bu
  // HAR BIR MAHSULOT uchun alohida (`PricingCard.jsx`) belgilanardi -
  // bu, savatda turli mahsulotlar turli to'lov turini talab qilishi
  // mumkinligi sababli, checkout'da "hech qanday umumiy to'lov turi
  // topilmadi" xatosiga olib kelardi. ENDI shu YAGONA joyda, BUTUN
  // DO'KON uchun belgilanadi (`sellers/{id}.paymentTypes`, ochiq/
  // ommaviy hujjat — karta raqami kabi MAXFIY emas, shuning uchun
  // `private/paymentConfig` o'rniga asosiy hujjatda saqlanadi va
  // Checkout'dagi mijozga `store` orqali to'g'ridan-to'g'ri ko'rinadi).
  const [checkoutTypes, setCheckoutTypes] = useState(() =>
    Array.isArray(store?.paymentTypes) && store.paymentTypes.length > 0 ? store.paymentTypes : ["cod"]
  );
  const [checkoutTypesSaving, setCheckoutTypesSaving] = useState(false);
  const [checkoutTypesError, setCheckoutTypesError] = useState(null);
  const [checkoutTypesSaved, setCheckoutTypesSaved] = useState(false);

  const toggleCheckoutType = (type) => {
    setCheckoutTypesSaved(false);
    setCheckoutTypesError(null);
    setCheckoutTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));
  };

  const handleSaveCheckoutTypes = async () => {
    if (checkoutTypes.length === 0) {
      setCheckoutTypesError(t("paymentSettings.checkoutMethodsRequired"));
      return;
    }
    setCheckoutTypesSaving(true);
    setCheckoutTypesError(null);
    try {
      // "Bo'lib to'lash" (installment) imkoniyati platformada haqiqiy
      // qo'llab-quvvatlanmaydi (2026-09: sotuvchiga ko'rsatilgan, lekin
      // "bizda bu imkoniyat yo'q" deb ataylab olib tashlangan) — shu
      // sabab bu yerda doim `false` sifatida saqlanadi, hatto ilgari
      // yoqilgan bo'lsa ham (checkout'dagi mijozga ko'rinishi ham shu
      // orqali o'chadi, chunki `Checkout.jsx` faqat shu maydonga qarab
      // ko'rsatadi).
      await updateSeller(sellerId, {
        paymentTypes: checkoutTypes,
        installmentPaymentEnabled: false,
      });
      patchStore({ paymentTypes: checkoutTypes, installmentPaymentEnabled: false });
      setCheckoutTypesSaved(true);
    } catch (err) {
      setCheckoutTypesError(err.message || t("paymentSettings.checkoutMethodsRequired"));
    } finally {
      setCheckoutTypesSaving(false);
    }
  };

  const [activeTab, setActiveTab] = useState("individual"); // 'individual' | 'legal'

  const [clickServiceId, setClickServiceId] = useState("");
  const [clickSecretKey, setClickSecretKey] = useState("");
  const [clickEnabled, setClickEnabled] = useState(false);
  const [paymeMerchantId, setPaymeMerchantId] = useState("");
  const [paymeKey, setPaymeKey] = useState("");
  const [paymeEnabled, setPaymeEnabled] = useState(false);

  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [individualEnabled, setIndividualEnabled] = useState(false);

  const [showSavedModal, setShowSavedModal] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!config) return;
    setClickServiceId(config.clickServiceId || "");
    setClickSecretKey(config.clickSecretKey || "");
    setClickEnabled(Boolean(config.clickEnabled));
    setPaymeMerchantId(config.paymeMerchantId || "");
    setPaymeKey(config.paymeKey || "");
    setPaymeEnabled(Boolean(config.paymeEnabled));
    setCardNumber(formatCardNumber(config.individualCardNumber || ""));
    setCardHolderName(config.individualCardHolderName || "");
    setIndividualEnabled(Boolean(config.individualPaymentEnabled));
    // Do'kon allaqachon yuridik shaxs ma'lumotlarini to'ldirgan, lekin
    // shaxsiy kartani hali kiritmagan bo'lsa — "Yuridik shaxs" tabini
    // ochiq holda ko'rsatamiz, aks holda standart "Jismoniy shaxs".
    if ((config.clickEnabled || config.paymeEnabled) && !config.individualCardNumber) {
      setActiveTab("legal");
    }
  }, [config]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (activeTab === "individual" && (cardNumber || cardHolderName)) {
      const digits = cardNumber.replace(/\D/g, "");
      if (digits.length !== 16) {
        setFormError(t("paymentSettings.errorCardNumberInvalid"));
        return;
      }
      if (!cardHolderName.trim()) {
        setFormError(t("paymentSettings.errorCardHolderRequired"));
        return;
      }
    }

    try {
      await save({
        clickServiceId, clickSecretKey, clickEnabled,
        paymeMerchantId, paymeKey, paymeEnabled,
        individualCardNumber: cardNumber.replace(/\D/g, ""),
        individualCardHolderName: cardHolderName.trim(),
        individualPaymentEnabled: individualEnabled,
      });
      setShowSavedModal(true);
    } catch {
      // xato allaqachon `error` orqali ko'rsatiladi
    }
  };

  if (loading) {
    return <FullScreenSpinner />;
  }

  return (
    <div className="bg-[#F4F5F9] dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white pb-36 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-900 px-5 py-4 sticky top-0 z-30 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300">
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("paymentSettings.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("paymentSettings.subtitle")}</p>
        </div>
      </div>

      <div className="p-4 pb-0">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div>
            <h2 className="text-sm font-black text-slate-800 dark:text-white">{t("paymentSettings.checkoutMethodsTitle")}</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{t("paymentSettings.checkoutMethodsDescription")}</p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => toggleCheckoutType("cod")}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                checkoutTypes.includes("cod")
                  ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500"
                  : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent"
              }`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                checkoutTypes.includes("cod") ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-emerald-500"
              }`}>
                <Package size={16} />
              </span>
              <div className="text-left flex-1">
                <p className={`text-xs font-black ${checkoutTypes.includes("cod") ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}>{t("paymentSettings.checkoutCodTitle")}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("paymentSettings.checkoutCodDesc")}</p>
              </div>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                checkoutTypes.includes("cod") ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
              }`}>
                {checkoutTypes.includes("cod") && <Check size={12} strokeWidth={3} />}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleCheckoutType("prepay")}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                checkoutTypes.includes("prepay")
                  ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500"
                  : "bg-[#F4F5F9] dark:bg-slate-800 border-transparent"
              }`}
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                checkoutTypes.includes("prepay") ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-900 text-indigo-400"
              }`}>
                <CreditCard size={16} />
              </span>
              <div className="text-left flex-1">
                <p className={`text-xs font-black ${checkoutTypes.includes("prepay") ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"}`}>{t("paymentSettings.checkoutPrepayTitle")}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("paymentSettings.checkoutPrepayDesc")}</p>
              </div>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                checkoutTypes.includes("prepay") ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"
              }`}>
                {checkoutTypes.includes("prepay") && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          </div>

          {checkoutTypes.includes("prepay") && !individualEnabled && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{t("paymentSettings.individualNotConfiguredWarning")}</span>
            </div>
          )}

          {checkoutTypesError && (
            <p className="text-[11px] text-rose-500 font-semibold">{checkoutTypesError}</p>
          )}
          {checkoutTypesSaved && !checkoutTypesError && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{t("paymentSettings.checkoutMethodsSaved")}</p>
          )}

          <button
            type="button"
            onClick={handleSaveCheckoutTypes}
            disabled={checkoutTypesSaving}
            className="w-full h-11 bg-[#5346E0] text-white font-black text-xs rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
          >
            {checkoutTypesSaving ? t("paymentSettings.saving") : t("paymentSettings.checkoutMethodsSaveButton")}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-1.5 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("individual")}
            className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "individual" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <CreditCard size={14} /> {t("paymentSettings.tabIndividual")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("legal")}
            className={`h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === "legal" ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <Landmark size={14} /> {t("paymentSettings.tabLegal")}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 p-4 bg-indigo-50 dark:bg-indigo-500/10 mx-4 mt-4 rounded-2xl text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
        <Lightbulb size={15} className="shrink-0 mt-0.5" />
        <span>{activeTab === "individual" ? t("paymentSettings.individualDescription") : t("paymentSettings.legalDescription")}</span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {(formError || error) && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400">
            {formError || error}
          </div>
        )}

        {activeTab === "individual" && (
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-800 dark:text-white">{t("paymentSettings.individualEnabledLabel")}</label>
              <button
                type="button"
                onClick={() => setIndividualEnabled((v) => !v)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors ${individualEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${individualEnabled ? "translate-x-5" : ""}`} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.cardNumberLabel")}</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder={t("paymentSettings.cardNumberPlaceholder")}
                maxLength={19}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.cardHolderNameLabel")}</label>
              <input
                type="text"
                value={cardHolderName}
                onChange={(e) => setCardHolderName(e.target.value)}
                placeholder={t("paymentSettings.cardHolderNamePlaceholder")}
                className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {activeTab === "legal" && (
          <>
            {/* CLICK */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-slate-800 dark:text-white">Click</label>
                <button
                  type="button"
                  onClick={() => setClickEnabled((v) => !v)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${clickEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${clickEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.serviceIdLabel")}</label>
                <input
                  type="text"
                  value={clickServiceId}
                  onChange={(e) => setClickServiceId(e.target.value)}
                  placeholder={t("paymentSettings.serviceIdPlaceholder")}
                  className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.secretKeyLabel")}</label>
                <input
                  type="password"
                  value={clickSecretKey}
                  onChange={(e) => setClickSecretKey(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* PAYME */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-slate-800 dark:text-white">Payme</label>
                <button
                  type="button"
                  onClick={() => setPaymeEnabled((v) => !v)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${paymeEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white block transition-transform ${paymeEnabled ? "translate-x-5" : ""}`} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.merchantIdLabel")}</label>
                <input
                  type="text"
                  value={paymeMerchantId}
                  onChange={(e) => setPaymeMerchantId(e.target.value)}
                  placeholder={t("paymentSettings.merchantIdPlaceholder")}
                  className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t("paymentSettings.keyLabel")}</label>
                <input
                  type="password"
                  value={paymeKey}
                  onChange={(e) => setPaymeKey(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 bg-[#5346E0] text-white font-black text-sm rounded-2xl shadow-md shadow-indigo-600/20 disabled:opacity-60"
        >
          {saving ? t("paymentSettings.saving") : t("paymentSettings.save")}
        </button>
      </form>

      {showSavedModal && (
        <StatusModal
          variant="success"
          title={t("paymentSettings.savedTitle")}
          onClose={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default PaymentSettingsPage;
