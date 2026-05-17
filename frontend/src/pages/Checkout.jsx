import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Ticket, CreditCard, Check, ShieldCheck, Banknote } from 'lucide-react';
import { CartContext } from '../context/CartContext';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId');
  const navigate = useNavigate();
  const { fetchCarts } = useContext(CartContext);

  const [addresses, setAddresses] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [note, setNote] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const [addrRes, vouchRes, cartRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/users/addresses`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/users/vouchers`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/cart`, { headers })
        ]);
        
        setAddresses(addrRes.data);
        setVouchers(vouchRes.data);
        
        const currentCart = cartRes.data.find(c => c.id_Restaurant == restaurantId);
        setCart(currentCart);
        
        if (addrRes.data.length > 0) {
          const def = addrRes.data.find(a => a.is_Default);
          if (def) setSelectedAddress(def.id_Address);
          else setSelectedAddress(addrRes.data[0].id_Address);
        }
      } catch (error) {
        console.error('Error fetching checkout data', error);
      } finally {
        setLoading(false);
      }
    };
    if (restaurantId) fetchData();
  }, [restaurantId]);

  const handleCheckout = async () => {
    if (!selectedAddress) {
      alert('Vui lòng chọn địa chỉ giao hàng');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const payload = {
        id_Address: selectedAddress,
        id_Restaurant: restaurantId,
        payment_Method: paymentMethod,
        note,
        id_Promo: selectedVoucher || null
      };
      await axios.post(`${import.meta.env.VITE_API_URL}/orders`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCarts();
      navigate('/orders');
    } catch (error) {
      alert('Lỗi đặt hàng: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!cart || cart.items.length === 0) return <div className="min-h-screen flex justify-center items-center text-slate-500">Giỏ hàng trống.</div>;

  const foodTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingFee = 20000;
  let discount = 0;
  
  if (selectedVoucher) {
    const v = vouchers.find(x => x.id_Voucher == selectedVoucher);
    if (v) {
      discount = v.value; // simple fixed logic based on schema value
    }
  }
  
  const total = Math.max(0, foodTotal + shippingFee - discount);

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Thanh toán đơn hàng</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Address */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <MapPin className="text-orange-500" /> Địa chỉ giao hàng
              </h2>
              {addresses.length === 0 ? (
                <div className="bg-orange-50 text-orange-600 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                  <span>Bạn chưa có địa chỉ giao hàng nào.</span>
                  <Link to="/profile" className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600">Thêm địa chỉ</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map(a => (
                    <label key={a.id_Address} className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${selectedAddress == a.id_Address ? 'border-orange-500 bg-orange-50' : 'hover:border-slate-300'}`}>
                      <input type="radio" name="address" value={a.id_Address} checked={selectedAddress == a.id_Address} onChange={(e) => setSelectedAddress(e.target.value)} className="mt-1 text-orange-500 focus:ring-orange-500" />
                      <div>
                        <div className="font-bold text-slate-800">{a.name} <span className="text-slate-500 font-normal">| {a.phone}</span></div>
                        <div className="text-slate-600 text-sm mt-1">{a.full_Address}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Ghi chú đơn hàng</h2>
              <textarea 
                rows="3" 
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:ring-orange-500 focus:border-orange-500 bg-slate-50"
                placeholder="Giao tới lễ tân, gọi cửa..."
              ></textarea>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CreditCard className="text-blue-500" /> Phương thức thanh toán
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'online' ? 'border-blue-500 bg-blue-50' : 'hover:border-slate-300'}`}>
                  <input type="radio" name="payment" value="online" checked={paymentMethod === 'online'} onChange={(e) => setPaymentMethod(e.target.value)} className="text-blue-500 focus:ring-blue-500" />
                  <CreditCard className="w-6 h-6 text-blue-500" />
                  <span className="font-bold text-slate-800">Thanh toán Online (Ví/Card)</span>
                </label>
                <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'hover:border-slate-300'}`}>
                  <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={(e) => setPaymentMethod(e.target.value)} className="text-green-500 focus:ring-green-500" />
                  <Banknote className="w-6 h-6 text-green-500" />
                  <span className="font-bold text-slate-800">Tiền mặt khi nhận hàng</span>
                </label>
              </div>
            </div>

          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h3 className="font-bold text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Tóm tắt đơn hàng</h3>
              
              <div className="mb-4">
                <div className="font-bold text-slate-800 mb-2">{cart.name_Restaurant}</div>
                {cart.items.map(item => (
                  <div key={item.id_CartFood} className="flex justify-between text-sm text-slate-600 mb-1">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{(item.price * item.quantity).toLocaleString('vi-VN')} đ</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 py-4 mb-4">
                <h4 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1"><Ticket className="w-4 h-4 text-orange-500" /> Mã giảm giá</h4>
                <select 
                  value={selectedVoucher} 
                  onChange={(e) => setSelectedVoucher(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 text-sm bg-slate-50"
                >
                  <option value="">Không sử dụng voucher</option>
                  {vouchers.map(v => (
                    <option key={v.id_Voucher} value={v.id_Voucher}>{v.code} - Giảm {v.value.toLocaleString()}đ</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Tạm tính</span>
                  <span>{foodTotal.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Phí giao hàng</span>
                  <span>{shippingFee.toLocaleString('vi-VN')} đ</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Giảm giá</span>
                    <span>-{discount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800">Tổng cộng</span>
                  <span className="text-2xl font-extrabold text-orange-500">{total.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={!selectedAddress}
                className="w-full mt-6 py-4 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-md flex justify-center items-center gap-2"
              >
                <Check className="w-5 h-5" /> Đặt hàng ngay
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
