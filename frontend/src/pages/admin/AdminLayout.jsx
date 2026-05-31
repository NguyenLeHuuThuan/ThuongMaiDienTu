import { useState, useEffect, useContext } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, Settings, AlertTriangle,
  ListCollapse, Flame, LogOut, Menu, X, Bell, User, Clock, ShieldAlert, Wallet, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [time, setTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ partners: 0, complaints: 0 });

  const fetchAdminNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(res.data.notifications || []);
      setUnreadCounts(res.data.unreadCounts || { partners: 0, complaints: 0 });
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
    }
  };

  useEffect(() => {
    const clockTimer = setInterval(() => setTime(new Date()), 1000);
    
    fetchAdminNotifications();
    const notificationTimer = setInterval(fetchAdminNotifications, 10000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(notificationTimer);
    };
  }, []);

  useEffect(() => {
    fetchAdminNotifications();
  }, [location.pathname]);

  // Secure Route: Only admins allowed
  useEffect(() => {
    // If not loaded yet, wait. If loaded and not admin, redirect.
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
    }
  }, [user, navigate]);

  const menuItems = [
    { name: 'Bảng Điều Khiển', path: '/admin', icon: LayoutDashboard },
    { name: 'Quản Lý Người Dùng', path: '/admin/users', icon: Users },
    { name: 'Duyệt Đối Tác', path: '/admin/partners', icon: UserCheck, badge: unreadCounts.partners },
    { name: 'Cấu Hình Hệ Thống', path: '/admin/configs', icon: Settings },
    { name: 'Quản Lý Ví Hệ Thống', path: '/admin/wallet', icon: Wallet },
    { name: 'Xử Lý Khiếu Nại', path: '/admin/complaints', icon: AlertTriangle, badge: unreadCounts.complaints },
    { name: 'Danh Mục Món Ăn', path: '/admin/categories', icon: ListCollapse },
    { name: 'Chương Trình Hot', path: '/admin/campaigns', icon: Flame },
    { name: 'Giám Sát Logistics', path: '/admin/logistics', icon: Activity }
  ];

  const toggleNotificationRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleLogoutClick = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-[#070a13] text-slate-100 font-sans flex overflow-hidden">
      {/* Background dynamic ambient glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg bg-gradient-to-r from-blue-400 via-indigo-200 to-white bg-clip-text text-transparent">
                Món Ngon Tại Nhà
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Admin Control Panel
              </span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-inner'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-100 border border-transparent'
                  }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  <span className="text-sm tracking-wide">{item.name}</span>
                </div>
                {item.badge > 0 && !isActive && (
                  <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full animate-bounce">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar User profile Info & Sign out */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 p-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold uppercase shadow-inner">
              {user?.fullName ? user.fullName[0] : 'A'}
            </div>
            <div className="overflow-hidden">
              <span className="block text-sm font-bold text-slate-200 truncate">{user?.fullName || 'Administrator'}</span>
              <span className="block text-[10px] text-green-400 font-semibold tracking-wider uppercase">Online</span>
            </div>
          </div>
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl transition-all duration-200 text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Đăng Xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-20 bg-slate-900/40 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between z-20">
          {/* Left: Hamburger trigger */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 bg-slate-800/60 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent hidden sm:block">
              {menuItems.find(item => item.path === location.pathname)?.name || 'Admin Workspace'}
            </h1>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Live Clock */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-300 text-xs font-semibold tracking-wide">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{time.toLocaleDateString('vi-VN')}</span>
              <span className="text-slate-600">|</span>
              <span className="text-blue-400 tabular-nums">{time.toLocaleTimeString('vi-VN')}</span>
            </div>

            {/* Simulated Admin Notifications bells */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-slate-300 hover:text-white transition-all duration-200 relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    {/* Overlay to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3.5 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Thông báo khẩn cấp</span>
                        <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full">
                          {notifications.filter(n => !n.read).length} Mới
                        </span>
                      </div>
                      <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-slate-500 text-xs">
                            Không có thông báo mới
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                toggleNotificationRead(n.id);
                                setShowNotifications(false);
                                if (n.type === 'partner') navigate('/admin/partners');
                                else if (n.type === 'complaint') navigate('/admin/complaints');
                              }}
                              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${n.read
                                  ? 'bg-slate-950/20 border-slate-800 text-slate-400 hover:bg-slate-950/40'
                                  : 'bg-blue-600/5 border-blue-500/20 text-slate-200 hover:bg-blue-600/10'
                                }`}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <span className="block text-xs font-bold text-slate-200">{n.title}</span>
                                <span className="text-[8px] text-slate-500 shrink-0 font-semibold mt-0.5">
                                  {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <span className="block text-[10px] mt-0.5 leading-relaxed">{n.desc}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Back to Site link */}
            <Link
              to="/"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              Về Trang Khách
            </Link>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/20 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="max-w-7xl mx-auto h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
