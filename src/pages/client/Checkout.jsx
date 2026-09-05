import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, CreditCard, Sparkles, Check, Copy, ImageUp, Loader2, X as XIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import useSendOrder from '@/hooks/useSendOrder';
import { resetOrderStatus } from '@/store/slices/order/sendOrderSlice';
import { useSession } from '@/context/SessionContext';
import { formatUzPhone, isValidUzPhone } from '@/utils/phone';
import { validateCoupon } from '@/services/coupons/coupons';
import { isBundleStillValid, computeBundleSavings } from '@/utils/bundlePricing';
import { computeInstallmentAmounts } from '@/utils/installments';
import { resolveDeliveryTier } from '@/constants/deliveryTiers';
import { UZBEKISTAN_REGIONS } from '@/constants/uzbekistanRegions';
import CustomSelect from '@/components/ui/CustomSelect';
import StatusModal from '@/components/ui/StatusModal';
import LocationPickerModal from '@/components/ui/LocationPickerModal';
import useGetClientOrdersData from '@/hooks/seller/useClientOrder';
import { deriveCheckoutAutofill } from '@/utils/checkoutAutofill';
import { useUploadImage } from '@/hooks/storage/useUploadStorage';
import getSellerPaymentCardInfo from '@/services/payments/getSellerPaymentCardInfo';
import getMyLoyaltyBalance from '@/services/payments/getMyLoyaltyBalance';
import { generateDeliverySlots, getMinLeadHours, dayKeyOf, formatDeliverySlotRangeLabel } from '@/utils/deliverySlots';
import DeliverySlotSheet from '@/components/ui/DeliverySlotSheet';
import CheckoutCrossSell from '@/features/shop/components/checkout/CheckoutCrossSell';

// Checkout'dagi "Yetkazib berish vaqti" tugmasi ustidagi qisqa xulosa
// yorlig'i - alohida, kichik komponent sifatida (tanlangan oraliq
// o'zgarmasa qayta render bo'lmasin, va asosiy `CheckoutPage`
// tanasini shishirmasin).
const DeliverySlotLabel = ({ slot, todayKey }) => {
  const { t } = useLanguage();
  return <span>{formatDeliverySlotRangeLabel(slot, todayKey, t)}</span>;
};

