import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, ShoppingBag, Users, Store, TrendingUp, AlertCircle, 
  Terminal, ShieldCheck, RefreshCw, ChevronRight, BarChart3, PieChart,
  Calendar, Filter, Receipt, Truck, ArrowUpDown, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date and filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // '7days' | '30days' | 'all'
  
  // Sorting state for daily earnings table
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [stats, setStats] = useState({
    overview: {
      total_customers: 0,
      active_drivers: 0,
      active_restaurants: 0,
      total_orders: 0,
      total_revenue: 0,
      total_commissions: 0,
      wallet_balance: 0
    },
    orderSplit: [],
    topFoods: [],
    monthlyRevenue: [],
    recentLogs: [],
    dailyEarnings: [],
    activeRates: {
      restaurantFeePercent: 15.0,
      shipperFeePercent: 5.0
    }
  });

  const fetchStats = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối API hoặc tải số liệu thống kê.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      fetchStats(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  const handleQuickFilter = (type) => {
    setQuickFilter(type);
    const today = new Date();
    if (type === '7days') {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setStartDate(past7.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else if (type === '30days') {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      setStartDate(past30.toISOString().slice(0, 10));
      setEndDate(today.toISOString().slice(0, 10));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN');
  };

  if (loading && stats.dailyEarnings.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-64 bg-slate-800 rounded-lg"></div>
          <div className="h-10 w-28 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-900/60 border border-slate-800 rounded-2xl p-6"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/40 backdrop-blur-xl border border-red-500/20 rounded-3xl text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-100 mb-2">Đã xảy ra lỗi hệ thống</h3>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error}</p>
        <button 
          onClick={fetchStats}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Thử Lại Ngay
        </button>
      </div>
    );
  }

  const { overview, orderSplit, topFoods, monthlyRevenue, recentLogs, dailyEarnings, activeRates } = stats;

  // Aggregate metrics from daily breakdown inside filtered range
  const totalRestaurantCuts = dailyEarnings?.reduce((acc, curr) => acc + (curr.restaurant_service_fee || 0), 0) || 0;
  const totalShipperCuts = dailyEarnings?.reduce((acc, curr) => acc + (curr.shipper_service_fee || 0), 0) || 0;
  const totalSystemEarningsInRange = totalRestaurantCuts + totalShipperCuts;
  
  // Total order sums within filter
  const totalOrdersCount = dailyEarnings?.reduce((acc, curr) => acc + (curr.order_count || 0), 0) || 0;

  // Custom SVG Chart calculations
  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.revenue)) : 100000;
  const chartHeight = 160;
  const chartWidth = 500;

  // Sort daily earnings
  const sortedDailyEarnings = [...(dailyEarnings || [])].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (sortField === 'date') {
      aVal = new Date(a.date).getTime();
      bVal = new Date(b.date).getTime();
    }
    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Overview Headings */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Trung Tâm Điều Hành Hệ Thống</h2>
          <p className="text-slate-400 text-sm font-semibold">Thống kê chi tiết doanh số, chiết khấu hoa hồng của nhà hàng và shipper toàn hệ thống.</p>
        </div>
        <button 
          onClick={fetchStats}
          className="self-start flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm Mới Số Liệu
        </button>
      </div>

      {/* FILTER CONTROL BAR PANEL */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-4 rounded-2xl shadow-xl flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-black text-slate-200 uppercase tracking-wider">Bộ lọc thống kê:</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          {/* Quick Filters */}
          <div className="flex bg-slate-950/60 border border-slate-800/80 rounded-xl p-1 w-full sm:w-auto">
            <button
              onClick={() => handleQuickFilter('all')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                quickFilter === 'all' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả thời gian
            </button>
            <button
              onClick={() => handleQuickFilter('7days')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                quickFilter === '7days' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => handleQuickFilter('30days')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                quickFilter === '30days' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 ngày qua
            </button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <input 
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
              />
            </div>
            <span className="text-slate-650 text-xs">➔</span>
            <div className="relative flex-1 sm:flex-initial">
              <input 
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setQuickFilter('custom');
                }}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Doanh thu */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Doanh Số</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{formatPrice(overview.total_revenue)}</span>
            <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full inline-block">
              +12.4% Hệ thống
            </span>
          </div>
          <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Tổng thu nhập chiết khấu trong kỳ lọc */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Doanh Thu Hệ Thống</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">
              {formatPrice(totalSystemEarningsInRange)}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
              Phí Nhà hàng + Shipper trích thu
            </span>
          </div>
          <div className="p-4 bg-emerald-600/10 text-emerald-400 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Đơn hàng trong kỳ lọc */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-purple-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đơn Hoàn Thành</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{totalOrdersCount} đơn</span>
            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full inline-block">
              Trong khoảng lọc hiện tại
            </span>
          </div>
          <div className="p-4 bg-purple-600/10 text-purple-400 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Ví Hệ Thống */}
        <div 
          onClick={() => navigate('/admin/wallet')}
          className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-pink-500/30 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="space-y-2 z-10 text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              Ví Hệ Thống <ChevronRight className="w-3.5 h-3.5 text-pink-500 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">
              {formatPrice(overview.wallet_balance || 0)}
            </span>
            <span className="text-[10px] text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded-full inline-block">
              Quản lý nạp, rút & dòng tiền
            </span>
          </div>
          <div className="p-4 bg-pink-600/10 text-pink-400 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-all shadow-inner z-10">
            <Wallet className="w-6 h-6 animate-pulse" />
          </div>
        </div>
      </div>

      {/* SYSTEM EARNINGS DYNAMIC DETAILS REPORT PANEL */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6 text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-md">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-100 tracking-tight">Phân Tích Chi Tiết Nguồn Phí Dịch Vụ Hệ Thống</h3>
              <p className="text-slate-400 text-xs">Đối chiếu tỷ lệ trích thu chiết khấu từ nhà hàng và tài xế shipper.</p>
            </div>
          </div>
          
          {/* Active rates badges */}
          <div className="flex flex-wrap gap-2.5">
            <div className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <Store className="w-3.5 h-3.5" />
              Chiết khấu Nhà hàng: {activeRates.restaurantFeePercent}%
            </div>
            <div className="px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <Truck className="w-3.5 h-3.5" />
              Chiết khấu Shipper: {activeRates.shipperFeePercent}%
            </div>
          </div>
        </div>

        {/* Dynamic breakdown aggregate display cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Từ Món Ăn Đối Tác ({activeRates.restaurantFeePercent}%)</span>
            <span className="text-lg font-black text-blue-400 block">{formatPrice(totalRestaurantCuts)}</span>
            <div className="w-full h-1 bg-slate-850 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${totalSystemEarningsInRange > 0 ? (totalRestaurantCuts / totalSystemEarningsInRange * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">Từ Phí Vận Chuyển ({activeRates.shipperFeePercent}%)</span>
            <span className="text-lg font-black text-indigo-400 block">{formatPrice(totalShipperCuts)}</span>
            <div className="w-full h-1 bg-slate-850 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-indigo-500 rounded-full" 
                style={{ width: `${totalSystemEarningsInRange > 0 ? (totalShipperCuts / totalSystemEarningsInRange * 100) : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-br from-emerald-600/10 to-teal-600/10 border border-emerald-500/20 rounded-xl space-y-1 shadow-inner relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
            <span className="text-[10px] text-slate-400 uppercase font-black block tracking-wider">Tổng Doanh Thu Hệ Thống Trích Thu</span>
            <span className="text-lg font-black text-emerald-400 block">{formatPrice(totalSystemEarningsInRange)}</span>
            <span className="text-[9px] text-slate-450 block italic">Tương đương {totalOrdersCount > 0 ? formatPrice(totalSystemEarningsInRange / totalOrdersCount) : '0đ'} / đơn hàng</span>
          </div>
        </div>

        {/* Daily breakdowns table */}
        <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/15">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                  <th onClick={() => handleSort('date')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Ngày <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('order_count')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Tổng Số Đơn <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('total_food_amount')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Doanh Số Món <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('total_shipping_fee')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Doanh Số Ship <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('restaurant_service_fee')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Phí Nhà Hàng ({activeRates.restaurantFeePercent}%) <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('shipper_service_fee')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none">
                    <div className="flex items-center gap-1">Phí Shipper ({activeRates.shipperFeePercent}%) <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                  <th onClick={() => handleSort('total_system_earnings')} className="px-5 py-3 cursor-pointer hover:bg-slate-900/60 select-none text-right">
                    <div className="flex items-center justify-end gap-1">Hệ Thống Thu Về <ArrowUpDown className="w-3.5 h-3.5" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {sortedDailyEarnings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-8 text-center text-slate-500 font-medium bg-slate-900/5">
                      Không tìm thấy dữ liệu thu phí dịch vụ nào trong khoảng lọc đã chọn.
                    </td>
                  </tr>
                ) : (
                  sortedDailyEarnings.map((day, i) => (
                    <tr key={i} className="hover:bg-slate-900/20 transition-all">
                      <td className="px-5 py-3.5 font-bold text-slate-350 font-mono">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 bg-slate-850 border border-slate-800 text-slate-300 font-bold rounded-lg inline-block">
                          {day.order_count} đơn hoàn tất
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-semibold">
                        {formatPrice(day.total_food_amount)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-semibold">
                        {formatPrice(day.total_shipping_fee)}
                      </td>
                      <td className="px-5 py-3.5 text-blue-400 font-bold">
                        {formatPrice(day.restaurant_service_fee)}
                      </td>
                      <td className="px-5 py-3.5 text-indigo-400 font-bold">
                        {formatPrice(day.shipper_service_fee)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-400 text-sm">
                        {formatPrice(day.total_system_earnings)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Doanh thu SVG Line Chart */}
        <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-slate-200 text-sm">Xu Hướng Doanh Số Hệ Thống</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">Theo Tháng</span>
          </div>

          {monthlyRevenue.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-xs">Không có dữ liệu biểu đồ.</div>
          ) : (
            <div className="relative pt-2">
              {/* Premium Custom SVG graph */}
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full overflow-visible">
                {/* SVG definitions for gradients */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#334155" />

                {/* Line Path Calculation */}
                {(() => {
                  const points = monthlyRevenue.map((m, index) => {
                    const x = (index / (monthlyRevenue.length - 1)) * chartWidth;
                    const y = chartHeight - (m.revenue / maxRevenue) * (chartHeight * 0.8) - 10;
                    return { x, y, label: m.month, val: m.revenue };
                  });

                  const pathD = points.reduce((acc, p, i) => 
                    i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, ''
                  );
                  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

                  return (
                    <>
                      {/* Area Fill */}
                      <path d={areaD} fill="url(#chartGradient)" />
                      {/* Stroke Line */}
                      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                      {/* Circle Dots */}
                      {points.map((p, i) => (
                        <g key={i} className="group/dot cursor-pointer">
                          <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
                          <circle cx={p.x} cy={p.y} r="9" fill="#3b82f6" className="opacity-0 group-hover/dot:opacity-20 transition-opacity" />
                          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold" className="opacity-0 group-hover/dot:opacity-100 transition-opacity bg-slate-900 px-1">
                            {formatPrice(p.val)}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
              {/* Bottom Labels */}
              <div className="flex justify-between mt-3 text-[10px] text-slate-500 font-bold px-1">
                {monthlyRevenue.map((m, i) => (
                  <span key={i}>{m.month}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trạng thái đơn hàng - Custom visual bars list */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-slate-200 text-sm">Trạng Thái Đơn Hàng</h3>
          </div>

          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {orderSplit.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-10">Không có đơn hàng nào.</div>
            ) : (
              orderSplit.map((item, idx) => {
                const colors = {
                  delivered: 'bg-emerald-500 text-emerald-400',
                  cancelled: 'bg-red-500 text-red-400',
                  preparing: 'bg-amber-500 text-amber-400',
                  pending: 'bg-blue-500 text-blue-400',
                  confirmed: 'bg-indigo-500 text-indigo-400'
                };
                const colorClass = colors[item.order_Status] || 'bg-slate-500 text-slate-400';
                const total = orderSplit.reduce((acc, curr) => acc + curr.count, 0);
                const percent = ((item.count / total) * 100).toFixed(0);

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-300 capitalize">{item.order_Status}</span>
                      <span className="font-bold text-slate-400">{item.count} đơn ({percent}%)</span>
                    </div>
                    <div className="h-2 bg-slate-800/80 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colorClass.split(' ')[0]}`} style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* LOWER GRID: MONITORS & POPULAR FOOD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time System Monitoring Terminal Logs */}
        <div className="lg:col-span-2 bg-[#0b0f19] border border-slate-800/85 p-6 rounded-2xl shadow-xl flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-slate-200 text-sm tracking-tight">System Monitor & Audit Logs</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Live Feed Active
            </div>
          </div>

          {/* Logs terminal box */}
          <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-xl overflow-auto p-4 custom-scrollbar text-xs font-mono space-y-2">
            {recentLogs.length === 0 ? (
              <div className="text-slate-500 italic">No system audit records found.</div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id_Log} className="border-b border-slate-900 pb-2 last:border-0 hover:bg-slate-900/30 p-1 rounded transition-colors">
                  <span className="text-slate-500 text-[10px] mr-2">[{new Date(log.created_At).toLocaleTimeString('vi-VN')}]</span>
                  <span className="text-indigo-400 mr-1.5">[{log.user_name || 'Hệ thống'}]</span>
                  <span className="text-amber-500 font-semibold mr-1.5">{log.action}</span>
                  <span className="text-slate-400 mr-2">entity:{log.entity} #{log.id_Entity}</span>
                  {log.new_Value && (
                    <span className="text-slate-500 block text-[10px] pl-4 truncate">
                      params: {log.new_Value}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top-selling items list */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between h-[400px]">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-slate-200 text-sm">Món Ăn Bán Chạy Nhất</h3>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1 custom-scrollbar">
              {topFoods.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-12">Không có dữ liệu bán chạy.</div>
              ) : (
                topFoods.map((food, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-800/40 pb-3 last:border-b-0 last:pb-0 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-slate-800 flex items-center justify-center text-slate-300 font-black text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate max-w-[140px]">
                          {food.name}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{food.name_Restaurant}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-300 bg-slate-800/80 px-2 py-1 rounded-lg">
                      {food.sold_quantity} đã bán
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2">
            <span className="block text-[10px] text-slate-500 font-bold text-center uppercase tracking-widest border-t border-slate-800/60 pt-3">
              Cập nhật định kỳ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
