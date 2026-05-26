import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  Search, Bell, Settings, ClipboardList, UtensilsCrossed, 
  Tag, BarChart3, UserCircle, MessageSquare, Clock, Power
} from 'lucide-react';
import '../pages/restaurant/RestaurantDashboard.css';

const RestaurantLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  if (!user || user.role !== 'restaurant_owner') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Truy cập bị từ chối</h2>
          <p style={{ color: '#999' }}>Bạn cần đăng nhập với tài khoản chủ nhà hàng.</p>
          <button onClick={() => navigate('/login')} className="res-btn res-btn-primary" style={{ marginTop: 16 }}>
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/restaurant-dashboard/orders', icon: ClipboardList, label: 'Đơn hàng' },
    { to: '/restaurant-dashboard/menu', icon: UtensilsCrossed, label: 'Thực đơn' },
    { to: '/restaurant-dashboard/promotions', icon: Tag, label: 'Khuyến mãi' },
    { to: '/restaurant-dashboard/analytics', icon: BarChart3, label: 'Thống kê' },
    { to: '/restaurant-dashboard/profile', icon: UserCircle, label: 'Hồ sơ' },
    { to: '/restaurant-dashboard/chat', icon: MessageSquare, label: 'Trò chuyện' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="res-dashboard">
      {/* Header */}
      <header className="res-header">
        <NavLink to="/restaurant-dashboard" className="res-header-logo">
          The Culinary Curator
        </NavLink>

        <div className="res-header-search">
          <Search className="search-icon" />
          <input type="text" placeholder="Tìm kiếm dữ liệu..." />
        </div>

        <div className="res-header-actions">
          <button title="Thông báo">
            <Bell size={20} />
            <span className="res-notif-badge"></span>
          </button>
          <button title="Cài đặt">
            <Settings size={20} />
          </button>
          <div className="res-header-avatar" title={user.fullName} onClick={() => navigate('/restaurant-dashboard/profile')}>
            {user.fullName?.charAt(0)}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="res-body">
        {/* Sidebar */}
        <aside className="res-sidebar">
          <div className="res-sidebar-profile">
            <div className="res-sidebar-profile-name">Bếp Trưởng</div>
            <div className="res-sidebar-profile-sub">Nhà hàng của bạn</div>
          </div>

          <nav className="res-sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `res-nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="res-sidebar-bottom">
            <button
              className={`res-toggle-btn ${isOpen ? 'open' : 'closed'}`}
              onClick={() => setIsOpen(!isOpen)}
            >
              <Clock size={16} />
              {isOpen ? 'Mở/Đóng Cửa Hàng' : 'Cửa hàng đã đóng'}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="res-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default RestaurantLayout;
