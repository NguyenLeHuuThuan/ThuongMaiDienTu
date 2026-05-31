import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, MapPin, Truck, RefreshCw, Clock, CheckCircle2, AlertCircle, 
  Map, UserCheck, ShieldAlert, Compass, ChevronRight, Play, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LogisticsMonitor() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    stats: { activeOrders: 0, totalDrivers: 0, onlineDrivers: 0, deliveryRate: 98.4 },
    orders: [],
    drivers: []
  });

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'preparing' | 'ready' | 'delivering'
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Real-time Simulation States
  const [simStep, setSimStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLogs, setSimLogs] = useState([]);

  const fetchLogisticsData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/logistics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      
      // Auto select first active order for mini-map simulation if none selected
      if (res.data.orders.length > 0 && !selectedOrder) {
        setSelectedOrder(res.data.orders[0]);
      }
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến máy chủ tháp điều hành Logistics.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
    const interval = setInterval(() => {
      fetchLogisticsData(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Simulator Coordinates & Logs for active delivery
  const simCoordinates = [
    { x: 30, y: 110, label: 'Nhà hàng (Quán ăn)', desc: 'Tài xế đang đến nhà hàng lấy món...', coords: '10.7756, 106.7004' },
    { x: 75, y: 95, label: 'Đường Lê Lợi', desc: 'Đã nhận thức ăn, đang di chuyển trên đường Lê Lợi...', coords: '10.7782, 106.7032' },
    { x: 120, y: 70, label: 'Đại lộ Nguyễn Huệ', desc: 'Di chuyển qua vòng xoay Nguyễn Huệ...', coords: '10.7801, 106.7058' },
    { x: 165, y: 45, label: 'Đường Đồng Khởi', desc: 'Tài xế đang tiếp cận vị trí khách hàng...', coords: '10.7812, 106.7089' },
    { x: 210, y: 25, label: 'Điểm nhận hàng (Khách)', desc: 'Giao đồ ăn thành công cho khách hàng!', coords: '10.7825, 106.7112' }
  ];

  const triggerSimulation = () => {
    if (isSimulating || !selectedOrder) return;
    setIsSimulating(true);
    setSimStep(0);
    setSimLogs([`[10:24:50] Khởi động vận đơn #${selectedOrder.id_Order}: Phân phối tài xế ${selectedOrder.driver_name || 'Hệ thống tự động'}`]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setSimStep(step);
      
      const details = simCoordinates[step];
      if (details) {
        setSimLogs(prev => [
          `[${new Date().toLocaleTimeString('vi-VN')}] ${details.label}: ${details.desc} (${details.coords})`,
          ...prev
        ]);
      }

      if (step >= 4) {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 3000);
  };

  useEffect(() => {
    // Reset simulation when selected order changes
    setSimStep(0);
    setSimLogs([]);
    setIsSimulating(false);
  }, [selectedOrder]);

  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Chờ xác nhận', style: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' },
      confirmed: { text: 'Đang chuẩn bị', style: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
      preparing: { text: 'Đang chuẩn bị', style: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
      ready: { text: 'Đang lấy món', style: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' },
      delivering: { text: 'Đang giao hàng', style: 'bg-orange-500/10 border-orange-500/20 text-orange-400' }
    };
    return badges[status] || { text: status, style: 'bg-slate-800 border-slate-700 text-slate-400' };
  };

  const getDriverStateBadge = (state) => {
    const badges = {
      online: { text: 'Online', style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5 animate-pulse' },
      busy: { text: 'Đang Giao', style: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5' },
      offline: { text: 'Offline', style: 'bg-slate-800 border-slate-750 text-slate-500' }
    };
    return badges[state] || { text: state, style: 'bg-slate-800 text-slate-400' };
  };

  const filteredOrders = data.orders.filter(o => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'preparing') return o.status === 'preparing' || o.status === 'confirmed';
    return o.status === statusFilter;
  });

  if (loading && data.orders.length === 0) {
    return (
      <div className="space-y-6 flex flex-col justify-center items-center h-96 text-slate-400 text-xs">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">Khởi động Tháp điều hành vận đơn...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-slate-900/60 backdrop-blur-xl border border-red-500/25 text-center text-red-400 rounded-3xl space-y-4 max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
        <h3 className="text-slate-100 font-extrabold text-lg">Lỗi Tháp Điều Hành</h3>
        <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
        <button onClick={fetchLogisticsData} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer">
          Thử Lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity className="text-blue-500 animate-pulse" />
            Tháp Điều Hành Logistics Hệ Thống
          </h2>
          <p className="text-slate-400 text-sm font-semibold">Giám sát luồng đơn hàng thời gian thực, quản lý phân bố tài xế và mô phỏng lộ trình vận chuyển.</p>
        </div>
        <button 
          onClick={fetchLogisticsData}
          className="self-start flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm Mới Trực Tiếp
        </button>
      </div>

      {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-blue-500/20 transition-all">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Vận Đơn Đang Chạy</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-blue-400">{data.stats.activeOrders} đơn</span>
            <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full inline-block">
              Trạng thái thời gian thực
            </span>
          </div>
          <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-emerald-500/20 transition-all">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tài Xế Trực Tuyến</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-emerald-400">{data.stats.onlineDrivers} / {data.stats.totalDrivers}</span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-block">
              Đang hoạt động (Online)
            </span>
          </div>
          <div className="p-4 bg-emerald-600/10 text-emerald-400 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-orange-500/20 transition-all">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tỷ Lệ SLA Thành Công</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-orange-400">{data.stats.deliveryRate}%</span>
            <span className="text-[10px] text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded-full inline-block">
              Sát với KPI toàn quốc
            </span>
          </div>
          <div className="p-4 bg-orange-600/10 text-orange-400 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all shadow-inner">
            <Compass className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-pink-500/20 transition-all">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Thời Gian Giao Trung Bình</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-pink-400">22.5 phút</span>
            <span className="text-[10px] text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded-full inline-block">
              Tốc độ tối ưu thuật toán
            </span>
          </div>
          <div className="p-4 bg-pink-600/10 text-pink-400 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-all shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LOGISTICS CONTROL PANEL - 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Orders List Card */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-200 text-sm">Vận Đơn Đang Hoạt Động</h3>
                <p className="text-slate-500 text-[10px]">Tất cả đơn hàng đang di chuyển trong quy trình vận chuyển của hệ thống.</p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex flex-wrap gap-1 bg-slate-950/60 border border-slate-850 rounded-xl p-1 shrink-0">
                {[
                  { id: 'all', label: 'Tất Cả' },
                  { id: 'pending', label: 'Chờ Duyệt' },
                  { id: 'preparing', label: 'Chuẩn Bị' },
                  { id: 'ready', label: 'Lấy Món' },
                  { id: 'delivering', label: 'Đang Giao' }
                ].map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black cursor-pointer transition-all ${
                      statusFilter === f.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    {f.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Rows */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredOrders.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-800/40 bg-slate-950/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <Truck className="w-8 h-8 text-slate-600 animate-bounce" />
                  <span>Hiện không có vận đơn nào khớp với bộ lọc hiện tại.</span>
                </div>
              ) : (
                filteredOrders.map(o => {
                  const badge = getStatusBadge(o.status);
                  const isSelected = selectedOrder?.id_Order === o.id_Order;
                  return (
                    <div 
                      key={o.id_Order}
                      onClick={() => setSelectedOrder(o)}
                      className={`p-4 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-blue-600/10 border-blue-500/40 shadow-inner' 
                          : 'bg-slate-950/20 border-slate-850 hover:bg-slate-950/40'
                      }`}
                    >
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 border text-[9px] font-black uppercase rounded-lg ${badge.style}`}>
                            {badge.text}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 font-bold">ĐƠN: ORD#{o.id_Order}</span>
                        </div>
                        <span className="block text-xs font-black text-slate-250">
                          {o.restaurant_name} ➔ {o.customer_name}
                        </span>
                        <div className="flex gap-4 text-[9px] text-slate-500 font-semibold">
                          <span>Phí ship: <strong className="text-slate-400">{formatPrice(o.shipping_Fee)}</strong></span>
                          <span>Tài xế: <strong className="text-blue-400">{o.driver_name || 'Chưa gán tài xế'}</strong></span>
                        </div>
                      </div>

                      <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-slate-850 pt-2 sm:pt-0">
                        <span className="text-xs font-black text-slate-100">{formatPrice(o.total_Amount)}</span>
                        <span className="text-[9px] text-slate-500 block font-bold mt-0.5">
                          {new Date(o.created_At).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Shipper Monitor Table Card */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4 text-left">
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">Giám Sát Định Danh Tài Xế (Shippers)</h3>
              <p className="text-slate-500 text-[10px]">Quản lý danh sách Shipper, theo dõi hiệu năng vận hành và chất lượng dịch vụ.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[9px] font-black text-slate-500 border-b border-slate-800 uppercase tracking-wider text-left">
                    <th className="pb-2.5">Họ Tên</th>
                    <th className="pb-2.5 text-center">Trạng Thái</th>
                    <th className="pb-2.5 text-right">Tỷ Lệ Hoàn Thành</th>
                    <th className="pb-2.5 text-right">Tỷ Lệ Hủy Đơn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {data.drivers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-500 italic">Không có tài xế nào trên hệ thống</td>
                    </tr>
                  ) : (
                    data.drivers.map(d => {
                      const stateBadge = getDriverStateBadge(d.opStatus);
                      return (
                        <tr key={d.id_User} className="hover:bg-slate-950/10 transition-colors">
                          <td className="py-3 font-bold text-slate-350">{d.fullName}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 border text-[9px] font-black uppercase rounded-lg ${stateBadge.style}`}>
                              {stateBadge.text}
                            </span>
                          </td>
                          <td className="py-3 text-right text-emerald-400 font-extrabold">{d.successRate}%</td>
                          <td className="py-3 text-right text-rose-400 font-extrabold">{d.cancelRate}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* INTERACTIVE MINI-MAP VISUAL SIMULATOR - 1 Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-5 text-left flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-orange-500" />
                  <div>
                    <h3 className="font-extrabold text-slate-200 text-sm">Bản Đồ Vận Đơn Mini</h3>
                    <p className="text-slate-500 text-[10px]">Mô phỏng vị trí tài xế theo thời gian thực.</p>
                  </div>
                </div>
              </div>

              {selectedOrder ? (
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase block">Vận Đơn Đang Theo Dõi:</span>
                  <span className="text-xs font-black text-blue-400 block">ORD#{selectedOrder.id_Order}</span>
                  <div className="flex justify-between text-[10px] font-bold text-slate-350">
                    <span>Nhà hàng: {selectedOrder.restaurant_name}</span>
                    <span>Khách: {selectedOrder.customer_name}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950/10 border border-dashed border-slate-850 rounded-xl text-center text-slate-500 text-xs italic">
                  Vui lòng chọn 1 vận đơn để kích hoạt mô phỏng
                </div>
              )}
            </div>

            {/* Map Canvas SVG */}
            <div className="relative border border-slate-850 rounded-2xl bg-[#080d16] p-4 flex items-center justify-center min-h-[220px]">
              {selectedOrder && (
                <svg viewBox="0 0 240 140" className="w-full h-full overflow-visible">
                  {/* Grid Lines */}
                  {[0, 35, 70, 105, 140].map(val => (
                    <line key={`h_${val}`} x1="0" y1={val} x2="240" y2={val} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
                  ))}
                  {[0, 48, 96, 144, 192, 240].map(val => (
                    <line key={`v_${val}`} x1={val} y1="0" x2={val} y2="140" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2 2" />
                  ))}

                  {/* Connecting Route Line */}
                  <path 
                    d="M 30,110 Q 120,80 210,25" 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="2.5" 
                    strokeDasharray="4 4" 
                    className="opacity-70 animate-[dash_20s_linear_infinite]"
                  />

                  {/* Restaurant Node */}
                  <g className="cursor-pointer">
                    <circle cx="30" cy="110" r="8" fill="#1e1b4b" stroke="#3b82f6" strokeWidth="2" />
                    <circle cx="30" cy="110" r="3" fill="#3b82f6" />
                    <text x="30" y="125" textAnchor="middle" fill="#94a3b8" fontSize="6.5" fontWeight="bold">QUÁN ĂN</text>
                  </g>

                  {/* Customer Node */}
                  <g className="cursor-pointer">
                    <circle cx="210" cy="25" r="8" fill="#1c1917" stroke="#ec4899" strokeWidth="2" />
                    <circle cx="210" cy="25" r="3" fill="#ec4899" />
                    <text x="210" y="40" textAnchor="middle" fill="#94a3b8" fontSize="6.5" fontWeight="bold">KHÁCH HÀNG</text>
                  </g>

                  {/* Traveling Driver Node Icon */}
                  <motion.g 
                    animate={{ 
                      x: simCoordinates[simStep].x - 30, 
                      y: simCoordinates[simStep].y - 110 
                    }} 
                    transition={{ type: 'spring', stiffness: 50 }}
                    className="cursor-pointer"
                  >
                    {/* Ring Pulse */}
                    <circle cx="30" cy="110" r="12" fill="#f97316" fillOpacity="0.15" stroke="#f97316" strokeWidth="1" strokeDasharray="2 2" className="animate-ping" />
                    <circle cx="30" cy="110" r="6" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="30" cy="110" r="2.5" fill="#fff" />
                  </motion.g>
                </svg>
              )}
            </div>

            {/* Control buttons & Simulation Logs */}
            <div className="space-y-4">
              <button
                onClick={triggerSimulation}
                disabled={isSimulating || !selectedOrder}
                className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-lg shadow-orange-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider"
              >
                <Play className="w-3.5 h-3.5" />
                {isSimulating ? 'ĐANG MÔ PHỎNG...' : 'XEM LỘ TRÌNH'}
              </button>

              {/* Simulation logs list */}
              <div className="p-3 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2 h-24 overflow-y-auto custom-scrollbar text-[9px] font-mono leading-relaxed">
                {simLogs.length === 0 ? (
                  <div className="text-slate-500 italic text-center pt-6">Sẵn sàng nhận dữ liệu định vị (GPS).</div>
                ) : (
                  simLogs.map((log, i) => (
                    <div key={i} className="text-slate-350 border-b border-slate-900 pb-1 flex gap-1">
                      <ChevronRight className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                      <span>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
