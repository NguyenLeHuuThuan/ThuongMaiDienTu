import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Ticket, CreditCard, Check, ShieldCheck, Banknote, Plus, X, Locate, Loader2, Wallet, AlertCircle, Pencil } from 'lucide-react';
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
  const [selectedFreeshipVoucher, setSelectedFreeshipVoucher] = useState('');
  const [selectedDiscountVoucher, setSelectedDiscountVoucher] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentConfigs, setPaymentConfigs] = useState({
    pay_cod_enabled: { enabled: false },
    pay_vnpay_enabled: { enabled: false },
    pay_wallet_enabled: { enabled: false }
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [note, setNote] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});
  const [shippingFee, setShippingFee] = useState(20000);
  const [distance, setDistance] = useState(0);
  const [shippingFeeError, setShippingFeeError] = useState('');

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
        
        const [addrRes, vouchRes, cartRes, configRes, walletRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/users/addresses`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/users/vouchers?id_Restaurant=${restaurantId}`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/cart`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/orders/payment-configs`, { headers }),
          axios.get(`${import.meta.env.VITE_API_URL}/users/wallet`, { headers }).catch(e => ({ data: { wallet_balance: 0 } }))
        ]);
        
        setAddresses(addrRes.data);
        setVouchers(vouchRes.data);
        setWalletBalance(Number(walletRes.data?.wallet_balance) || 0);
        
        const currentCart = cartRes.data.find(c => c.id_Restaurant == restaurantId);
        setCart(currentCart);

        const activeConfigs = configRes.data;
        setPaymentConfigs(activeConfigs);
        
        const currentBalance = Number(walletRes.data?.wallet_balance) || 0;
        const hasDebt = currentBalance < 0;

        // Auto-select the first available active payment method
        if (activeConfigs.pay_wallet_enabled?.enabled) {
          setPaymentMethod('wallet');
        } else if (activeConfigs.pay_cod_enabled?.enabled && !hasDebt) {
          setPaymentMethod('cash');
        } else if (activeConfigs.pay_vnpay_enabled?.enabled) {
          setPaymentMethod('vnpay');
        } else {
          setPaymentMethod('');
        }
        
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

  useEffect(() => {
    const fetchShippingFee = async () => {
      if (!selectedAddress || !restaurantId) return;
      setShippingFeeError('');
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/orders/shipping-fee?id_Address=${selectedAddress}&id_Restaurant=${restaurantId}`,
          { headers }
        );
        setShippingFee(res.data.shippingFee);
        setDistance(res.data.distance);
      } catch (error) {
        console.error('Error fetching shipping fee', error);
        setShippingFee(0);
        setDistance(0);
        setShippingFeeError(error.response?.data?.message || 'Không thể tính phí vận chuyển cho địa chỉ này.');
      }
    };
    fetchShippingFee();
  }, [selectedAddress, restaurantId]);

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

  const handleItemNoteChange = (id_CartFood, newNote) => {
    setCart(prevCart => {
      if (!prevCart) return null;
      return {
        ...prevCart,
        items: prevCart.items.map(item => 
          item.id_CartFood === id_CartFood 
            ? { ...item, note: newNote } 
            : item
        )
      };
    });
  };

  const handleSaveItemNote = async (id_CartFood, noteText) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/cart/item/${id_CartFood}`, 
        { note: noteText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Lỗi khi lưu ghi chú món ăn:', error);
    }
  };

  const toggleNote = (id_CartFood, currentNote) => {
    setExpandedNotes(prev => {
      const nextVal = !prev[id_CartFood];
      if (!nextVal) {
        handleSaveItemNote(id_CartFood, currentNote);
      }
      return {
        ...prev,
        [id_CartFood]: nextVal
      };
    });
  };

  const handleCheckout = async () => {
    if (!selectedAddress) {
      alert('Vui lòng chọn địa chỉ giao hàng');
      return;
    }
    if (paymentMethod === 'wallet' && walletBalance < total) {
      alert('Số dư ví của bạn không đủ để thanh toán đơn hàng này. Vui lòng nạp thêm tiền vào ví!');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Bước 1: Đồng bộ lưu tất cả ghi chú món ăn từ state React xuống database trước khi đặt hàng
      if (cart && cart.items) {
        const updatePromises = cart.items.map(item => {
          return axios.put(`${import.meta.env.VITE_API_URL}/cart/item/${item.id_CartFood}`, 
            { note: item.note || null },
            { headers }
          );
        });
        await Promise.all(updatePromises);
      }

      // Bước 2: Tạo đơn hàng sau khi toàn bộ ghi chú đã được lưu chắc chắn xuống Database
      const payload = {
        id_Address: selectedAddress,
        id_Restaurant: restaurantId,
        payment_Method: paymentMethod,
        note,
        id_Promo_Freeship: selectedFreeshipVoucher || null,
        id_Promo_Discount: selectedDiscountVoucher || null
      };
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/orders`, payload, {
        headers
      });
      fetchCarts();
      
      if (res.data.paymentUrl) {
        // Chuyển hướng sang VNPAY
        window.location.href = res.data.paymentUrl;
      } else {
        navigate('/orders');
      }
    } catch (error) {
      alert('Lỗi đặt hàng: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!cart || cart.items.length === 0) return <div className="min-h-screen flex justify-center items-center text-slate-500">Giỏ hàng trống.</div>;

  const foodTotal = cart.items.reduce((sum, item) => sum + ((item.discount_Price || item.price) * item.quantity), 0);
  
  let freeshipDiscountAmount = 0;
  let promoDiscountAmount = 0;
  let freeshipCode = '';
  let promoCode = '';
  
  if (selectedFreeshipVoucher) {
    const v = vouchers.find(x => x.id === selectedFreeshipVoucher);
    if (v && foodTotal >= v.min_OrderValue) {
      freeshipDiscountAmount = Math.min(shippingFee, v.value || shippingFee);
      freeshipCode = v.code;
    }
  }
  
  if (selectedDiscountVoucher) {
    const v = vouchers.find(x => x.id === selectedDiscountVoucher);
    if (v && foodTotal >= v.min_OrderValue) {
      if (v.type === 'percent') {
        let disc = (foodTotal * v.value) / 100;
        if (v.max_Discount && disc > v.max_Discount) {
          disc = v.max_Discount;
        }
        promoDiscountAmount = disc;
      } else if (v.type === 'fixed') {
        promoDiscountAmount = v.value;
      }
      promoCode = v.code;
    }
  }
  
  const discount = freeshipDiscountAmount + promoDiscountAmount;
  const debt = walletBalance < 0 ? Math.abs(walletBalance) : 0;
  const total = Math.max(0, foodTotal + shippingFee - discount + debt);

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Thanh toán đơn hàng</h1>

        {debt > 0 && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm font-semibold flex items-start gap-3 shadow-sm animate-pulse">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-rose-700">Lưu ý về dư nợ bom hàng: </span>
              Bạn đang có dư nợ ví điện tử do bom hàng trước đó: <span className="text-rose-600 font-extrabold">{debt.toLocaleString('vi-VN')} đ</span>. 
              Vì vậy, hệ thống chỉ cho phép thanh toán trực tuyến và tự động cộng khoản nợ này vào tổng tiền thanh toán của đơn hàng hiện tại.
            </div>
          </div>
        )}

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
                  
                  {shippingFeeError && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                      {shippingFeeError}
                    </div>
                  )}
                  {!shippingFeeError && distance > 0 && (
                    <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-sm font-semibold">
                      Khoảng cách giao hàng dự kiến: <span className="font-bold text-orange-600">{distance} km</span>
                    </div>
                  )}
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
              
              {!paymentConfigs.pay_vnpay_enabled?.enabled && !paymentConfigs.pay_cod_enabled?.enabled && !paymentConfigs.pay_wallet_enabled?.enabled ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                  Không có phương thức thanh toán nào được kích hoạt từ quản trị viên.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentConfigs.pay_wallet_enabled?.enabled && (
                    <label className={`flex flex-col md:flex-row md:items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'wallet' ? 'border-orange-500 bg-orange-50/20 shadow-sm ring-1 ring-orange-500/20' : 'hover:border-slate-300 hover:bg-slate-50/30'}`}>
                      <div className="flex items-center gap-3">
                        <input type="radio" name="payment" value="wallet" checked={paymentMethod === 'wallet'} onChange={(e) => setPaymentMethod(e.target.value)} className="text-orange-500 focus:ring-orange-500 focus:border-orange-500" />
                        <Wallet className="w-6 h-6 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">Ví của tôi</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${walletBalance >= total ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            Số dư: {walletBalance.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                        <span className="block text-[10px] text-slate-400 font-medium">Trừ trực tiếp vào tài khoản ví của bạn</span>
                      </div>
                    </label>
                  )}
                  {paymentConfigs.pay_vnpay_enabled?.enabled && (
                    <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'vnpay' ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20' : 'hover:border-slate-300 hover:bg-slate-50/30'}`}>
                      <input type="radio" name="payment" value="vnpay" checked={paymentMethod === 'vnpay'} onChange={(e) => setPaymentMethod(e.target.value)} className="text-blue-500 focus:ring-blue-500 focus:border-blue-500" />
                      <CreditCard className="w-6 h-6 text-blue-500" />
                      <div>
                        <span className="block font-bold text-slate-800">Thanh toán qua cổng VNPAY</span>
                        <span className="block text-[10px] text-slate-400 font-medium">ATM nội địa, Thẻ quốc tế, QR Code</span>
                      </div>
                    </label>
                  )}
                  {paymentConfigs.pay_cod_enabled?.enabled && debt === 0 && (
                    <label className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all duration-200 ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50/50 shadow-sm ring-1 ring-green-500/20' : 'hover:border-slate-300 hover:bg-slate-50/30'}`}>
                      <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={(e) => setPaymentMethod(e.target.value)} className="text-green-500 focus:ring-green-500 focus:border-green-500" />
                      <Banknote className="w-6 h-6 text-green-500" />
                      <div>
                        <span className="block font-bold text-slate-800">Tiền mặt khi nhận hàng (COD)</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Thanh toán trực tiếp khi nhận món</span>
                      </div>
                    </label>
                  )}
                </div>
              )}
            </div>

          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h3 className="font-bold text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Tóm tắt đơn hàng</h3>
              
              <div className="mb-4 space-y-3">
                <div className="font-bold text-slate-800 pb-2 border-b border-slate-100">{cart.name_Restaurant}</div>
                {cart.items.map(item => (
                  <div key={item.id_CartFood} className="pb-3 border-b border-slate-50 last:border-b-0">
                    <div className="flex justify-between items-start text-sm text-slate-700 font-semibold mb-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                        <span className="text-slate-500 flex-shrink-0">{item.quantity}x</span>
                        <span className="truncate">{item.name}</span>
                        {/* Biểu tượng cây bút chỉnh sửa ghi chú */}
                        <button
                          onClick={() => toggleNote(item.id_CartFood, item.note || '')}
                          className="p-1 text-slate-400 hover:text-orange-500 rounded-md hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
                          title="Sửa ghi chú"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-slate-800 flex-shrink-0">
                        {((item.discount_Price || item.price) * item.quantity).toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    
                    {/* Hộp nhập ghi chú từng món */}
                    {expandedNotes[item.id_CartFood] && (
                      <div className="mt-2 animate-in slide-in-from-top-1 duration-150">
                        <input
                          type="text"
                          value={item.note || ''}
                          onChange={(e) => handleItemNoteChange(item.id_CartFood, e.target.value)}
                          onBlur={() => handleSaveItemNote(item.id_CartFood, item.note || '')}
                          placeholder="Ghi chú món (không hành, ít cay...)"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50/50 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:bg-white outline-none transition-all placeholder-slate-400 text-slate-700"
                        />
                      </div>
                    )}
                    
                    {/* Nhãn ghi chú nhỏ gọn khi thu hồi ô gõ */}
                    {!expandedNotes[item.id_CartFood] && item.note && (
                      <div className="text-[11px] text-slate-500 mt-1 font-medium bg-slate-50 px-2 py-0.5 rounded inline-block max-w-full truncate">
                        Ghi chú: {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 py-4 mb-4 space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1">
                    <Ticket className="w-4 h-4 text-orange-500" /> Voucher Vận chuyển (Freeship)
                  </h4>
                  <select 
                    value={selectedFreeshipVoucher} 
                    onChange={(e) => setSelectedFreeshipVoucher(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 text-sm bg-slate-50"
                  >
                    <option value="">Không sử dụng voucher freeship</option>
                    {vouchers.filter(v => v.type === 'freeship').map(v => {
                      const minOrderText = v.min_OrderValue > 0 
                        ? ` (Đơn tối thiểu ${Number(v.min_OrderValue).toLocaleString('vi-VN')}đ)` 
                        : '';
                      const isApplicable = foodTotal >= v.min_OrderValue;
                      return (
                        <option key={v.id} value={v.id} disabled={!isApplicable}>
                          {v.code} - Giảm phí vận chuyển{minOrderText} {!isApplicable ? '[Không đủ ĐK]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1">
                    <Ticket className="w-4 h-4 text-orange-500" /> Voucher Giảm giá (Phần trăm / Cố định)
                  </h4>
                  <select 
                    value={selectedDiscountVoucher} 
                    onChange={(e) => setSelectedDiscountVoucher(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 text-sm bg-slate-50"
                  >
                    <option value="">Không sử dụng voucher giảm giá</option>
                    {vouchers.filter(v => v.type === 'percent' || v.type === 'fixed').map(v => {
                      const discountText = v.type === 'percent' 
                        ? `Giảm ${v.value}%` 
                        : `Giảm ${Number(v.value).toLocaleString('vi-VN')}đ`;
                      const minOrderText = v.min_OrderValue > 0 
                        ? ` (Đơn tối thiểu ${Number(v.min_OrderValue).toLocaleString('vi-VN')}đ)` 
                        : '';
                      const isApplicable = foodTotal >= v.min_OrderValue;
                      return (
                        <option key={v.id} value={v.id} disabled={!isApplicable}>
                          {v.code} - {discountText}{minOrderText} {!isApplicable ? '[Không đủ ĐK]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
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
                {freeshipDiscountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Khuyến mãi ship ({freeshipCode})</span>
                    <span>-{freeshipDiscountAmount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                {promoDiscountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Khuyến mãi đơn ({promoCode})</span>
                    <span>-{promoDiscountAmount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                {debt > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold animate-pulse">
                    <span>Dư nợ bom hàng</span>
                    <span>+{debt.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-800">Tổng cộng</span>
                  <span className="text-2xl font-extrabold text-orange-500">{total.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={!selectedAddress || !!shippingFeeError || !paymentMethod}
                className="w-full mt-6 py-4 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
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

