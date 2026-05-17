import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Package, Clock, CheckCircle, XCircle, ChevronRight, ChevronDown, Truck, AlertTriangle, Star, X } from 'lucide-react';

const Orders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [expandedId, setExpandedId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  
  // Modals
  const [reviewModal, setReviewModal] = useState({ show: false, orderId: null });
  const [complaintModal, setComplaintModal] = useState({ show: false, orderId: null });
  
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

  return (
    <div className="min-h-screen bg-slate-50 py-8 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Lịch sử đơn hàng</h1>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có đơn hàng nào</h3>
            <p className="text-slate-500">Bạn chưa đặt đơn hàng nào trên hệ thống.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => {
              const StatusIcon = getStatusInfo(order.order_Status).icon;
              const isExpanded = expandedId === order.id_Order;
              const details = orderDetails[order.id_Order];

              return (
                <div key={order.id_Order} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                  <div className="p-6 cursor-pointer hover:bg-slate-50" onClick={() => loadDetails(order.id_Order)}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                          <img 
                            src={order.logo ? `${import.meta.env.VITE_SERVER_URL}/${order.logo}` : `https://ui-avatars.com/api/?name=${order.name_Restaurant}&background=random`} 
                            alt={order.name_Restaurant}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800">{order.name_Restaurant}</h3>
                          <p className="text-sm text-slate-500">{new Date(order.created_At).toLocaleString('vi-VN')}</p>
                        </div>
                      </div>
                      
                      <div className={`px-4 py-1.5 rounded-full border text-sm font-medium flex items-center gap-1.5 ${getStatusInfo(order.order_Status).color}`}>
                        <StatusIcon className="w-4 h-4" />
                        {getStatusInfo(order.order_Status).text}
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <p className="text-sm text-slate-500 mb-1">Mã đơn: <span className="font-medium text-slate-700">{order.order_Code}</span></p>
                        <p className="text-sm text-slate-500">Tổng tiền: <span className="font-bold text-orange-500 text-lg">{(order.total_Amount).toLocaleString('vi-VN')} đ</span></p>
                      </div>
                      
                      <div className="w-full sm:w-auto flex flex-wrap gap-2">
                        {order.order_Status === 'pending' && (
                          <button onClick={(e) => { e.stopPropagation(); handleCancel(order.id_Order); }} className="px-4 py-2 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition">Hủy đơn</button>
                        )}
                        {order.order_Status === 'delivered' && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setReviewModal({show: true, orderId: order.id_Order}); }} className="px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition">Đánh giá</button>
                            <button onClick={(e) => { e.stopPropagation(); setComplaintModal({show: true, orderId: order.id_Order}); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-medium rounded-xl hover:bg-slate-200 transition">Khiếu nại</button>
                          </>
                        )}
                        <button className="px-4 py-2 bg-orange-50 text-orange-600 font-medium rounded-xl transition flex items-center gap-1">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && details && (
                    <div className="bg-slate-50 p-6 border-t border-slate-100 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-bold text-slate-800 mb-2">Thông tin giao hàng</h4>
                          <p className="text-slate-600"><span className="font-medium">Người nhận:</span> {details.user_name} ({details.user_phone})</p>
                          <p className="text-slate-600"><span className="font-medium">Địa chỉ:</span> {details.user_address}</p>
                          <p className="text-slate-600 mt-2"><span className="font-medium">Ghi chú:</span> {details.note || 'Không'}</p>
                          <p className="text-slate-600 mt-2"><span className="font-medium">Thanh toán:</span> {details.payment_Method === 'online' ? 'Online' : 'Tiền mặt'} - <span className={details.payment_Status === 'paid' ? 'text-green-600 font-bold' : 'text-orange-600 font-bold'}>{details.payment_Status}</span></p>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 mb-2">Chi tiết món</h4>
                          <div className="space-y-2">
                            {details.items?.map(item => (
                              <div key={item.id_OrderFood} className="flex justify-between items-start border-b border-slate-200 pb-2">
                                <div>
                                  <div className="font-medium text-slate-700">{item.quantity}x {item.name}</div>
                                  {item.note && <div className="text-xs text-slate-500">Ghi chú: {item.note}</div>}
                                </div>
                                <div className="font-medium text-slate-800">{(item.unit_Price * item.quantity).toLocaleString()} đ</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 space-y-1 text-slate-600">
                            <div className="flex justify-between"><span>Tạm tính:</span><span>{details.food_Amount?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between"><span>Phí ship:</span><span>{details.shipping_Fee?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between text-green-600"><span>Giảm giá:</span><span>-{details.discount_Amount?.toLocaleString()} đ</span></div>
                            <div className="flex justify-between font-bold text-orange-600 text-base pt-2 border-t"><span>Tổng:</span><span>{details.total_Amount?.toLocaleString()} đ</span></div>
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
        />
      )}

      {/* Complaint Modal */}
      {complaintModal.show && (
        <ComplaintModal 
          orderId={complaintModal.orderId} 
          onClose={() => setComplaintModal({show: false, orderId: null})} 
        />
      )}
    </div>
  );
};

const ReviewModal = ({ orderId, onClose }) => {
  const [ratingRes, setRatingRes] = useState(5);
  const [commentRes, setCommentRes] = useState('');

  const submit = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/orders/${orderId}/review`, {
        rating_Res: ratingRes,
        comment_ForRes: commentRes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Đánh giá thành công');
      onClose();
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi đánh giá');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl text-slate-800">Đánh giá nhà hàng</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Chất lượng nhà hàng (1-5 sao)</label>
          <div className="flex gap-2 text-orange-400 mb-4">
            {[1,2,3,4,5].map(v => (
              <Star key={v} onClick={() => setRatingRes(v)} className={`w-8 h-8 cursor-pointer ${v <= ratingRes ? 'fill-current' : 'text-slate-200'}`} />
            ))}
          </div>
          <label className="block text-sm font-medium mb-2">Nhận xét</label>
          <textarea rows="3" value={commentRes} onChange={e => setCommentRes(e.target.value)} className="w-full border rounded-lg p-2" placeholder="Nhà hàng phục vụ rất tốt..."></textarea>
        </div>
        <button onClick={submit} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600">Gửi đánh giá</button>
      </div>
    </div>
  );
};

const ComplaintModal = ({ orderId, onClose }) => {
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
      alert('Gửi khiếu nại thành công');
      onClose();
    } catch (e) {
      alert(e.response?.data?.message || 'Lỗi gửi khiếu nại');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-xl text-slate-800 text-red-600 flex items-center gap-2"><AlertTriangle /> Khiếu nại</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Loại vấn đề</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-lg p-2 mb-4 bg-slate-50">
            <option value="food_quality">Chất lượng món ăn</option>
            <option value="wrong_item">Giao sai món</option>
            <option value="late_delivery">Giao hàng quá trễ</option>
            <option value="other">Khác</option>
          </select>
          <label className="block text-sm font-medium mb-2">Mô tả chi tiết</label>
          <textarea rows="3" value={desc} onChange={e => setDesc(e.target.value)} className="w-full border rounded-lg p-2" placeholder="Vui lòng mô tả vấn đề bạn gặp phải..."></textarea>
        </div>
        <button onClick={submit} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700">Gửi khiếu nại</button>
      </div>
    </div>
  );
};

export default Orders;
