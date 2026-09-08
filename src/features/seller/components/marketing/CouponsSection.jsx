import { useState, useCallback } from "react";
import { Tag, Plus, Trash2, Percent, Wallet, Megaphone } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useCoupons } from "@/hooks/seller/useCoupons";
import { usePartnerCodeStats } from "@/hooks/seller/usePartnerCodeStats";
import StatusModal from "@/components/ui/StatusModal";
import CustomSelect from "@/components/ui/CustomSelect";
import { useLanguage } from "@/context/LanguageContext";
import { getTariffLimits } from "@/utils/tariffLimits";

/**
 * "PROMOKODLAR" bo'limi — 2026-09 birlashtirilgan "Marketing va
 * Kuponlar" sahifasining (`MarketingHub.jsx`) BIRINCHI tabi.
 *
 * OLDIN: bu — `MarketingCoupons.jsx` nomli TO'LIQ ALOHIDA sahifaning
 * o'zi edi, ichida HAM promokod yaratish/ro'yxati, HAM referal/
 * sodiqlik/tug'ilgan kun/eslatma kabi ko'plab yoqish-o'chirish
 * sozlamalari (toggle) birga edi. Foydalanuvchi so'roviga ko'ra:
 * (1) promokod qismi shu yerda, ALOHIDA tab sifatida qoladi;
 * (2) barcha toggle sozlamalar ALOHIDA "Sozlamalar" sahifasiga
 * (`MarketingSettingsPage.jsx`, gear tugmasi orqali) ko'chirildi.
 *
 * Bu komponent — sof "bo'lim" (tashqi wrapper/sarlavhasiz), xuddi
 * `PaymentSettingsSection.jsx`/`TariffsSection.jsx` naqshi kabi.
 */
const CouponsSection = () => {
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
    <div className="p-4 space-y-4">
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

      {globalError && (
        <StatusModal variant="error" title={t("marketing.errorTitle")} message={globalError} onClose={() => setGlobalError(null)} />
      )}
    </div>
  );
};

export default CouponsSection;
