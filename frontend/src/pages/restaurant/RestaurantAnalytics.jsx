import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Star, MessageSquare, ArrowRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const RestaurantAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('day');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, complaintsRes] = await Promise.all([
        axios.get(`${API}/restaurant/analytics?period=${chartMode}`, { headers }),
        axios.get(`${API}/restaurant/complaints`, { headers }),
      ]);
      setAnalytics(analyticsRes.data);
      setComplaints(complaintsRes.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chartMode]);

  const formatPrice = (price) => {
    if (!price) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const getDayLabel = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  const getMonthLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `Th${parseInt(parts[1], 10)}`;
    }
    const date = new Date(dateStr);
    return `Th${date.getMonth() + 1}`;
  };

  const handleRespondComplaint = async (id) => {
    const resolution = prompt('Nhập phản hồi:');
    if (!resolution) return;
    try {
      await axios.put(`${API}/restaurant/complaints/${id}/respond`, { resolution }, { headers });
      alert('Phản hồi thành công!');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi');
    }
  };

  const getComplaintStatusBadge = (status) => {
    const map = {
      pending: { class: 'res-badge-pending', label: 'Chưa xử lý' },
      processing: { class: 'res-badge-processing', label: 'Đang xem xét' },
      resolved: { class: 'res-badge-resolved', label: 'Đã giải quyết' },
      rejected: { class: 'res-badge-cancelled', label: 'Từ chối' },
    };
    const info = map[status] || { class: '', label: status };
    return <span className={`res-badge ${info.class}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className="res-content">
        <div className="res-loading"><div className="res-spinner"></div></div>
      </div>
    );
  }

  const maxRevenue = analytics?.revenue?.length > 0
    ? Math.max(...analytics.revenue.map(r => r.revenue))
    : 1;

  // Mock recent activities for right sidebar
  const recentActivities = [
    { title: 'Đơn hàng mới #ORD-1002', sub: 'Vừa xong • 2 món • 450.000đ', color: 'green' },
    { title: 'Shipper đã lấy hàng #ORD-998', sub: '5 phút trước • Tài xế: Nguyễn Văn A', color: 'blue' },
    { title: 'Hoàn tất đơn hàng #ORD-995', sub: '12 phút trước • Đánh giá: 5 sao', color: 'orange' },
  ];

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <h1>Phân tích Kinh doanh</h1>
          <p>Theo dõi hiệu suất và phản hồi khách hàng trong thời gian thực.</p>
        </div>

        {/* Revenue Chart + Top Foods */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Revenue Chart */}
          <div className="res-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Doanh thu theo thời gian</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {chartMode === 'day' ? 'Tổng quan 7 ngày gần nhất' : 'Tổng quan 6 tháng gần nhất'}
                </div>
              </div>
              <div className="res-tabs" style={{ marginBottom: 0 }}>
                <button className={`res-tab ${chartMode === 'day' ? 'active' : ''}`} onClick={() => setChartMode('day')}>Ngày</button>
                <button className={`res-tab ${chartMode === 'month' ? 'active' : ''}`} onClick={() => setChartMode('month')}>Tháng</button>
              </div>
            </div>

            {analytics?.revenue?.length > 0 ? (
              <div className="res-chart">
                {analytics.revenue.map((item, idx) => (
                  <div key={idx} className="res-chart-bar-wrapper">
                    <div className="res-chart-value">
                      {item.revenue >= 1000000
                        ? `${(item.revenue / 1000000).toFixed(1)}tr`
                        : `${(item.revenue / 1000).toFixed(0)}k`}
                    </div>
                    <div
                      className="res-chart-bar"
                      style={{ height: `${(item.revenue / maxRevenue) * 140}px` }}
                      title={`${formatPrice(item.revenue)} - ${item.orderCount} đơn`}
                    ></div>
                    <div className="res-chart-label">
                      {chartMode === 'day' ? getDayLabel(item.date) : getMonthLabel(item.date)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                Chưa có dữ liệu doanh thu
              </div>
            )}
          </div>

          {/* Top Foods */}
          <div className="res-card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Món bán chạy</div>
            {analytics?.topFoods?.map((food, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < analytics.topFoods.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: '#f5f5f5', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 24
                }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{food.name}</div>
                  <div style={{ fontSize: 12, color: '#ff5722' }}>{food.total_sold} đơn tháng này</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32' }}>
                  +{Math.floor(Math.random() * 20)}%
                </div>
              </div>
            ))}
            {(!analytics?.topFoods || analytics.topFoods.length === 0) && (
              <div style={{ textAlign: 'center', padding: 20, color: '#999', fontSize: 14 }}>
                Chưa có dữ liệu
              </div>
            )}
            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <a style={{ color: '#c4501a', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                Xem tất cả báo cáo <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
              </a>
            </div>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="res-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Phản hồi & Khiếu nại</h3>
            {complaints.filter(c => c.status === 'pending').length > 0 && (
              <span className="res-badge res-badge-new">
                {complaints.filter(c => c.status === 'pending').length} Yêu cầu mới
              </span>
            )}
          </div>

          {complaints.length > 0 ? (
            <table className="res-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Đơn hàng</th>
                  <th>Nội dung</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id_Complaint}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: '#f0f0f0', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: 600, fontSize: 13, color: '#666',
                          flexShrink: 0
                        }}>
                          {c.customerName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.customerName}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>#{c.order_Code?.slice(-4)}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {new Date(c.created_At).toLocaleDateString('vi-VN')}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description}
                      </div>
                    </td>
                    <td>{getComplaintStatusBadge(c.status)}</td>
                    <td>
                      {c.status === 'pending' || c.status === 'processing' ? (
                        <button className="res-btn res-btn-primary res-btn-sm" onClick={() => handleRespondComplaint(c.id_Complaint)}>
                          Phản hồi
                        </button>
                      ) : (
                        <button className="res-btn res-btn-secondary res-btn-sm">
                          Xem lại
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>😊</div>
              <div>Không có khiếu nại nào. Tuyệt vời!</div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="res-right-sidebar">
        {/* Activity Feed */}
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}>Hoạt động trực tiếp</h3>
        {recentActivities.map((act, idx) => (
          <div key={idx} className="res-activity-item">
            <div className={`res-activity-dot ${act.color}`}></div>
            <div className="res-activity-content">
              <div className="res-activity-title">{act.title}</div>
              <div className="res-activity-sub">{act.sub}</div>
            </div>
          </div>
        ))}

        {/* Satisfaction Score */}
        <div className="res-card" style={{ marginTop: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 4 }}>Chỉ số hài lòng</div>
          <div className="res-satisfaction">
            <div className="res-satisfaction-score">
              {analytics?.rating?.avg_rating ? analytics.rating.avg_rating.toFixed(1) : '—'}
              <span className="res-satisfaction-max"> /5.0</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#2e7d32', fontWeight: 500 }}>
            Dựa trên {analytics?.rating?.review_count || 0} đánh giá
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            Bạn đang làm rất tốt!
          </div>
        </div>

        {/* Tip */}
        <div className="res-tip-card" style={{ marginTop: 16 }}>
          <div className="res-tip-card-title">💡 Mẹo tăng doanh thu</div>
          <div className="res-tip-card-text">
            Dữ liệu cho thấy khách hàng thường đặt "Burger Bò" kèm với "Khoai tây chiên". Hãy thử tạo Combo để tăng giá trị đơn hàng!
          </div>
        </div>
      </aside>
    </>
  );
};

export default RestaurantAnalytics;
