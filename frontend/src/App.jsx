import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import RegisterRestaurant from './pages/RegisterRestaurant';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import RestaurantDetail from './pages/RestaurantDetail';
import FoodDetail from './pages/FoodDetail';
import Checkout from './pages/Checkout';
import VnPayReturn from './pages/VnPayReturn';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';
import Layout from './components/Layout';

// Admin Imports
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import PartnerApproval from './pages/admin/PartnerApproval';
import SystemConfig from './pages/admin/SystemConfig';
import ComplaintManagement from './pages/admin/ComplaintManagement';
import CategoryManagement from './pages/admin/CategoryManagement';
import CampaignManagement from './pages/admin/CampaignManagement';
import WalletManagement from './pages/admin/WalletManagement';
import LogisticsMonitor from './pages/admin/LogisticsMonitor';

// Restaurant Imports
import RestaurantLayout from './components/RestaurantLayout';
import RestaurantOrders from './pages/restaurant/RestaurantOrders';
import RestaurantMenu from './pages/restaurant/RestaurantMenu';
import RestaurantPromotions from './pages/restaurant/RestaurantPromotions';
import RestaurantAnalytics from './pages/restaurant/RestaurantAnalytics';
import RestaurantProfile from './pages/restaurant/RestaurantProfile';
import RestaurantChat from './pages/restaurant/RestaurantChat';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ChatProvider>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register-restaurant" element={<RegisterRestaurant />} />
            
            {/* Customer Routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="restaurant/:id" element={<RestaurantDetail />} />
              <Route path="food/:id" element={<FoodDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="vnpay-return" element={<VnPayReturn />} />
              <Route path="orders" element={<Orders />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>

            {/* Restaurant Routes */}
            <Route path="/restaurant-dashboard" element={<RestaurantLayout />}>
              <Route index element={<RestaurantOrders />} />
              <Route path="orders" element={<RestaurantOrders />} />
              <Route path="menu" element={<RestaurantMenu />} />
              <Route path="promotions" element={<RestaurantPromotions />} />
              <Route path="analytics" element={<RestaurantAnalytics />} />
              <Route path="profile" element={<RestaurantProfile />} />
              <Route path="chat" element={<RestaurantChat />} />
            </Route>

            {/* Admin Routes (Isolated from other developers) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="partners" element={<PartnerApproval />} />
              <Route path="configs" element={<SystemConfig />} />
              <Route path="complaints" element={<ComplaintManagement />} />
              <Route path="categories" element={<CategoryManagement />} />
              <Route path="campaigns" element={<CampaignManagement />} />
              <Route path="wallet" element={<WalletManagement />} />
              <Route path="logistics" element={<LogisticsMonitor />} />
            </Route>
          </Routes>
          </ChatProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

