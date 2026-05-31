import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import { Clock, MapPin, CreditCard, Phone, ChefHat, Truck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { getImageUrl } from '../../utils/imageHelper';

const API = import.meta.env.VITE_API_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const RestaurantOrders = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [processingId, setProcessingId] = useState(null);
  const [todayStats, setTodayStats] = useState({ todayRevenue: 0, todayOrders: 0 });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchOrders = async (status, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await axios.get(`${API}/restaurant/orders?status=${status}`, { headers });
      setOrders(res.data);
    } catch (err) {
      console.error('Lỗi tải đơn hàng:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/restaurant/analytics`, { headers });
      setTodayStats(res.data.today);
    } catch (err) {
      console.error('Lỗi tải thống kê:', err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchOrders(activeTab);
    fetchStats();

    // Polling every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchOrders(activeTab, true);
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const handleAccept = async (orderId) => {
    try {
      await axios.put(`${API}/restaurant/orders/${orderId}/accept`, {}, { headers });
      fetchOrders(activeTab);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi chấp nhận đơn');
    }
  };

  const handleReject = async (orderId) => {
    const reason = prompt('Lý do từ chối:');
    if (reason === null) return;
    try {
      await axios.put(`${API}/restaurant/orders/${orderId}/reject`, { reason }, { headers });
      fetchOrders(activeTab);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi từ chối đơn');
    }
  };

  const handleComplete = async (orderId) => {
    if (processingId === orderId) return;
    try {
      setProcessingId(orderId);
      await axios.put(`${API}/restaurant/orders/${orderId}/complete`, {}, { headers });
      fetchOrders(activeTab);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi hoàn thành đơn');
    } finally {
      setProcessingId(null);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Vừa xong';
    if (diff < 60) return `${diff} phút trước`;
    if (diff < 1440) return `${Math.floor(diff / 60)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  const getStatusBadge = (status) => {
    const map = {
      pending: { class: 'res-badge-new', label: 'Đơn mới' },
      confirmed: { class: 'res-badge-confirmed', label: 'Đã xác nhận' },
      preparing: { class: 'res-badge-preparing', label: 'Đang chuẩn bị' },
      ready: { class: 'res-badge-ready', label: 'Sẵn sàng' },
      picking: { class: 'res-badge-delivering', label: 'Đang lấy hàng' },
      delivering: { class: 'res-badge-delivering', label: 'Đang giao' },
      delivered: { class: 'res-badge-delivered', label: 'Đã giao' },
      cancelled: { class: 'res-badge-cancelled', label: 'Đã hủy' },
    };
    const info = map[status] || { class: '', label: status };
    return <span className={`res-badge ${info.class}`}>{info.label}</span>;
  };

  const getPaymentLabel = (method) => {
    if (method === 'online') return 'Thanh toán Online';
    return 'Tiền mặt';
  };

  const tabs = [
    { key: 'new', label: 'Đơn mới', count: null },
    { key: 'processing', label: 'Đang xử lý', count: null },
    { key: 'completed', label: 'Đã hoàn thành', count: null },
  ];

  // Mock drivers
  const mockDrivers = [
    { name: 'Lê Minh T.', status: 'Cách nhà hàng 500m', order: '#089' },
    { name: 'Hoàng Mỹ D.', status: 'Đang đợi (3p)', order: '#092' },
  ];

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <h1>Quản lý đơn hàng</h1>
          <p>Theo dõi và xử lý các đơn đặt món theo thời gian thực.</p>
        </div>

        {/* Tabs */}
        <div className="res-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`res-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {activeTab === tab.key && orders.length > 0 && (
                <span style={{ marginLeft: 4 }}>({orders.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="res-loading">
            <div className="res-spinner"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="res-empty">
            <div className="res-empty-icon">📋</div>
            <div className="res-empty-text">Không có đơn hàng nào</div>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id_Order} className="res-order-card">
              {/* Order Header */}
              <div className="res-order-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="res-order-id">#{order.order_Code?.slice(-3) || order.id_Order}</span>
                  <span className="res-order-customer">{order.customerName}</span>
                </div>
                {getStatusBadge(order.order_Status)}
              </div>

              {/* Meta */}
              <div className="res-order-meta" style={{ marginBottom: 12 }}>
                <Clock size={14} />
                <span>{formatTime(order.created_At)}</span>
                <span>•</span>
                <CreditCard size={14} />
                <span>{getPaymentLabel(order.payment_Method)}</span>
              </div>

              {/* Items */}
              <div className="res-order-items">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="res-order-item">
                    <div style={{
                      width: 48, height: 48, borderRadius: 10, 
                      background: '#f5f5f5', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', fontSize: 20, flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {item.image ? (
                        <img 
                          src={getImageUrl(item.image, 'food')} 
                          alt={item.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop';
                          }}
                        />
                      ) : (
                        '🍽️'
                      )}
                    </div>
                    <div>
                      <div className="res-order-item-name">
                        {item.name} x{item.quantity}
                      </div>
                      <div className="res-order-item-desc">Ghi chú: {item.note || 'không có'}</div>
                    </div>
                    <div className="res-order-item-price">
                      {formatPrice(item.unit_Price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="res-order-footer">
                <div className="res-order-total">
                  <span>Tổng cộng</span><br />
                  {formatPrice(order.total_Amount)}
                </div>
                <div className="res-order-actions">
                  {order.order_Status === 'pending' && (
                    <>
                      <button className="res-btn res-btn-secondary" onClick={() => handleReject(order.id_Order)}>
                        Từ chối
                      </button>
                      <button className="res-btn res-btn-primary" onClick={() => handleAccept(order.id_Order)}>
                        Chấp nhận đơn
                      </button>
                    </>
                  )}
                  {(order.order_Status === 'confirmed' || order.order_Status === 'preparing' || order.order_Status === 'picking') && (
                    <button 
                      className="res-btn res-btn-dark" 
                      disabled={processingId === order.id_Order}
                      style={{ opacity: processingId === order.id_Order ? 0.7 : 1 }}
                      onClick={() => handleComplete(order.id_Order)}
                    >
                      {processingId === order.id_Order ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>⏳ Đang xử lý...</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={16} />
                          {order.order_Status === 'picking' ? 'Báo món đã xong' : 'Hoàn thành & Gọi tài xế'}
                        </span>
                      )}
                    </button>
                  )}
                  {order.order_Status === 'delivered' && (
                    <span style={{ color: '#2e7d32', fontWeight: 600, fontSize: 14 }}>
                      ✓ Đã giao thành công
                    </span>
                  )}
                  {order.order_Status === 'ready' && (
                    <span style={{ color: '#e65100', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} /> Đã báo món xong
                    </span>
                  )}
                  {(order.order_Status === 'ready' || order.order_Status === 'picking' || order.order_Status === 'delivering') && (
                    <button 
                      className="res-btn res-btn-secondary" 
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => {
                        const query = encodeURIComponent(order.deliveryAddress || 'Đà Nẵng');
                        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                      }}
                    >
                      <MapPin size={14} />
                      Theo dõi tài xế
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Right Sidebar */}
      <aside className="res-right-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tổng quan hôm nay</h3>
        </div>

        {/* Revenue */}
        <div className="res-card" style={{ background: '#f4f9f4', borderColor: '#c8e6c9' }}>
          <div className="res-card-title" style={{ color: '#2e7d32' }}>Doanh thu (Thực nhận)</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#2e7d32' }}>
            {formatPrice(todayStats.todayNetRevenue !== undefined ? todayStats.todayNetRevenue : (todayStats.todayRevenue || 0))}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            Gốc: {formatPrice(todayStats.originalTodayRevenue || 0)} (-{formatPrice(todayStats.todayServiceFee || 0)})
          </div>
        </div>

        {/* Order count */}
        <div className="res-card">
          <div className="res-card-title">Đơn hàng</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#1a1a1a' }}>
            {todayStats.todayOrders || 0}
          </div>
          <div className="res-progress">
            <div
              className="res-progress-fill orange"
              style={{ width: `${Math.min((todayStats.todayOrders / 60) * 100, 100)}%` }}
            ></div>
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Mục tiêu: 60 đơn</div>
        </div>

        {/* Drivers */}
        <div style={{ marginTop: 16 }}>
          <div className="res-card-title">Tài xế đang đến</div>
          {mockDrivers.map((d, i) => (
            <div key={i} className="res-driver-card">
              <div className="res-driver-avatar">{d.name.charAt(0)}</div>
              <div className="res-driver-info">
                <div className="res-driver-name">{d.name}</div>
                <div className="res-driver-status">{d.status}</div>
              </div>
              <div className="res-driver-order">{d.order}</div>
            </div>
          ))}
        </div>

        {/* Map placeholder */}
        <div 
          className="res-map-placeholder" 
          style={{ marginTop: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          onClick={() => window.open('https://www.google.com/maps', '_blank')}
        >
          <div style={{ position: 'relative', zIndex: 1, fontSize: 13, fontWeight: 600 }}>
            🗺️ Bản đồ vận chuyển
          </div>
          <div style={{ position: 'relative', zIndex: 1, fontSize: 11, color: '#f5f5f5' }}>
            Nhấn để mở Google Maps
          </div>
        </div>
      </aside>
    </>
  );
};

export default RestaurantOrders;
