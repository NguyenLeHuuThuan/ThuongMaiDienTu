import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, Trash2, Tag, Percent, Truck, DollarSign } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const RestaurantPromotions = () => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '', type: 'percent', value: '', min_OrderValue: '', max_Discount: '',
    usage_Limit: '', star_Date: '', end_Date: ''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/restaurant/promotions`, { headers });
      setPromotions(res.data);
    } catch (err) {
      console.error('Lỗi tải khuyến mãi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const handleCreate = async () => {
    if (!formData.code || !formData.value) {
      alert('Vui lòng nhập mã và giá trị');
      return;
    }
    try {
      await axios.post(`${API}/restaurant/promotions`, {
        ...formData,
        value: parseFloat(formData.value),
        min_OrderValue: formData.min_OrderValue ? parseFloat(formData.min_OrderValue) : null,
        max_Discount: formData.max_Discount ? parseFloat(formData.max_Discount) : null,
        usage_Limit: formData.usage_Limit ? parseInt(formData.usage_Limit) : null,
        star_Date: formData.star_Date || null,
        end_Date: formData.end_Date || null,
      }, { headers });
      alert('Tạo khuyến mãi thành công!');
      setShowModal(false);
      setFormData({ code: '', type: 'percent', value: '', min_OrderValue: '', max_Discount: '', usage_Limit: '', star_Date: '', end_Date: '' });
      fetchPromotions();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi tạo khuyến mãi');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa khuyến mãi này?')) return;
    try {
      await axios.delete(`${API}/restaurant/promotions/${id}`, { headers });
      fetchPromotions();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi');
    }
  };

  const formatPrice = (price) => {
    if (!price) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const getDaysLeft = (endDate) => {
    if (!endDate) return '∞';
    const diff = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Hết hạn';
    return `${diff} ngày`;
  };

  const isActive = (promo) => {
    if (!promo.end_Date) return true;
    return new Date(promo.end_Date) >= new Date();
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'percent': return <Percent size={16} />;
      case 'freeship': return <Truck size={16} />;
      default: return <DollarSign size={16} />;
    }
  };

  const getPromoDescription = (promo) => {
    if (promo.type === 'percent') return `Giảm ${promo.value}% cho đơn hàng`;
    if (promo.type === 'freeship') return `Miễn phí vận chuyển`;
    return `Giảm ${formatPrice(promo.value)} cho đơn hàng`;
  };

  const activePromos = promotions.filter(p => isActive(p));
  const expiredPromos = promotions.filter(p => !isActive(p));

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1>Chiến dịch Khuyến mãi</h1>
              <p>Tạo và quản lý các mã giảm giá cho nhà hàng của bạn.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="res-btn res-btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={18} />
                Tạo mã mới
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="res-stats-grid" style={{ marginBottom: 24 }}>
          <div className="res-stat-card">
            <div className="res-stat-value">{promotions.length}</div>
            <div className="res-stat-label">Tổng khuyến mãi</div>
          </div>
          <div className="res-stat-card">
            <div className="res-stat-value" style={{ color: '#2e7d32' }}>{activePromos.length}</div>
            <div className="res-stat-label">Đang hoạt động</div>
          </div>
          <div className="res-stat-card">
            <div className="res-stat-value" style={{ color: '#999' }}>{expiredPromos.length}</div>
            <div className="res-stat-label">Đã hết hạn</div>
          </div>
        </div>

        {loading ? (
          <div className="res-loading"><div className="res-spinner"></div></div>
        ) : promotions.length === 0 ? (
          <div className="res-empty">
            <div className="res-empty-icon">🏷️</div>
            <div className="res-empty-text">Chưa có khuyến mãi nào</div>
            <button className="res-btn res-btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
              Tạo khuyến mãi đầu tiên
            </button>
          </div>
        ) : (
          <>
            {/* Active */}
            {activePromos.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Đang hoạt động</h3>
                <div className="res-promo-grid" style={{ marginBottom: 32 }}>
                  {activePromos.map((promo) => (
                    <div key={promo.id_Promo} className="res-promo-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className="res-badge res-badge-active">Active</span>
                          {!promo.is_owner && (
                            <span className="res-badge" style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', fontSize: '11px' }}>Hệ thống</span>
                          )}
                        </div>
                        {promo.is_owner && (
                          <button
                            onClick={() => handleDelete(promo.id_Promo)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 4 }}
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="res-promo-code">{promo.code}</div>
                      <div className="res-promo-desc">{getPromoDescription(promo)}</div>
                      {promo.min_OrderValue > 0 && (
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                          Đơn tối thiểu: {formatPrice(promo.min_OrderValue)}
                        </div>
                      )}
                      <div className="res-promo-meta">
                        <div className="res-promo-meta-item">
                          <div style={{ color: '#999' }}>Hết hạn sau</div>
                          <span>{getDaysLeft(promo.end_Date)}</span>
                        </div>
                        <div className="res-promo-meta-item">
                          <div style={{ color: '#999' }}>Đã dùng</div>
                          <span>{promo.used_Count || 0}/{promo.usage_Limit || '∞'}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add card */}
                  <div
                    className="res-promo-card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderStyle: 'dashed' }}
                    onClick={() => setShowModal(true)}
                  >
                    <div style={{ textAlign: 'center', color: '#999' }}>
                      <Plus size={32} />
                      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600 }}>Thêm chiến dịch mới</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Expired */}
            {expiredPromos.length > 0 && (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#999' }}>Đã hết hạn</h3>
                <div className="res-promo-grid">
                  {expiredPromos.map((promo) => (
                    <div key={promo.id_Promo} className="res-promo-card" style={{ opacity: 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <span className="res-badge res-badge-expired">Hết hạn</span>
                          {!promo.is_owner && (
                            <span className="res-badge" style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', fontSize: '11px' }}>Hệ thống</span>
                          )}
                        </div>
                      </div>
                      <div className="res-promo-code">{promo.code}</div>
                      <div className="res-promo-desc">{getPromoDescription(promo)}</div>
                      <div className="res-promo-meta">
                        <div className="res-promo-meta-item">
                          <div style={{ color: '#999' }}>Đã dùng</div>
                          <span>{promo.used_Count || 0}/{promo.usage_Limit || '∞'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Right Sidebar */}
      <aside className="res-right-sidebar">
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Hướng dẫn</h3>

        <div className="res-card">
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            <p style={{ marginBottom: 12 }}>
              <strong>Percent</strong>: Giảm theo % tổng đơn hàng. VD: Giảm 15% cho đơn từ 200k.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong>Fixed</strong>: Giảm số tiền cố định. VD: Giảm 20.000đ cho đơn từ 100k.
            </p>
            <p>
              <strong>Freeship</strong>: Miễn phí vận chuyển cho đơn hàng.
            </p>
          </div>
        </div>

        <div className="res-tip-card">
          <div className="res-tip-card-title">💡 Mẹo tăng doanh thu</div>
          <div className="res-tip-card-text">
            Dữ liệu cho thấy khách hàng thường đặt "Burger Bò" kèm với "Khoai tây chiên". Hãy thử tạo Combo để tăng giá trị đơn hàng!
          </div>
        </div>
      </aside>

      {/* Create Modal */}
      {showModal && (
        <div className="res-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="res-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="res-modal-title" style={{ margin: 0 }}>Tạo mã khuyến mãi</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Mã khuyến mãi *</label>
              <input
                className="res-form-input"
                placeholder="VD: SUMMER24"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Loại khuyến mãi *</label>
              <select
                className="res-form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="percent">Giảm theo %</option>
                <option value="fixed">Giảm số tiền cố định</option>
                <option value="freeship">Miễn phí vận chuyển</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="res-form-group">
                <label className="res-form-label">
                  {formData.type === 'percent' ? 'Phần trăm giảm (%)' : formData.type === 'freeship' ? 'Giá trị ship (VNĐ)' : 'Số tiền giảm (VNĐ)'} *
                </label>
                <input
                  className="res-form-input"
                  type="number"
                  placeholder="0"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>
              <div className="res-form-group">
                <label className="res-form-label">Đơn tối thiểu (VNĐ)</label>
                <input
                  className="res-form-input"
                  type="number"
                  placeholder="0"
                  value={formData.min_OrderValue}
                  onChange={(e) => setFormData({ ...formData, min_OrderValue: e.target.value })}
                />
              </div>
            </div>

            {formData.type === 'percent' && (
              <div className="res-form-group">
                <label className="res-form-label">Giảm tối đa (VNĐ)</label>
                <input
                  className="res-form-input"
                  type="number"
                  placeholder="50000"
                  value={formData.max_Discount}
                  onChange={(e) => setFormData({ ...formData, max_Discount: e.target.value })}
                />
              </div>
            )}

            <div className="res-form-group">
              <label className="res-form-label">Giới hạn lượt sử dụng</label>
              <input
                className="res-form-input"
                type="number"
                placeholder="VD: 200 (để trống = không giới hạn)"
                value={formData.usage_Limit}
                onChange={(e) => setFormData({ ...formData, usage_Limit: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="res-form-group">
                <label className="res-form-label">Ngày bắt đầu</label>
                <input
                  className="res-form-input"
                  type="date"
                  value={formData.star_Date}
                  onChange={(e) => setFormData({ ...formData, star_Date: e.target.value })}
                />
              </div>
              <div className="res-form-group">
                <label className="res-form-label">Ngày kết thúc</label>
                <input
                  className="res-form-input"
                  type="date"
                  value={formData.end_Date}
                  onChange={(e) => setFormData({ ...formData, end_Date: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="res-btn res-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>
                Hủy
              </button>
              <button className="res-btn res-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCreate}>
                Tạo khuyến mãi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RestaurantPromotions;
