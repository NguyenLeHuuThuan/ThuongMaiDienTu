import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import RestaurantDetail from './pages/RestaurantDetail';
import FoodDetail from './pages/FoodDetail';
import Checkout from './pages/Checkout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Layout from './components/Layout';

// Restaurant Dashboard
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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="restaurant/:id" element={<RestaurantDetail />} />
              <Route path="food/:id" element={<FoodDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="orders" element={<Orders />} />
              <Route path="profile" element={<Profile />} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
            {/* Restaurant Owner Dashboard */}
            <Route path="/restaurant-dashboard" element={<RestaurantLayout />}>
              <Route index element={<RestaurantOrders />} />
              <Route path="orders" element={<RestaurantOrders />} />
              <Route path="menu" element={<RestaurantMenu />} />
              <Route path="promotions" element={<RestaurantPromotions />} />
              <Route path="analytics" element={<RestaurantAnalytics />} />
              <Route path="profile" element={<RestaurantProfile />} />
              <Route path="chat" element={<RestaurantChat />} />
            </Route>
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

