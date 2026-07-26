import { useState, useMemo, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useSendOrder from '@/hooks/useSendOrder';
import {FiCheckCircle} from 'react-icons/fi'
import { resetOrderStatus } from '@/store/slices/order/sendOrderSlice';


const CheckoutPage = () => {

  const { sendOrder, loading, carts, success } = useSendOrder();
  const dispatch = useDispatch()
  const navigate = useNavigate();
  
  const currentSellerId = "yGsq7Cmn2C3IF103gtGm";
  const currentUserId = "QdPK91xipZh6c6JHaupV";

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    paymentMethod: 'cash', 
  });

  const totalAmount = useMemo(() => {
    return carts.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  }, [carts]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const isFormValid = useCallback(() => {
    const { fullName, phone, address } = formData;
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      alert("Iltimos, barcha maydonlarni to'ldiring.");
      return false;
    }
    return true;
  }, [formData]);

  const handlePlaceOrder = useCallback(async (e) => {
    e.preventDefault();
    if (!isFormValid()) return;
    
    const { fullName, phone, address, paymentMethod } = formData;
    
    try {
      await sendOrder(
        { 
          fullName: fullName.trim(), 
          phone: phone.trim(), 
          address: address.trim(),
          paymentMethod 
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
      alert("Xatolik yuz berdi: " + (error.message || "Buyurtma jo'natilmadi"));
      console.error("Order sending error in page:", error);
    }
  }, [formData, carts, sendOrder, navigate, isFormValid]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24 pt-4 select-none">
      <div className="max-w-md mx-auto px-4 mb-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">Xaridni rasmiylashtirish</h1>
        <p className="text-xs text-gray-400 mt-1">Buyurtmani yakunlash uchun ma'lumotlarni kiriting</p>
      </div>

      <div className="max-w-md mx-auto px-4 space-y-6">
        
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100/80">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Yetkazib berish</h2>
          
          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-1">F.I.Sh</label>
              <input 
                type="text" 
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Max Tiger" 
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-1">Telefon raqam</label>
              <input 
                type="tel" 
                name="phone"
                required  
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+998 90 123 45 67" 
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 pl-1">Manzil</label>
              <textarea 
                name="address"
                required
                rows="3"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Toshkent shahar, Chilonzor..." 
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400 resize-none font-medium"
              ></textarea>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-500 mb-2 pl-1">To'lov turi</label>
              <div className="space-y-2">
                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${formData.paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50/30 text-blue-600 font-semibold' : 'border-gray-100 bg-[#f8fafc] text-gray-600'}`}>
                  <span className="text-sm">Kuryerga naqd to'lash</span>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="cash" 
                    checked={formData.paymentMethod === 'cash'}
                    onChange={handleInputChange}
                    className="accent-blue-600 w-4 h-4"
                  />
                </label>
                <label className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${formData.paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/30 text-blue-600 font-semibold' : 'border-gray-100 bg-[#f8fafc] text-gray-600'}`}>
                  <span className="text-sm">Karta orqali (Click/Payme)</span>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={handleInputChange}
                    className="accent-blue-600 w-4 h-4"
                  />
                </label>
              </div>
            </div>
          </form>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100/80 mb-[100px]">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Mahsulotlar</h2>
          
          <div className="divide-y divide-gray-50 max-h-[240px] overflow-y-auto pr-1">
            {carts.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-12 h-12 object-cover rounded-xl bg-[#f8fafc]"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-xs line-clamp-1">{item.name}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Soni: {item.quantity} ta</p>
                </div>
                <span className="font-bold text-blue-600 text-sm">
                  ${item.price * item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-4 pt-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Mahsulotlar summasi</span>
              <span className="font-medium text-gray-700">${totalAmount}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Yetkazib berish</span>
              <span className="text-blue-500 font-bold">Bepul</span>
            </div>
          </div>
        </div>

      </div>
      <div className="fixed bottom-[90px] left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-4 py-3 z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Umumiy qiymat</p>
            <p className="text-2xl font-black text-blue-600">${totalAmount}</p>
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
      {success && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-xl flex flex-col items-center max-w-xs text-center animate-fade-in">
            <FiCheckCircle size={44} className="text-green-500 mb-3" />
            <h3 className="text-base font-bold text-gray-800 mb-1">Buyurmangiz muvaffaqiyatli amalga oshdi!</h3>
            <p className="text-xs text-gray-500">Tez orada siz bilan bog'lanamiz.</p>
          </div>
        </div>
      )}
    </div>
  );

};

export default CheckoutPage;
