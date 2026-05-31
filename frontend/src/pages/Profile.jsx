import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Edit2, Check, Star, ShoppingBag, Shield, Map, Ticket, BarChart3, Wallet, Percent, TrendingUp } from 'lucide-react';
import AddressesList from '../components/AddressesList';
import VouchersList from '../components/VouchersList';
import { getImageUrl } from '../utils/imageHelper';

const Profile = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', avatar: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location]);

  const [walletData, setWalletData] = useState({ wallet_balance: 0, transactions: [] });
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [processingTopup, setProcessingTopup] = useState(false);

  useEffect(() => {
    const fetchWallet = async () => {
      if (!user || activeTab !== 'wallet') return;
      setLoadingWallet(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/users/wallet`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setWalletData(res.data);
      } catch (error) {
        console.error('Error fetching wallet data', error);
      } finally {
        setLoadingWallet(false);
      }
    };
    fetchWallet();
  }, [activeTab, user]);

  const handleTopup = async (e) => {
    if (e) e.preventDefault();
    const amountVal = parseFloat(topupAmount);
    if (isNaN(amountVal) || amountVal < 10000) {
      alert('Số tiền nạp tối thiểu là 10.000đ');
      return;
    }
    setProcessingTopup(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/users/wallet/topup`, 
        { amount: amountVal },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        alert('Không tạo được yêu cầu nạp tiền');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi hệ thống khi nạp tiền');
    } finally {
      setProcessingTopup(false);
    }
  };

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(res.data);
        setFormData({ fullName: res.data.fullName, email: res.data.email || '', avatar: res.data.avatar || '' });
      } catch (error) {
        console.error('Error fetching profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setLoadingOrders(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/orders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrders(res.data);
      } catch (error) {
        console.error('Error fetching orders for stats', error);
      } finally {
        setLoadingOrders(false);
      }
    };
    if (activeTab === 'statistics') {
      fetchOrders();
    }
  }, [activeTab, user]);

  const getStats = () => {
    const completedOrders = orders.filter(o => o.order_Status === 'delivered');
    const cancelledOrders = orders.filter(o => o.order_Status === 'cancelled');
    
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.total_Amount, 0);
    const totalSaved = completedOrders.reduce((sum, o) => sum + (o.discount_Amount || 0), 0);
    
    const totalOrdersCount = orders.length;
    const completedCount = completedOrders.length;
    const cancelledCount = cancelledOrders.length;
    
    const successRate = totalOrdersCount > 0 
      ? Math.round((completedCount / totalOrdersCount) * 100) 
      : 0;
      
    const averageOrderValue = completedCount > 0 
      ? Math.round(totalSpent / completedCount) 
      : 0;

    let cashCount = 0;
    let onlineCount = 0;
    orders.forEach(o => {
      if (o.payment_Method === 'cash') cashCount++;
      if (o.payment_Method === 'online') onlineCount++;
    });
    
    let preferredPayment = 'Chưa có';
    if (cashCount > onlineCount) {
      preferredPayment = `Tiền mặt (${cashCount} đơn)`;
    } else if (onlineCount > cashCount) {
      preferredPayment = `Chuyển khoản (${onlineCount} đơn)`;
    } else if (cashCount > 0) {
      preferredPayment = `Đều nhau (Tiền mặt/Chuyển khoản)`;
    }

    const restaurantCounts = {};
    completedOrders.forEach(o => {
      restaurantCounts[o.name_Restaurant] = (restaurantCounts[o.name_Restaurant] || 0) + 1;
    });
    
    let favoriteRestaurant = 'Chưa có';
    let maxCount = 0;
    Object.entries(restaurantCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteRestaurant = `${name} (${count} lần đặt)`;
      }
    });

    return {
      totalSpent,
      totalSaved,
      totalOrdersCount,
      completedCount,
      cancelledCount,
      successRate,
      averageOrderValue,
      preferredPayment,
      favoriteRestaurant
    };
  };

  const stats = getStats();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({
      fullName: profile.fullName,
      email: profile.email || '',
      avatar: profile.avatar || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/users/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Cập nhật thành công!');
      setIsEditing(false);
      setProfile({ ...profile, ...formData });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Cập nhật thất bại!');
      console.error(error);
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative py-12 overflow-hidden bg-slate-50">
      {/* Food theme background watermark texture */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-fixed pointer-events-none -z-20 opacity-[0.06] filter blur-[1px]"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1600&auto=format&fit=crop')` }}
      />
      {/* Decorative blurred backdrop glow elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-200/35 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-blue-100/25 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Trang cá nhân</h1>

        {message && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-200 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar Info */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-orange-400 to-orange-500 z-0"></div>
              
              <div className="relative z-10">
                <div 
                  className={`w-24 h-24 mx-auto bg-white rounded-full p-1 mb-4 shadow-md relative ${isEditing ? 'cursor-pointer group' : ''}`}
                  onClick={() => isEditing && document.getElementById('avatar-upload').click()}
                >
                  <img 
                    src={getImageUrl(isEditing ? formData.avatar : profile.avatar, 'avatar')} 
                    alt="Avatar" 
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://ui-avatars.com/api/?name=' + (isEditing ? formData.fullName : profile.fullName) + '&background=f97316&color=fff';
                    }}
                  />
                  {isEditing && (
                    <div className="absolute inset-1 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {isEditing && (
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  )}
                </div>
                
                <h2 className="text-xl font-bold text-slate-800">{profile.fullName}</h2>
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600 mt-2">
                  <Shield className="w-3 h-3 text-orange-500" />
                  Thành viên
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-orange-500 flex justify-center items-center gap-1">
                      {profile.reputation_score} <Star className="w-4 h-4 fill-orange-500" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Điểm uy tín</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-700 flex justify-center items-center gap-1">
                      {profile.total_orders || 0} <ShoppingBag className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Đơn hàng</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <button onClick={() => setActiveTab('profile')} className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <User className="w-4 h-4" /> Thông tin cá nhân
                  </button>
                  <button onClick={() => setActiveTab('addresses')} className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'addresses' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Map className="w-4 h-4" /> Sổ địa chỉ
                  </button>
                  <button onClick={() => setActiveTab('vouchers')} className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'vouchers' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Ticket className="w-4 h-4" /> Kho Voucher
                  </button>
                  <button onClick={() => setActiveTab('wallet')} className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'wallet' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Wallet className="w-4 h-4" /> Ví điện tử
                  </button>
                  <button onClick={() => setActiveTab('statistics')} className={`text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'statistics' ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <BarChart3 className="w-4 h-4" /> Thống kê cá nhân
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Info Form */}
          {activeTab === 'profile' && (<div className="md:col-span-2 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Thông tin liên hệ</h3>
                <button 
                  onClick={() => isEditing ? handleCancelEdit() : setIsEditing(true)}
                  className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" /> {isEditing ? 'Hủy' : 'Chỉnh sửa'}
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled
                          value={profile.phone}
                          className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 sm:text-sm cursor-not-allowed"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Số điện thoại không thể thay đổi</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Họ và tên</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={isEditing ? formData.fullName : profile.fullName}
                          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                          className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl sm:text-sm transition-colors ${
                            isEditing 
                              ? 'border-slate-300 focus:ring-orange-500 focus:border-orange-500 bg-white' 
                              : 'border-transparent bg-slate-50 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          disabled={!isEditing}
                          value={isEditing ? formData.email : (profile.email || 'Chưa cập nhật')}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl sm:text-sm transition-colors ${
                            isEditing 
                              ? 'border-slate-300 focus:ring-orange-500 focus:border-orange-500 bg-white' 
                              : 'border-transparent bg-slate-50 text-slate-700'
                          }`}
                          placeholder="Cập nhật địa chỉ email"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ mặc định</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled
                          value={profile.default_Address_Text || 'Chưa thiết lập'}
                          className="block w-full pl-10 pr-3 py-2.5 border border-transparent bg-slate-50 rounded-xl sm:text-sm text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-6 py-2 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors mr-3"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors shadow-md"
                      >
                        Lưu thay đổi
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>)}

          {activeTab === 'addresses' && (
            <div className="md:col-span-2 animate-in fade-in slide-in-from-right-3 duration-300">
              <AddressesList />
            </div>
          )}

          {activeTab === 'vouchers' && (
            <div className="md:col-span-2 animate-in fade-in slide-in-from-right-3 duration-300">
              <VouchersList />
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-orange-500" /> Thống kê cá nhân
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Thông tin chi tiết về thói quen mua sắm của bạn</p>
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="p-12 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : (
                  <div className="p-6 space-y-6 animate-in fade-in duration-350">
                    {/* KPI Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card 1: Total Spent */}
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng tiền đã mua</div>
                          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.totalSpent.toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>

                      {/* Card 2: Completed Orders */}
                      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 flex-shrink-0">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đơn hoàn thành</div>
                          <div className="text-2xl font-black text-blue-600 mt-1">{stats.completedCount} / {stats.totalOrdersCount} đơn</div>
                        </div>
                      </div>

                      {/* Card 3: Total Saved */}
                      <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 flex-shrink-0">
                          <Percent className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiết kiệm (Voucher)</div>
                          <div className="text-2xl font-black text-orange-600 mt-1">{stats.totalSaved.toLocaleString('vi-VN')} đ</div>
                        </div>
                      </div>

                      {/* Card 4: Success Rate */}
                      <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 flex-shrink-0">
                          <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tỷ lệ thành công</div>
                          <div className="text-2xl font-black text-purple-600 mt-1">{stats.successRate}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown & Insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                      {/* Left: Chi tiết */}
                      <div className="space-y-4">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Chi tiết thói quen đặt hàng</h4>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 text-sm">
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/50">
                            <span className="text-slate-500 font-medium">Trung bình/đơn hàng:</span>
                            <span className="font-bold text-slate-800">{stats.averageOrderValue.toLocaleString('vi-VN')} đ</span>
                          </div>
                          <div className="flex justify-between items-center pb-3 border-b border-slate-200/50">
                            <span className="text-slate-500 font-medium">Phương thức thanh toán:</span>
                            <span className="font-bold text-slate-800">{stats.preferredPayment}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Quán quen yêu thích:</span>
                            <span className="font-bold text-orange-600 text-right max-w-[60%] truncate" title={stats.favoriteRestaurant}>{stats.favoriteRestaurant}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Trạng thái đơn hàng */}
                      <div className="space-y-4">
                        <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Phân tích trạng thái đơn</h4>
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-600">
                              <span>Đã nhận hàng ({stats.completedCount})</span>
                              <span>{stats.totalOrdersCount > 0 ? Math.round((stats.completedCount / stats.totalOrdersCount) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${stats.totalOrdersCount > 0 ? (stats.completedCount / stats.totalOrdersCount) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-600">
                              <span>Đã hủy đơn ({stats.cancelledCount})</span>
                              <span>{stats.totalOrdersCount > 0 ? Math.round((stats.cancelledCount / stats.totalOrdersCount) * 100) : 0}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-red-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${stats.totalOrdersCount > 0 ? (stats.cancelledCount / stats.totalOrdersCount) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          {(() => {
                            const otherCount = stats.totalOrdersCount - stats.completedCount - stats.cancelledCount;
                            return (
                              <div>
                                <div className="flex justify-between text-xs font-bold mb-1.5 text-slate-600">
                                  <span>Đang xử lý / Khác ({otherCount})</span>
                                  <span>{stats.totalOrdersCount > 0 ? Math.round((otherCount / stats.totalOrdersCount) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${stats.totalOrdersCount > 0 ? (otherCount / stats.totalOrdersCount) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="md:col-span-2 space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                    <Wallet className="text-orange-500 w-5 h-5" /> Ví điện tử của tôi
                  </h3>
                </div>
                
                {loadingWallet ? (
                  <div className="p-12 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-6 text-white shadow-lg shadow-orange-100 relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-6 translate-y-6">
                        <Wallet className="w-64 h-64" />
                      </div>
                      <span className="text-sm font-semibold uppercase tracking-wider opacity-80">Số dư hiện tại</span>
                      <h4 className="text-4xl font-black mt-2 mb-4">
                        {(Number(walletData.wallet_balance) || 0).toLocaleString('vi-VN')} đ
                      </h4>
                      <p className="text-xs opacity-90">Sử dụng để thanh toán nhanh chóng mọi đơn hàng mà không cần tiền mặt.</p>
                    </div>

                    {/* Topup Form */}
                    <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/50">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        Nạp tiền vào ví
                      </h4>
                      <form onSubmit={handleTopup} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Số tiền muốn nạp (đ)</label>
                          <input 
                            type="number"
                            required
                            min="10000"
                            step="1000"
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value)}
                            placeholder="Nhập số tiền (tối thiểu 10.000đ)"
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white font-bold"
                          />
                        </div>

                        {/* Predefined Amounts */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[50000, 100000, 200000, 500000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setTopupAmount(String(amt))}
                              className={`py-2 px-3 text-xs font-bold border rounded-lg transition-all ${topupAmount === String(amt) ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-350'}`}
                            >
                              {amt.toLocaleString('vi-VN')} đ
                            </button>
                          ))}
                        </div>

                        <button
                          type="submit"
                          disabled={processingTopup || !topupAmount}
                          className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer"
                        >
                          {processingTopup ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span>Đang chuyển hướng...</span>
                            </>
                          ) : (
                            <span>Nạp tiền ngay qua VNPAY</span>
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Transaction History */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-4">Lịch sử giao dịch</h4>
                      {walletData.transactions.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
                          Chưa có giao dịch nào được thực hiện.
                        </div>
                      ) : (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                          {walletData.transactions.map((tx) => {
                            const isPositive = tx.transaction_type === 'top_up' || tx.transaction_type === 'refund';
                            return (
                              <div key={tx.id_Transaction} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      tx.transaction_type === 'top_up' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                                      tx.transaction_type === 'payment' ? 'bg-blue-50 text-blue-700 border border-blue-150' :
                                      'bg-purple-50 text-purple-700 border border-purple-150'
                                    }`}>
                                      {tx.transaction_type === 'top_up' ? 'Nạp tiền' :
                                       tx.transaction_type === 'payment' ? 'Thanh toán' : 'Hoàn tiền'}
                                    </span>
                                    {tx.order_Code && (
                                      <span className="text-xs font-semibold text-slate-500">Đơn hàng: #{tx.order_Code}</span>
                                    )}
                                  </div>
                                  <p className="text-sm font-semibold text-slate-700">{tx.note}</p>
                                  <p className="text-[10px] text-slate-400">{new Date(tx.created_At).toLocaleString('vi-VN')}</p>
                                </div>
                                <div className="text-right">
                                  <span className={`font-extrabold text-sm ${isPositive ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {isPositive ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')} đ
                                  </span>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Số dư: {tx.balance_after.toLocaleString('vi-VN')}đ</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Profile;
