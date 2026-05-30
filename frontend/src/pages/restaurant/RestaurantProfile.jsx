import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Clock, Save, Store } from 'lucide-react';
import { getImageUrl } from '../../utils/imageHelper';

const API = import.meta.env.VITE_API_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const RestaurantProfile = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name_Restaurant: '',
    description: '',
    address: '',
    openTime: '',
    closeTime: '',
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRestaurant = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/restaurant/info`, { headers });
      setRestaurant(res.data);
      setFormData({
        name_Restaurant: res.data.name_Restaurant || '',
        description: res.data.description || '',
        address: res.data.address || '',
        openTime: res.data.openTime ? res.data.openTime.slice(0, 5) : '08:00',
        closeTime: res.data.closeTime ? res.data.closeTime.slice(0, 5) : '22:00',
      });
    } catch (err) {
      console.error('Lỗi tải thông tin nhà hàng:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurant();
  }, []);

  const [conversations, setConversations] = useState([]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/restaurant/chat/conversations`, { headers });
      setConversations(res.data);
    } catch (err) {
      console.error('Lỗi tải cuộc hội thoại:', err);
    }
  };

  useEffect(() => {
    fetchRestaurant();
    fetchConversations();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/restaurant/info`, formData, { headers });
      alert('Cập nhật thông tin thành công!');
      fetchRestaurant();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  // Mock chat data
  const mockChats = [
    { name: 'Minh Anh', time: '2 phút trước', text: 'Chào shop, đơn hàng #2940 có thể...', initials: 'MA' },
    { name: 'Hoàng Long', time: '15 phút trước', text: 'Cảm ơn bạn, món ăn rất tuyệt!', initials: 'HL' },
  ];

  if (loading) {
    return (
      <div className="res-content">
        <div className="res-loading"><div className="res-spinner"></div></div>
      </div>
    );
  }

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <h1>Hồ sơ nhà hàng</h1>
          <p>Cập nhật thông tin chi tiết để thu hút nhiều thực khách hơn.</p>
        </div>

        {/* Basic Info */}
        <div className="res-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Store size={20} color="#c4501a" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Thông tin cơ bản</h3>
          </div>

          <div className="res-form-group">
            <label className="res-form-label">Tên nhà hàng</label>
            <input
              className="res-form-input"
              value={formData.name_Restaurant}
              onChange={(e) => setFormData({ ...formData, name_Restaurant: e.target.value })}
              placeholder="Tên nhà hàng của bạn"
            />
          </div>

          <div className="res-form-group">
            <label className="res-form-label">Giới thiệu ngắn</label>
            <textarea
              className="res-form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Mô tả về nhà hàng của bạn..."
              rows={4}
            />
          </div>
        </div>

        {/* Address & Operations */}
        <div className="res-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <MapPin size={20} color="#c4501a" />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Địa chỉ & Vận hành</h3>
          </div>

          <div className="res-form-group">
            <label className="res-form-label">Địa chỉ chính xác</label>
            <div style={{ position: 'relative' }}>
              <input
                className="res-form-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Đường ABC, Quận XYZ"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="res-form-group">
              <label className="res-form-label">Giờ mở cửa</label>
              <input
                className="res-form-input"
                type="time"
                value={formData.openTime}
                onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
              />
            </div>
            <div className="res-form-group">
              <label className="res-form-label">Giờ đóng cửa</label>
              <input
                className="res-form-input"
                type="time"
                value={formData.closeTime}
                onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            className="res-btn res-btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 160, justifyContent: 'center' }}
          >
            <Save size={16} />
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          <button className="res-btn res-btn-secondary" onClick={fetchRestaurant}>
            Hủy bỏ
          </button>
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="res-right-sidebar">
        {/* Chat */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Trò chuyện</h3>
          {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
            <span className="res-count-badge">
              {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)} mới
            </span>
          )}
        </div>

        {conversations.slice(0, 3).map((chat, idx) => (
          <div 
            key={idx} 
            className="res-chat-item"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/restaurant-dashboard/chat', { state: { partnerName: chat.partnerName } })}
          >
            <div className="res-chat-avatar">
              {chat.partnerAvatar ? (
                <img 
                  src={getImageUrl(chat.partnerAvatar, 'avatar')} 
                  alt={chat.partnerName} 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
              ) : (
                chat.partnerName?.charAt(0)
              )}
            </div>
            <div className="res-chat-content">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="res-chat-name">{chat.partnerName}</span>
                <span className="res-chat-time">
                  {new Date(chat.lastMessageTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="res-chat-text">"{chat.lastMessage}"</div>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '20px 0' }}>
            Chưa có tin nhắn nào
          </div>
        )}

        {/* System Notifications */}
        <div style={{ marginTop: 24 }}>
          <div className="res-card-title">Thông báo hệ thống</div>
          <div className="res-card" style={{ background: '#fff9f5', borderColor: '#ffe0cc' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                Bạn có 1 đánh giá 5 sao mới từ thực khách thân thiết.
              </div>
            </div>
          </div>
        </div>

        {/* Banner placeholder */}
        <div style={{
          marginTop: 20, borderRadius: 14, height: 160,
          background: 'linear-gradient(135deg, #ff5722, #ff9800)',
          display: 'flex', alignItems: 'flex-end', padding: 16,
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Nâng cấp gian hàng ngay</div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default RestaurantProfile;
