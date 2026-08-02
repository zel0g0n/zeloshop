import { useState, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useSendOrder from '@/hooks/useSendOrder';
import { resetOrderStatus } from '@/store/slices/order/sendOrderSlice';
import { useSession } from '@/context/SessionContext';
import { formatUzPhone, isValidUzPhone } from '@/utils/phone';
import { validateCoupon } from '@/services/coupons/coupons';
import { DELIVERY_ZONES } from '@/constants/deliveryZones';
import StatusModal from '@/components/ui/StatusModal';
import LocationPickerModal from '@/components/ui/LocationPickerModal';

const CheckoutPage = () => {

  const { sendOrder, loading, carts, success } = useSendOrder();
  const dispatch = useDispatch()
  const navigate = useNavigate();
  const { sellerId: currentSellerId, clientId: currentUserId, store } = useSession();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
  });

  const [addressMode, setAddressMode] = useState('manual'); // 'manual' | 'map'
  const [mapLocation, setMapLocation] = useState(null); // { lat, lng }
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [deliveryZoneKey, setDeliveryZoneKey] = useState('');

  // Sotuvchi sozlagan hududlardan faqat narxi belgilanganlarini
  // ko'rsatamiz — bo'sh (0 so'm) qoldirilganlarini emas.
  const availableZones = useMemo(() => {
    if (!store?.deliveryZones) return [];
    return DELIVERY_ZONES.filter((zone) => Number(store.deliveryZones[zone.key]?.price) > 0)
      .map((zone) => ({ ...zone, ...store.deliveryZones[zone.key] }));
  }, [store]);

  // OLDIN: xatolar faqat brauzerning alert() oynasi orqali ko'rsatilardi.
  // Endi har bir maydon o'zining aniq xatosini ko'rsatadi (mashhur
  // saytlardagi kabi) — bu foydalanuvchiga aynan qaysi maydon
  // to'ldirilmaganini ko'rsatadi, umumiy "hammasini to'ldiring" o'rniga.
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

  const amountAfterDiscount = Math.max(0, subtotal - discountAmount);

  // Eslatma: bu — faqat KO'RSATISH uchun taxmin. Haqiqiy yetkazib
  // berish narxi HAR DOIM server tomonida (`createOrder` Cloud
  // Function) sotuvchining haqiqiy sozlamasidan qayta hisoblanadi —
  // xuddi narx va promokod kabi.
  const selectedZone = availableZones.find((z) => z.key === deliveryZoneKey);
  const isFreeDeliveryPreview = Boolean(
    store?.freeDeliveryEnabled &&
    store?.freeDeliveryThreshold &&
    amountAfterDiscount >= Number(store.freeDeliveryThreshold)
  );
  const deliveryFeePreview = selectedZone ? (isFreeDeliveryPreview ? 0 : Number(selectedZone.price) || 0) : 0;

  const totalAmount = amountAfterDiscount + deliveryFeePreview;

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

  // OLDIN: bu yerda mijoz "Kuryerga naqd" yoki "Karta orqali"ni ERKIN
  // tanlardi — bu sotuvchining mahsulotda belgilagan to'lov turidan
  // MUSTAQIL, alohida tanlov edi. Endi to'lov turi FAQAT sotuvchi
  // tomonidan (mahsulot qo'shishda) belgilanadi — bu yerda faqat
  // savatdagi barcha mahsulotlar UMUMIY qo'llab-quvvatlaydigan
  // (kesishgan) turlar ko'rsatiladi, mijoz o'zgartira olmaydi.
  const allowedPaymentTypes = useMemo(() => {
    if (carts.length === 0) return [];
    const perItemTypes = carts.map((item) =>
      Array.isArray(item.paymentTypes) && item.paymentTypes.length > 0
        ? item.paymentTypes
        : (item.paymentType ? [item.paymentType] : ["prepay"])
    );
    return perItemTypes.reduce((acc, curr) => acc.filter((t) => curr.includes(t)));
  }, [carts]);

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

    if (availableZones.length > 0 && !deliveryZoneKey) {
      errors.deliveryZone = "Yetkazib berish hududini tanlang";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, addressMode, mapLocation, availableZones, deliveryZoneKey]);

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
          couponCode: appliedCoupon?.code || null,
          discountAmount,
          deliveryZoneKey: deliveryZoneKey || null,
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
  }, [formData, addressMode, mapLocation, allowedPaymentTypes, appliedCoupon, discountAmount, deliveryZoneKey, carts, sendOrder, navigate, validate, currentSellerId, currentUserId, dispatch]);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 pb-24 pt-4 select-none transition-colors duration-300">
      <div className="max-w-md mx-auto px-4 mb-6">
        <h1 className="text-2xl font-bold text-[#1e293b] dark:text-white">Xaridni rasmiylashtirish</h1>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Buyurtmani yakunlash uchun ma'lumotlarni kiriting</p>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4">Yetkazib berish</h2>
          
          <form onSubmit={handlePlaceOrder} noValidate className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">F.I.Sh</label>
              <input 
                type="text" 
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Max Tiger" 
                className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.fullName ? 'border-rose-400 focus:border-rose-500' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
              />
              {fieldErrors.fullName && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5 pl-1">Telefon raqam</label>
              <input 
                type="tel" 
                inputMode="numeric"
                name="phone"
                value={formData.phone}
                onFocus={() => { if (!formData.phone) setFormData(prev => ({ ...prev, phone: '+998 ' })); }}
                onChange={handleInputChange}
                placeholder="+998 90 123 45 67" 
                maxLength={17}
                className={`w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border outline-none focus:bg-white dark:focus:bg-slate-800 transition-all text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 font-medium ${fieldErrors.phone ? 'border-rose-400 focus:border-rose-500' : 'border-gray-100 dark:border-slate-700 focus:border-blue-500'}`}
              />
              {fieldErrors.phone && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.phone}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 pl-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400">Manzil</label>
                <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-slate-800 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setAddressMode('manual')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${addressMode === 'manual' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-slate-500'}`}
                  >
                    ✍️ Qo'lda
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressMode('map')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${addressMode === 'map' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-slate-500'}`}
                  >
                    📍 Xaritadan
                  </button>
                </div>
              </div>

              {addressMode === 'manual' ? (
                <textarea 
                  name="address"
                  rows="3"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Toshkent shahar, Chilonzor..." 
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
                      📍 Joylashuv belgilandi ({mapLocation.lat.toFixed(4)}, {mapLocation.lng.toFixed(4)})
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-slate-500">Xaritadan joylashuvni tanlash uchun bosing</span>
                  )}
                </button>
              )}
              {fieldErrors.address && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.address}</p>}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">To'lov turi</label>
              {/* OLDIN: bu yerda mijoz erkin radio tugma orqali tanlardi.
                  Endi — faqat ma'lumot: sotuvchi qaysi turlarni yoqqan
                  bo'lsa, o'shalar ko'rsatiladi. Mijoz o'zgartira olmaydi. */}
              <div className="flex flex-wrap gap-2">
                {allowedPaymentTypes.length === 0 ? (
                  <span className="text-xs text-gray-400 dark:text-slate-500">Savat bo'sh</span>
                ) : (
                  allowedPaymentTypes.map((type) => (
                    <div
                      key={type}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10"
                    >
                      <span className="text-base">{type === "cod" ? "📦" : "💳"}</span>
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {type === "cod" ? "Yetkazilganda to'lov" : "Oldindan to'lov"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">Promokod (ixtiyoriy)</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
                  <div>
                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{appliedCoupon.code}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      -{discountAmount.toLocaleString()} so'm chegirma qo'llandi
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-rose-500"
                  >
                    Bekor qilish
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                    placeholder="Kodni kiriting"
                    className="flex-1 h-11 px-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm font-bold text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 uppercase tracking-wider focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={applyingCoupon || !couponInput.trim()}
                    onClick={handleApplyCoupon}
                    className="h-11 px-5 bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold rounded-2xl disabled:opacity-50"
                  >
                    {applyingCoupon ? "..." : "Qo'llash"}
                  </button>
                </div>
              )}
              {couponError && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{couponError}</p>}
            </div>

            {availableZones.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2 pl-1">Yetkazib berish hududi</label>
                <div className="space-y-2">
                  {availableZones.map((zone) => {
                    const zoneFree = Boolean(
                      store?.freeDeliveryEnabled &&
                      store?.freeDeliveryThreshold &&
                      amountAfterDiscount >= Number(store.freeDeliveryThreshold)
                    );
                    return (
                      <label
                        key={zone.key}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          deliveryZoneKey === zone.key
                            ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-500/10'
                            : 'border-gray-100 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-800 dark:text-white">{zone.label}</p>
                          {zone.days && <p className="text-[10px] text-gray-400 dark:text-slate-500">{zone.days}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black ${zoneFree ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-slate-200"}`}>
                            {zoneFree ? "Bepul" : `${Number(zone.price).toLocaleString()} so'm`}
                          </span>
                          <input
                            type="radio"
                            name="deliveryZone"
                            checked={deliveryZoneKey === zone.key}
                            onChange={() => setDeliveryZoneKey(zone.key)}
                            className="accent-blue-600 w-4 h-4"
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.deliveryZone && <p className="text-[11px] text-rose-500 font-semibold mt-1 pl-1">{fieldErrors.deliveryZone}</p>}
              </div>
            )}
          </form>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-gray-100/80 dark:border-slate-800 mb-[100px]">
          <h2 className="text-sm font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Mahsulotlar</h2>
          
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
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Soni: {item.quantity} ta</p>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                  {(item.price * item.quantity).toLocaleString()} so'm
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 mt-4 pt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>Mahsulotlar summasi</span>
              <span className="font-medium text-gray-700 dark:text-slate-300">{subtotal.toLocaleString()} so'm</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
                <span>Promokod ({appliedCoupon.code})</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">-{discountAmount.toLocaleString()} so'm</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500">
              <span>Yetkazib berish</span>
              {!selectedZone ? (
                <span className="text-gray-400 dark:text-slate-500">Hudud tanlanmagan</span>
              ) : isFreeDeliveryPreview ? (
                <span className="text-blue-500 dark:text-blue-400 font-bold">Bepul</span>
              ) : (
                <span className="font-medium text-gray-700 dark:text-slate-300">{deliveryFeePreview.toLocaleString()} so'm</span>
              )}
            </div>
          </div>
        </div>

      </div>
      <div className="fixed bottom-24 left-0 right-0 z-40 px-[10px]">
        <div className="max-w-[440px] mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border border-gray-100 dark:border-slate-800 rounded-[24px] px-4 py-3 shadow-lg flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider">Umumiy qiymat</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{totalAmount.toLocaleString()} so'm</p>
          </div>
          
          <button 
            type="button"
            onClick={handlePlaceOrder}
            disabled={loading || carts.length === 0}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-2xl text-center text-sm shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none cursor-pointer"
          >
            {loading ? "Buyurtma berilmoqda..." : "Buyurtmani yakunlash"}
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
