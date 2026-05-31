import { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Star, MessageSquare, ArrowRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const RestaurantAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState('day');
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [mode, setMode] = useState('view');
  const [resolutionText, setResolutionText] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // States cho quản lý ví
  const [walletData, setWalletData] = useState({ balance: 0, transactions: [] });
  const [showWallet, setShowWallet] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpNote, setTopUpNote] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchWalletData = async () => {
    try {
      const res = await axios.get(`${API}/restaurant/wallet`, { headers });
      setWalletData(res.data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu ví:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, complaintsRes, walletRes] = await Promise.all([
        axios.get(`${API}/restaurant/analytics?period=${chartMode}`, { headers }),
        axios.get(`${API}/restaurant/complaints`, { headers }),
        axios.get(`${API}/restaurant/wallet`, { headers }).catch(e => {
          console.error('Lỗi tải dữ liệu ví:', e);
          return { data: { balance: 0, transactions: [] } };
        })
      ]);
      setAnalytics(analyticsRes.data);
      setComplaints(complaintsRes.data);
      setWalletData(walletRes.data);
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

  const getDaySubLabel = (dateStr) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const getMonthLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `Th${parseInt(parts[1], 10)}/${parts[0]}`;
    }
    const date = new Date(dateStr);
    return `Th${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const handleSubmitResponse = async (id) => {
    if (!resolutionText.trim()) return;
    try {
      await axios.put(`${API}/restaurant/complaints/${id}/respond`, { resolution: resolutionText }, { headers });
      alert('Phản hồi thành công!');
      setActiveComplaint(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi');
    }
  };

  const handleOpenReport = async () => {
    setShowReportModal(true);
    try {
      setReportLoading(true);
      const res = await axios.get(`${API}/restaurant/menu`, { headers });
      const sorted = res.data.sort((a, b) => (b.sold_Count || 0) - (a.sold_Count || 0));
      setReportData(sorted);
    } catch (err) {
      console.error('Lỗi tải báo cáo:', err);
    } finally {
      setReportLoading(false);
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

  const serviceFeePercent = analytics?.serviceFeePercent !== undefined ? analytics.serviceFeePercent : 10;

  const periodOriginalTotal = analytics?.revenue?.length > 0
    ? analytics.revenue.reduce((sum, item) => sum + (item.originalRevenue || item.revenue || 0), 0)
    : 0;

  const periodNetTotal = analytics?.revenue?.length > 0
    ? analytics.revenue.reduce((sum, item) => sum + (item.netRevenue || item.revenue || 0), 0)
    : 0;

  const periodFeeTotal = analytics?.revenue?.length > 0
    ? analytics.revenue.reduce((sum, item) => sum + (item.serviceFee || 0), 0)
    : 0;

  const maxRevenue = analytics?.revenue?.length > 0
    ? Math.max(...analytics.revenue.map(r => parseFloat(r.originalRevenue || r.revenue || 0)))
    : 1;

  // Mock recent activities for right sidebar
  const recentActivities = [
    { title: 'Đơn hàng mới #ORD-1002', sub: 'Vừa xong • 2 món • 450.000đ', color: 'green' },
    { title: 'Shipper đã lấy hàng #ORD-998', sub: '5 phút trước • Tài xế: Nguyễn Văn A', color: 'blue' },
    { title: 'Hoàn tất đơn hàng #ORD-995', sub: '12 phút trước • Đánh giá: 5 sao', color: 'orange' },
  ];

  const getTransactionTypeBadge = (type) => {
    const map = {
      top_up: { class: 'res-badge-confirmed', label: 'Nạp tiền' },
      withdraw: { class: 'res-badge-cancelled', label: 'Rút tiền' },
      order_revenue: { class: 'res-badge-delivered', label: 'Doanh thu đơn' },
      commission_deduction: { class: 'res-badge-preparing', label: 'Chiết khấu' },
      payment: { class: 'res-badge-pending', label: 'Thanh toán' },
      refund: { class: 'res-badge-ready', label: 'Hoàn tiền' },
    };
    const info = map[type] || { class: 'res-badge-expired', label: type };
    return <span className={`res-badge ${info.class}`}>{info.label}</span>;
  };



  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(topUpAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Vui lòng nhập số tiền nạp hợp lệ');
      return;
    }
    try {
      const res = await axios.post(`${API}/restaurant/wallet/topup`, { amount: amountVal, note: topUpNote }, { headers });
      alert(res.data.message);
      setShowTopUpModal(false);
      await Promise.all([fetchWalletData(), fetchData()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi nạp tiền');
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(withdrawAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Vui lòng nhập số tiền rút hợp lệ');
      return;
    }
    try {
      const res = await axios.post(`${API}/restaurant/wallet/withdraw`, { amount: amountVal, note: withdrawNote }, { headers });
      alert(res.data.message);
      setShowWithdrawModal(false);
      await Promise.all([fetchWalletData(), fetchData()]);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi rút tiền');
    }
  };

  const renderTopUpModal = () => (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, fontFamily: 'Inter, sans-serif'
    }}>
      <form onSubmit={handleTopUpSubmit} style={{
        background: 'white', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400,
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>📥 Nạp tiền vào Ví</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Số tiền cần nạp (VNĐ)</label>
            <input 
              type="number"
              required
              placeholder="Ví dụ: 100000"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Ghi chú nạp tiền</label>
            <input 
              type="text"
              placeholder="Nạp tiền quảng cáo, nạp tiền ký quỹ..."
              value={topUpNote}
              onChange={(e) => setTopUpNote(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', outline: 'none' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button 
            type="button" 
            className="res-btn res-btn-secondary" 
            onClick={() => setShowTopUpModal(false)}
          >
            Hủy
          </button>
          <button 
            type="submit" 
            className="res-btn res-btn-primary"
            style={{ background: 'linear-gradient(135deg, #ff5722, #e64a19)' }}
          >
            Xác nhận nạp
          </button>
        </div>
      </form>
    </div>
  );

  const renderWithdrawModal = () => (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, fontFamily: 'Inter, sans-serif'
    }}>
      <form onSubmit={handleWithdrawSubmit} style={{
        background: 'white', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400,
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>📤 Rút tiền về Ngân hàng</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Số tiền muốn rút (VNĐ)</label>
            <input 
              type="number"
              required
              max={walletData?.balance || 0}
              placeholder={`Tối đa: ${formatPrice(walletData?.balance || 0)}`}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Ghi chú rút tiền</label>
            <input 
              type="text"
              placeholder="Rút doanh thu bán hàng..."
              value={withdrawNote}
              onChange={(e) => setWithdrawNote(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', outline: 'none' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button 
            type="button" 
            className="res-btn res-btn-secondary" 
            onClick={() => setShowWithdrawModal(false)}
          >
            Hủy
          </button>
          <button 
            type="submit" 
            className="res-btn res-btn-primary"
            style={{ background: '#37474f' }}
          >
            Xác nhận rút
          </button>
        </div>
      </form>
    </div>
  );

  if (showWallet) {
    return (
      <>
        <div className="res-content" style={{ maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button 
              className="res-btn res-btn-secondary res-btn-sm" 
              onClick={() => setShowWallet(false)}
              style={{ borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >
              ◀
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>Quản lý Ví tài khoản</h1>
              <p style={{ margin: 0, fontSize: 13, color: '#888' }}>Xem số dư ví, nạp/rút tiền và lịch sử giao dịch chi tiết</p>
            </div>
          </div>

          {/* Wallet Balance Card */}
          <div style={{ 
            background: 'linear-gradient(135deg, #1a1a1a, #333)', 
            color: 'white', 
            borderRadius: 16, 
            padding: 24, 
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 20
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Số dư khả dụng</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#ff7043', marginTop: 4 }}>
                {formatPrice(walletData?.balance || 0)}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Tài khoản liên kết: Vietcombank *******890</div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button 
                className="res-btn res-btn-primary" 
                onClick={() => {
                  setTopUpAmount('');
                  setTopUpNote('');
                  setShowTopUpModal(true);
                }}
                style={{ background: 'linear-gradient(135deg, #ff7043, #f4511e)' }}
              >
                📥 Nạp tiền
              </button>
              <button 
                className="res-btn" 
                onClick={() => {
                  setWithdrawAmount('');
                  setWithdrawNote('');
                  setShowWithdrawModal(true);
                }}
                style={{ background: '#37474f', color: '#fff', border: '1px solid #455a64' }}
              >
                📤 Rút tiền
              </button>

            </div>
          </div>

          {/* Transactions Table */}
          <div className="res-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch sử giao dịch ví</h3>
              <span style={{ fontSize: 12, color: '#888' }}>Hiển thị {walletData?.transactions?.length || 0} giao dịch mới nhất</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="res-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại giao dịch</th>
                    <th style={{ textAlign: 'right' }}>Số tiền</th>
                    <th style={{ textAlign: 'right' }}>Số dư sau GD</th>
                    <th>Ghi chú</th>
                    <th>Mã đơn</th>
                  </tr>
                </thead>
                <tbody>
                  {walletData?.transactions?.length > 0 ? (
                    walletData.transactions.map((tx) => {
                      const isPositive = ['top_up', 'order_revenue', 'refund', 'shipping_reward'].includes(tx.transaction_type);
                      return (
                        <tr key={tx.id_Transaction}>
                          <td>
                            {new Date(tx.created_At).toLocaleString('vi-VN')}
                          </td>
                          <td>
                            {getTransactionTypeBadge(tx.transaction_type)}
                          </td>
                          <td style={{ 
                            textAlign: 'right', 
                            fontWeight: 700, 
                            color: isPositive ? '#2e7d32' : '#c62828' 
                          }}>
                            {isPositive ? '+' : '-'}{formatPrice(tx.amount)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 500, color: '#555' }}>
                            {formatPrice(tx.balance_after)}
                          </td>
                          <td style={{ color: '#666', fontSize: 13 }}>
                            {tx.note || '—'}
                          </td>
                          <td>
                            {tx.order_Code ? (
                              <span style={{ fontWeight: 600, color: '#c4501a' }}>#{tx.order_Code}</span>
                            ) : (
                              <span style={{ color: '#aaa' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                        Chưa có giao dịch nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Render Modals */}
        {showTopUpModal && renderTopUpModal()}
        {showWithdrawModal && renderWithdrawModal()}
      </>
    );
  }

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <h1>Phân tích Kinh doanh</h1>
          <p>Theo dõi hiệu suất và phản hồi khách hàng trong thời gian thực.</p>
        </div>

        {/* Overview Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          {/* Card: Ví của tôi */}
          <div 
            className="res-card" 
            onClick={() => setShowWallet(true)}
            style={{ 
              marginBottom: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between', 
              minHeight: 120,
              background: 'linear-gradient(135deg, #fff3e0, #fff)',
              borderColor: '#ffe0b2',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,87,34,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ví của tôi</span>
                <span style={{ fontSize: 20 }}>💳</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#e65100' }}>
                {formatPrice(walletData?.balance || 0)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#ff5722', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, borderTop: '1px solid #ffe0b2', paddingTop: 8 }}>
              Quản lý ví & giao dịch <ArrowRight size={12} />
            </div>
          </div>
          {/* Card 1: Doanh thu gốc hôm nay */}
          <div className="res-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Doanh thu hôm nay (Gốc)</span>
                <span style={{ fontSize: 20 }}>💰</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>
                {formatPrice(analytics?.today?.originalTodayRevenue || analytics?.today?.todayRevenue || 0)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8, borderTop: '1px solid #f5f5f5', paddingTop: 8 }}>
              Chưa khấu trừ phí dịch vụ
            </div>
          </div>

          {/* Card 2: Thực nhận hôm nay */}
          <div className="res-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120, background: '#f4f9f4', borderColor: '#c8e6c9' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thực nhận hôm nay</span>
                <span style={{ fontSize: 20 }}>💵</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2e7d32' }}>
                {formatPrice(analytics?.today?.todayNetRevenue !== undefined ? analytics.today.todayNetRevenue : (analytics?.today?.todayRevenue || 0))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 8, borderTop: '1px solid #e8f5e9', paddingTop: 8 }}>
              Đã khấu trừ {serviceFeePercent}% (-{formatPrice(analytics?.today?.todayServiceFee || 0)})
            </div>
          </div>

          {/* Card 3: Doanh thu gốc chu kỳ */}
          <div className="res-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng DT gốc chu kỳ</span>
                <span style={{ fontSize: 20 }}>📈</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>
                {formatPrice(periodOriginalTotal)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 8, borderTop: '1px solid #f5f5f5', paddingTop: 8 }}>
              Theo tổng {analytics?.revenue?.length || 0} {chartMode === 'day' ? 'ngày gần nhất' : 'tháng gần nhất'}
            </div>
          </div>

          {/* Card 4: Thực nhận chu kỳ */}
          <div className="res-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120, background: '#f4f9f4', borderColor: '#c8e6c9' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng thực nhận chu kỳ</span>
                <span style={{ fontSize: 20 }}>🤝</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#2e7d32' }}>
                {formatPrice(periodNetTotal)}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 8, borderTop: '1px solid #e8f5e9', paddingTop: 8 }}>
              Đã khấu trừ {serviceFeePercent}% (-{formatPrice(periodFeeTotal)})
            </div>
          </div>
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
                {analytics.revenue.map((item, idx) => {
                  const itemOriginal = item.originalRevenue || item.revenue || 0;
                  const itemFee = item.serviceFee || 0;
                  const itemNet = item.netRevenue || item.revenue || 0;
                  return (
                    <div key={idx} className="res-chart-bar-wrapper">
                      <div className="res-chart-value">
                        {itemOriginal >= 1000000
                          ? `${(itemOriginal / 1000000).toFixed(1)}tr`
                          : `${(itemOriginal / 1000).toFixed(0)}k`}
                      </div>
                      <div
                        className="res-chart-bar"
                        style={{
                          height: `${(itemOriginal / maxRevenue) * 140}px`,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        title={`Thời gian: ${item.date}\nDoanh thu gốc: ${formatPrice(itemOriginal)}\nKhấu trừ (${serviceFeePercent}%): -${formatPrice(itemFee)}\nThực nhận: ${formatPrice(itemNet)}\nSố đơn: ${item.orderCount} đơn`}
                      >
                        {/* Visual representation of Net Payout: Green bottom section, Orange top section */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: `${100 - serviceFeePercent}%`,
                          background: 'linear-gradient(180deg, #4caf50, #2e7d32)',
                          borderRadius: '0 0 6px 6px'
                        }} />
                      </div>
                      <div className="res-chart-label" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>
                          {chartMode === 'day' ? getDayLabel(item.date) : getMonthLabel(item.date)}
                        </span>
                        {chartMode === 'day' && (
                          <span style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', fontWeight: 'normal' }}>
                            {getDaySubLabel(item.date)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              <a 
                onClick={handleOpenReport}
                style={{ color: '#c4501a', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
              >
                Xem tất cả báo cáo <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
              </a>
            </div>
          </div>
        </div>

        {/* Detailed Revenue Table */}
        <div className="res-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Bảng kê chi tiết doanh thu & Khấu trừ ({serviceFeePercent}%)</h3>
            <span style={{ fontSize: 12, color: '#666', background: '#f5f5f5', padding: '4px 10px', borderRadius: 12, fontWeight: 500 }}>
              Áp dụng khấu trừ trên từng đơn hàng
            </span>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="res-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th style={{ textAlign: 'center' }}>Số đơn hàng</th>
                  <th style={{ textAlign: 'right' }}>Doanh thu gốc</th>
                  <th style={{ textAlign: 'right' }}>Khấu trừ ({serviceFeePercent}%)</th>
                  <th style={{ textAlign: 'right' }}>Thực nhận (Net)</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.revenue?.map((item, idx) => {
                  const itemOriginal = item.originalRevenue || item.revenue || 0;
                  const itemFee = item.serviceFee || 0;
                  const itemNet = item.netRevenue || item.revenue || 0;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>
                        {chartMode === 'day' 
                          ? new Date(item.date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })
                          : `Tháng ${item.date.split('-')[1]}/${item.date.split('-')[0]}`}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.orderCount} đơn</td>
                      <td style={{ textAlign: 'right', color: '#1a1a1a', fontWeight: 500 }}>
                        {formatPrice(itemOriginal)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#c62828', fontWeight: 500 }}>
                        -{formatPrice(itemFee)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#2e7d32', fontWeight: 700 }}>
                        {formatPrice(itemNet)}
                      </td>
                    </tr>
                  );
                })}
                {(!analytics?.revenue || analytics.revenue.length === 0) && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                      Chưa có dữ liệu thống kê
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
                        <button 
                          className="res-btn res-btn-primary res-btn-sm" 
                          onClick={() => {
                            setActiveComplaint(c);
                            setMode('respond');
                            setResolutionText('');
                          }}
                        >
                          Phản hồi
                        </button>
                      ) : (
                        <button 
                          className="res-btn res-btn-secondary res-btn-sm"
                          onClick={() => {
                            setActiveComplaint(c);
                            setMode('view');
                          }}
                        >
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

      {/* Modal chi tiết & phản hồi khiếu nại */}
      {activeComplaint && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: 'white', padding: 24, borderRadius: 16, width: '90%', maxWidth: 500,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>
              {mode === 'view' ? 'Chi tiết Khiếu nại' : 'Phản hồi Khiếu nại'} #{activeComplaint.order_Code?.slice(-4) || activeComplaint.id_Order}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <div>
                <strong>Khách hàng:</strong> {activeComplaint.customerName}
              </div>
              <div>
                <strong>Ngày gửi:</strong> {new Date(activeComplaint.created_At).toLocaleDateString('vi-VN')}
              </div>
              <div>
                <strong>Nội dung khiếu nại:</strong>
                <p style={{ margin: '4px 0 0', padding: 10, background: '#f5f5f5', borderRadius: 8, color: '#333' }}>
                  {activeComplaint.description}
                </p>
              </div>

              {mode === 'view' ? (
                <>
                  <div>
                    <strong>Trạng thái:</strong> <span style={{ color: '#2e7d32', fontWeight: 600 }}>Đã giải quyết</span>
                  </div>
                  <div>
                    <strong>Phản hồi của nhà hàng:</strong>
                    <p style={{ margin: '4px 0 0', padding: 10, background: '#e8f5e9', borderRadius: 8, color: '#2e7d32', borderLeft: '4px solid #2e7d32' }}>
                      {activeComplaint.resolution || 'Không có phản hồi'}
                    </p>
                  </div>
                  {activeComplaint.resolved_At && (
                    <div>
                      <strong>Thời gian xử lý:</strong> {new Date(activeComplaint.resolved_At).toLocaleString('vi-VN')}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Giải pháp / Nội dung phản hồi:</strong>
                  <textarea
                    rows={4}
                    placeholder="Nhập hướng giải quyết cho khách hàng (ví dụ: Đồng ý hoàn tiền, gửi tặng voucher...)"
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    style={{
                      width: '100%', padding: 12, borderRadius: 8, border: '1px solid #ddd',
                      fontFamily: 'inherit', fontSize: 13, resize: 'vertical', outline: 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button 
                className="res-btn res-btn-secondary" 
                onClick={() => { setActiveComplaint(null); }}
              >
                Hủy
              </button>
              {mode === 'respond' ? (
                <button 
                  className="res-btn res-btn-primary" 
                  onClick={() => handleSubmitResponse(activeComplaint.id_Complaint)}
                  disabled={!resolutionText.trim()}
                >
                  Gửi phản hồi
                </button>
              ) : (
                <button 
                  className="res-btn res-btn-primary" 
                  onClick={() => { setActiveComplaint(null); }}
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết báo cáo doanh số thực đơn */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, fontFamily: 'Inter, sans-serif'
        }}>
          <div style={{
            background: 'white', padding: 24, borderRadius: 16, width: '95%', maxWidth: 700,
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                📊 Báo cáo doanh số chi tiết thực đơn
              </h3>
              <button 
                onClick={() => setShowReportModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#999' }}
              >
                &times;
              </button>
            </div>

            {reportLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="res-spinner"></div>
              </div>
            ) : (
              <>
                <table className="res-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Tên món</th>
                      <th>Danh mục</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Đã bán</th>
                      <th style={{ textAlign: 'right' }}>Tổng doanh thu</th>
                      <th style={{ textAlign: 'center' }}>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((food) => {
                      const totalRevenue = (food.sold_Count || 0) * food.price;
                      return (
                        <tr key={food.id_Food}>
                          <td style={{ fontWeight: 600 }}>{food.name}</td>
                          <td>{food.categoryName}</td>
                          <td style={{ textAlign: 'right' }}>{formatPrice(food.price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{food.sold_Count || 0}</td>
                          <td style={{ textAlign: 'right', color: '#c4501a', fontWeight: 700 }}>
                            {formatPrice(totalRevenue)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {food.avg_rating ? `⭐ ${food.avg_rating.toFixed(1)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Summary Cards */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, 
                  marginTop: 20, padding: 16, background: '#fcfcfc', borderRadius: 12, border: '1px solid #f0f0f0'
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#888' }}>Tổng số lượng món đã bán</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginTop: 4 }}>
                      {reportData.reduce((acc, f) => acc + (f.sold_Count || 0), 0)} phần
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#888' }}>Ước tính tổng doanh số thực đơn</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2e7d32', marginTop: 4 }}>
                      {formatPrice(reportData.reduce((acc, f) => acc + ((f.sold_Count || 0) * f.price), 0))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div style={{ textAlign: 'right', marginTop: 24 }}>
              <button 
                className="res-btn res-btn-primary" 
                onClick={() => setShowReportModal(false)}
              >
                Đóng báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RestaurantAnalytics;
