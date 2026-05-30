import { Outlet, Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';
import { Utensils, ShoppingCart, User, LogOut, Bell } from 'lucide-react';
import ChatWidget from './ChatWidget';

const Layout = () => {
  const { user, logout, unreadNotiCount } = useContext(AuthContext);
  const { carts } = useContext(CartContext);

  const totalItems = carts.reduce((acc, cart) => acc + cart.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Utensils className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight">MonNgonTaiNha</span>
            </Link>

            <nav className="hidden md:flex space-x-8">
              <Link to="/" className="text-slate-600 hover:text-orange-500 font-medium transition-colors">Trang chủ</Link>
              <Link to="/explore" className="text-slate-600 hover:text-orange-500 font-medium transition-colors">Khám phá</Link>
              {user && (
                <Link to="/orders" className="text-slate-600 hover:text-orange-500 font-medium transition-colors">Đơn hàng của tôi</Link>
              )}
            </nav>

            <div className="flex items-center gap-4">
              <Link to="/cart" className="relative p-2 text-slate-600 hover:text-orange-500 transition-colors">
                <ShoppingCart className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white">
                    {totalItems}
                  </span>
                )}
              </Link>

              {user && (
                <Link to="/notifications" className="relative p-2 text-slate-600 hover:text-orange-500 transition-colors">
                  <Bell className="w-6 h-6" />
                  {unreadNotiCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full border border-white transform translate-x-1/3 -translate-y-1/3 animate-pulse">
                      {unreadNotiCount}
                    </span>
                  )}
                </Link>
              )}
              
              {user ? (
                <div className="flex items-center gap-3">
                  <Link to="/profile" className="flex items-center gap-2 text-slate-700 font-medium hover:text-orange-500 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 border border-orange-200">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="hidden sm:inline">{user.fullName}</span>
                  </Link>
                  <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Đăng xuất">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="px-4 py-2 rounded-full bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors shadow-sm hover:shadow-md">
                  Đăng nhập
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Floating Chat Widget */}
      <ChatWidget />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-orange-500 rounded-md">
                <Utensils className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-white">MonNgonTaiNha</span>
            </div>
            <p className="text-slate-400 text-sm">Giao đồ ăn tận nơi, nhanh chóng và tiện lợi. Thưởng thức hàng ngàn món ngon ngay tại nhà.</p>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Liên kết</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-orange-400 transition-colors">Trang chủ</Link></li>
              <li><Link to="/explore" className="hover:text-orange-400 transition-colors">Khám phá món ăn</Link></li>
              <li><Link to="/orders" className="hover:text-orange-400 transition-colors">Theo dõi đơn hàng</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white mb-4">Liên hệ</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>Email: support@monngontainha.vn</li>
              <li>Hotline: 1900 1234</li>
              <li>Địa chỉ: 123 Nguyễn Văn Linh, Đà Nẵng</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
          &copy; {new Date().getFullYear()} MonNgonTaiNha. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
