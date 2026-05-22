import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Ticket, CreditCard, Check, ShieldCheck, Banknote, Plus, X, Locate, Loader2 } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId');
  const navigate = useNavigate();
  const { fetchCarts } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  const [addresses, setAddresses] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [note, setNote] = useState('');

  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddressName, setNewAddressName] = useState('');
  const [newAddressPhone, setNewAddressPhone] = useState('');
  const [newAddressFull, setNewAddressFull] = useState('');
  const [newAddressLat, setNewAddressLat] = useState(null);
  const [newAddressLng, setNewAddressLng] = useState(null);
  const [newAddressNote, setNewAddressNote] = useState('');
  const [newAddressIsDefault, setNewAddressIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        const [addrRes, vouchRes, cartRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/users/addresses`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/users/vouchers?id_Restaurant=${restaurantId}`, { headers }),
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị.');
      return;
    }
    
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setNewAddressLat(latitude);
        setNewAddressLng(longitude);
        
        try {
          // Sử dụng Nominatim OpenStreetMap API để giải mã tọa độ thành địa chỉ
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (response.data && response.data.display_name) {
            setNewAddressFull(response.data.display_name);
          } else {
            setNewAddressFull(`${latitude}, ${longitude}`);
          }
        } catch (error) {
          console.error('Error reverse geocoding', error);
          setNewAddressFull(`${latitude}, ${longitude}`);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error('Error getting location', error);
        alert('Không thể lấy vị trí hiện tại. Vui lòng cấp quyền định vị cho trang web.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!newAddressName || !newAddressPhone || !newAddressFull) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    
    setSavingAddress(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const payload = {
        name: newAddressName,
        phone: newAddressPhone,
        full_Address: newAddressFull,
        lat: newAddressLat,
        lng: newAddressLng,
        note: newAddressNote || null,
        is_Default: newAddressIsDefault
      };
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/users/addresses`, payload, { headers });
      
      if (response.data && response.data.id_Address) {
        // Tải lại danh sách địa chỉ
        const addrRes = await axios.get(`${import.meta.env.VITE_API_URL}/users/addresses`, { headers });
        setAddresses(addrRes.data);
        
        // Tự động chọn địa chỉ mới thêm
        setSelectedAddress(response.data.id_Address);
        
        // Reset form và đóng modal
        setNewAddressName('');
        setNewAddressPhone('');
        setNewAddressFull('');
        setNewAddressLat(null);
        setNewAddressLng(null);
        setNewAddressNote('');
        setNewAddressIsDefault(false);
        setShowAddressModal(false);
      }
    } catch (error) {
      console.error('Error saving address', error);
      alert('Không thể lưu địa chỉ: ' + (error.response?.data?.message || error.message));
    } finally {
      setSavingAddress(false);
    }
  };

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
    const v = vouchers.find(x => x.id === selectedVoucher);
    if (v && foodTotal >= v.min_OrderValue) {
      if (v.type === 'percent') {
        discount = (foodTotal * v.value) / 100;
        if (v.max_Discount && discount > v.max_Discount) {
          discount = v.max_Discount;
        }
      } else if (v.type === 'fixed') {
        discount = v.value;
      } else if (v.type === 'freeship') {
        discount = shippingFee;
      }
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="text-orange-500" /> Địa chỉ giao hàng
                </h2>
                <button
                  onClick={() => {
                    setNewAddressPhone(user?.phone || '');
                    setShowAddressModal(true);
                  }}
                  className="text-sm font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-transparent"
                >
                  <Plus className="w-4 h-4" /> Thêm địa chỉ mới
                </button>
              </div>
              {addresses.length === 0 ? (
                <div className="bg-orange-50 text-orange-600 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                  <span>Bạn chưa có địa chỉ giao hàng nào.</span>
                  <button 
                    onClick={() => {
                      setNewAddressPhone(user?.phone || '');
                      setShowAddressModal(true);
                    }}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600"
                  >
                    Thêm địa chỉ
                  </button>
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
                  {vouchers.map(v => {
                    const discountText = v.type === 'percent' 
                      ? `Giảm ${v.value}%` 
                      : v.type === 'freeship' 
                      ? 'Miễn phí vận chuyển' 
                      : `Giảm ${Number(v.value).toLocaleString('vi-VN')}đ`;
                      
                    const minOrderText = v.min_OrderValue > 0 
                      ? ` (Đơn tối thiểu ${Number(v.min_OrderValue).toLocaleString('vi-VN')}đ)` 
                      : '';
                      
                    const isApplicable = foodTotal >= v.min_OrderValue;
                    
                    return (
                      <option 
                        key={v.id} 
                        value={v.id}
                        disabled={!isApplicable}
                      >
                        {v.code} - {discountText}{minOrderText} {!isApplicable ? '[Không đủ ĐK]' : ''}
                      </option>
                    );
                  })}
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

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <MapPin className="text-orange-500" /> Thêm địa chỉ mới
              </h3>
              <button 
                onClick={() => setShowAddressModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tên gợi nhớ (ví dụ: Nhà, Công ty...)</label>
                <input 
                  type="text"
                  required
                  value={newAddressName}
                  onChange={e => setNewAddressName(e.target.value)}
                  placeholder="Nhà riêng, Văn phòng..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Số điện thoại nhận hàng</label>
                <input 
                  type="tel"
                  required
                  value={newAddressPhone}
                  onChange={e => setNewAddressPhone(e.target.value)}
                  placeholder="Nhập số điện thoại..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-slate-50/50"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Địa chỉ chi tiết</label>
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={locating}
                    className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:text-slate-400 bg-orange-50 hover:bg-orange-100 disabled:bg-slate-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  >
                    {locating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Locate className="w-3.5 h-3.5" />
                    )}
                    {locating ? 'Đang lấy vị trí...' : 'Lấy vị trí hiện tại'}
                  </button>
                </div>
                <textarea 
                  required
                  rows="2"
                  value={newAddressFull}
                  onChange={e => setNewAddressFull(e.target.value)}
                  placeholder="Địa chỉ số nhà, đường, phường/xã, quận/huyện..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-slate-50/50 text-sm"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ghi chú (tùy chọn)</label>
                <input 
                  type="text"
                  value={newAddressNote}
                  onChange={e => setNewAddressNote(e.target.value)}
                  placeholder="Cổng màu xanh, giao giờ hành chính..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-slate-50/50"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="is_default_chk"
                  checked={newAddressIsDefault}
                  onChange={e => setNewAddressIsDefault(e.target.checked)}
                  className="w-4 h-4 text-orange-500 focus:ring-orange-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="is_default_chk" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  Đặt làm địa chỉ mặc định
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold rounded-xl transition-colors shadow-md shadow-orange-100 flex justify-center items-center gap-2 cursor-pointer"
                >
                  {savingAddress && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu địa chỉ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

