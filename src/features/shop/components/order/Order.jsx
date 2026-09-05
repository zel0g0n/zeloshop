import { memo, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getOrderStatusInfo } from "@/constants/orderStatus";
import { MapPin, ChevronDown, RotateCcw, Navigation, Layers, ImageUp, Loader2, Check } from "lucide-react";
import { reorderFromPastOrder } from "@/store/slices/product/cartSlice";
import { useLanguage } from "@/context/LanguageContext";
import { useSession } from "@/context/SessionContext";
import { useUploadImage } from "@/hooks/storage/useUploadStorage";
import submitInstallmentPayment from "@/services/orders/submitInstallmentPayment";

const Order = ({order}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { sellerId: currentSellerId, clientId: currentUserId } = useSession();
  const statusInfo = getOrderStatusInfo(order.status);

  // "BO'LIB TO'LASH" — keyingi (2-, 3-...) qism uchun to'lov chekini
  // yuklash. Birinchi qism buyurtma berilganda allaqachon
  // biriktirilgan (`order.installmentPlan.payments[0]`) — bu yerda
  // FAQAT navbatdagi to'lanmagan qismlar uchun UI ko'rsatiladi.
  const plan = order.installmentPlan;
  const { uploadImage, progress: installmentUploadProgress, loading: installmentUploading } = useUploadImage();
  const [installmentSubmitting, setInstallmentSubmitting] = useState(false);
  const [installmentError, setInstallmentError] = useState(null);
  const [localPartsPaid, setLocalPartsPaid] = useState(null);

  const partsPaid = localPartsPaid ?? plan?.partsPaid ?? 0;
  const isFullyPaid = plan ? partsPaid >= plan.totalParts : false;

  const handleInstallmentReceiptChange = useCallback(async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentSellerId || !currentUserId) return;
    setInstallmentError(null);
    setInstallmentSubmitting(true);
    try {
      const url = await uploadImage(file, `payment-receipts/${currentSellerId}/${currentUserId}`);
      const result = await submitInstallmentPayment(order.id, url);
      setLocalPartsPaid(result.partsPaid);
    } catch (err) {
      setInstallmentError(err.message || t("ordersPage.installmentSubmitError"));
    } finally {
      setInstallmentSubmitting(false);
    }
  }, [uploadImage, currentSellerId, currentUserId, order.id, t]);

  // "BIR TUGMA BILAN QAYTA BUYURTMA" - xaridni oshirishning eng
  // arzon, eng samarali usullaridan biri: takroriy xaridor uchun
  // butun katalogni qayta ko'rib chiqish o'rniga, bitta bosishda
  // aynan o'sha mahsulotlarni savatga qaytaradi.
  const handleReorder = useCallback((e) => {
    e.stopPropagation();
    dispatch(reorderFromPastOrder(order.orders || []));
    navigate("/cart");
  }, [dispatch, navigate, order.orders]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-100/80 dark:border-slate-800 shadow-sm space-y-3 max-w-md mx-auto transition-all duration-300">
      
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1 max-w-[65%]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
              {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '12:34'}
            </span>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block ${statusInfo.color}`}>
              {t(`orderStatus.${statusInfo.key}`)}
            </span>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
            {t("ordersPage.customer")} <span className="font-bold text-gray-700 dark:text-slate-200">{order.customer?.fullName || 'Noma\'lum'}</span>
          </p>

          <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate flex items-center gap-1">
            <MapPin size={11} className="shrink-0" /> {order.customer?.address || t("ordersPage.address")}
          </p>
        </div>
        
        <div className="text-right flex flex-col items-end space-y-1.5 shrink-0">
          <span className="font-black text-[#514be3] dark:text-[#8b85f5] text-sm block font-mono">
            {Number(order.totalAmount).toLocaleString()} so'm
          </span>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-[#514be3] transition-all text-gray-500 dark:text-slate-400 active:scale-95"
            >
              <ChevronDown
                size={16}
                strokeWidth={3}
                className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#514be3]' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="pt-2 space-y-3 border-t border-dashed border-gray-100 dark:border-slate-700 transition-all">
          
          <div className="grid grid-cols-2 gap-2 bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 text-xs text-gray-600 dark:text-slate-300">
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">{t("ordersPage.phoneLabel")}</p>
              <p className="font-semibold text-gray-700 dark:text-slate-200 font-mono">{order.customer?.phone || t("ordersPage.unknownPhone")}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase">{t("ordersPage.paymentTypeLabel")}</p>
              <p className="font-semibold text-gray-700 dark:text-slate-200 uppercase font-mono">
                {order.paymentMethod === 'cash' ? t("ordersPage.cash") : order.paymentMethod}
              </p>
            </div>
          </div>

          <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2.5 text-xs text-gray-600 dark:text-slate-300">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase mb-0.5">{t("ordersPage.fullAddressLabel")}</p>
            <p className="text-gray-700 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed">
              {order.customer?.address}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase px-1">{t("ordersPage.orderContents")} ({order.orders?.length || 0} ta)</p>
            <div className="bg-gray-50/60 dark:bg-slate-800/60 rounded-xl p-2 text-xs text-gray-600 dark:text-slate-300 space-y-2">
              {order.orders?.map((item, index) => (
                <div
                  key={item.id || index}
                  className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 shadow-sm border border-gray-100 dark:border-slate-700"
                >
                  <img
                    src={item.image || "/placeholder.png"}
                    alt={item.name}
                    className="w-11 h-11 rounded-xl object-cover bg-gray-100 dark:bg-slate-800 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 dark:text-white truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">
                        x{item.quantity}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium font-mono">
                        {Number(item.price).toLocaleString()} so'm
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[12px] font-bold text-[#3B5BFF] dark:text-[#7c8fff] font-mono">
                      {(item.price * item.quantity).toLocaleString()} so'm
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {plan && (
            <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Layers size={13} className="text-violet-500 shrink-0" />
                <p className="text-[11px] font-black text-violet-700 dark:text-violet-300">
                  {t("ordersPage.installmentProgress", { paid: partsPaid, total: plan.totalParts })}
                </p>
              </div>

              {isFullyPaid ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Check size={12} /> {t("ordersPage.installmentFullyPaid")}
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-violet-600 dark:text-violet-400/90">
                    {t("ordersPage.installmentNextAmount", { amount: Number(plan.amounts?.[partsPaid] || 0).toLocaleString() })}
                  </p>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 w-full h-10 rounded-lg border-2 border-dashed border-violet-300 dark:border-violet-500/30 bg-white/60 dark:bg-slate-900/40 cursor-pointer"
                  >
                    {installmentUploading || installmentSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-violet-500" />
                        <span className="text-[11px] font-bold text-violet-500">{installmentUploading ? `${installmentUploadProgress}%` : t("ordersPage.installmentSubmitting")}</span>
                      </>
                    ) : (
                      <>
                        <ImageUp size={14} className="text-violet-500" />
                        <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">{t("ordersPage.installmentUploadButton")}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleInstallmentReceiptChange}
                      disabled={installmentUploading || installmentSubmitting}
                    />
                  </label>
                  {installmentError && <p className="text-[11px] text-rose-500 font-semibold">{installmentError}</p>}
                </>
              )}
            </div>
          )}

          {order.yandexTrackingLink && (
            <a
              href={order.yandexTrackingLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full h-11 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Navigation size={14} /> {t("ordersPage.trackDeliveryButton")}
            </a>
          )}

          <button
            type="button"
            onClick={handleReorder}
            className="w-full h-11 bg-[#514be3] dark:bg-[#5346E0] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <RotateCcw size={14} /> {t("ordersPage.reorderButton")}
          </button>
        </div>
      )}

    </div>
  )
}

export default memo(Order)
