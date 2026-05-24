import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, ShoppingBag, Users, Store, TrendingUp, AlertCircle, 
  Terminal, ShieldCheck, RefreshCw, ChevronRight, BarChart3, PieChart
} from 'lucide-react';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    overview: {
      total_customers: 0,
      active_drivers: 0,
      active_restaurants: 0,
      total_orders: 0,
      total_revenue: 0,
      total_commissions: 0
    },
    orderSplit: [],
    topFoods: [],
    monthlyRevenue: [],
    recentLogs: []
  });

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối API. Vui lòng kiểm tra backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  if (loading) {
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
          <div className="h-96 bg-slate-900/60 border border-slate-800 rounded-2xl"></div>
        </div>
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

  const { overview, orderSplit, topFoods, monthlyRevenue, recentLogs } = stats;

  // Custom SVG Chart calculations
  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.revenue)) : 100000;
  const chartHeight = 160;
  const chartWidth = 500;

  return (
    <div className="space-y-6">
      {/* Overview Headings */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Trung Tâm Điều Hành Hệ Thống</h2>
          <p className="text-slate-400 text-sm">Thống kê doanh thu, đơn hàng và giám sát hoạt động thời gian thực.</p>
        </div>
        <button 
          onClick={fetchStats}
          className="self-start flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm Mới Số Liệu
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Doanh thu */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-blue-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Doanh Số</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{formatPrice(overview.total_revenue)}</span>
            <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full inline-block">
              +12.4% Tháng này
            </span>
          </div>
          <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Hoa hồng hệ thống */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Doanh Thu Hệ Thống</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{formatPrice(overview.total_commissions)}</span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">
              Commission 10%
            </span>
          </div>
          <div className="p-4 bg-emerald-600/10 text-emerald-400 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Đơn hàng */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-purple-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Đơn Hàng</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{overview.total_orders} đơn</span>
            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full inline-block">
              Hoàn tất 94%
            </span>
          </div>
          <div className="p-4 bg-purple-600/10 text-purple-400 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Cửa hàng & Shipper */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-amber-500/30 transition-all">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Đối Tác Hoạt Động</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">
              {overview.active_restaurants + overview.active_drivers} đối tác
            </span>
            <span className="text-[10px] text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded-full inline-block">
              {overview.active_restaurants} Res | {overview.active_drivers} Ship
            </span>
          </div>
          <div className="p-4 bg-amber-600/10 text-amber-400 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner">
            <Store className="w-6 h-6" />
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
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
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
