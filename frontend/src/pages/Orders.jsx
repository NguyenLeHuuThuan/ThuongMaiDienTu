import { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { Package, Clock, CheckCircle, XCircle, ChevronRight, ChevronDown, Truck, AlertTriangle, Star, X, MapPin, User, Phone, CreditCard, Receipt, FileText, MessageSquare } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';

const Orders = () => {
  const { user } = useContext(AuthContext);
  const { openChatWith } = useContext(ChatContext);
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedId, setExpandedId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  
  // Tab State
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending', label: 'Chờ xác nhận', statuses: ['pending'] },
    { id: 'processing', label: 'Đang xử lý', statuses: ['confirmed', 'preparing', 'ready', 'picking'] },
    { id: 'delivering', label: 'Đang giao', statuses: ['delivering'] },
    { id: 'delivered', label: 'Đã giao', statuses: ['delivered'] },
    { id: 'cancelled', label: 'Đã hủy', statuses: ['cancelled'] },
  ];

  // Modals
  const [reviewModal, setReviewModal] = useState({ show: false, orderId: null });
  const [complaintModal, setComplaintModal] = useState({ show: false, orderId: null });
  
  // Toast State
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };
  
  const fetchOrders = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (error) {
      console.error('Error fetching orders', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  useEffect(() => {
    if (location.state && location.state.expandOrderId && orders.length > 0) {
      const orderId = location.state.expandOrderId;
      const order = orders.find(o => o.id_Order === orderId);
      if (order) {
        setActiveTab('all');
        loadDetails(orderId);
        // Clear history state to prevent re-opening on manual page refresh
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, orders]);

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending': return { text: 'Chờ xác nhận', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: Clock };
      case 'confirmed': return { text: 'Đã xác nhận', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircle };
      case 'preparing': return { text: 'Đang chuẩn bị', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: Package };
      case 'delivering': return { text: 'Đang giao hàng', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: Truck };
      case 'delivered': return { text: 'Đã giao', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle };
      case 'cancelled': return { text: 'Đã huỷ', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle };
      default: return { text: status, color: 'text-slate-600 bg-slate-50 border-slate-200', icon: Clock };
    }
  };

  const loadDetails = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!orderDetails[id]) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrderDetails(prev => ({ ...prev, [id]: res.data }));
      } catch (error) {
        console.error('Error fetching order detail', error);
      }
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/orders/${id}/cancel`, { reason: 'Khách hàng đổi ý' }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchOrders();
      if (expandedId === id) setExpandedId(null);
      showToast('Đã hủy đơn hàng thành công');
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi hủy đơn');
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn chưa đăng nhập</h2>
        <p className="text-slate-500 mb-8">Vui lòng đăng nhập để xem đơn hàng.</p>
      </div>
    );
  }

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    const tab = tabs.find(t => t.id === activeTab);
    return tab?.statuses.includes(order.order_Status);
  });

  return (
    <div className="min-h-screen relative py-12 overflow-hidden bg-slate-50">
      {/* Food theme background watermark texture */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed pointer-events-none -z-20 opacity-[0.06] filter blur-[1px]"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1600&auto=format&fit=crop')` }}
      />
      {/* Decorative blurred backdrop glow elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-200/35 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-blue-100/25 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Đơn hàng của tôi</h1>
        
        {/* Tabs Bar */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 overflow-x-auto no-scrollbar scrollbar-none border border-slate-200">
          <div className="flex space-x-1 min-w-max w-full">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              const count = orders.filter(order => {
                if (tab.id === 'all') return true;
                return tab.statuses.includes(order.order_Status);
              }).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setExpandedId(null);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'bg-white text-orange-600 shadow-sm scale-[1.01]' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold transition-colors duration-300 ${
                      isActive ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm animate-in fade-in duration-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có đơn hàng</h3>
            <p className="text-slate-500">
              {activeTab === 'all' && 'Bạn chưa đặt đơn hàng nào trên hệ thống.'}
              {activeTab === 'pending' && 'Không có đơn hàng nào đang chờ xác nhận.'}
              {activeTab === 'processing' && 'Không có đơn hàng nào đang chuẩn bị.'}
              {activeTab === 'delivering' && 'Không có đơn hàng nào đang giao.'}
              {activeTab === 'delivered' && 'Không có đơn hàng nào đã giao.'}
              {activeTab === 'cancelled' && 'Không có đơn hàng nào đã bị hủy.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map(order => {
              const StatusIcon = getStatusInfo(order.order_Status).icon;
              const isExpanded = expandedId === order.id_Order;
              const details = orderDetails[order.id_Order];

              const getActiveStep = (status) => {
                switch (status) {
                  case 'pending': return 1;
                  case 'confirmed':
                  case 'preparing':
                  case 'ready':
                  case 'picking': return 2;
                  case 'delivering': return 3;
                  case 'delivered': return 4;
                  default: return 0;
                }
              };

              return (
                <div 
                  key={order.id_Order} 
                  className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group border-l-4 ${
                    order.order_Status === 'pending' ? 'border-l-orange-500' :
                    ['confirmed', 'preparing', 'ready', 'picking'].includes(order.order_Status) ? 'border-l-blue-500' :
                    order.order_Status === 'delivering' ? 'border-l-indigo-500' :
                    order.order_Status === 'delivered' ? 'border-l-emerald-500' :
                    'border-l-red-500'
                  }`}
                >
                  <div className="cursor-pointer" onClick={() => loadDetails(order.id_Order)}>
                    {/* Header with soft status gradient background */}
                    <div className={`p-6 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100/80 transition-colors ${
                      order.order_Status === 'pending' ? 'bg-gradient-to-r from-orange-50/40 via-orange-50/10 to-transparent' :
                      ['confirmed', 'preparing', 'ready', 'picking'].includes(order.order_Status) ? 'bg-gradient-to-r from-blue-50/40 via-blue-50/10 to-transparent' :
                      order.order_Status === 'delivering' ? 'bg-gradient-to-r from-indigo-50/40 via-indigo-50/10 to-transparent' :
                      order.order_Status === 'delivered' ? 'bg-gradient-to-r from-emerald-50/40 via-emerald-50/10 to-transparent' :
                      'bg-gradient-to-r from-red-50/40 via-red-50/10 to-transparent'
                    }`}>
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner ring-4 group-hover:scale-105 transition-transform duration-300 ${
                          order.order_Status === 'pending' ? 'ring-orange-100' :
                          ['confirmed', 'preparing', 'ready', 'picking'].includes(order.order_Status) ? 'ring-blue-100' :
                          order.order_Status === 'delivering' ? 'ring-indigo-100' :
                          order.order_Status === 'delivered' ? 'ring-emerald-100' :
                          'ring-red-100'
                        }`}>
                          <img 
                            src={getImageUrl(order.logo, 'logo')} 
                            alt={order.name_Restaurant}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${order.name_Restaurant}&background=random`;
                            }}
                          />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-orange-500 transition-colors">{order.name_Restaurant}</h3>
                          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1 mt-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(order.created_At).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                      
                      <div className={`px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-300 ${getStatusInfo(order.order_Status).color}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${
                          ['pending', 'preparing', 'delivering'].includes(order.order_Status) ? 'animate-pulse' : ''
                        }`} />
                        {getStatusInfo(order.order_Status).text}
                      </div>
                    </div>
                    
                    {/* Body */}
                    <div className="p-6 pt-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mã đơn hàng</p>
                          <p className="text-sm font-semibold text-slate-700 mb-2">{order.order_Code}</p>
                          <p className="text-sm text-slate-500 flex items-center flex-wrap gap-1 mt-1">
                            Tổng thanh toán: 
                            <span className="font-black text-orange-600 bg-orange-50/70 border border-orange-100 px-2.5 py-0.5 rounded-lg text-base shadow-sm">
                              {(order.total_Amount).toLocaleString('vi-VN')} đ
                            </span>
                          </p>
                        </div>
                        
                        <div className="w-full sm:w-auto flex flex-wrap gap-2 items-center justify-end">
                          {order.order_Status === 'pending' && (
                            <button onClick={(e) => { e.stopPropagation(); handleCancel(order.id_Order); }} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 hover:shadow-sm transition cursor-pointer text-sm border border-red-100">Hủy đơn</button>
                          )}
                          {order.order_Status === 'delivered' && (
                            <>
                              {order.is_Reviewed === 1 ? (
                                <button disabled className="px-4 py-2 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed text-sm">Đã đánh giá</button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setReviewModal({show: true, orderId: order.id_Order}); }} className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 hover:shadow-sm transition cursor-pointer text-sm border border-blue-100">Đánh giá</button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); setComplaintModal({show: true, orderId: order.id_Order}); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer text-sm">Khiếu nại</button>
                            </>
                          )}
                          <button className="p-2 bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white rounded-xl transition duration-300 cursor-pointer border border-orange-100 flex items-center justify-center">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                  {isExpanded && details && (
                    <div className="bg-gradient-to-b from-slate-50 to-white p-6 border-t border-slate-100 text-sm animate-in slide-in-from-top-3 duration-300">
                      
                      {/* Step Progress Bar (Only show if not cancelled) */}
                      {order.order_Status !== 'cancelled' ? (
                        <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="relative flex justify-between items-center max-w-lg mx-auto">
                            
                            {/* Connecting Progress Line */}
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-0 rounded-full">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500 rounded-full"
                                style={{ width: `${((getActiveStep(order.order_Status) - 1) / 3) * 100}%` }}
                              ></div>
                            </div>

                            {/* Steps */}
                            {[
                              { label: 'Chờ duyệt', icon: Clock, step: 1 },
                              { label: 'Chuẩn bị', icon: Package, step: 2 },
                              { label: 'Đang giao', icon: Truck, step: 3 },
                              { label: 'Đã nhận', icon: CheckCircle, step: 4 },
                            ].map((s) => {
                              const StepIcon = s.icon;
                              const isCompleted = getActiveStep(order.order_Status) >= s.step;
                              const isActive = getActiveStep(order.order_Status) === s.step;
                              return (
                                <div key={s.step} className="flex flex-col items-center relative z-10">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow ${
                                    isCompleted 
                                      ? 'bg-orange-500 text-white ring-4 ring-orange-100' 
                                      : 'bg-white text-slate-400 border-2 border-slate-200'
                                  } ${isActive ? 'scale-110 animate-bounce' : ''}`}>
                                    <StepIcon className="w-4 h-4" />
                                  </div>
                                  <span className={`text-[10px] font-bold mt-2 transition-colors ${
                                    isCompleted ? 'text-slate-800' : 'text-slate-400'
                                  }`}>{s.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700 animate-in fade-in duration-300">
                          <XCircle className="w-5 h-5 text-red-500 animate-pulse" />
                          <div>
                            <p className="font-bold text-sm">Đơn hàng đã bị hủy</p>
                            <p className="text-xs text-red-500 mt-0.5">Đơn hàng này không thể tiếp tục thực hiện hoặc đã được hủy thành công.</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Shipping Info Card */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-2 border-b pb-2 border-slate-50">
                              <Truck className="w-4 h-4 text-orange-500" />
                              Thông tin giao hàng
                            </h4>
                            <div className="space-y-3 text-slate-600">
                              <div className="flex items-start gap-2.5">
                                <User className="w-4 h-4 text-slate-400 mt-0.5" />
                                <p><span className="font-semibold text-slate-700">Người nhận:</span> {details.user_name}</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                                <p><span className="font-semibold text-slate-700">Số điện thoại:</span> {details.user_phone}</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                <p><span className="font-semibold text-slate-700">Địa chỉ:</span> {details.user_address}</p>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                                <p><span className="font-semibold text-slate-700">Ghi chú:</span> {details.note || 'Không có ghi chú'}</p>
                              </div>
                              {details.res_owner_id && (
                                <div className="flex items-center gap-2.5 bg-orange-50/70 p-2.5 rounded-xl border border-orange-100/50 mt-4 shadow-sm">
                                  <MessageSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                  <div className="flex-grow min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cửa hàng</p>
                                    <p className="text-xs font-semibold text-slate-700 truncate">{order.name_Restaurant}</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openChatWith({
                                        id: details.res_owner_id,
                                        fullName: order.name_Restaurant,
                                        avatar: order.logo,
                                        role: 'restaurant_owner'
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition duration-200 cursor-pointer shadow-sm hover:shadow"
                                  >
                                    Chat
                                  </button>
                                </div>
                              )}
                              {details.driver_name && (
                                <div className="flex items-center gap-2.5 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100/50 mt-3 shadow-sm">
                                  <Truck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                  <div className="flex-grow min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tài xế giao hàng</p>
                                    <p className="text-xs font-semibold text-slate-700 truncate">{details.driver_name}</p>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openChatWith({
                                        id: details.driver_user_id,
                                        fullName: details.driver_name,
                                        role: 'driver'
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-650 text-white rounded-lg text-xs font-bold transition duration-200 cursor-pointer shadow-sm hover:shadow"
                                  >
                                    Chat
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-semibold text-slate-500 bg-slate-50/50 p-2.5 rounded-xl">
                            <span className="flex items-center gap-1.5">
                              <CreditCard className="w-4 h-4 text-slate-400" />
                              Thanh toán: {details.payment_Method === 'online' ? 'Online' : 'Tiền mặt'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              details.payment_Status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                            }`}>{details.payment_Status === 'paid' ? 'Đã trả' : 'Chưa trả'}</span>
                          </div>
                        </div>

                        {/* Order Items Card */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-2 border-b pb-2 border-slate-50">
                              <Receipt className="w-4 h-4 text-orange-500" />
                              Chi tiết món ăn
                            </h4>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                              {details.items?.map(item => (
                                <div key={item.id_OrderFood} className="flex gap-3 items-center border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                  <div className="w-10 h-10 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                                    <img 
                                      src={getImageUrl(item.image, 'food')} 
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://ui-avatars.com/api/?name=${item.name}&background=random`;
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-700 truncate text-sm">{item.name}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">Số lượng: {item.quantity} x {item.unit_Price.toLocaleString()} đ</div>
                                    {item.note && <div className="text-[10px] text-orange-600 bg-orange-50/50 px-1.5 py-0.5 rounded w-fit mt-1">Ghi chú: {item.note}</div>}
                                  </div>
                                  <div className="font-bold text-slate-800 text-sm flex-shrink-0">
                                    {(item.unit_Price * item.quantity).toLocaleString()} đ
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                            <div className="flex justify-between"><span>Tạm tính:</span><span className="font-medium text-slate-700">{details.food_Amount?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between"><span>Phí ship:</span><span className="font-medium text-slate-700">{details.shipping_Fee?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between text-emerald-600"><span>Giảm giá:</span><span className="font-medium">-{details.discount_Amount?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between font-extrabold text-orange-600 text-sm pt-2 border-t border-slate-100">
                              <span>Tổng cộng:</span>
                              <span className="text-base">{details.total_Amount?.toLocaleString()} đ</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal.show && (
        <ReviewModal 
          orderId={reviewModal.orderId} 
          onClose={() => setReviewModal({show: false, orderId: null})} 
          onSuccess={(msg) => {
            setReviewModal({show: false, orderId: null});
            showToast(msg);
            fetchOrders();
          }}
        />
      )}

      {/* Complaint Modal */}
      {complaintModal.show && (
        <ComplaintModal 
          orderId={complaintModal.orderId} 
          onClose={() => setComplaintModal({show: false, orderId: null})} 
          onSuccess={(msg) => {
            setComplaintModal({show: false, orderId: null});
            showToast(msg);
          }}
        />
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-55 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

const ReviewModal = ({ orderId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);

  // Form State
  const [ratingRes, setRatingRes] = useState(5);
  const [commentRes, setCommentRes] = useState('');

  const [ratingDri, setRatingDri] = useState(5);
  const [commentDri, setCommentDri] = useState('');

  // foodRatings: { [id_Food]: { rating: 5, comment: '' } }
  const [foodRatings, setFoodRatings] = useState({});

  useEffect(() => {
    const fetchOrderDetail = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrder(res.data);
        
        // Initialize food ratings
        const initialRatings = {};
        if (res.data.items) {
          res.data.items.forEach(item => {
            initialRatings[item.id_Food] = { rating: 5, comment: '' };
          });
        }
        setFoodRatings(initialRatings);
      } catch (error) {
        console.error('Error fetching order detail for review', error);
      } finally {
        setLoading(false);
      }
    };
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);

  const submit = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Convert foodRatings map to backend structure
      const foods = Object.keys(foodRatings).map(foodId => ({
        id_Food: parseInt(foodId, 10),
        rating_Food: foodRatings[foodId].rating,
        comment_Food: foodRatings[foodId].comment || null
      }));

      await axios.post(`${import.meta.env.VITE_API_URL}/orders/${orderId}/review`, {
        rating_Res: ratingRes,
        comment_ForRes: commentRes || null,
        rating_Dri: ratingDri,
        comment_ForDri: commentDri || null,
        foods: foods
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess('Đánh giá thành công! Cảm ơn ý kiến đóng góp của bạn.');
    } catch (e) {
      const errMsg = e.response?.data?.message || 'Lỗi đánh giá';
      alert(errMsg);
      if (errMsg.includes('đã được đánh giá') || errMsg.includes('đã đánh giá')) {
        onClose();
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-slate-500 font-medium">Đang tải thông tin đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md text-center">
          <p className="text-red-500 font-medium mb-4">Không tìm thấy thông tin đơn hàng để đánh giá.</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl">Đóng</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-xl text-slate-800">Đánh giá dịch vụ</h3>
            <p className="text-xs text-slate-500 mt-1">Đơn hàng: #{order.order_Code} - {order.name_Restaurant}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          
          {/* Part 1: Nhà hàng */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold">NH</div>
              <div>
                <h4 className="font-bold text-slate-850">Đánh giá nhà hàng</h4>
                <p className="text-xs text-slate-500">Chất lượng đồ ăn & phục vụ của {order.name_Restaurant}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button 
                  key={v} 
                  type="button"
                  onClick={() => setRatingRes(v)} 
                  className="transition transform active:scale-95 cursor-pointer"
                >
                  <Star className={`w-8 h-8 ${v <= ratingRes ? 'text-orange-400 fill-orange-400' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>

            <textarea 
              rows="3" 
              value={commentRes} 
              onChange={e => setCommentRes(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-orange-500 focus:outline-none transition bg-white" 
              placeholder="Đồ ăn nóng hổi ngon miệng, đóng gói sạch sẽ..."
            />
          </div>

          {/* Part 2: Tài xế */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">TX</div>
              <div>
                <h4 className="font-bold text-slate-850">Đánh giá tài xế</h4>
                <p className="text-xs text-slate-500">Tốc độ giao hàng & thái độ của shipper</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button 
                  key={v} 
                  type="button"
                  onClick={() => setRatingDri(v)} 
                  className="transition transform active:scale-95 cursor-pointer"
                >
                  <Star className={`w-8 h-8 ${v <= ratingDri ? 'text-orange-400 fill-orange-400' : 'text-slate-200'}`} />
                </button>
              ))}
            </div>

            <textarea 
              rows="3" 
              value={commentDri} 
              onChange={e => setCommentDri(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:border-orange-500 focus:outline-none transition bg-white" 
              placeholder="Tài xế thân thiện, giao hàng rất nhanh..."
            />
          </div>

          {/* Part 3: Từng món ăn */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 px-1">Đánh giá từng món ăn</h4>
              <div className="space-y-4">
                {order.items.map(item => {
                  const ratingInfo = foodRatings[item.id_Food] || { rating: 5, comment: '' };
                  
                  return (
                    <div key={item.id_OrderFood} className="p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          <img 
                            src={getImageUrl(item.image, 'food')} 
                            alt={item.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://ui-avatars.com/api/?name=${item.name}&background=random`;
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                          <div className="text-xs text-slate-500">Số lượng: {item.quantity}</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full md:w-auto">
                        {/* Stars */}
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                setFoodRatings(prev => ({
                                  ...prev,
                                  [item.id_Food]: { ...ratingInfo, rating: v }
                                }));
                              }}
                              className="transition transform active:scale-95 cursor-pointer"
                            >
                              <Star className={`w-6 h-6 ${v <= ratingInfo.rating ? 'text-orange-400 fill-orange-400' : 'text-slate-200'}`} />
                            </button>
                          ))}
                        </div>
                        {/* Comment input for Food */}
                        <input
                          type="text"
                          value={ratingInfo.comment}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFoodRatings(prev => ({
                              ...prev,
                              [item.id_Food]: { ...ratingInfo, comment: val }
                            }));
                          }}
                          className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:border-orange-500 focus:outline-none w-full md:w-64"
                          placeholder="Ý kiến về món ăn này (không bắt buộc)..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex gap-3 justify-end bg-slate-50/50">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 font-bold rounded-xl text-slate-600 transition cursor-pointer text-sm"
          >
            Hủy bỏ
          </button>
          <button 
            type="button" 
            onClick={submit} 
            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-sm"
          >
            Gửi đánh giá
          </button>
        </div>

      </div>
    </div>
  );
};

const ComplaintModal = ({ orderId, onClose, onSuccess }) => {
  const [type, setType] = useState('food_quality');
  const [desc, setDesc] = useState('');

  const submit = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/orders/${orderId}/complaint`, {
        type, description: desc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess('Gửi khiếu nại thành công');
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi gửi khiếu nại');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-50">
          <h3 className="font-extrabold text-xl text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" /> 
            Khiếu nại đơn hàng
          </h3>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loại vấn đề</label>
            <select 
              value={type} 
              onChange={e => setType(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:border-red-500 focus:outline-none font-medium text-slate-800 text-sm transition"
            >
              <option value="food_quality">Chất lượng món ăn</option>
              <option value="wrong_item">Giao sai món</option>
              <option value="late_delivery">Giao hàng quá trễ</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mô tả chi tiết</label>
            <textarea 
              rows="4" 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              className="w-full border border-slate-200 rounded-xl p-3 focus:border-red-500 focus:outline-none text-sm transition" 
              placeholder="Vui lòng mô tả vấn đề bạn gặp phải..."
            ></textarea>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-55">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 font-bold rounded-xl text-slate-500 transition cursor-pointer text-sm"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={submit} 
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition cursor-pointer text-sm shadow-sm hover:shadow-md"
          >
            Gửi khiếu nại
          </button>
        </div>
      </div>
    </div>
  );
};

export default Orders;
