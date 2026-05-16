import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Package, Clock, CheckCircle, XCircle, ChevronRight, Truck } from 'lucide-react';

const Orders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn chưa đăng nhập</h2>
        <p className="text-slate-500 mb-8">Vui lòng đăng nhập để xem đơn hàng.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
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
              return (
                <div key={order.id_Order} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                          <img 
                            src={`https://source.unsplash.com/100x100/?restaurant,logo&sig=${order.id_Restaurant}`} 
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
                      
                      <button className="w-full sm:w-auto px-6 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1">
                        Chi tiết <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
