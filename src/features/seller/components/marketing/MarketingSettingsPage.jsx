import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Percent, Gift, ShoppingCart, Heart, RotateCcw, Star, Cake, Trophy } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import updateSeller from "@/services/sellers/updateSeller";
import StatusModal from "@/components/ui/StatusModal";
import { useLanguage } from "@/context/LanguageContext";
import { getEffectiveTariffPlan } from "@/utils/tariffLimits";
import BiznesBadge from "@/components/ui/BiznesBadge";

/**
 * MARKETING — SOZLAMALAR (2026-09, foydalanuvchi so'roviga ko'ra
 * ALOHIDA sahifaga ajratildi, 8-band).
 *
 * OLDIN: referal/sodiqlik/tug'ilgan kun/savat-eslatma/sevimlilar/
 * qayta-sotib-olish kabi BARCHA yoqish-o'chirish (toggle) sozlamalari
 * `MarketingCoupons.jsx`ning O'ZIDA, promokod yaratish formasi bilan
 * BIRGA, bitta uzun sahifada edi — bu ham "Marketing" sahifasini
 * haddan tashqari uzun qilardi, ham promokod (asosiy, tez-tez
 * ishlatiladigan) funksiyani ko'plab kamdan-kam o'zgartiriladigan
 * sozlamalar orasiga "ko'mib" yuborardi.
 *
 * ENDI: bularning barchasi shu, BUTUNLAY ALOHIDA sahifaga ko'chirildi —
 * `MarketingHub.jsx`ning sarlavha qatoridagi "Sozlamalar" (gear)
 * tugmasi orqali ochiladi — xuddi `AiCeoSettingsPage.jsx` naqshi kabi.
 *
 * MUHIM TUZATISH (12-band, "sozlama saqlanmayapti" bug'i): OLDIN bu
 * yerdagi HECH BIR `updateSeller()` chaqiruvi keyin `patchStore()`ni
 * chaqirmasdi — natijada `SessionContext.jsx`dagi keshlangan `store`
 * yangilanmasdan qolardi, va sahifadan chiqib qayta kirilganda
 * (`useEffect` `store`dan qayta o'qiganda) SAQLANGAN qiymat emas,
 * ESKI (keshdagi) qiymat ko'rinardi. Endi HAR BIR muvaffaqiyatli
 * saqlashdan keyin `patchStore()` ham chaqiriladi.
 */
const MarketingSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();
  const isBiznes = getEffectiveTariffPlan(store) === "biznes";

  const [globalError, setGlobalError] = useState(null);

  // REFERAL DASTURI SOZLAMALARI - standart bo'yicha YOQILGAN (10%),
  // sotuvchi o'chirishi yoki foizni o'zgartirishi mumkin.
  const [referralEnabled, setReferralEnabled] = useState(store?.referralProgramEnabled !== false);
  const [referralPercent, setReferralPercent] = useState(store?.referralDiscountPercent || 10);
  const [referralDirty, setReferralDirty] = useState(false);
  const [referralSaving, setReferralSaving] = useState(false);

  // HAFTALIK REYTING MUKOFOTI (#114, "savdoni oshiruvchi" ro'yxati) -
  // eng ko'p do'st taklif qilgan TOP-3 mijozga har hafta avtomatik
  // chegirma promokodi (`functions/referralLeaderboardBonus.js`).
  // Standart bo'yicha YOQILGAN (bazaviy referal dasturi kabi - real
  // pul xavfi yo'q, faqat bir martalik promokod), lekin sotuvchi
  // ATAYLAB o'chirishi mumkin.
  const [leaderboardBonusEnabled, setLeaderboardBonusEnabled] = useState(store?.referralLeaderboardBonusEnabled !== false);

  useEffect(() => {
    if (!store) return;
    setReferralEnabled(store.referralProgramEnabled !== false);
    setReferralPercent(store.referralDiscountPercent || 10);
    setLeaderboardBonusEnabled(store.referralLeaderboardBonusEnabled !== false);
  }, [store]);

  const handleReferralToggle = useCallback(async () => {
    const next = !referralEnabled;
    setReferralEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { referralProgramEnabled: next });
        patchStore({ referralProgramEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [referralEnabled, sellerId, patchStore]);

  const handleReferralPercentSave = useCallback(async () => {
    if (!sellerId) return;
    setReferralSaving(true);
    try {
      const value = Number(referralPercent) || 10;
      await updateSeller(sellerId, { referralDiscountPercent: value });
      patchStore({ referralDiscountPercent: value });
      setReferralDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setReferralSaving(false);
    }
  }, [sellerId, referralPercent, patchStore]);

  const handleLeaderboardBonusToggle = useCallback(async () => {
    const next = !leaderboardBonusEnabled;
    setLeaderboardBonusEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { referralLeaderboardBonusEnabled: next });
        patchStore({ referralLeaderboardBonusEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [leaderboardBonusEnabled, sellerId, patchStore]);

  // SODIQLIK DASTURI ("Bonus hisobi") - standart bo'yicha O'CHIRILGAN
  // (referal dasturidan farqli o'laroq, bu sotuvchining haqiqiy pul
  // chegirmasini anglatadi - shuning uchun ONGLI ravishda yoqishi
  // kerak).
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(store?.loyaltyEnabled === true);
  const [loyaltyEarnPercent, setLoyaltyEarnPercent] = useState(store?.loyaltyEarnPercent || 2);
  const [loyaltyMaxRedeemPercent, setLoyaltyMaxRedeemPercent] = useState(store?.loyaltyMaxRedeemPercent || 50);
  const [loyaltyDirty, setLoyaltyDirty] = useState(false);
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setLoyaltyEnabled(store.loyaltyEnabled === true);
    setLoyaltyEarnPercent(store.loyaltyEarnPercent || 2);
    setLoyaltyMaxRedeemPercent(store.loyaltyMaxRedeemPercent || 50);
  }, [store]);

  const handleLoyaltyToggle = useCallback(async () => {
    const next = !loyaltyEnabled;
    setLoyaltyEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { loyaltyEnabled: next });
        patchStore({ loyaltyEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [loyaltyEnabled, sellerId, patchStore]);

  const handleLoyaltySave = useCallback(async () => {
    if (!sellerId) return;
    setLoyaltySaving(true);
    try {
      const earnPercent = Number(loyaltyEarnPercent) || 2;
      const maxRedeemPercent = Number(loyaltyMaxRedeemPercent) || 50;
      await updateSeller(sellerId, {
        loyaltyEarnPercent: earnPercent,
        loyaltyMaxRedeemPercent: maxRedeemPercent,
      });
      patchStore({ loyaltyEarnPercent: earnPercent, loyaltyMaxRedeemPercent: maxRedeemPercent });
      setLoyaltyDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoyaltySaving(false);
    }
  }, [sellerId, loyaltyEarnPercent, loyaltyMaxRedeemPercent, patchStore]);

  // TUG'ILGAN KUN AVTOMATIK CHEGIRMASI - standart bo'yicha
  // O'CHIRILGAN (bu ham sodiqlik dasturi kabi haqiqiy pul chegirmasi,
  // shuning uchun ONGLI ravishda yoqilishi kerak). Mijoz o'z tug'ilgan
  // sanasini profilida (`EditProfile.jsx`) kiritgan bo'lsa VA ILGARI
  // shu do'kondan xarid qilgan bo'lsa (batafsil izoh:
  // `functions/birthdayRewards.js`) - tug'ilgan kunida bir martalik
  // promokod va tabrik xabari avtomatik yuboriladi.
  const [birthdayDiscountEnabled, setBirthdayDiscountEnabled] = useState(store?.birthdayDiscountEnabled === true);
  const [birthdayDiscountPercent, setBirthdayDiscountPercent] = useState(store?.birthdayDiscountPercent || 10);
  const [birthdayDirty, setBirthdayDirty] = useState(false);
  const [birthdaySaving, setBirthdaySaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setBirthdayDiscountEnabled(store.birthdayDiscountEnabled === true);
    setBirthdayDiscountPercent(store.birthdayDiscountPercent || 10);
  }, [store]);

  const handleBirthdayToggle = useCallback(async () => {
    const next = !birthdayDiscountEnabled;
    setBirthdayDiscountEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { birthdayDiscountEnabled: next });
        patchStore({ birthdayDiscountEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [birthdayDiscountEnabled, sellerId, patchStore]);

  const handleBirthdaySave = useCallback(async () => {
    if (!sellerId) return;
    setBirthdaySaving(true);
    try {
      const value = Number(birthdayDiscountPercent) || 10;
      await updateSeller(sellerId, { birthdayDiscountPercent: value });
      patchStore({ birthdayDiscountPercent: value });
      setBirthdayDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setBirthdaySaving(false);
    }
  }, [sellerId, birthdayDiscountPercent, patchStore]);

  // VIP TUG'ILGAN KUN BONUSI — FAQAT Z-Biznes tarifiga xos
  // (`firestore.rules` yozishda ham, `functions/birthdayRewards.js`
  // ijro paytida ham qayta tekshiradi). Oddiy tug'ilgan kun chegirmasi
  // YOQILGAN bo'lsa ko'rsatiladi — VIP bonusi shu asosiy tizim USTIGA
  // qo'shiladi.
  const [vipBirthdayEnabled, setVipBirthdayEnabled] = useState(store?.vipBirthdayBonusEnabled === true);
  const [vipBirthdayPercent, setVipBirthdayPercent] = useState(store?.vipBirthdayDiscountPercent || 20);
  const [vipBirthdayDirty, setVipBirthdayDirty] = useState(false);
  const [vipBirthdaySaving, setVipBirthdaySaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setVipBirthdayEnabled(store.vipBirthdayBonusEnabled === true);
    setVipBirthdayPercent(store.vipBirthdayDiscountPercent || 20);
  }, [store]);

  const handleVipBirthdayToggle = useCallback(async () => {
    const next = !vipBirthdayEnabled;
    setVipBirthdayEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { vipBirthdayBonusEnabled: next });
        patchStore({ vipBirthdayBonusEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [vipBirthdayEnabled, sellerId, patchStore]);

  const handleVipBirthdaySave = useCallback(async () => {
    if (!sellerId) return;
    setVipBirthdaySaving(true);
    try {
      const value = Number(vipBirthdayPercent) || 20;
      await updateSeller(sellerId, { vipBirthdayDiscountPercent: value });
      patchStore({ vipBirthdayDiscountPercent: value });
      setVipBirthdayDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setVipBirthdaySaving(false);
    }
  }, [sellerId, vipBirthdayPercent, patchStore]);

  // "TASHLAB KETILGAN SAVAT" ESLATMASI SOZLAMALARI - eslatmaning
  // o'zi standart bo'yicha YOQILGAN (chegirmasiz - shunchaki
  // xotirlatib qo'yish), chegirma esa IXTIYORIY (0 = chegirmasiz).
  const [cartReminderEnabled, setCartReminderEnabled] = useState(store?.cartReminderEnabled !== false);
  const [cartReminderPercent, setCartReminderPercent] = useState(store?.cartReminderDiscountPercent || 0);
  const [cartReminderDirty, setCartReminderDirty] = useState(false);
  const [cartReminderSaving, setCartReminderSaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setCartReminderEnabled(store.cartReminderEnabled !== false);
    setCartReminderPercent(store.cartReminderDiscountPercent || 0);
  }, [store]);

  const handleCartReminderToggle = useCallback(async () => {
    const next = !cartReminderEnabled;
    setCartReminderEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { cartReminderEnabled: next });
        patchStore({ cartReminderEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [cartReminderEnabled, sellerId, patchStore]);

  const handleCartReminderPercentSave = useCallback(async () => {
    if (!sellerId) return;
    setCartReminderSaving(true);
    try {
      const value = Number(cartReminderPercent) || 0;
      await updateSeller(sellerId, { cartReminderDiscountPercent: value });
      patchStore({ cartReminderDiscountPercent: value });
      setCartReminderDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setCartReminderSaving(false);
    }
  }, [sellerId, cartReminderPercent, patchStore]);

  // SEVIMLILAR VA QAYTA SOTIB OLISH ESLATMALARI - haqiqiy, qurilgan
  // bildirishnomalar (`functions/engagementReminders.js`) - xuddi
  // savat eslatmasi bilan BIR XIL yoqish/o'chirish naqshi, lekin
  // chegirmasiz (soddaroq - shunchaki eslatib qo'yish).
  const [favoriteReminderEnabled, setFavoriteReminderEnabled] = useState(store?.favoriteReminderEnabled !== false);
  const [repurchaseReminderEnabled, setRepurchaseReminderEnabled] = useState(store?.repurchaseReminderEnabled !== false);

  useEffect(() => {
    if (!store) return;
    setFavoriteReminderEnabled(store.favoriteReminderEnabled !== false);
    setRepurchaseReminderEnabled(store.repurchaseReminderEnabled !== false);
  }, [store]);

  const handleFavoriteReminderToggle = useCallback(async () => {
    const next = !favoriteReminderEnabled;
    setFavoriteReminderEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { favoriteReminderEnabled: next });
        patchStore({ favoriteReminderEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [favoriteReminderEnabled, sellerId, patchStore]);

  const handleRepurchaseReminderToggle = useCallback(async () => {
    const next = !repurchaseReminderEnabled;
    setRepurchaseReminderEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { repurchaseReminderEnabled: next });
        patchStore({ repurchaseReminderEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [repurchaseReminderEnabled, sellerId, patchStore]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("marketing.settingsTitle")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("marketing.settingsSubtitle")}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* REFERAL DASTURI */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Gift size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.referral.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleReferralToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${referralEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.referral.description")}</p>

          {referralEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.referral.percentLabel")}</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={referralPercent}
                    onChange={(e) => { setReferralPercent(e.target.value); setReferralDirty(true); }}
                    className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
              {referralDirty && (
                <button
                  type="button"
                  onClick={handleReferralPercentSave}
                  disabled={referralSaving}
                  className="h-10 px-4 mt-4 bg-indigo-600 text-white text-xs font-black rounded-xl disabled:opacity-60"
                >
                  {referralSaving ? t("marketing.referral.saving") : t("marketing.referral.save")}
                </button>
              )}
            </div>
          )}

          {referralEnabled && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                <Trophy size={13} />
                <div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{t("marketing.referral.leaderboardBonusTitle")}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.referral.leaderboardBonusDescription")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLeaderboardBonusToggle}
                className={`shrink-0 w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${leaderboardBonusEnabled ? "bg-amber-500 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          )}
        </div>

        {/* SODIQLIK DASTURI (Bonus hisobi) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Star size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.loyalty.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleLoyaltyToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${loyaltyEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.loyalty.description")}</p>

          {loyaltyEnabled && (
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.loyalty.earnPercentLabel")}</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={loyaltyEarnPercent}
                    onChange={(e) => { setLoyaltyEarnPercent(e.target.value); setLoyaltyDirty(true); }}
                    className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t("marketing.loyalty.earnPercentHint")}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.loyalty.maxRedeemPercentLabel")}</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={loyaltyMaxRedeemPercent}
                    onChange={(e) => { setLoyaltyMaxRedeemPercent(e.target.value); setLoyaltyDirty(true); }}
                    className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t("marketing.loyalty.maxRedeemPercentHint")}</p>
              </div>

              {loyaltyDirty && (
                <button
                  type="button"
                  onClick={handleLoyaltySave}
                  disabled={loyaltySaving}
                  className="w-full h-10 bg-indigo-600 text-white text-xs font-black rounded-xl disabled:opacity-60"
                >
                  {loyaltySaving ? t("marketing.loyalty.saving") : t("marketing.loyalty.save")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* TUG'ILGAN KUN AVTOMATIK CHEGIRMASI */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Cake size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.birthday.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleBirthdayToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${birthdayDiscountEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.birthday.description")}</p>

          {birthdayDiscountEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.birthday.percentLabel")}</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={birthdayDiscountPercent}
                    onChange={(e) => { setBirthdayDiscountPercent(e.target.value); setBirthdayDirty(true); }}
                    className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
              {birthdayDirty && (
                <button
                  type="button"
                  onClick={handleBirthdaySave}
                  disabled={birthdaySaving}
                  className="h-10 px-4 mt-4 bg-indigo-600 text-white text-xs font-black rounded-xl disabled:opacity-60"
                >
                  {birthdaySaving ? t("marketing.birthday.saving") : t("marketing.birthday.save")}
                </button>
              )}
            </div>
          )}

          {/* VIP TUG'ILGAN KUN BONUSI — faqat Z-Biznes, va faqat
              oddiy tug'ilgan kun chegirmasi allaqachon yoqilgan bo'lsa. */}
          {birthdayDiscountEnabled && isBiznes && (
            <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[11px] font-black text-slate-600 dark:text-slate-300">{t("marketing.birthday.vipTitle")}</h4>
                  <BiznesBadge size="xs" />
                </div>
                <button
                  type="button"
                  onClick={handleVipBirthdayToggle}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${vipBirthdayEnabled ? "bg-amber-500 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.birthday.vipDescription")}</p>
              {vipBirthdayEnabled && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.birthday.vipPercentLabel")}</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        min="1"
                        max="70"
                        value={vipBirthdayPercent}
                        onChange={(e) => { setVipBirthdayPercent(e.target.value); setVipBirthdayDirty(true); }}
                        className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    </div>
                  </div>
                  {vipBirthdayDirty && (
                    <button
                      type="button"
                      onClick={handleVipBirthdaySave}
                      disabled={vipBirthdaySaving}
                      className="h-10 px-4 mt-4 bg-amber-500 text-white text-xs font-black rounded-xl disabled:opacity-60"
                    >
                      {vipBirthdaySaving ? t("marketing.birthday.saving") : t("marketing.birthday.save")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TASHLAB KETILGAN SAVAT ESLATMASI */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <ShoppingCart size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.cartReminder.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleCartReminderToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${cartReminderEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.cartReminder.description")}</p>

          {cartReminderEnabled && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.cartReminder.percentLabel")}</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    placeholder="0"
                    value={cartReminderPercent}
                    onChange={(e) => { setCartReminderPercent(e.target.value); setCartReminderDirty(true); }}
                    className="w-full h-10 px-3 pr-8 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t("marketing.cartReminder.percentHint")}</p>
              </div>
              {cartReminderDirty && (
                <button
                  type="button"
                  onClick={handleCartReminderPercentSave}
                  disabled={cartReminderSaving}
                  className="h-10 px-4 mt-4 bg-indigo-600 text-white text-xs font-black rounded-xl disabled:opacity-60 shrink-0"
                >
                  {cartReminderSaving ? t("marketing.cartReminder.saving") : t("marketing.cartReminder.save")}
                </button>
              )}
            </div>
          )}
        </div>

        {/* SEVIMLILAR ESLATMASI (yangi qurilgan bildirishnoma) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <Heart size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.favoriteReminder.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleFavoriteReminderToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${favoriteReminderEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.favoriteReminder.description")}</p>
        </div>

        {/* QAYTA SOTIB OLISH TAKLIFI (yangi qurilgan bildirishnoma) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <RotateCcw size={13} />
              <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.repurchaseReminder.title")}</h3>
            </div>
            <button
              type="button"
              onClick={handleRepurchaseReminderToggle}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${repurchaseReminderEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.repurchaseReminder.description")}</p>
        </div>
      </div>

      {globalError && (
        <StatusModal variant="error" title={t("marketing.errorTitle")} message={globalError} onClose={() => setGlobalError(null)} />
      )}
    </div>
  );
};

export default MarketingSettingsPage;
