import { useState, useEffect } from 'react';
import { db } from '@/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const OrderForm = () => {
    const navigate = useNavigate();
    const [ setLoading] = useState(false);
    const [cart, setCart] = useState([]);
    
    const [formData, setFormData] = useState({
      fullName: '',
      phone: '',
      address: '',
      paymentMethod: 'cash', 
    });
  
    useEffect(() => {
      const savedCart = JSON.parse(localStorage.getItem('cart')) || [];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(savedCart);
    }, []);
  
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };
  
    const handlePlaceOrder = async (e) => {
      e.preventDefault();
      if (cart.length === 0) return;
      
      setLoading(true);
      try {
        const orderData = {
          customer: {
            fullName: formData.fullName,
            phone: formData.phone,
            address: formData.address,
          },
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
          })),
          totalAmount: totalAmount,
          paymentMethod: formData.paymentMethod,
          status: "Yangi",
          createdAt: serverTimestamp()
        };
  
        await addDoc(collection(db, "orders"), orderData);
        localStorage.removeItem('zelo_cart');
        window.dispatchEvent(new Event('storage'));
  
        navigate('/'); 
      } catch (error) {
        console.error("Order error:", error);
      } finally {
        setLoading(false);
      }
    };
  return (
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
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400"
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
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400"
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
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f8fafc] border border-gray-100 outline-none focus:border-blue-500 focus:bg-white transition-all text-sm text-gray-800 placeholder-gray-400 resize-none"
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
  )
}

export default OrderForm