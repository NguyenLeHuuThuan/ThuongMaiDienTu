import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  Search, Bell, Settings, ClipboardList, UtensilsCrossed, 
  Tag, BarChart3, UserCircle, MessageSquare, Clock, Power
} from 'lucide-react';
import '../pages/restaurant/RestaurantDashboard.css';

const RestaurantLayout = () => {
  const { user, logout, unreadNotiCount } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDropdown]);

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
          <button title="Thông báo" onClick={() => navigate('/notifications')}>
            <Bell size={20} />
            {unreadNotiCount > 0 && (
              <span className="res-notif-badge">{unreadNotiCount}</span>
            )}
          </button>
          <button title="Cài đặt">
            <Settings size={20} />
          </button>
          <div className="res-header-user-menu" ref={dropdownRef}>
            <div 
              className="res-header-avatar" 
              title={user.fullName} 
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {user.fullName?.charAt(0)}
            </div>
            {showDropdown && (
              <div className="res-header-dropdown">
                <div className="res-dropdown-header">
                  <div className="res-dropdown-name">{user.fullName}</div>
                  <div className="res-dropdown-role">Chủ nhà hàng</div>
                </div>
                <div className="res-dropdown-divider"></div>
                <button className="res-dropdown-item" onClick={() => { setShowDropdown(false); navigate('/restaurant-dashboard/profile'); }}>
                  <UserCircle size={16} />
                  <span>Hồ sơ nhà hàng</span>
                </button>
                <button className="res-dropdown-item" onClick={() => { setShowDropdown(false); navigate('/restaurant-dashboard/orders'); }}>
                  <ClipboardList size={16} />
                  <span>Đơn hàng của tôi</span>
                </button>
                <div className="res-dropdown-divider"></div>
                <button className="res-dropdown-item logout" onClick={() => { setShowDropdown(false); handleLogout(); }}>
                  <Power size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
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
              style={{ marginBottom: '8px' }}
            >
              <Clock size={16} />
              {isOpen ? 'Mở/Đóng Cửa Hàng' : 'Cửa hàng đã đóng'}
            </button>
            <button
              className="res-logout-sidebar-btn"
              onClick={handleLogout}
            >
              <Power size={16} />
              <span>Đăng xuất</span>
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