const CheckoutPage = () => {

  const { t } = useLanguage();
  const { sendOrder, loading, carts, success, activeBundle } = useSendOrder();
  const dispatch = useDispatch()
  const navigate = useNavigate();
  const { sellerId: currentSellerId, clientId: currentUserId, store, telegramUser } = useSession();

  // Buyurtma formasidagi "F.I.Sh" maydoniga, Telegram'dan kelgan
  // ism-familiya (`first_name`/`last_name`) boshlang'ich qiymat
  // sifatida qo'yiladi — Telegram username emas (masalan
  // "@alisher_dev" kabi taxallus emas, "Alisher Davronov" kabi
  // haqiqiy ism). Bu faqat qulay boshlang'ich qiymat — xaridor
  // xohlasa, buni erkin o'zgartirishi mumkin (input oddiy,
  // tahrirlanadigan maydon).
  const defaultFullName = useMemo(
    () => [telegramUser?.firstName, telegramUser?.lastName].filter(Boolean).join(" "),
    [telegramUser]
  );

  const [formData, setFormData] = useState({
    fullName: defaultFullName,
    phone: '',
    address: '',
  });

  const [addressMode, setAddressMode] = useState('manual'); // 'manual' | 'map'
  const [mapLocation, setMapLocation] = useState(null); // { lat, lng }
  const [showMapPicker, setShowMapPicker] = useState(false);

  // "TAKRORLAMANG" (Zero Friction) — xaridor bu sotuvchidan oldin
  // buyurtma bergan bo'lsa, telefon/manzilni HAR SAFAR qo'lda qayta
  // kiritishga majburlanmasin: eng so'nggi buyurtmasidan (`getClientOrder.js`
  // allaqachon `createdAt desc` bo'yicha tartiblab beradi) avtomatik
  // to'ldiriladi. Faqat BIR MARTA (ma'lumot birinchi kelganda) va faqat
  // maydonlar hali BO'SH bo'lsa qo'llaniladi — xaridor allaqachon
  // qo'lda yoza boshlagan bo'lsa, ustidan yozib yuborilmaydi. Har doim
  // TAHRIRLANADIGAN oddiy input bo'lib qoladi - bu shunchaki qulay
  // boshlang'ich qiymat, xuddi F.I.Sh maydonidagi Telegram-ism kabi.
  const { orders: pastOrders } = useGetClientOrdersData(currentUserId, currentSellerId);
  const lastOrder = pastOrders?.[0] || null;
  const prefilledFromLastOrderRef = useRef(false);
  const [autofilledFromLastOrder, setAutofilledFromLastOrder] = useState(false);

  // Xaridor o'z hududini (viloyatini) tanlaydi — tizim buni
  // sotuvchining hududi bilan solishtirib, qaysi narx bosqichi
  // (Shahar/Tumanlar/Boshqa viloyat) qo'llanilishini o'zi hisoblab
  // chiqadi (`resolveDeliveryTier` - `constants/deliveryTiers.js`).
  //
  // MUHIM: bu deklaratsiya ATAYLAB pastdagi "avtomatik to'ldirish"
  // effektidan OLDIN turibdi — o'sha effekt `setCustomerRegion`ni
  // ishlatadi, va uni shu o'zgaruvchi e'lon qilinishidan OLDIN
  // ishlatish "Cannot access before initialization" xatosiga olib
  // kelishi mumkin edi (`selectedPaymentType`dagi xuddi shu turdagi
  // xato bilan bir xil sabab — yuqoridagi izohga qarang).
  const [customerRegion, setCustomerRegion] = useState('');

  // Lint eslatmasi ("setState synchronously within an effect"):
  // bu yerda haqiqiy tashqi tizimdan (Firestore, `getClientOrder.js`)
  // asinxron kelgan ma'lumot mahalliy formaga BIR MARTA
  // sinxronlanmoqda - loyihada allaqachon qabul qilingan naqsh
  // (masalan `AiCeoInfoPage.jsx`dagi `loadReport()` effekti xuddi shu
  // qoidani, xuddi shu sababdan qo'zg'atadi) - kodning bu turi uchun
  // kutilgan, zararsiz ogohlantirish.
  useEffect(() => {
    if (prefilledFromLastOrderRef.current || !lastOrder) return;
    prefilledFromLastOrderRef.current = true;

    const autofill = deriveCheckoutAutofill(lastOrder);
    if (!autofill) return;

    setFormData((prev) => ({
      ...prev,
      phone: prev.phone || autofill.phone,
      address: prev.address || autofill.address,
    }));

    if (autofill.mapLocation) {
      setAddressMode('map');
      setMapLocation(autofill.mapLocation);
    }
    if (autofill.customerRegion) {
      setCustomerRegion(autofill.customerRegion);
    }
    setAutofilledFromLastOrder(true);
  }, [lastOrder]);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // `customerRegion`/`setCustomerRegion` — yuqorida, avtomatik
  // to'ldirish effektidan OLDIN e'lon qilingan (qarang: yuqoridagi izoh).

  const deliveryTier = useMemo(
    () => resolveDeliveryTier(store?.region, customerRegion),
    [store?.region, customerRegion]
  );

  const selectedTierInfo = deliveryTier ? store?.deliveryTiers?.[deliveryTier] : null;
  const hasDeliveryPricing = Boolean(selectedTierInfo && Number(selectedTierInfo.price) > 0);

  // Yetkazib berish VAQT ORALIG'I tanlovi (2026-09 punkt-royxati,
  // 15-band): mijoz do'kon ish vaqti ichida, hozirdan kamida 3 soat
  // (yoki BOSHQA hududda bo'lsa 27 soat) keyingi 1-soatlik oraliqni
  // tanlaydi. `mountedAtMs` — `Dashboard.jsx`/`PnLDashboard.jsx`dagi
  // bilan bir xil naqsh (`react-hooks/purity`: render vaqtida
  // to'g'ridan-to'g'ri `Date.now()` chaqirilmaydi, faqat MOUNT'da bir
  // marta suratga olinadi).
  const [mountedAtMs] = useState(() => Date.now());
  const minLeadHours = getMinLeadHours(deliveryTier);
  const availableDeliverySlots = useMemo(
    () => generateDeliverySlots({
      nowMs: mountedAtMs,
      minLeadHours,
      workingHoursOpen: store?.workingHoursOpen || "10:00",
      workingHoursClose: store?.workingHoursClose || "19:00",
    }),
    [mountedAtMs, minLeadHours, store?.workingHoursOpen, store?.workingHoursClose]
  );
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState(null);
  const [showDeliverySlotSheet, setShowDeliverySlotSheet] = useState(false);
  const todayKey = useMemo(() => dayKeyOf(mountedAtMs), [mountedAtMs]);

  // Hudud (va shu bilan minimal kutish vaqti) o'zgarsa, oldin
  // tanlangan oraliq endi yaroqsiz bo'lib qolishi mumkin (masalan
  // mijoz "bir xil hudud"dan "boshqa hudud"ga o'zgartirsa - endi 27
  // soat talab qilinadi) - shuning uchun ro'yxatda YO'Q bo'lib qolgan
  // tanlov avtomatik tozalanadi.
  useEffect(() => {
    if (selectedDeliverySlot && !availableDeliverySlots.some((s) => s.startMs === selectedDeliverySlot.startMs)) {
      // Tanlangan oraliq endi (hudud/vaqt o'zgarishi sabab) yaroqli
      // ro'yxatda YO'Q - eskirgan tanlovni tozalaymiz (xuddi shu
      // fayldagi `selectedPaymentType`ni tozalovchi effekt bilan bir
      // xil, allaqachon qabul qilingan naqsh).
      setSelectedDeliverySlot(null);
    }
  }, [availableDeliverySlots, selectedDeliverySlot]);

  // Har bir maydon o'zining aniq xatosini ko'rsatadi — bu
  // foydalanuvchiga aynan qaysi maydon to'ldirilmaganini ko'rsatadi,
  // umumiy "hammasini to'ldiring" xabari o'rniga.
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);

  const subtotal = useMemo(() => {
    return carts.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  }, [carts]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === "percent") {
      return Math.round((subtotal * appliedCoupon.discountValue) / 100);
    }
    return Math.min(appliedCoupon.discountValue, subtotal);
  }, [appliedCoupon, subtotal]);

  // MAHSULOT BANDLLARI (combo takliflar) - mijoz mahsulot sahifasidan
  // "combo sifatida qo'shish" tugmasini bosgan bo'lsa, `activeBundle`
  // savat state'ida saqlanadi. Combo'ga kiruvchi mahsulotlardan biri
  // savatdan (alohida) olib tashlangan bo'lsa - `isBundleStillValid`
  // buni aniqlaydi va chegirma endi qo'llanmaydi. Bu yerdagi summa
  // faqat ko'rsatish uchun taxmin - HAQIQIY chegirma serverda
  // (`functions/orders.js`) combo mahsulotlarining HOZIRGI
  // narxlaridan qayta hisoblanadi.
  const isBundleValid = isBundleStillValid(carts, activeBundle);
  const bundleDiscountAmount = useMemo(() => {
    if (!isBundleValid) return 0;
    const individualTotal = (activeBundle.productIds || []).reduce((sum, pid) => {
      const item = carts.find((c) => c.id === pid);
      return sum + (item ? Number(item.price) || 0 : 0);
    }, 0);
    return computeBundleSavings(individualTotal, activeBundle.bundlePrice).savings;
  }, [isBundleValid, activeBundle, carts]);

  const amountAfterDiscount = Math.max(0, subtotal - discountAmount - bundleDiscountAmount);

  // SODIQLIK DASTURI ("Bonus hisobi") - mijozning shu sotuvchi
  // uchun yig'gan bonus balansi. Sotuvchida o'chirilgan bo'lsa
  // `loyaltyInfo.enabled` false qaytadi va bu bo'lim UI'da umuman
  // ko'rsatilmaydi. Xuddi karta ma'lumoti (`sellerCardInfo`) kabi -
  // faqat kerak bo'lganda (bu sahifaga kirilganda) bir marta
  // yuklanadi.
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [useBonus, setUseBonus] = useState(false);
  const [bonusAmountInput, setBonusAmountInput] = useState('');

  useEffect(() => {
    if (!currentSellerId) return;
    let cancelled = false;
    setLoyaltyLoading(true);
    getMyLoyaltyBalance(currentSellerId)
      .then((data) => { if (!cancelled) setLoyaltyInfo(data); })
      .catch(() => { if (!cancelled) setLoyaltyInfo(null); }) // jim - bonus IXTIYORIY qulaylik, checkout'ni to'xtatmasligi kerak
      .finally(() => { if (!cancelled) setLoyaltyLoading(false); });
    return () => { cancelled = true; };
  }, [currentSellerId]);

  // Bitta buyurtmada eng ko'pi bilan ishlatsa bo'ladigan bonus -
  // HAQIQIY balans, sotuvchi belgilagan foiz chegarasi VA chegirmadan
  // keyingi summaning O'ZIDAN oshmaydi (backend - `orders.js` - AYNAN
  // shu formuladan QAYTA tekshiradi, bu yerdagi hisob faqat ko'rsatish
  // uchun taxmin).
  const maxRedeemableBonus = useMemo(() => {
    if (!loyaltyInfo?.enabled) return 0;
    const byPercent = Math.floor((amountAfterDiscount * (loyaltyInfo.maxRedeemPercent || 0)) / 100);
    return Math.max(0, Math.min(Number(loyaltyInfo.balance) || 0, byPercent, amountAfterDiscount));
  }, [loyaltyInfo, amountAfterDiscount]);

  const bonusRedeemAmount = useBonus ? Math.min(Number(bonusAmountInput) || 0, maxRedeemableBonus) : 0;
  const amountAfterBonus = Math.max(0, amountAfterDiscount - bonusRedeemAmount);

  const handleToggleUseBonus = useCallback(() => {
    setUseBonus((prev) => {
      const next = !prev;
      if (next && !bonusAmountInput) {
        // Yoqilganda - qulaylik uchun avtomatik eng yuqori (ruxsat
        // etilgan) miqdorni taklif qilamiz, xaridor xohlasa kamaytirishi mumkin.
        setBonusAmountInput(String(maxRedeemableBonus));
      }
      return next;
    });
  }, [bonusAmountInput, maxRedeemableBonus]);

  const handleUseMaxBonus = useCallback(() => {
    setBonusAmountInput(String(maxRedeemableBonus));
  }, [maxRedeemableBonus]);

  // Eslatma: bu faqat ko'rsatish uchun taxmin. Haqiqiy yetkazib
  // berish narxi har doim server tomonida (`createOrder` Cloud
  // Function) sotuvchining haqiqiy sozlamasidan qayta hisoblanadi —
  // xuddi narx va promokod kabi.
  const isFreeDeliveryPreview = Boolean(
    store?.freeDeliveryEnabled &&
    store?.freeDeliveryThreshold &&
    amountAfterBonus >= Number(store.freeDeliveryThreshold)
  );
  const deliveryFeePreview = hasDeliveryPricing ? (isFreeDeliveryPreview ? 0 : Number(selectedTierInfo.price) || 0) : 0;

  const totalAmount = amountAfterBonus + deliveryFeePreview;

  // MIJOZ endi TO'LOV USULINI o'zi tanlaydi (agar sotuvchi ikkalasini
  // ham yoqqan bo'lsa) — OLDIN bu yerda faqat ma'lumot sifatida
  // ko'rsatilardi, haqiqiy tanlov YO'Q edi (2026-09 punkt-royxati,
  // 14-band). "cod" = naqd (kuryerga), "prepay" = karta orqali (ATMOS
  // hali ulanmagani uchun — sotuvchining shaxsiy kartasiga qo'lda
  // o'tkazma + chek skrinshoti).
  //
  // MUHIM: bu deklaratsiya ATAYLAB shu yerda, pastdagi "BO'LIB TO'LASH"
  // blokidan OLDIN turibdi — `showInstallmentOption` shu o'zgaruvchini
  // ishlatadi, va `const` bilan e'lon qilingan o'zgaruvchini undan
  // OLDIN ishlatish "Cannot access before initialization" xatosiga
  // olib kelardi (bu — production'da Checkout sahifasi HAR DOIM
  // qulab tushishiga sabab bo'lgan haqiqiy xato edi, endi tuzatildi).
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);

  // "BO'LIB TO'LASH" — faqat sotuvchi bu funksiyani yoqqan VA
  // "Karta orqali" (prepay) tanlangan bo'lsa ko'rsatiladi. Qismlar
  // soni sotuvchi tomonidan belgilangan (`store.installmentParts`) -
  // mijoz faqat "bo'lib to'layman" yoki "to'liq to'layman"ni tanlaydi.
  // Bu yerdagi bo'linma faqat OLDINDAN ko'rsatish uchun — HAQIQIY
  // reja serverda (`functions/orders.js`) buyurtmaning HAQIQIY
  // umumiy summasidan qayta hisoblanadi.
  const installmentPartsConfig = Number(store?.installmentParts) >= 2 ? Number(store.installmentParts) : 0;
  const showInstallmentOption = selectedPaymentType === "prepay" && store?.installmentPaymentEnabled === true && installmentPartsConfig >= 2;
  const [useInstallments, setUseInstallments] = useState(false);

  useEffect(() => {
    if (!showInstallmentOption && useInstallments) {
      setUseInstallments(false);
    }
  }, [showInstallmentOption, useInstallments]);

  const installmentPreviewAmounts = useMemo(
    () => (showInstallmentOption && useInstallments ? computeInstallmentAmounts(totalAmount, installmentPartsConfig) : null),
    [showInstallmentOption, useInstallments, totalAmount, installmentPartsConfig]
  );

  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon(currentSellerId, couponInput);
      if (result.valid) {
        setAppliedCoupon(result.coupon);
      } else {
        setAppliedCoupon(null);
        setCouponError(result.error);
      }
    } finally {
      setApplyingCoupon(false);
    }
  }, [couponInput, currentSellerId]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }, []);

  // OLDIN: to'lov turi HAR BIR MAHSULOTda alohida belgilanardi, bu
  // yerda esa savatdagi barcha mahsulotlar umumiy qo'llab-quvvatlaydigan
  // (kesishgan) turlar hisoblanardi. HAQIQIY XATO: agar savatda bitta
  // mahsulot faqat "karta orqali", ikkinchisi faqat "naqd" qo'llab-
  // quvvatlasa, kesishma BO'SH bo'lib qolardi — mijoz UMUMAN to'lov
  // usulini tanlay olmasdi, checkout tiqilib qolardi.
  //
  // ENDI (2026-09 punkt-royxati): to'lov turi endi mahsulot emas,
  // BUTUN DO'KON darajasida — `sellers/{id}.paymentTypes` (sotuvchi
  // "Sozlamalar → To'lovlar va Tariflar"da belgilaydi,
  // `PaymentSettingsPage.jsx`) — bitta joyda, barcha mahsulotlarga bir
  // xil qo'llaniladi. Sozlama hali tanlanmagan (eski) do'konlar uchun
  // standart — faqat "naqd" (`["cod"]`), chunki bu hech qanday
  // qo'shimcha sozlashni talab qilmaydi.
  const storePaymentTypes = store?.paymentTypes;
  const allowedPaymentTypes = useMemo(
    () => (Array.isArray(storePaymentTypes) && storePaymentTypes.length > 0 ? storePaymentTypes : ["cod"]),
    [storePaymentTypes]
  );

  // `selectedPaymentType`/`setSelectedPaymentType` — yuqorida, "BO'LIB
  // TO'LASH" blokidan OLDIN e'lon qilingan (qarang: yuqoridagi izoh).
  useEffect(() => {
    if (allowedPaymentTypes.length === 1) {
      setSelectedPaymentType(allowedPaymentTypes[0]);
    } else if (allowedPaymentTypes.length > 1 && selectedPaymentType && !allowedPaymentTypes.includes(selectedPaymentType)) {
      setSelectedPaymentType(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat ruxsat etilgan turlar ro'yxati o'zgarganda
  }, [allowedPaymentTypes]);

  // "Karta orqali" tanlanganda — sotuvchining shaxsiy kartasini
  // (`getSellerPaymentCardInfo`) yuklaymiz va mijozdan to'lov cheki
  // skrinshotini yuklashini so'raymiz.
  const [sellerCardInfo, setSellerCardInfo] = useState(null);
  const [cardInfoLoading, setCardInfoLoading] = useState(false);
  const [cardInfoError, setCardInfoError] = useState(null);
  const [cardCopied, setCardCopied] = useState(false);
  const { uploadImage, progress: receiptProgress, loading: receiptUploading } = useUploadImage();
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [receiptError, setReceiptError] = useState(null);

  // MUHIM (2026-09 tuzatish): so'rov holatini kuzatish uchun `useRef`
  // ishlatilmoqda, `cardInfoLoading` STATE'i EMAS — chunki agar shu
  // effekt o'zi o'rnatgan state'ni (`cardInfoLoading`) o'zining
  // dependency-massivida ham ishlatsa, quyidagi "poyga holati" (race
  // condition) yuzaga kelardi: `setCardInfoLoading(true)` chaqirilishi
  // bilan qayta render bo'ladi → `cardInfoLoading` o'zgargani uchun
  // effekt qayta ishga tushadi → effektning ESKI nusxasi "tozalanadi"
  // (`cancelled = true`) — buning HAMMASI, haqiqiy tarmoq so'rovi
  // (Cloud Function) hali javob qaytarmasdan OLDIN sodir bo'ladi. Shu
  // sababli so'rov haqiqatda tugaganda `cancelled` allaqachon `true`
  // bo'lib qolardi — na karta ma'lumoti, na xato, na "yuklanmoqda"
  // holatini tugatish HECH QACHON qo'llanmasdi, va mijoz "Karta
  // ma'lumotlari yuklanmoqda..." holatida ABADIY qotib qolardi
  // (production'da haqiqatan kuzatilgan xato). `useRef` esa o'zgarishi
  // qayta render'ga SABAB BO'LMAYDI, shuning uchun bu poyga yo'q.
  const cardInfoFetchStartedRef = useRef(false);

  useEffect(() => {
    if (selectedPaymentType !== "prepay" || !currentSellerId || sellerCardInfo || cardInfoFetchStartedRef.current) return;
    cardInfoFetchStartedRef.current = true;
    let cancelled = false;
    setCardInfoLoading(true);
    setCardInfoError(null);
    getSellerPaymentCardInfo(currentSellerId)
      .then((data) => { if (!cancelled) setSellerCardInfo(data); })
      .catch((err) => {
        if (!cancelled) {
          setCardInfoError(err.message || t("checkout.cardInfoError"));
          // Xato bo'lsa, keyinroq (masalan to'lov turini almashtirib,
          // qaytadan tanlaganda) qayta urinib ko'rish imkoni qolsin.
          cardInfoFetchStartedRef.current = false;
        }
      })
      .finally(() => { if (!cancelled) setCardInfoLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPaymentType, currentSellerId, sellerCardInfo, t]);

  const handleCopyCardNumber = useCallback(() => {
    if (!sellerCardInfo?.cardNumber) return;
    navigator.clipboard?.writeText(sellerCardInfo.cardNumber).then(() => {
      setCardCopied(true);
      setTimeout(() => setCardCopied(false), 2000);
    }).catch(() => {});
  }, [sellerCardInfo]);

  const handleReceiptFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentSellerId || !currentUserId) return;
    setReceiptError(null);
    try {
      const url = await uploadImage(file, `payment-receipts/${currentSellerId}/${currentUserId}`);
      setReceiptUrl(url);
    } catch (err) {
      setReceiptError(err.message || t("checkout.receiptUploadError"));
    }
  }, [uploadImage, currentSellerId, currentUserId, t]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatUzPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setFieldErrors(prev => (prev[name] ? { ...prev, [name]: null } : prev));
  }, []);

  const validate = useCallback(() => {
    const { fullName, phone, address } = formData;
    const errors = {};

    if (!fullName.trim()) errors.fullName = "F.I.Sh kiritilishi shart";
    if (!phone.trim()) errors.phone = "Telefon raqam kiritilishi shart";
    else if (!isValidUzPhone(phone)) errors.phone = "To'liq telefon raqam kiriting (9 ta raqam)";

    if (addressMode === 'manual') {
      if (!address.trim()) errors.address = "Yetkazib berish manzili kiritilishi shart";
    } else if (!mapLocation) {
      errors.address = "Xaritadan joylashuvni belgilang";
    }

    if (store?.region && !customerRegion) {
      errors.deliveryZone = t("checkout.regionRequiredError");
    }

    if (allowedPaymentTypes.length > 1 && !selectedPaymentType) {
      errors.paymentType = t("checkout.paymentTypeRequiredError");
    }
    if (selectedPaymentType === "prepay" && !receiptUrl) {
      errors.paymentReceipt = t("checkout.receiptRequiredError");
    }

    if (!selectedDeliverySlot) {
      errors.deliverySlot = t("checkout.deliverySlotRequiredError");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, addressMode, mapLocation, store?.region, customerRegion, allowedPaymentTypes, selectedPaymentType, receiptUrl, selectedDeliverySlot, t]);

  const handlePlaceOrder = useCallback(async (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    const { fullName, phone, address } = formData;
    
    try {
      await sendOrder(
        { 
          fullName: fullName.trim(), 
          phone: phone.trim(), 
          address: addressMode === 'manual' ? address.trim() : `Xaritadagi joylashuv: ${mapLocation.lat.toFixed(5)}, ${mapLocation.lng.toFixed(5)}`,
          location: addressMode === 'map' ? mapLocation : null,
          paymentTypes: allowedPaymentTypes,
          paymentMethod: selectedPaymentType === "prepay" ? "card" : "cash",
          paymentReceiptUrl: selectedPaymentType === "prepay" ? receiptUrl : null,
          couponCode: appliedCoupon?.code || null,
          discountAmount,
          redeemBonusAmount: bonusRedeemAmount > 0 ? bonusRedeemAmount : null,
          bundleId: isBundleValid ? activeBundle.bundleId : null,
          installments: showInstallmentOption && useInstallments ? installmentPartsConfig : null,
          customerRegion: customerRegion || null,
          deliveryTimeSlot: { start: selectedDeliverySlot.startMs, end: selectedDeliverySlot.endMs },
        },
        carts,
        currentSellerId,
        currentUserId
      );
      setTimeout(() => {
        navigate('/')
        dispatch(resetOrderStatus())
      }, 1300);
    } catch (error) {
      setSubmitError(error.message || "Buyurtma jo'natilmadi");
    }
  }, [formData, addressMode, mapLocation, allowedPaymentTypes, selectedPaymentType, receiptUrl, appliedCoupon, discountAmount, bonusRedeemAmount, isBundleValid, activeBundle, showInstallmentOption, useInstallments, installmentPartsConfig, customerRegion, selectedDeliverySlot, carts, sendOrder, navigate, validate, currentSellerId, currentUserId, dispatch]);

  return (
    // "Umumiy qiymat + Buyurtmani yakunlash" paneli sahifaning oddiy
    // oqimi (normal document flow) ichida joylashadi, `position: fixed`
    // ishlatilmaydi — shu tufayli sun'iy bo'sh joy yoki klaviatura
    // ochilganda panelni alohida yashirish mantig'i kerak emas.
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-36 pt-4 select-none transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={16} className="text-gray-600 dark:text-slate-300" />
        </button>
        <h1 className="text-2xl font-bold text-[#1e293b] dark:text-white">{t("checkout.title")}</h1>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t("checkout.subtitle")}</p>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">{t("checkout.deliverySection")}</h2>

          {/* Xaridor bu ma'lumotni allaqachon kiritgan bo'lsa (oldingi
              buyurtma), qayta yozdirilmaydi - lekin bu shaffof
              ko'rsatiladi, "sirli" avtomatik to'ldirish emas, va har
              doim erkin tahrirlanadi. */}
          {autofilledFromLastOrder && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl px-3.5 py-2.5 mb-4">
              <Sparkles size={14} className="text-blue-500 shrink-0" />
              <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{t("checkout.autofilledFromLastOrder")}</p>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">{t("checkout.fullName")}</label>
              <input 
                type="text" 
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder={t("checkout.fullNamePlaceholder")} 
                className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.fullName ? 'border-rose-400 focus:border-rose-500' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
              />
              {fieldErrors.fullName && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">{t("checkout.phone")}</label>
              <input 
                type="tel" 
                inputMode="numeric"
                name="phone"
                value={formData.phone}
                onFocus={() => { if (!formData.phone) setFormData(prev => ({ ...prev, phone: '+998 ' })); }}
                onChange={handleInputChange}
                placeholder={t("checkout.phonePlaceholder")} 
                maxLength={17}
                className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.phone ? 'border-rose-400 focus:border-rose-500' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
              />
              {fieldErrors.phone && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.phone}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 pl-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400">{t("checkout.address")}</label>
                <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-slate-800 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setAddressMode('manual')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${addressMode === 'manual' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-slate-500'}`}
                  >
                    {t("checkout.addressManual")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressMode('map')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${addressMode === 'map' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-slate-500'}`}
                  >
                    {t("checkout.addressMap")}
                  </button>
                </div>
              </div>

              {addressMode === 'manual' ? (
                <textarea 
                  name="address"
                  rows="3"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder={t("checkout.addressPlaceholder")} 
                  className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 resize-none font-medium ${fieldErrors.address ? 'border-rose-400 focus:border-rose-500' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
                ></textarea>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border text-left transition-all ${fieldErrors.address ? 'border-rose-400' : 'border-gray-100 dark:border-slate-700'}`}
                >
                  {mapLocation ? (
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">
                      {t("checkout.locationSet")} ({mapLocation.lat.toFixed(4)}, {mapLocation.lng.toFixed(4)})
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-slate-500">{t("checkout.mapPick")}</span>
                  )}
                </button>
              )}
              {fieldErrors.address && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.address}</p>}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">{t("checkout.paymentType")}</label>
              {/* Agar sotuvchi FAQAT bitta turni yoqqan bo'lsa — mijozga
                  tanlash shart emas, oddiy ma'lumot sifatida ko'rsatiladi.
                  Ikkalasi ham yoqilgan bo'lsa — mijoz ANIQ birini
                  TANLASHI SHART (2026-09 punkt-royxati, 14-band). */}
              <div className="flex flex-wrap gap-2">
                {allowedPaymentTypes.length === 0 ? (
                  <span className="text-xs text-gray-400 dark:text-slate-500">{t("checkout.cartEmpty")}</span>
                ) : (
                  allowedPaymentTypes.map((type) => {
                    const isSelectable = allowedPaymentTypes.length > 1;
                    const isSelected = selectedPaymentType === type;
                    const Icon = type === "cod" ? Package : CreditCard;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => isSelectable && setSelectedPaymentType(type)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all ${
                          isSelected || !isSelectable
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                            : "border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900"
                        } ${isSelectable ? "cursor-pointer active:scale-[0.97]" : "cursor-default"}`}
                      >
                        <Icon size={16} className={isSelected || !isSelectable ? "text-blue-600 dark:text-blue-300" : "text-gray-400 dark:text-slate-500"} />
                        <span className={`text-sm font-semibold ${isSelected || !isSelectable ? "text-blue-700 dark:text-blue-300" : "text-gray-500 dark:text-slate-400"}`}>
                          {type === "cod" ? t("checkout.paymentCod") : t("productDetail.prepay")}
                        </span>
                        {isSelectable && (isSelected ? <Check size={14} className="text-blue-600 dark:text-blue-300" /> : null)}
                      </button>
                    );
                  })
                )}
              </div>
              {fieldErrors.paymentType && <p className="text-[11px] text-rose-500 font-semibold mt-1.5 pl-1">{fieldErrors.paymentType}</p>}

              {/* "Karta orqali" tanlanganda — sotuvchining shaxsiy
                  kartasi ko'rsatiladi va mijoz to'lov chekining
                  skrinshotini yuklashi so'raladi. */}
              {selectedPaymentType === "prepay" && (
                <div className="mt-3 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/5 space-y-3">
                  {cardInfoLoading && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">{t("checkout.cardInfoLoading")}</p>
                  )}
                  {cardInfoError && (
                    <p className="text-xs text-rose-500 font-semibold">{cardInfoError}</p>
                  )}
                  {sellerCardInfo && (
                    <>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">{t("checkout.cardPaymentInstructions")}</p>
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3.5 border border-blue-100 dark:border-blue-500/20">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("paymentSettings.cardNumberLabel")}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-base font-mono font-black tracking-wider text-gray-800 dark:text-white">
                            {sellerCardInfo.cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                          </span>
                          <button type="button" onClick={handleCopyCardNumber} className="shrink-0 text-blue-600 dark:text-blue-400">
                            {cardCopied ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-2">{sellerCardInfo.cardHolderName}</p>
                      </div>

                      {showInstallmentOption && (
                        <div className="flex items-center justify-between px-3.5 py-3 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-xs font-black text-violet-700 dark:text-violet-300">{t("checkout.installmentTitle")}</p>
                            <p className="text-[11px] text-violet-600 dark:text-violet-400/90">
                              {t("checkout.installmentDesc", { parts: installmentPartsConfig })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUseInstallments((v) => !v)}
                            className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${useInstallments ? "bg-violet-500 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                          >
                            <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                          </button>
                        </div>
                      )}

                      {installmentPreviewAmounts && (
                        <div className="px-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-violet-100 dark:border-violet-500/20 space-y-1.5">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t("checkout.installmentPreviewTitle")}</p>
                          {installmentPreviewAmounts.map((amount, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-gray-500 dark:text-slate-400">{t("checkout.installmentPartLabel", { n: idx + 1 })}</span>
                              <span className="font-bold text-gray-800 dark:text-white">{amount.toLocaleString()} so'm</span>
                            </div>
                          ))}
                          <p className="text-[10px] text-violet-600 dark:text-violet-400 pt-1">{t("checkout.installmentFirstPayHint")}</p>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1.5">{t("checkout.receiptUploadLabel")}</label>
                        {receiptUrl ? (
                          <div className="relative inline-block">
                            <img src={receiptUrl} alt="receipt" className="w-24 h-24 object-cover rounded-xl border border-blue-200 dark:border-blue-500/30" />
                            <button
                              type="button"
                              onClick={() => setReceiptUrl(null)}
                              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md"
                            >
                              <XIcon size={12} />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center gap-1.5 w-full h-24 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-500/30 bg-white/60 dark:bg-slate-900/40 cursor-pointer">
                            {receiptUploading ? (
                              <>
                                <Loader2 size={18} className="animate-spin text-blue-500" />
                                <span className="text-[10px] font-bold text-blue-500">{receiptProgress}%</span>
                              </>
                            ) : (
                              <>
                                <ImageUp size={18} className="text-blue-400" />
                                <span className="text-[11px] font-bold text-blue-500">{t("checkout.receiptUploadButton")}</span>
                              </>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={handleReceiptFileChange} disabled={receiptUploading} />
                          </label>
                        )}
                        {receiptError && <p className="text-[11px] text-rose-500 font-semibold mt-1">{receiptError}</p>}
                        {fieldErrors.paymentReceipt && <p className="text-[11px] text-rose-500 font-semibold mt-1">{fieldErrors.paymentReceipt}</p>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">{t("checkout.promoCode")}</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
                  <div>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{appliedCoupon.code}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      -{discountAmount.toLocaleString()} so'm {t("checkout.couponDiscountApplied")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-rose-500"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                    placeholder={t("checkout.promoPlaceholder")}
                    className="flex-1 h-11 px-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-bold text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={applyingCoupon || !couponInput.trim()}
                    onClick={handleApplyCoupon}
                    className="h-11 px-5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold rounded-2xl disabled:opacity-50"
                  >
                    {applyingCoupon ? "..." : t("checkout.couponApply")}
                  </button>
                </div>
              )}
              {couponError && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{couponError}</p>}
            </div>

            {/* SODIQLIK DASTURI ("Bonus hisobi") - faqat sotuvchi
                yoqqan VA mijozda ijobiy balans bo'lsagina ko'rsatiladi
                (aks holda foydasiz bo'sh bo'lim bilan chalg'itmaymiz). */}
            {!loyaltyLoading && loyaltyInfo?.enabled && loyaltyInfo.balance > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400">{t("checkout.bonusSectionTitle")}</p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400/90">
                      {t("checkout.bonusBalanceLabel", { amount: loyaltyInfo.balance.toLocaleString() })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleUseBonus}
                    className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${useBonus ? "bg-amber-500 justify-end" : "bg-slate-200 dark:bg-slate-700 justify-start"}`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                {useBonus && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={maxRedeemableBonus}
                        value={bonusAmountInput}
                        onChange={(e) => setBonusAmountInput(e.target.value)}
                        placeholder={t("checkout.bonusInputLabel")}
                        className="flex-1 h-11 px-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-bold text-gray-800 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleUseMaxBonus}
                        className="h-11 px-4 bg-amber-500 text-white text-xs font-bold rounded-2xl shrink-0"
                      >
                        {t("checkout.bonusUseMax")}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">
                      {t("checkout.bonusMaxHint", { amount: maxRedeemableBonus.toLocaleString() })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {store?.region && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">{t("checkout.customerRegionLabel")}</label>
                <CustomSelect
                  value={customerRegion}
                  onChange={setCustomerRegion}
                  options={UZBEKISTAN_REGIONS}
                  placeholder={t("checkout.customerRegionPlaceholder")}
                  error={Boolean(fieldErrors.deliveryZone)}
                />
                {fieldErrors.deliveryZone && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.deliveryZone}</p>}

                {customerRegion && (
                  <div className={`mt-2 flex items-center justify-between p-3.5 rounded-2xl border ${
                    hasDeliveryPricing ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-500/10' : 'border-amber-200 bg-amber-50/50 dark:bg-amber-500/10'
                  }`}>
                    {hasDeliveryPricing ? (
                      <>
                        <div>
                          <p className="text-xs font-bold text-gray-800 dark:text-white">{t(`logistics.tier_${deliveryTier}_label`)}</p>
                          {selectedTierInfo?.days && <p className="text-[10px] text-gray-400 dark:text-slate-500">{t(`deliveryZones.${selectedTierInfo.days}`)}</p>}
                        </div>
                        <span className={`text-xs font-black ${isFreeDeliveryPreview ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-slate-200"}`}>
                          {isFreeDeliveryPreview ? t("checkout.free") : `${Number(selectedTierInfo.price).toLocaleString()} so'm`}
                        </span>
                      </>
                    ) : (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">{t("checkout.noDeliveryPricingSet")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Yetkazib berish VAQT ORALIG'I (2026-09 punkt-royxati,
                15-band) - do'kon ish vaqti va mijoz/sotuvchi hududiga
                qarab hisoblangan bo'sh 1-soatlik oraliqlardan biri. */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">{t("checkout.deliverySlotSectionLabel")}</label>
              <button
                type="button"
                onClick={() => setShowDeliverySlotSheet(true)}
                className={`w-full h-12 px-4 rounded-2xl border text-left text-sm font-bold flex items-center justify-between ${
                  fieldErrors.deliverySlot ? "border-rose-400 text-rose-500" : "border-gray-100 dark:border-slate-700 text-gray-800 dark:text-white"
                } bg-[#f8fafc] dark:bg-slate-800`}
              >
                {selectedDeliverySlot ? (
                  <DeliverySlotLabel slot={selectedDeliverySlot} todayKey={todayKey} />
                ) : (
                  <span className="text-gray-400 dark:text-slate-500 font-medium">{t("checkout.deliverySlotPlaceholder")}</span>
                )}
              </button>
              {fieldErrors.deliverySlot && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.deliverySlot}</p>}
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">{t("checkout.productsSection")}</h2>
          
          <div className="divide-y divide-gray-50 dark:divide-slate-800 max-h-[240px] overflow-y-auto pr-1">
            {carts.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-12 h-12 object-cover rounded-xl bg-[#f8fafc] dark:bg-slate-800"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 dark:text-white text-xs line-clamp-1">{item.name}</h3>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{t("checkout.quantitySuffix")} {item.quantity} ta</p>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                  {(item.price * item.quantity).toLocaleString()} so'm
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 mt-4 pt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>{t("checkout.productsTotal")}</span>
              <span className="font-medium text-gray-700 dark:text-slate-300">{subtotal.toLocaleString()} so'm</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
                <span>{t("checkout.promoLabel")} ({appliedCoupon.code})</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">-{discountAmount.toLocaleString()} so'm</span>
              </div>
            )}
            {bundleDiscountAmount > 0 && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
                <span>{t("checkout.bundleLabel")}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">-{bundleDiscountAmount.toLocaleString()} so'm</span>
              </div>
            )}
            {bonusRedeemAmount > 0 && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
                <span>{t("checkout.bonusLabel")}</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">-{bonusRedeemAmount.toLocaleString()} so'm</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>{t("checkout.deliveryLabel")}</span>
              {!customerRegion || !hasDeliveryPricing ? (
                <span className="text-gray-400 dark:text-slate-500">{t("checkout.zoneNotSelected")}</span>
              ) : isFreeDeliveryPreview ? (
                <span className="text-blue-500 dark:text-blue-400 font-bold">{t("checkout.free")}</span>
              ) : (
                <span className="font-medium text-gray-700 dark:text-slate-300">{deliveryFeePreview.toLocaleString()} so'm</span>
              )}
            </div>
          </div>
        </div>

        {/* "Ko'pincha birga olishadi" (cross-sell) - savatdagi
            mahsulotlarga asoslangan, savat qiymatini bittada
            oshirishga qaratilgan blok. Savat bo'sh bo'lsa yoki
            HECH qanday tavsiya topilmasa, komponent o'zi hech narsa
            render qilmaydi (`CheckoutCrossSell.jsx`). */}
        {carts.length > 0 && <CheckoutCrossSell cartItems={carts} />}

        {/* Bu panel sahifaning oddiy oqimi bir qismi (yuqoridagi
            fayl darajasidagi izohga qarang), shuning uchun yuqoridagi
            kartochkalar bilan bir xil `space-y-6` oralig'idan
            foydalanadi, alohida `max-w`/`px` berish shart emas. */}
        <div className="bg-white/95 dark:bg-slate-900/95 border border-gray-100 dark:border-slate-800 rounded-[24px] px-4 py-3 shadow-lg flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider">{t("checkout.totalValue")}</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalAmount.toLocaleString()} so'm</p>
            {installmentPreviewAmounts && (
              <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold mt-0.5">
                {t("checkout.installmentTotalHint", { amount: installmentPreviewAmounts[0].toLocaleString(), parts: installmentPartsConfig })}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={loading || carts.length === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-center text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none cursor-pointer"
          >
            {loading ? t("checkout.placingOrder") : t("checkout.placeOrder")}
          </button>
        </div>

      </div>

      {showMapPicker && (
        <LocationPickerModal
          initialLocation={mapLocation}
          onConfirm={(loc) => { setMapLocation(loc); setShowMapPicker(false); setFieldErrors((prev) => ({ ...prev, address: null })); }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {showDeliverySlotSheet && (
        <DeliverySlotSheet
          slots={availableDeliverySlots}
          selected={selectedDeliverySlot}
          todayKey={todayKey}
          onSelect={(slot) => { setSelectedDeliverySlot(slot); setFieldErrors((prev) => ({ ...prev, deliverySlot: null })); }}
          onClose={() => setShowDeliverySlotSheet(false)}
        />
      )}

      {success && (
        <StatusModal
          variant="success"
          title="Buyurmangiz muvaffaqiyatli amalga oshdi!"
          message="Tez orada siz bilan bog'lanamiz."
          onClose={() => { navigate('/'); dispatch(resetOrderStatus()); }}
        />
      )}

      {submitError && (
        <StatusModal
          variant="error"
          title="Xatolik yuz berdi"
          message={submitError}
          onClose={() => setSubmitError(null)}
        />
      )}
    </div>
  );

};

export default CheckoutPage;
