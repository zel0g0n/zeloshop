import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Tag, Plus, Trash2, Percent, Wallet, Gift, ShoppingCart, Heart, RotateCcw, Star, Cake, Trophy, Megaphone } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCoupons } from "@/hooks/seller/useCoupons";
import { usePartnerCodeStats } from "@/hooks/seller/usePartnerCodeStats";
import updateSeller from "@/services/sellers/updateSeller";
import StatusModal from "@/components/ui/StatusModal";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";
import { getTariffLimits } from "@/utils/tariffLimits";

const MarketingCoupons = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store } = useSession();
  const { coupons, loading, create, remove } = useCoupons(sellerId);
  // Z-TARIFLAR: Z-Start tarifda promo kod UMUMAN yo'q, Z-Pro'da 3
  // tagacha, Z-Biznes'da cheksiz (haqiqiy tekshiruv `firestore.rules`da
  // - bu yerdagi hisob faqat tezkor UX xabari uchun).
  const maxCoupons = getTariffLimits(store).maxCoupons;
  const couponLimitReached = maxCoupons !== null && coupons.length >= maxCoupons;
  // Hamkor/blogger kodlari samaradorligi (#117) - alohida, YIG'MA
  // kolleksiyadan (`orders.js` avtomatik yozadi), pastdagi
  // "Hamkorlar" bo'limi uchun.
  const { stats: partnerStats, loading: partnerStatsLoading } = usePartnerCodeStats(sellerId);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percent"); // "percent" | "fixed"
  const [discountValue, setDiscountValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  // Hamkor/blogger nomi (ixtiyoriy) - to'ldirilsa, bu oddiy promokod
  // emas, balki ANIQ bir hamkorga bog'langan kod bo'ladi va uning
  // sotuvlari avtomatik kuzatiladi (pastdagi "Hamkorlar" bo'limida).
  const [partnerName, setPartnerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingCode, setDeletingCode] = useState(null);
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
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [referralEnabled, sellerId]);

  const handleReferralPercentSave = useCallback(async () => {
    if (!sellerId) return;
    setReferralSaving(true);
    try {
      await updateSeller(sellerId, { referralDiscountPercent: Number(referralPercent) || 10 });
      setReferralDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setReferralSaving(false);
    }
  }, [sellerId, referralPercent]);

  const handleLeaderboardBonusToggle = useCallback(async () => {
    const next = !leaderboardBonusEnabled;
    setLeaderboardBonusEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { referralLeaderboardBonusEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [leaderboardBonusEnabled, sellerId]);

  // SODIQLIK DASTURI ("Bonus hisobi") - YANGI TAVSIYA QILINGAN
  // FUNKSIYA (2026-09, "savdoni oshiruvchi" ro'yxati): standart
  // bo'yicha O'CHIRILGAN (referal dasturidan farqli o'laroq, bu
  // sotuvchining haqiqiy pul chegirmasini anglatadi - shuning uchun
  // ONGLI ravishda yoqishi kerak).
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
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [loyaltyEnabled, sellerId]);

  const handleLoyaltySave = useCallback(async () => {
    if (!sellerId) return;
    setLoyaltySaving(true);
    try {
      await updateSeller(sellerId, {
        loyaltyEarnPercent: Number(loyaltyEarnPercent) || 2,
        loyaltyMaxRedeemPercent: Number(loyaltyMaxRedeemPercent) || 50,
      });
      setLoyaltyDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setLoyaltySaving(false);
    }
  }, [sellerId, loyaltyEarnPercent, loyaltyMaxRedeemPercent]);

  // TUG'ILGAN KUN AVTOMATIK CHEGIRMASI - YANGI TAVSIYA QILINGAN
  // FUNKSIYA (2026-09, "savdoni oshiruvchi" ro'yxati): standart
  // bo'yicha O'CHIRILGAN (bu ham sodiqlik dasturi kabi haqiqiy pul
  // chegirmasi, shuning uchun ONGLI ravishda yoqilishi kerak).
  // Mijoz o'z tug'ilgan sanasini profilida (`EditProfile.jsx`)
  // kiritgan bo'lsa VA ILGARI shu do'kondan xarid qilgan bo'lsa
  // (batafsil izoh: `functions/birthdayRewards.js`) - tug'ilgan
  // kunida bir martalik promokod va tabrik xabari avtomatik yuboriladi.
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
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [birthdayDiscountEnabled, sellerId]);

  const handleBirthdaySave = useCallback(async () => {
    if (!sellerId) return;
    setBirthdaySaving(true);
    try {
      await updateSeller(sellerId, { birthdayDiscountPercent: Number(birthdayDiscountPercent) || 10 });
      setBirthdayDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setBirthdaySaving(false);
    }
  }, [sellerId, birthdayDiscountPercent]);

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
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [cartReminderEnabled, sellerId]);

  const handleCartReminderPercentSave = useCallback(async () => {
    if (!sellerId) return;
    setCartReminderSaving(true);
    try {
      await updateSeller(sellerId, { cartReminderDiscountPercent: Number(cartReminderPercent) || 0 });
      setCartReminderDirty(false);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setCartReminderSaving(false);
    }
  }, [sellerId, cartReminderPercent]);

  // SEVIMLILAR VA QAYTA SOTIB OLISH ESLATMALARI - endi haqiqiy,
  // qurilgan bildirishnomalar (`functions/engagementReminders.js`) -
  // xuddi savat eslatmasi bilan BIR XIL yoqish/o'chirish naqshi,
  // lekin chegirmasiz (soddaroq - shunchaki eslatib qo'yish).
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
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [favoriteReminderEnabled, sellerId]);

  const handleRepurchaseReminderToggle = useCallback(async () => {
    const next = !repurchaseReminderEnabled;
    setRepurchaseReminderEnabled(next);
    if (sellerId) {
      try {
        await updateSeller(sellerId, { repurchaseReminderEnabled: next });
      } catch (err) {
        setGlobalError(err.message);
      }
    }
  }, [repurchaseReminderEnabled, sellerId]);

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    setFormError(null);

    if (couponLimitReached) {
      setFormError(maxCoupons === 0 ? t("marketing.limitReachedStart") : t("marketing.limitReachedPro"));
      return;
    }
    if (!code.trim()) {
      setFormError(t("marketing.codeRequired"));
      return;
    }
    if (!discountValue || Number(discountValue) <= 0) {
      setFormError(t("marketing.valueRequired"));
      return;
    }
    if (discountType === "percent" && Number(discountValue) > 100) {
      setFormError(t("marketing.percentMax"));
      return;
    }

    setCreating(true);
    try {
      await create({
        code,
        discountType,
        discountValue,
        expiresAt: expiresAt || null,
        usageLimit: usageLimit || null,
        partnerName: partnerName || null,
      });
      setCode("");
      setDiscountValue("");
      setExpiresAt("");
      setUsageLimit("");
      setPartnerName("");
    } catch (err) {
      setFormError(err.message || t("marketing.createError"));
    } finally {
      setCreating(false);
    }
  }, [code, discountType, discountValue, expiresAt, usageLimit, partnerName, create, couponLimitReached, maxCoupons, t]);

  const handleDelete = useCallback(async (couponCode) => {
    setDeletingCode(couponCode);
    try {
      await remove(couponCode);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setDeletingCode(null);
    }
  }, [remove]);

  return (
    <div className="min-h-screen bg-[#F4F5F9] dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased pb-36 transition-colors duration-300">

      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 px-4 py-4 shadow-xs flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 dark:text-slate-300 active:scale-95 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-black text-slate-800 dark:text-white">{t("marketing.title")}</h1>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t("marketing.subtitle")}</p>
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

        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Tag size={13} />
            <h3 className="text-xs font-black uppercase tracking-wider">{t("marketing.newCouponTitle")}</h3>
          </div>

          <input
            type="text"
            disabled={creating}
            placeholder={t("marketing.codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl font-black text-sm uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
          />

          <div className="grid grid-cols-2 gap-2">
            <CustomSelect
              disabled={creating}
              value={discountType}
              onChange={setDiscountType}
              options={[
                { value: "percent", label: t("marketing.percentOption") },
                { value: "fixed", label: t("marketing.fixedOption") },
              ]}
            />
            <input
              type="number"
              disabled={creating}
              placeholder={discountType === "percent" ? t("marketing.percentPlaceholder") : t("marketing.fixedPlaceholder")}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="h-11 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.expiresLabel")}</label>
              <input
                type="date"
                disabled={creating}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.usageLimitLabel")}</label>
              <input
                type="number"
                disabled={creating}
                placeholder={t("marketing.unlimitedPlaceholder")}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t("marketing.partnerNameLabel")}</label>
            <input
              type="text"
              disabled={creating}
              placeholder={t("marketing.partnerNamePlaceholder")}
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              className="w-full h-10 px-3 bg-[#F4F5F9] dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("marketing.partnerNameHint")}</p>
          </div>

          {couponLimitReached && !formError && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              {maxCoupons === 0 ? t("marketing.limitReachedStart") : t("marketing.limitReachedPro")}
            </p>
          )}
          {formError && <p className="text-[11px] text-rose-500 font-semibold">{formError}</p>}

          <button
            type="submit"
            disabled={creating || couponLimitReached}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Plus size={14} /> {creating ? t("marketing.creating") : t("marketing.createButton")}
          </button>
        </form>

        <div className="space-y-2">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{t("marketing.activeCouponsTitle")}</h3>

          {loading && <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">{t("marketing.loading")}</p>}

          {!loading && coupons.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-8">{t("marketing.noCoupons")}</p>
          )}

          {!loading && coupons.map((coupon) => (
            <div key={coupon.code} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  {coupon.discountType === "percent" ? <Percent size={15} /> : <Wallet size={15} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-white truncate flex items-center gap-1.5">
                    {coupon.code}
                    {coupon.isReferralReward && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {t("marketing.referral.rewardBadge")}
                      </span>
                    )}
                    {coupon.isCartRecoveryReward && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {t("marketing.cartReminder.rewardBadge")}
                      </span>
                    )}
                    {coupon.isAiCeoWinBackReward && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {t("marketing.aiCeoWinBack.rewardBadge")}
                      </span>
                    )}
                    {coupon.isBirthdayReward && (
                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        {t("marketing.birthday.rewardBadge")}
                      </span>
                    )}
                    {coupon.partnerName && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                        <Megaphone size={9} /> {coupon.partnerName}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {coupon.discountType === "percent" ? t("marketing.percentDiscount", { value: coupon.discountValue }) : t("marketing.fixedDiscount", { value: Number(coupon.discountValue).toLocaleString() })}
                    {coupon.usageLimit ? ` · ${t("marketing.usedOfLimit", { used: coupon.usedCount, limit: coupon.usageLimit })}` : ` · ${t("marketing.usedCount", { count: coupon.usedCount })}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(coupon.code)}
                disabled={deletingCode === coupon.code}
                className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 disabled:opacity-50"
                aria-label={t("marketing.deleteAria")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* HAMKOR/BLOGGER KODLARI SAMARADORLIGI (#117) - faqat hech
            bo'lmasa bitta hamkor kodi ISHLATILGAN bo'lsa ko'rsatiladi
            (bo'sh, hech qachon ishlatilmagan ro'yxat ma'nosiz). Har
            bir yozuv `functions/orders.js` tomonidan AVTOMATIK
            yangilanadi - bu yerda hech qanday qo'lda hisoblash yo'q. */}
        {!partnerStatsLoading && partnerStats.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
              <Megaphone size={13} /> {t("marketing.partnerStats.title")}
            </h3>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs divide-y divide-slate-50 dark:divide-slate-800">
              {partnerStats.map((stat) => (
                <div key={stat.code} className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-white truncate">{stat.partnerName}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {stat.code} · {t("marketing.partnerStats.orderCount", { count: stat.orderCount || 0 })}
                    </p>
                  </div>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                    {Number(stat.totalRevenue || 0).toLocaleString()} so'm
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {globalError && (
        <StatusModal variant="error" title={t("marketing.errorTitle")} message={globalError} onClose={() => setGlobalError(null)} />
      )}
    </div>
  );
};

export default MarketingCoupons;
