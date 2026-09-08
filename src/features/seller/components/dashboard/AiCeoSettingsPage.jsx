import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { useLanguage } from "@/context/LanguageContext";
import updateSeller from "@/services/sellers/updateSeller";
import CustomSelect from "@/components/ui/CustomSelect";

/**
 * AI CEO — AVTOPILOT SOZLAMALARI (2026-09, sotuvchi so'roviga ko'ra
 * ALOHIDA sahifaga ajratildi).
 *
 * OLDIN: "AI CEO'ni to'liq yoqish" katta tugmasi VA yopiq/ochiq
 * "Kengaytirilgan sozlamalar" bo'limi `AiCeoInfoPage.jsx`ning ("Kunlik
 * hisobot") O'ZIDA, pastda joylashgan edi — bu, sahifani har safar
 * ochganda, ko'p sonli yoqish/o'chirish tugmasi bilan aralashib,
 * hisobotni ko'rish uchun uzoq skroll qilishni talab qilardi.
 *
 * ENDI: bularning barchasi shu, BUTUNLAY ALOHIDA sahifaga ko'chirildi —
 * "Kunlik hisobot" sahifasining sarlavha qatoridagi "Sozlamalar"
 * (gear) tugmasi orqali ochiladi. Holat/saqlash mantig'i
 * `AiCeoInfoPage.jsx`dan AYNAN, o'zgarishsiz ko'chirildi — faqat
 * joylashuv o'zgardi, xatti-harakat bir xil qoldi.
 */
const AiCeoSettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { sellerId, store, patchStore } = useSession();

  const [enabled, setEnabled] = useState(store?.aiCeoDigestEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [draftHour, setDraftHour] = useState(
    Number.isInteger(store?.aiCeoDraftProcessHour) ? String(store.aiCeoDraftProcessHour) : "21"
  );
  const [savingHour, setSavingHour] = useState(false);
  // AI CEO avtonom ijrosi: standart holatda o'chiq (opt-in, opt-out
  // emas) — yoqilsa, 30 kun xarid qilmagan mijozlarga AI CEO matnni o'zi
  // yozadi va sotuvchi tasdiqisiz avtomatik yuboradi (batafsil izoh:
  // `functions/engagementReminders.js`).
  const [autoWinBackEnabled, setAutoWinBackEnabled] = useState(store?.aiCeoAutoWinBackEnabled === true);
  const [savingAutoWinBack, setSavingAutoWinBack] = useState(false);
  // Xuddi shu avtonom ijro mantig'i sevimlilar eslatmasiga ham
  // qo'llaniladi (standart holatda o'chiq, batafsil izoh:
  // `functions/engagementReminders.js`).
  const [autoFavoriteEnabled, setAutoFavoriteEnabled] = useState(store?.aiCeoAutoFavoriteEnabled === true);
  const [savingAutoFavorite, setSavingAutoFavorite] = useState(false);
  // Yuqoridagi kabi avtonom ijro, lekin bu safar haqiqiy moliyaviy
  // oqibatga ega: yoqilsa (va `autoWinBackEnabled` ham yoqilgan bo'lsa,
  // va AI CEO'ning matni yetarlicha ishlamayotgan bo'lsa), qaytarish
  // xabariga haqiqiy, bir martalik chegirma promokodi ham avtomatik
  // qo'shiladi (standart holatda o'chiq, batafsil izoh:
  // `functions/aiCeoAutoDiscount.js`).
  const [autoDiscountEnabled, setAutoDiscountEnabled] = useState(store?.aiCeoAutoDiscountEnabled === true);
  const [savingAutoDiscount, setSavingAutoDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(
    Number.isInteger(store?.aiCeoAutoDiscountPercent) ? String(store.aiCeoAutoDiscountPercent) : "10"
  );
  const [savingDiscountPercent, setSavingDiscountPercent] = useState(false);
  const [savingMaster, setSavingMaster] = useState(false);
  // Telegram orqali "1-tugmali tasdiqlash": Mini App'ni ochmasdan,
  // to'g'ridan-to'g'ri Telegram chatida AI CEO tavsiyasini ko'rib, bitta
  // tugma bilan tasdiqlash mumkin (standart holatda o'chiq, batafsil
  // izoh: `functions/telegramApproval.js`).
  const [telegramApprovalEnabled, setTelegramApprovalEnabled] = useState(store?.aiCeoTelegramApprovalEnabled === true);
  const [savingTelegramApproval, setSavingTelegramApproval] = useState(false);
  // AI RASM GENERATSIYASI (avtomatik reklama surati, avtomatik 9:16
  // "Story" rasmi, qo'lda chaqiriladigan "AI asosiy rasm") — 2026-09,
  // sotuvchi so'roviga ko'ra BUTUNLAY OLIB TASHLANDI (Gemini API
  // kvotasi/429 muammolari sababli). Shu sozlamalar sahifasidagi
  // "Avtomatik Story rasm" tumbler ham shu sabab bilan O'CHIRILDI.
  // MENEJERGA PROAKTIV OGOHLANTIRISHLAR (2026-09 punkt-royxati,
  // "Advanced Automation", 5-band) - standart holatda o'chiq, batafsil
  // izoh: `functions/managerAlerts.js`. Ikkalasi ham SOTUVCHINING
  // O'ZIGA yuboriladi (xaridorga emas) - shuning uchun boshqa
  // kartochkalardan farqli, "konversiya" emas, "operatsion nazorat"
  // haqida.
  const [lowStockAlertEnabled, setLowStockAlertEnabled] = useState(store?.aiCeoLowStockAlertEnabled === true);
  const [savingLowStockAlert, setSavingLowStockAlert] = useState(false);
  const [staleOrderAlertEnabled, setStaleOrderAlertEnabled] = useState(store?.aiCeoStaleOrderAlertEnabled === true);
  const [savingStaleOrderAlert, setSavingStaleOrderAlert] = useState(false);

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` })),
    []
  );

  // Moliyaviy xavfni cheklash uchun qat'iy chegaralangan tanlov (backend,
  // `aiCeoAutoDiscount.js`dagi `MIN_DISCOUNT_PERCENT`/
  // `MAX_DISCOUNT_PERCENT` bilan mos).
  const discountPercentOptions = useMemo(
    () => [5, 10, 15, 20].map((p) => ({ value: String(p), label: `${p}%` })),
    []
  );

  // Katta "yoqish" tugmasi faqat uchta moliyaviy xavfsiz sozlama (kunlik
  // xulosa va ikkala avtomatik xabar turi) hammasi birdaniga yoqilgan
  // holatdagina "yoqilgan" ko'rinadi — aralash holat (masalan faqat
  // ikkitasi yoqilgan, pastdagi ro'yxatdan qo'lda sozlangan) "o'chiq"
  // deb ko'rsatiladi, chunki to'liq yoqilmagan.
  const allCoreEnabled = enabled && autoWinBackEnabled && autoFavoriteEnabled;

  const handleHourChange = useCallback(async (value) => {
    const previous = draftHour;
    setDraftHour(value);
    setSavingHour(true);
    try {
      await updateSeller(sellerId, { aiCeoDraftProcessHour: Number(value) });
      patchStore({ aiCeoDraftProcessHour: Number(value) });
    } catch {
      setDraftHour(previous);
    } finally {
      setSavingHour(false);
    }
  }, [draftHour, sellerId, patchStore]);

  const handleToggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await updateSeller(sellerId, { aiCeoDigestEnabled: next });
      patchStore({ aiCeoDigestEnabled: next });
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }, [enabled, sellerId, patchStore]);

  const handleAutoWinBackToggle = useCallback(async () => {
    const next = !autoWinBackEnabled;
    setAutoWinBackEnabled(next);
    setSavingAutoWinBack(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoWinBackEnabled: next });
      patchStore({ aiCeoAutoWinBackEnabled: next });
    } catch {
      setAutoWinBackEnabled(!next);
    } finally {
      setSavingAutoWinBack(false);
    }
  }, [autoWinBackEnabled, sellerId, patchStore]);

  const handleAutoFavoriteToggle = useCallback(async () => {
    const next = !autoFavoriteEnabled;
    setAutoFavoriteEnabled(next);
    setSavingAutoFavorite(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoFavoriteEnabled: next });
      patchStore({ aiCeoAutoFavoriteEnabled: next });
    } catch {
      setAutoFavoriteEnabled(!next);
    } finally {
      setSavingAutoFavorite(false);
    }
  }, [autoFavoriteEnabled, sellerId, patchStore]);

  const handleAutoDiscountToggle = useCallback(async () => {
    const next = !autoDiscountEnabled;
    setAutoDiscountEnabled(next);
    setSavingAutoDiscount(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoDiscountEnabled: next });
      patchStore({ aiCeoAutoDiscountEnabled: next });
    } catch {
      setAutoDiscountEnabled(!next);
    } finally {
      setSavingAutoDiscount(false);
    }
  }, [autoDiscountEnabled, sellerId, patchStore]);

  const handleDiscountPercentChange = useCallback(async (value) => {
    const previous = discountPercent;
    setDiscountPercent(value);
    setSavingDiscountPercent(true);
    try {
      await updateSeller(sellerId, { aiCeoAutoDiscountPercent: Number(value) });
      patchStore({ aiCeoAutoDiscountPercent: Number(value) });
    } catch {
      setDiscountPercent(previous);
    } finally {
      setSavingDiscountPercent(false);
    }
  }, [discountPercent, sellerId, patchStore]);

  // Bitta bosish bilan uchta sozlamani birdaniga yozadi (kaskad) — bu
  // faqat tezkor yo'l qo'shadi, har biri pastdagi ro'yxatdan baribir
  // alohida ham sozlanadi. Xatolik bo'lsa, uchalasi ham eski holatiga
  // qaytariladi, yarim yozilgan holat qolmasligi uchun.
  const handleMasterToggle = useCallback(async () => {
    const next = !allCoreEnabled;
    const prevEnabled = enabled;
    const prevAutoWinBack = autoWinBackEnabled;
    const prevAutoFavorite = autoFavoriteEnabled;
    setEnabled(next);
    setAutoWinBackEnabled(next);
    setAutoFavoriteEnabled(next);
    setSavingMaster(true);
    try {
      await updateSeller(sellerId, {
        aiCeoDigestEnabled: next,
        aiCeoAutoWinBackEnabled: next,
        aiCeoAutoFavoriteEnabled: next,
      });
      patchStore({
        aiCeoDigestEnabled: next,
        aiCeoAutoWinBackEnabled: next,
        aiCeoAutoFavoriteEnabled: next,
      });
    } catch {
      setEnabled(prevEnabled);
      setAutoWinBackEnabled(prevAutoWinBack);
      setAutoFavoriteEnabled(prevAutoFavorite);
    } finally {
      setSavingMaster(false);
    }
  }, [allCoreEnabled, enabled, autoWinBackEnabled, autoFavoriteEnabled, sellerId, patchStore]);

  const handleTelegramApprovalToggle = useCallback(async () => {
    const next = !telegramApprovalEnabled;
    setTelegramApprovalEnabled(next);
    setSavingTelegramApproval(true);
    try {
      await updateSeller(sellerId, { aiCeoTelegramApprovalEnabled: next });
      patchStore({ aiCeoTelegramApprovalEnabled: next });
    } catch {
      setTelegramApprovalEnabled(!next);
    } finally {
      setSavingTelegramApproval(false);
    }
  }, [telegramApprovalEnabled, sellerId, patchStore]);

  const handleLowStockAlertToggle = useCallback(async () => {
    const next = !lowStockAlertEnabled;
    setLowStockAlertEnabled(next);
    setSavingLowStockAlert(true);
    try {
      await updateSeller(sellerId, { aiCeoLowStockAlertEnabled: next });
      patchStore({ aiCeoLowStockAlertEnabled: next });
    } catch {
      setLowStockAlertEnabled(!next);
    } finally {
      setSavingLowStockAlert(false);
    }
  }, [lowStockAlertEnabled, sellerId, patchStore]);

  const handleStaleOrderAlertToggle = useCallback(async () => {
    const next = !staleOrderAlertEnabled;
    setStaleOrderAlertEnabled(next);
    setSavingStaleOrderAlert(true);
    try {
      await updateSeller(sellerId, { aiCeoStaleOrderAlertEnabled: next });
      patchStore({ aiCeoStaleOrderAlertEnabled: next });
    } catch {
      setStaleOrderAlertEnabled(!next);
    } finally {
      setSavingStaleOrderAlert(false);
    }
  }, [staleOrderAlertEnabled, sellerId, patchStore]);

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
        <h1 className="text-sm font-black text-slate-800 dark:text-white flex-1">{t("aiCeo.advancedSettingsTitle")}</h1>
      </div>

      <div className="p-4 space-y-4 pb-36">
        {/* Bitta katta "yoqish" tugmasi bosilganda, moliyaviy xavfsiz,
            faqat matn/xabar darajasidagi uchta sozlamani (kunlik xulosa
            va avtomatik qaytarish/sevimlilar xabari) birdaniga, aqlli
            standart qiymat bilan yoqadi/o'chiradi — pastdagi ro'yxat har
            bir narsani baribir alohida, nozik sozlash imkonini saqlab
            qoladi. Pul bilan bog'liq avtomatik chegirma
            (`aiCeoAutoDiscountEnabled`) qasddan bu tugmaga
            qo'shilmagan — u har doim alohida, ongli ravishda pastdagi
            ro'yxatdan yoqiladi. */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black">{t("aiCeo.masterToggleTitle")}</p>
              <p className="text-[10px] font-medium text-white/70 mt-0.5 leading-relaxed">{t("aiCeo.masterToggleDesc")}</p>
            </div>
            <button
              type="button"
              onClick={handleMasterToggle}
              disabled={savingMaster}
              aria-label={t("aiCeo.masterToggleTitle")}
              className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingMaster ? "opacity-60" : ""} ${allCoreEnabled ? "bg-white/90 justify-end" : "bg-white/20 justify-start"}`}
            >
              <span className={`w-5 h-5 rounded-full shadow-sm ${allCoreEnabled ? "bg-indigo-600" : "bg-white"}`} />
            </button>
          </div>

          <div className="pt-3 border-t border-white/15 space-y-2">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-white/70" />
              <p className="text-[11px] font-bold text-white/70">{t("aiCeo.processTimeTitle")}</p>
            </div>
            <CustomSelect value={draftHour} onChange={handleHourChange} options={hourOptions} disabled={savingHour} />
          </div>
        </div>

        {/* Har bir funksiya alohida yoqiladi/o'chiriladi - ilgari
            "Kunlik hisobot" sahifasida yopiq/ochiq bo'lardi, endi bu
            ALOHIDA sahifa bo'lgani uchun to'g'ridan-to'g'ri, doim
            ochiq holda ko'rsatiladi. */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("aiCeo.advancedSettingsTitle")}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t("aiCeo.advancedSettingsSubtitle")}</p>
          </div>

          <div className="px-4 pb-4 space-y-3">
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t("aiCeo.dashboardCardTitle")}</span>
              <button
                type="button"
                onClick={handleToggle}
                disabled={saving}
                aria-label={t("aiCeo.dashboardCardTitle")}
                className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${saving ? "opacity-60" : ""} ${enabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            {/* Standart holatda o'chiq (opt-in). Bu, boshqa
                sozlamalardan farqli, matnni AI yozadi va sotuvchi
                tasdiqisiz yuboradi — shuning uchun tavsif orqali aniq
                tushuntiriladi, nima o'zgarishini yashirmasdan. */}
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.autoWinBackTitle")}</span>
                <button
                  type="button"
                  onClick={handleAutoWinBackToggle}
                  disabled={savingAutoWinBack}
                  aria-label={t("aiCeo.autoWinBackTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingAutoWinBack ? "opacity-60" : ""} ${autoWinBackEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.autoWinBackDesc")}</p>
            </div>

            {/* Xuddi shu avtonom ijro mantig'i, sevimlilar eslatmasi
                uchun. */}
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.autoFavoriteTitle")}</span>
                <button
                  type="button"
                  onClick={handleAutoFavoriteToggle}
                  disabled={savingAutoFavorite}
                  aria-label={t("aiCeo.autoFavoriteTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingAutoFavorite ? "opacity-60" : ""} ${autoFavoriteEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.autoFavoriteDesc")}</p>
            </div>

            {/* "Avtonom qaytarish xabari"ning kuchaytirilgan varianti —
                shuning uchun `autoWinBackEnabled` yoqilmagan bo'lsa,
                tugma o'chirilgan (kulrang) va bosilmaydi, bog'liqlik
                aniq ko'rinadi uchun. */}
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-bold flex-1 ${autoWinBackEnabled ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>{t("aiCeo.autoDiscountTitle")}</span>
                <button
                  type="button"
                  onClick={handleAutoDiscountToggle}
                  disabled={savingAutoDiscount || !autoWinBackEnabled}
                  aria-label={t("aiCeo.autoDiscountTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${(savingAutoDiscount || !autoWinBackEnabled) ? "opacity-50" : ""} ${autoDiscountEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                {autoWinBackEnabled ? t("aiCeo.autoDiscountDesc") : t("aiCeo.autoDiscountRequiresWinBackNote")}
              </p>
              {autoDiscountEnabled && autoWinBackEnabled && (
                <div className="pt-1.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">{t("aiCeo.autoDiscountPercentLabel")}</p>
                  <CustomSelect value={discountPercent} onChange={handleDiscountPercentChange} options={discountPercentOptions} disabled={savingDiscountPercent} />
                </div>
              )}
            </div>

            {/* Telegram orqali "1-tugmali tasdiqlash": Mini App'ni
                ochmasdan, AI CEO tavsiyasini to'g'ridan-to'g'ri
                Telegram chatida bitta tugma bilan tasdiqlash mumkin. */}
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.telegramApprovalTitle")}</span>
                <button
                  type="button"
                  onClick={handleTelegramApprovalToggle}
                  disabled={savingTelegramApproval}
                  aria-label={t("aiCeo.telegramApprovalTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingTelegramApproval ? "opacity-60" : ""} ${telegramApprovalEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.telegramApprovalDesc")}</p>
            </div>

            {/* MENEJERGA ogohlantirishlar (2026-09 punkt-royxati, 5-band)
                - ikkalasi ham xaridorga emas, SOTUVCHINING O'ZIGA
                yuboriladi, standart holatda o'chiq. */}
            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.lowStockAlertTitle")}</span>
                <button
                  type="button"
                  onClick={handleLowStockAlertToggle}
                  disabled={savingLowStockAlert}
                  aria-label={t("aiCeo.lowStockAlertTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingLowStockAlert ? "opacity-60" : ""} ${lowStockAlertEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.lowStockAlertDesc")}</p>
            </div>

            <div className="pt-3 border-t border-slate-50 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex-1">{t("aiCeo.staleOrderAlertTitle")}</span>
                <button
                  type="button"
                  onClick={handleStaleOrderAlertToggle}
                  disabled={savingStaleOrderAlert}
                  aria-label={t("aiCeo.staleOrderAlertTitle")}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${savingStaleOrderAlert ? "opacity-60" : ""} ${staleOrderAlertEnabled ? "bg-indigo-600 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{t("aiCeo.staleOrderAlertDesc")}</p>
            </div>
          </div>
        </div>

        {/* FOYDALANUVCHI SO'ROVI (2026-09): "AI narx tavsiyalari" ILGARI
            Sozlamalar (`More.jsx`) ro'yxatida, AI CEO bilan ALOQASI
            noaniq alohida band edi — endi O'SHA YERDAN OLIB TASHLANDI va
            shu yerga, AI CEO sozlamalari ICHIGA ko'chirildi (mavjud
            `/seller/pricing-suggestions` sahifasining O'ZI o'zgarishsiz
            qoldi — faqat unga olib boruvchi kirish nuqtasi ko'chdi). */}
        <button
          type="button"
          onClick={() => navigate('/seller/pricing-suggestions')}
          className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-slate-800 dark:text-white">{t("aiCeo.pricingSuggestionsNavTitle")}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-snug mt-0.5">{t("aiCeo.pricingSuggestionsNavDesc")}</p>
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
        </button>
      </div>
    </div>
  );
};

export default AiCeoSettingsPage;
