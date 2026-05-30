import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Bell, Check, ShoppingBag, Gift, Truck, Info } from 'lucide-react';
import clsx from 'clsx';

const Notifications = () => {
  const { user, fetchUnreadCount } = useContext(AuthContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data);
        if (fetchUnreadCount) fetchUnreadCount();
      } catch (error) {
        console.error('Error fetching notifications', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [user]);

  const markAsRead = async (id_Noti) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/notifications/${id_Noti}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Cập nhật state
      setNotifications(notifications.map(n => n.id_Noti === id_Noti ? { ...n, is_Read: true } : n));
      if (fetchUnreadCount) fetchUnreadCount();
    } catch (error) {
      console.error('Error marking as read', error);
    }
  };

  const handleNotiClick = async (noti) => {
    if (!noti.is_Read) {
      await markAsRead(noti.id_Noti);
    }
    if (noti.related_OrderId) {
      navigate('/orders', { state: { expandOrderId: noti.related_OrderId } });
    }
  };

  const getNotiIcon = (type) => {
    switch(type) {
      case 'order': return <ShoppingBag className="w-5 h-5 text-blue-500" />;
      case 'delivery': return <Truck className="w-5 h-5 text-orange-500" />;
      case 'promo': return <Gift className="w-5 h-5 text-pink-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  const getNotiBg = (type) => {
    switch(type) {
      case 'order': return 'bg-blue-100';
      case 'delivery': return 'bg-orange-100';
      case 'promo': return 'bg-pink-100';
      default: return 'bg-slate-100';
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn chưa đăng nhập</h2>
        <p className="text-slate-500 mb-8">Vui lòng đăng nhập để xem thông báo.</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_Read).length;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900">Thông báo</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {unreadCount} mới
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Chưa có thông báo nào</h3>
            <p className="text-slate-500">Bạn sẽ nhận được thông báo khi có cập nhật về đơn hàng hoặc khuyến mãi.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {notifications.map(noti => (
              <div 
                key={noti.id_Noti} 
                className={clsx(
                  "p-6 transition-colors hover:bg-slate-50 cursor-pointer flex gap-4",
                  !noti.is_Read ? "bg-orange-50/30" : "bg-white"
                )}
                onClick={() => handleNotiClick(noti)}
              >
                <div className="flex-shrink-0">
                  <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center", getNotiBg(noti.type))}>
                    {getNotiIcon(noti.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={clsx("text-base truncate pr-4", !noti.is_Read ? "font-bold text-slate-900" : "font-medium text-slate-700")}>
                      {noti.title}
                    </h4>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(noti.created_At).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className={clsx("text-sm line-clamp-2", !noti.is_Read ? "text-slate-700 font-medium" : "text-slate-500")}>
                    {noti.body}
                  </p>
                </div>
                {!noti.is_Read && (
                  <div className="flex-shrink-0 flex items-center">
                    <div className="w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
