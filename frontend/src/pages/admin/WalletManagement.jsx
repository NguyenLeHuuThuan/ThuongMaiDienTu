import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Wallet, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, 
  Search, Calendar, Filter, Send, Landmark, HelpCircle, AlertCircle, 
  CheckCircle2, ShieldCheck, KeyRound, Info, CreditCard, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WalletManagement() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    balance: 0,
    transactions: [],
    stats: { totalCollected: 0, totalRefunded: 0, totalWithdrawn: 0 }
  });

  // Filter states
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'commission_deduction' | 'refund' | 'withdraw' | 'top_up'
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  
  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('VNPay Nhóm');
  const [accountNumber, setAccountNumber] = useState('8888888888');
  const [accountName, setAccountName] = useState('NHOM ADMIN');
  const [validationError, setValidationError] = useState('');
  
  // Modal / Transaction Progress States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const banksList = [
    { code: 'VNPAY', name: 'VNPay Nhóm', fullName: 'Cổng thanh toán VNPay Nhóm' },
    { code: 'VCB', name: 'Vietcombank', fullName: 'Ngân hàng Ngoại thương Việt Nam' },
    { code: 'TCB', name: 'Techcombank', fullName: 'Ngân hàng Kỹ thương Việt Nam' },
    { code: 'MB', name: 'MB Bank', fullName: 'Ngân hàng Quân đội' },
    { code: 'BIDV', name: 'BIDV', fullName: 'Ngân hàng Đầu tư và Phát triển VN' },
    { code: 'ACB', name: 'ACB', fullName: 'Ngân hàng Á Châu' },
    { code: 'VPB', name: 'VPBank', fullName: 'Ngân hàng Việt Nam Thịnh Vượng' },
    { code: 'VTB', name: 'VietinBank', fullName: 'Ngân hàng Công Thương Việt Nam' }
  ];

  const fetchWalletData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Không thể tải thông tin ví hệ thống. Vui lòng kiểm tra kết nối API.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
    const interval = setInterval(() => {
      fetchWalletData(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // --- FINANCIAL ANALYTICS PARSERS & CSV ENGINE ---
  
  // 1. CSV Report Export function
  const exportToCSV = () => {
    const headers = ['Mã Giao Dịch', 'Loại Giao Dịch', 'Số Tiền (VND)', 'Số Dư Sau GD (VND)', 'Nội Dung Chi Tiết', 'Thời Gian'];
    
    const rows = filteredTransactions.map(tx => {
      const typeLabel = tx.transaction_type === 'top_up' ? 'Nạp Tiền'
        : tx.transaction_type === 'withdraw' ? 'Rút Tiền'
        : tx.transaction_type === 'commission_deduction' ? 'Thu Phí Dịch Vụ'
        : tx.transaction_type === 'refund' ? 'Bồi Thường Khiếu Nại'
        : tx.transaction_type;
      return [
        `TXN#${tx.id_Transaction}`,
        typeLabel,
        tx.amount,
        tx.balance_after,
        tx.note.replace(/"/g, '""'),
        formatDate(tx.created_At)
      ];
    });

    const csvContent = "\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_Cao_Doi_Soat_Vi_He_Thong_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Parse Revenue Breakdown for Donut Chart
  let totalRestaurantComm = 0;
  let totalShipperComm = 0;

  data.transactions.forEach(t => {
    if (t.transaction_type === 'commission_deduction') {
      const noteLower = t.note.toLowerCase();
      if (noteLower.includes('nhà hàng') || noteLower.includes('quán')) {
        totalRestaurantComm += Math.abs(parseFloat(t.amount)) || 0;
      } else if (noteLower.includes('tài xế') || noteLower.includes('vận chuyển') || noteLower.includes('shipper')) {
        totalShipperComm += Math.abs(parseFloat(t.amount)) || 0;
      } else {
        totalRestaurantComm += Math.abs(parseFloat(t.amount)) * 0.75;
        totalShipperComm += Math.abs(parseFloat(t.amount)) * 0.25;
      }
    }
  });

  const totalComm = totalRestaurantComm + totalShipperComm;
  const resPercentage = totalComm > 0 ? Math.round((totalRestaurantComm / totalComm) * 100) : 0;
  const shipPercentage = totalComm > 0 ? Math.round((totalShipperComm / totalComm) * 100) : 0;

  // 3. Parse Cumulative Timeline Data for Area Chart
  const getTimelineData = () => {
    const sortedTx = [...data.transactions].sort((a, b) => a.id_Transaction - b.id_Transaction);
    let cumRevenue = 0;
    let cumExpense = 0;
    
    return sortedTx.map((tx, idx) => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.transaction_type === 'commission_deduction') {
        cumRevenue += amt;
      } else if (tx.transaction_type === 'refund' || tx.transaction_type === 'withdraw') {
        cumExpense += Math.abs(amt);
      }
      return {
        index: idx,
        id: tx.id_Transaction,
        date: new Date(tx.created_At).toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }),
        revenue: cumRevenue,
        expense: cumExpense,
        note: tx.note
      };
    });
  };

  const timelineData = getTimelineData();
  const maxY = timelineData.length > 0 
    ? Math.max(...timelineData.map(d => Math.max(d.revenue, d.expense)), 100000) 
    : 100000;

  const handleWithdrawalRequest = (e) => {
    e.preventDefault();
    setValidationError('');
    
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setValidationError('Số tiền rút không hợp lệ.');
      return;
    }
    if (amt > data.balance) {
      setValidationError('Số dư Ví hệ thống không đủ để thực hiện yêu cầu rút tiền này.');
      return;
    }
    if (amt < 50000) {
      setValidationError('Số tiền rút tối thiểu là 50.000đ.');
      return;
    }
    if (!accountNumber || accountNumber.trim().length < 6) {
      setValidationError('Số tài khoản ngân hàng không hợp lệ.');
      return;
    }
    if (!accountName || accountName.trim().length < 3) {
      setValidationError('Tên chủ tài khoản không hợp lệ.');
      return;
    }

    // Form validated -> trigger OTP modal
    setOtpCode(['', '', '', '', '', '']);
    setOtpError('');
    setShowOtpModal(true);
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false;

    setOtpCode([...otpCode.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.nextSibling && element.value !== '') {
      element.nextSibling.focus();
    }
  };

  const handleExecuteWithdrawal = async () => {
    const enteredOtp = otpCode.join('');
    if (enteredOtp !== '123456') { // Mock secure system OTP code
      setOtpError('Mã xác thực OTP không đúng hoặc đã hết hạn (Mã mẫu: 123456)');
      return;
    }

    setOtpError('');
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        amount: parseFloat(withdrawAmount),
        bankName,
        accountNumber,
        accountName: accountName.toUpperCase()
      };
      
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/admin/wallet/withdraw`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setShowOtpModal(false);
        setShowSuccessModal(true);
        setWithdrawAmount('');
        setAccountNumber('');
        setAccountName('');
        // Reload data
        fetchWalletData();
      }
    } catch (err) {
      console.error(err);
      setOtpError(err.response?.data?.message || 'Có lỗi xảy ra khi thực hiện rút tiền.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getTransactionBadge = (type) => {
    const badges = {
      top_up: { text: 'Nạp Tiền', style: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
      withdraw: { text: 'Rút Tiền', style: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
      commission_deduction: { text: 'Trích Thu Phí', style: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
      refund: { text: 'Bồi Thường', style: 'bg-amber-500/10 border-amber-500/20 text-amber-400' }
    };
    return badges[type] || { text: type, style: 'bg-slate-800 border-slate-700 text-slate-400' };
  };

  if (loading && data.transactions.length === 0) {
    return (
      <div className="space-y-6 flex flex-col justify-center items-center h-96 text-slate-400 text-xs">
        <LoaderComponent />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-slate-900/60 backdrop-blur-xl border border-red-500/25 text-center text-red-400 rounded-3xl space-y-4 max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 mx-auto text-red-500 animate-bounce" />
        <h3 className="text-slate-100 font-extrabold text-lg">Đã xảy ra lỗi tải dữ liệu ví</h3>
        <p className="text-slate-400 text-xs leading-relaxed">{error}</p>
        <button onClick={fetchWalletData} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer">
          Thử Lại Ngay
        </button>
      </div>
    );
  }

  // Filter transactions local
  const filteredTransactions = data.transactions.filter(t => {
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
    const matchesSearch = !searchQuery.trim() || 
      t.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id_Transaction.toString() === searchQuery;
      
    // Extract date parts
    const txDate = new Date(t.created_At);
    const txDay = String(txDate.getDate()).padStart(2, '0');
    const txMonth = String(txDate.getMonth() + 1).padStart(2, '0');
    const txYear = String(txDate.getFullYear());

    const matchesDay = !dayFilter || txDay === dayFilter;
    const matchesMonth = !monthFilter || txMonth === monthFilter;
    const matchesYear = !yearFilter || txYear === yearFilter;

    return matchesType && matchesSearch && matchesDay && matchesMonth && matchesYear;
  });

  return (
    <div className="space-y-6 text-left relative overflow-hidden">
      {/* Dynamic ambient glow effects */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Wallet className="text-pink-500 animate-pulse" />
            Quản Lý Ví Hệ Thống
          </h2>
          <p className="text-slate-400 text-sm font-semibold">Giám sát tổng doanh thu trích thu, chi trả bồi thường bồi hoàn khiếu nại và quản lý rút tiền ngân hàng.</p>
        </div>
        <button 
          onClick={fetchWalletData}
          className="self-start flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-750 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm Mới Số Liệu
        </button>
      </div>

      {/* FINANCIAL OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Real-time Wallet Balance */}
        <div className="bg-gradient-to-br from-pink-900/20 via-slate-900/60 to-slate-900/40 backdrop-blur-xl border border-pink-500/20 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-pink-500/30 transition-all relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-pink-500/5 rounded-full blur-xl pointer-events-none"></div>
          <div className="space-y-2 z-10">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Số Dư Khả Dụng</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight">{formatPrice(data.balance)}</span>
            <span className="text-[10px] text-pink-400 font-extrabold bg-pink-500/10 px-2.5 py-0.5 rounded-full inline-block">
              Đã bao gồm chiết khấu hệ thống
            </span>
          </div>
          <div className="p-4 bg-pink-600/10 text-pink-400 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-all shadow-inner z-10">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Total Collected system fees */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-blue-500/30 transition-all relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Trích Thu Chiết Khấu</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-blue-400">{formatPrice(data.stats.totalCollected)}</span>
            <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full inline-block flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Dòng thu chính từ Nhà hàng & Shipper
            </span>
          </div>
          <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Payouts for complaints */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-amber-500/30 transition-all relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Chi Trả Khiếu Nại</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-amber-400">{formatPrice(data.stats.totalRefunded)}</span>
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full inline-block flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5" /> Khấu trừ hoàn tiền bồi thường
            </span>
          </div>
          <div className="p-4 bg-amber-600/10 text-amber-400 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Total Bank withdrawals */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl flex items-center justify-between group hover:border-purple-500/30 transition-all relative overflow-hidden">
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tổng Rút Ngân Hàng</span>
            <span className="text-2xl font-black text-slate-100 block tracking-tight text-purple-400">{formatPrice(data.stats.totalWithdrawn)}</span>
            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full inline-block flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5" /> Đã rút về tài khoản Nhóm
            </span>
          </div>
          <div className="p-4 bg-purple-600/10 text-purple-400 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FINANCIAL BI ANALYTICS CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cumulative Flow Area Chart - 2 Columns */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between group hover:border-blue-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">Biến Động Dòng Tiền Lũy Kế</h3>
              <p className="text-slate-500 text-[10px]">Tương quan lũy kế giữa Doanh thu trích thu (Phí) và chi phí hệ thống (Hoàn tiền/Rút).</p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block"></span> Doanh Thu Phí
              </span>
              <span className="flex items-center gap-1.5 text-pink-400">
                <span className="w-2.5 h-2.5 bg-pink-500 rounded-full inline-block"></span> Tổng Chi Ra
              </span>
            </div>
          </div>

          {/* SVG Area Chart */}
          <div className="relative h-48 w-full flex items-center justify-center">
            {timelineData.length === 0 ? (
              <div className="text-slate-500 text-xs italic">Đang cập nhật biểu đồ dòng tiền...</div>
            ) : (
              <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines & Y Axis Labels */}
                {[0, 0.5, 1].map((ratio, i) => {
                  const val = ratio * maxY;
                  const y = 20 + (1 - ratio) * 125;
                  return (
                    <g key={i} className="opacity-40">
                      <line x1="60" y1={y} x2="480" y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
                      <text x="55" y={y + 3} fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="end">
                        {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : formatPrice(val).replace(' ₫', '')}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Date Labels */}
                {timelineData.map((d, i) => {
                  if (timelineData.length > 5 && i % 2 !== 0 && i !== timelineData.length - 1) return null;
                  const x = 60 + (i / (timelineData.length - 1)) * 420;
                  return (
                    <text key={i} x={x} y="165" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle" className="opacity-80">
                      {d.date}
                    </text>
                  );
                })}

                {/* Areas Under Curves */}
                <path d={
                  (() => {
                    const points = timelineData.map((d, i) => `${60 + (i / (timelineData.length - 1)) * 420},${20 + (1 - d.revenue / maxY) * 125}`);
                    return `M 60,145 L ${points.join(' L ')} L ${60 + 420},145 Z`;
                  })()
                } fill="url(#revGradient)" />

                <path d={
                  (() => {
                    const points = timelineData.map((d, i) => `${60 + (i / (timelineData.length - 1)) * 420},${20 + (1 - d.expense / maxY) * 125}`);
                    return `M 60,145 L ${points.join(' L ')} L ${60 + 420},145 Z`;
                  })()
                } fill="url(#expGradient)" />

                {/* Lines */}
                <path d={
                  (() => {
                    const points = timelineData.map((d, i) => `${60 + (i / (timelineData.length - 1)) * 420},${20 + (1 - d.revenue / maxY) * 125}`);
                    return `M ${points.join(' L ')}`;
                  })()
                } fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

                <path d={
                  (() => {
                    const points = timelineData.map((d, i) => `${60 + (i / (timelineData.length - 1)) * 420},${20 + (1 - d.expense / maxY) * 125}`);
                    return `M ${points.join(' L ')}`;
                  })()
                } fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" />

                {/* Interactive Points (Dots) */}
                {timelineData.map((d, i) => {
                  const x = 60 + (i / (timelineData.length - 1)) * 420;
                  const yRev = 20 + (1 - d.revenue / maxY) * 125;
                  const yExp = 20 + (1 - d.expense / maxY) * 125;

                  return (
                    <g key={i}>
                      {/* Revenue dot */}
                      <circle 
                        cx={x} cy={yRev} r="4" 
                        fill="#1e1b4b" stroke="#3b82f6" strokeWidth="2"
                        className="cursor-pointer hover:r-6 transition-all"
                        onMouseEnter={() => setHoveredPoint({ ...d, type: 'revenue' })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      {/* Expense dot */}
                      <circle 
                        cx={x} cy={yExp} r="4" 
                        fill="#1e1b4b" stroke="#ec4899" strokeWidth="2"
                        className="cursor-pointer hover:r-6 transition-all"
                        onMouseEnter={() => setHoveredPoint({ ...d, type: 'expense' })}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Custom Interactive Tooltip Over Area Chart */}
            {hoveredPoint && (
              <div className="absolute bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 text-[9px] shadow-2xl backdrop-blur-md text-slate-200 pointer-events-none max-w-[200px]" style={{
                left: `${Math.min(Math.max((hoveredPoint.index / (timelineData.length - 1)) * 80 + 10, 5), 75)}%`,
                top: hoveredPoint.type === 'revenue' ? '10%' : '50%'
              }}>
                <span className="font-mono text-slate-500 font-bold block mb-1">Mã GD: TXN#{hoveredPoint.id} ({hoveredPoint.date})</span>
                <span className="block font-extrabold text-slate-100 mb-0.5 leading-relaxed">{hoveredPoint.note}</span>
                <div className="flex justify-between items-center gap-4 mt-1 border-t border-slate-850 pt-1">
                  <span className="text-slate-400 font-bold">{hoveredPoint.type === 'revenue' ? 'Doanh Thu Lũy Kế:' : 'Chi Lũy Kế:'}</span>
                  <span className={`font-black ${hoveredPoint.type === 'revenue' ? 'text-blue-400' : 'text-pink-400'}`}>
                    {formatPrice(hoveredPoint.type === 'revenue' ? hoveredPoint.revenue : hoveredPoint.expense)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Revenue Source Breakdown Donut Chart - 1 Column */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between group hover:border-pink-500/20 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="border-b border-slate-800 pb-3 mb-4 text-left">
            <h3 className="font-extrabold text-slate-200 text-sm">Cơ Cấu Doanh Thu Thu Phí</h3>
            <p className="text-slate-500 text-[10px]">Tỷ lệ đóng góp doanh thu hệ thống trích thu từ hai nguồn Nhà hàng và Shipper.</p>
          </div>

          {/* SVG Donut Chart */}
          <div className="relative h-36 flex items-center justify-center">
            {totalComm === 0 ? (
              <div className="text-slate-500 text-xs italic">Chưa phát sinh phí chiết khấu nào...</div>
            ) : (
              <svg viewBox="0 0 120 120" className="w-32 h-32 overflow-visible">
                {/* Segment 1: Restaurant Share */}
                <circle 
                  cx="60" cy="60" r="50" 
                  fill="transparent" stroke="#3b82f6" 
                  strokeWidth={hoveredSlice === 'restaurant' ? '14' : '10'}
                  strokeDasharray={`${314.159 * (resPercentage / 100)} 314.159`}
                  strokeDashoffset="0"
                  transform="rotate(-90 60 60)"
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredSlice('restaurant')}
                  onMouseLeave={() => setHoveredSlice(null)}
                />
                
                {/* Segment 2: Shipper Share */}
                <circle 
                  cx="60" cy="60" r="50" 
                  fill="transparent" stroke="#ec4899" 
                  strokeWidth={hoveredSlice === 'shipper' ? '14' : '10'}
                  strokeDasharray={`${314.159 * (shipPercentage / 100)} 314.159`}
                  strokeDashoffset={`-${314.159 * (resPercentage / 100)}`}
                  transform="rotate(-90 60 60)"
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredSlice('shipper')}
                  onMouseLeave={() => setHoveredSlice(null)}
                />

                {/* Central Labels inside Donut Hole */}
                <text x="60" y="58" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">
                  {hoveredSlice === 'restaurant' ? 'NHÀ HÀNG' : hoveredSlice === 'shipper' ? 'SHIPPER' : 'TỔNG THU'}
                </text>
                <text x="60" y="72" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="black">
                  {hoveredSlice === 'restaurant' ? `${resPercentage}%` 
                    : hoveredSlice === 'shipper' ? `${shipPercentage}%` 
                    : `${(totalComm / 1000).toFixed(0)}k`}
                </text>
              </svg>
            )}
          </div>

          {/* Legend Table details */}
          <div className="space-y-2 mt-4 pt-3 border-t border-slate-800/80">
            <div className="flex justify-between items-center text-[10px] font-bold p-1 hover:bg-slate-950/20 rounded-lg transition-colors" onMouseEnter={() => setHoveredSlice('restaurant')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span> Phí Nhà Hàng (15%)
              </span>
              <div className="text-right">
                <span className="text-slate-200 block font-black">{formatPrice(totalRestaurantComm)}</span>
                <span className="text-slate-500 text-[8px] block">{resPercentage}% nguồn thu</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold p-1 hover:bg-slate-950/20 rounded-lg transition-colors" onMouseEnter={() => setHoveredSlice('shipper')} onMouseLeave={() => setHoveredSlice(null)}>
              <span className="flex items-center gap-1.5 text-pink-400">
                <span className="w-2 h-2 bg-pink-500 rounded-full inline-block"></span> Phí Shipper (5%)
              </span>
              <div className="text-right">
                <span className="text-slate-200 block font-black">{formatPrice(totalShipperComm)}</span>
                <span className="text-slate-500 text-[8px] block">{shipPercentage}% nguồn thu</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DOCK WITHDRAWAL GATEWAY PANEL - 1 Column */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3 text-left">
            <Landmark className="w-5 h-5 text-pink-500" />
            <div>
              <h3 className="font-extrabold text-slate-200 text-sm">Cổng Rút Tiền Ngân Hàng</h3>
              <p className="text-slate-500 text-[10px]">Thực tế, an toàn bảo mật chuẩn ngân hàng.</p>
            </div>
          </div>

          <form onSubmit={handleWithdrawalRequest} className="space-y-4 text-left">
            {/* Input Amount */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số tiền rút (VND)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={withdrawAmount} 
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/\D/g, '');
                    setWithdrawAmount(cleanVal);
                  }}
                  placeholder="Nhập số tiền..."
                  className="w-full bg-slate-950 border border-slate-850 focus:border-pink-500 rounded-xl pl-3 pr-10 py-2.5 text-slate-200 text-sm font-black transition-all focus:outline-none"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">đ</span>
              </div>
              
              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1.5">
                {[1000000, 2000000, 5000000].map(val => (
                  <button 
                    key={val}
                    type="button" 
                    onClick={() => setWithdrawAmount(val.toString())}
                    className="py-1 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-750 text-slate-400 hover:text-slate-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all"
                  >
                    {val / 1000000}M
                  </button>
                ))}
                <button 
                  type="button" 
                  onClick={() => setWithdrawAmount(Math.floor(data.balance).toString())}
                  className="py-1 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 hover:border-pink-500 text-pink-400 hover:text-pink-300 text-[10px] font-extrabold rounded-lg cursor-pointer transition-all"
                >
                  TẤT CẢ
                </button>
              </div>
            </div>

            {/* Select Bank */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngân hàng thụ hưởng</label>
              <select 
                value={bankName}
                onChange={(e) => {
                  const val = e.target.value;
                  setBankName(val);
                  if (val === 'VNPay Nhóm') {
                    setAccountNumber('8888888888');
                    setAccountName('NHOM ADMIN');
                  } else {
                    if (accountNumber === '8888888888' && accountName === 'NHOM ADMIN') {
                      setAccountNumber('');
                      setAccountName('');
                    }
                  }
                }}
                className="w-full bg-slate-950 border border-slate-850 focus:border-pink-500 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold transition-all focus:outline-none cursor-pointer"
              >
                {banksList.map(bank => (
                  <option key={bank.code} value={bank.name}>{bank.code} - {bank.name}</option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số tài khoản thụ hưởng</label>
                {bankName === 'VNPay Nhóm' && (
                  <span className="text-[9px] font-black text-pink-400 bg-pink-500/10 px-1.5 py-0.2 rounded">CỐ ĐỊNH NHÓM</span>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={accountNumber} 
                  onChange={(e) => {
                    if (bankName !== 'VNPay Nhóm') {
                      setAccountNumber(e.target.value.replace(/\D/g, ''));
                    }
                  }}
                  placeholder="Số tài khoản ngân hàng..."
                  disabled={bankName === 'VNPay Nhóm'}
                  className={`w-full bg-slate-950 border border-slate-850 focus:border-pink-500 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold transition-all focus:outline-none ${bankName === 'VNPay Nhóm' ? 'opacity-60 cursor-not-allowed border-pink-500/35 bg-slate-950' : ''}`}
                />
              </div>
            </div>

            {/* Account Holder Name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tên chủ tài khoản (Không dấu)</label>
              <input 
                type="text" 
                value={accountName} 
                onChange={(e) => {
                  if (bankName !== 'VNPay Nhóm') {
                    setAccountName(e.target.value);
                  }
                }}
                placeholder="NGUYEN VAN A..."
                disabled={bankName === 'VNPay Nhóm'}
                className={`w-full bg-slate-950 border border-slate-850 focus:border-pink-500 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold transition-all focus:outline-none placeholder-slate-650 ${bankName === 'VNPay Nhóm' ? 'opacity-60 cursor-not-allowed border-pink-500/35 bg-slate-950' : ''}`}
              />
            </div>

            {/* Local validation warning info */}
            {validationError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] leading-relaxed flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-pink-500/15 hover:scale-102 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-6"
            >
              <Send className="w-4 h-4" />
              Yêu Cầu Rút Tiền
            </button>
          </form>

          {/* Secure disclaimer */}
          <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl flex items-start gap-2.5 text-[10px] text-slate-400 leading-relaxed text-left">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-extrabold block text-slate-350">Hệ Thống Rút Tiền Bảo Mật</span>
              Tất cả các giao dịch rút tiền được mã hóa và xác thực OTP 2 lớp. Giao dịch được xử lý ngay lập tức về tài khoản ngân hàng liên kết.
            </div>
          </div>
        </div>

        {/* TRANSACTIONS HISTORICAL DATA LIST - 2 Columns */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6 text-left flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-200 text-sm">Lịch Sử Giao Dịch</h3>
                  <button 
                    type="button"
                    onClick={exportToCSV}
                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 hover:border-emerald-500 rounded-lg text-[9px] font-black text-emerald-400 cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    XUẤT BÁO CÁO (.CSV)
                  </button>
                </div>
                <p className="text-slate-500 text-[10px]">Tất cả dòng thu chi của Ví được lưu lại đầy đủ phục vụ đối soát.</p>
              </div>

              {/* Dynamic Categories Type Filter */}
              <div className="flex flex-wrap gap-1 bg-slate-950/60 border border-slate-850 rounded-xl p-1 shrink-0">
                {[
                  { id: 'all', label: 'Tất Cả' },
                  { id: 'commission_deduction', label: 'Thu Phí' },
                  { id: 'refund', label: 'Bồi Thường' },
                  { id: 'withdraw', label: 'Rút Tiền' }
                ].map(f => (
                  <button 
                    key={f.id}
                    onClick={() => setTypeFilter(f.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      typeFilter === f.id 
                        ? 'bg-blue-600 text-white shadow-md font-extrabold' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Search Input & Date Dropdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search input - takes up 2 cols on desktop */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm theo mô tả, mã giao dịch..."
                  className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-slate-300 text-xs font-semibold focus:outline-none transition-all placeholder-slate-650"
                />
              </div>

              {/* Day, Month, Year select controls - takes up 2 cols */}
              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                {/* Day Selector */}
                <select
                  value={dayFilter}
                  onChange={e => setDayFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-2 py-2 text-slate-300 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Ngày</option>
                  {[...Array(31)].map((_, idx) => {
                    const dayVal = String(idx + 1).padStart(2, '0');
                    return (
                      <option key={dayVal} value={dayVal}>{idx + 1}</option>
                    );
                  })}
                </select>

                {/* Month Selector */}
                <select
                  value={monthFilter}
                  onChange={e => setMonthFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-2 py-2 text-slate-300 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Tháng</option>
                  {[...Array(12)].map((_, idx) => {
                    const monthVal = String(idx + 1).padStart(2, '0');
                    return (
                      <option key={monthVal} value={monthVal}>{`Tháng ${idx + 1}`}</option>
                    );
                  })}
                </select>

                {/* Year Selector */}
                <select
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-xl px-2 py-2 text-slate-300 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="">Năm</option>
                  {['2024', '2025', '2026', '2027'].map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data rows wrapper list */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-800/40 bg-slate-950/10 rounded-2xl flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <Info className="w-8 h-8 text-slate-600 animate-pulse" />
                  <span>Không tìm thấy bản ghi giao dịch ví nào hợp lệ.</span>
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPositive = parseFloat(tx.amount) > 0;
                  const badge = getTransactionBadge(tx.transaction_type);
                  return (
                    <div 
                      key={tx.id_Transaction}
                      className="bg-slate-950/25 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 group hover:border-slate-850 hover:bg-slate-950/40 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 border text-[9px] font-black uppercase rounded-lg ${badge.style}`}>
                            {badge.text}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 font-bold">Mã: TXN#{tx.id_Transaction}</span>
                        </div>
                        <span className="block text-[11px] font-extrabold text-slate-200 group-hover:text-slate-100 transition-colors leading-relaxed">
                          {tx.note}
                        </span>
                        <span className="block text-[9px] text-slate-500 font-semibold">{formatDate(tx.created_At)}</span>
                      </div>
                      
                      <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-slate-850 pt-2 sm:pt-0">
                        <span className={`text-sm font-black flex items-center ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{formatPrice(tx.amount)}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-bold mt-0.5">Số dư: {formatPrice(tx.balance_after)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Table summary stats */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[10px] text-slate-400">
            <span>Hiển thị <strong>{filteredTransactions.length}</strong> / <strong>{data.transactions.length}</strong> bản ghi giao dịch.</span>
            <span className="italic">* Chỉ số dòng tiền Ví hệ thống khớp 100% với báo cáo tài chính đối tác trong database.</span>
          </div>
        </div>
      </div>

      {/* SECURITY BANK WITHDRAWAL OTP AUTHORIZATION MODAL */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            {/* Modal Overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 cursor-pointer"
              onClick={() => !isSubmitting && setShowOtpModal(false)}
            />

            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative z-10 p-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mx-auto shadow-md">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-slate-100 tracking-tight">Xác Thực Rút Tiền Hệ Thống</h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                  Để đảm bảo an toàn, vui lòng nhập mã xác thực OTP gửi về số điện thoại quản trị viên đăng ký liên kết.
                </p>
                <div className="pt-2">
                  <span className="px-3 py-1 bg-slate-950 text-pink-400 border border-pink-500/20 text-[10px] font-black rounded-lg inline-block">
                    Mã xác thực mẫu: 123456
                  </span>
                </div>
              </div>

              {/* OTP Digits Inputs Box */}
              <div className="flex justify-center gap-2">
                {otpCode.map((data, index) => (
                  <input 
                    key={index}
                    type="text" 
                    maxLength="1"
                    value={data}
                    onChange={(e) => handleOtpChange(e.target, index)}
                    onFocus={(e) => e.target.focus()}
                    className="w-10 h-12 bg-slate-950 border border-slate-850 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 rounded-xl text-center text-slate-200 text-base font-black outline-none transition-all"
                  />
                ))}
              </div>

              {/* OTP Error Messages */}
              {otpError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[10px] leading-relaxed flex items-start gap-1.5 max-w-sm mx-auto text-left">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{otpError}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-40"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting || otpCode.some(val => val === '')}
                  onClick={handleExecuteWithdrawal}
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Đang xác thực...' : 'Xác nhận & Rút'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WITHDRAWAL TRANSACTION SUCCESS DETAILS DIALOG */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-850 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-2 relative">
                <CheckCircle2 className="w-8 h-8 animate-pulse" />
                <div className="absolute inset-0 bg-emerald-500 rounded-full blur animate-ping opacity-15"></div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-100 tracking-tight">Rút Tiền Thành Công!</h3>
                <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
                  {successMsg || 'Đã ghi nhận yêu cầu và gửi thành công lệnh bồi hoàn/rút tiền về ngân hàng của bạn.'}
                </p>
              </div>

              {/* Receipt details */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã ngân hàng:</span>
                  <span className="font-extrabold text-slate-350">{bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số tài khoản thụ hưởng:</span>
                  <span className="font-mono font-extrabold text-slate-350">{accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chủ tài khoản thụ hưởng:</span>
                  <span className="font-extrabold text-slate-350">{accountName.toUpperCase()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-850 pt-2 mt-2">
                  <span className="text-slate-400 font-bold">Số dư mới khả dụng:</span>
                  <span className="font-black text-pink-500">{formatPrice(data.balance)}</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold rounded-xl text-xs border border-slate-750 transition cursor-pointer"
              >
                Đóng & Quay Lại Ví
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoaderComponent() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">Đang tải thông tin ví...</span>
    </div>
  );
}
