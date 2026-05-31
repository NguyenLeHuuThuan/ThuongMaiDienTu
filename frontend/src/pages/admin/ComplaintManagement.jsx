import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AlertTriangle, ShieldCheck, Clock, Check, X, FileText, 
  CornerDownRight, User, ShoppingBag, DollarSign, MessageSquare, Eye,
  Cpu, Sparkles, Loader2, Zap, Play, Search, Truck, Store, Info
} from 'lucide-react';

export default function ComplaintManagement() {
  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Selected complaint for details modal drawer
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [compCustomerAmount, setCompCustomerAmount] = useState(0);
  const [compDriverAmount, setCompDriverAmount] = useState(0);
  const [compRestaurantAmount, setCompRestaurantAmount] = useState(0);
  const [feePercent, setFeePercent] = useState(5.0);
  const [resFeePercent, setResFeePercent] = useState(15.0);

  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);

  // AI & Smart Automation States
  const [autoPilot, setAutoPilot] = useState(() => {
    return localStorage.getItem('admin_autopilot_complaints') === 'true';
  });
  const [isAutoPilotProcessing, setIsAutoPilotProcessing] = useState(false);
  const [autoPilotLogs, setAutoPilotLogs] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchComplaints = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter logically based on status filter
      if (statusFilter) {
        setComplaints(res.data.filter(c => c.status === statusFilter));
      } else {
        setComplaints(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh sách khiếu nại từ hệ thống.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(() => {
      fetchComplaints(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, [statusFilter]);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/configs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const shipFee = res.data.find(c => c.config_key === 'op_shipper_fee_percent');
        const resFee = res.data.find(c => c.config_key === 'op_service_fee_percent');
        if (shipFee) setFeePercent(parseFloat(shipFee.config_value) || 5.0);
        if (resFee) setResFeePercent(parseFloat(resFee.config_value) || 15.0);
      } catch (err) {
        console.error('Failed to fetch system configs for fee percentages:', err);
      }
    };
    fetchConfigs();
  }, []);

  // Reset resolution and compensation fields when selectedComplaint changes
  useEffect(() => {
    if (selectedComplaint) {
      setResolutionText(selectedComplaint.resolution || '');
      setCompCustomerAmount(selectedComplaint.comp_customer_amount || 0);
      setCompDriverAmount(selectedComplaint.comp_driver_amount || 0);
      setCompRestaurantAmount(selectedComplaint.comp_restaurant_amount || 0);
    } else {
      setResolutionText('');
      setCompCustomerAmount(0);
      setCompDriverAmount(0);
      setCompRestaurantAmount(0);
    }
  }, [selectedComplaint]);

  const handleResolve = async (id, status) => {
    if (!resolutionText.trim()) {
      alert('Vui lòng nhập phương án giải quyết để phản hồi lại khiếu nại!');
      return;
    }
    
    if (!window.confirm(`Xác nhận xử lý khiếu nại này dưới dạng: ${status === 'resolved' ? 'ĐỒNG Ý GIẢI QUYẾT' : 'TỪ CHỐI KHIẾU NẠI'}?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/complaints/${id}`, {
        status,
        resolution: resolutionText,
        compCustomerAmount: status === 'resolved' ? parseFloat(compCustomerAmount) || 0 : 0,
        compDriverAmount: status === 'resolved' ? Math.round(parseFloat(compDriverAmount) * (1.0 + feePercent / 100.0)) || 0 : 0,
        compRestaurantAmount: status === 'resolved' ? Math.round(parseFloat(compRestaurantAmount) * (1.0 + resFeePercent / 100.0)) || 0 : 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi gửi phương án xử lý.');
    }
  };

  const generateAISuggestion = (desc, amount, role) => {
    const d = desc.toLowerCase();
    
    // AI Suggestions for Driver Complaints (Shipper Report)
    if (role === 'driver') {
      if (d.includes('không liên hệ được') || d.includes('bùng') || d.includes('bom') || d.includes('từ chối nhận')) {
        return `Đồng ý đền bù thiệt hại cho cả Tài xế và Nhà hàng do đơn hàng bị bùng/bom. Hoàn trả tiền đồ ăn cho Nhà hàng và đền bù phí giao hàng cho Tài xế, đồng thời tiến hành khóa ví/truy thu nợ khách hàng bùng đơn.`;
      }
      return `Xác nhận khiếu nại sự cố giao hàng từ Tài xế. Hỗ trợ đền bù công sức giao hàng cho shipper và chia sẻ tổn thất nguyên liệu đồ ăn với nhà hàng đối tác.`;
    }

    // AI Suggestions for Restaurant Owner Complaints
    if (role === 'restaurant_owner') {
      if (d.includes('bùng') || d.includes('bom') || d.includes('khách không nhận')) {
        return `Phê duyệt đền bù song phương (Nhà hàng + Tài xế). Đơn hàng bị bùng COD. Đền bù 100% tiền đồ ăn gốc cho nhà hàng và thanh toán phí ship đền bù cho tài xế giao hàng.`;
      }
      return `Duyệt đền bù hỗ trợ cho Nhà hàng và Tài xế. Hệ thống hỗ trợ chi phí đồ ăn và trả phí vận chuyển bồi dưỡng cho tài xế do sự cố khách hàng huỷ đơn đột ngột.`;
    }

    // AI Suggestions for Customer Complaints
    if (d.includes('thiếu') || d.includes('thieu') || d.includes('không có') || d.includes('khong co')) {
      return `Đồng ý hoàn tiền ${formatPrice(amount * 0.5)} (50% giá trị đơn hàng) do thiếu món ăn theo phản ánh. Xin lỗi khách hàng vì trải nghiệm không trọn vẹn.`;
    }
    if (d.includes('hỏng') || d.includes('hong') || d.includes('nát') || d.includes('nat') || d.includes('chua chín') || d.includes('sống')) {
      return `Chấp nhận khiếu nại. Hoàn tiền 100% (${formatPrice(amount)}) cho khách hàng do chất lượng món ăn không đạt vệ sinh an toàn thực phẩm. Yêu cầu nhà hàng giải trình.`;
    }
    if (d.includes('trễ') || d.includes('muộn') || d.includes('lau') || d.includes('lâu') || d.includes('chậm')) {
      return `Hòa giải thành công. Tặng Voucher giảm giá 25.000đ cho đơn hàng tiếp theo và cộng 100 điểm uy tín do tài xế giao hàng muộn. Xin chân thành cáo lỗi.`;
    }
    if (d.includes('thái độ') || d.includes('chửi') || d.includes('khó chịu')) {
      return `Ghi nhận khiếu nại về thái độ phục vụ. Tặng Voucher 15.000đ bồi thường tinh thần và tiến hành nhắc nhở, kiểm điểm đối tác phục vụ liên quan.`;
    }
    
    // Fallback default smart decision
    if (amount <= 30000) {
      return `Dưới hạn mức tối thiểu: Duyệt hoàn tiền nhanh 100% (${formatPrice(amount)}) tự động bằng AI. Kính chúc khách hàng ngon miệng lần sau.`;
    }
    return `Đồng ý hòa giải: Hoàn tiền 70% giá trị đơn hàng (${formatPrice(amount * 0.7)}) và gửi lời xin lỗi chân thành từ hệ thống chăm sóc khách hàng tự động.`;
  };

  const handleAISuggestionClick = () => {
    if (!selectedComplaint) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      const suggest = generateAISuggestion(
        selectedComplaint.description, 
        selectedComplaint.total_Amount,
        selectedComplaint.sender_role
      );
      setResolutionText(suggest);

      // Smart autofill compensation values based on AI suggestions
      if (selectedComplaint.sender_role === 'driver' || selectedComplaint.sender_role === 'restaurant_owner') {
        // Compensate both Shipper & Restaurant
        const grossShipFee = selectedComplaint.shipping_Fee || 15000;
        const grossFoodCost = Math.max(0, selectedComplaint.total_Amount - grossShipFee);
        const netShipFee = Math.round(grossShipFee / (1.0 + feePercent / 100.0));
        const netFoodCost = Math.round(grossFoodCost / (1.0 + resFeePercent / 100.0));
        setCompDriverAmount(netShipFee);
        setCompRestaurantAmount(netFoodCost);
        setCompCustomerAmount(0);
      } else {
        // Customer complaint: just refund customer
        setCompCustomerAmount(selectedComplaint.total_Amount);
        setCompDriverAmount(0);
        setCompRestaurantAmount(0);
      }

      setIsAnalyzing(false);
    }, 850);
  };

  const applyTemplate = (type) => {
    if (!selectedComplaint) return;
    const amountStr = formatPrice(selectedComplaint.total_Amount);
    
    switch(type) {
      case 'refund_100':
        setResolutionText(`Đồng ý khiếu nại. Hệ thống duyệt hoàn tiền 100% (${amountStr}) cho khách hàng.`);
        setCompCustomerAmount(selectedComplaint.total_Amount);
        setCompDriverAmount(0);
        setCompRestaurantAmount(0);
        break;
      case 'refund_50':
        setResolutionText(`Hòa giải thành công. Hoàn trả 50% (${formatPrice(selectedComplaint.total_Amount * 0.5)}) cho khách hàng, hệ thống chia sẻ chi phí.`);
        setCompCustomerAmount(Math.round(selectedComplaint.total_Amount * 0.5));
        setCompDriverAmount(0);
        setCompRestaurantAmount(0);
        break;
      case 'driver_comp':
        setResolutionText(`Xác nhận bồi hoàn công sức cho tài xế giao hàng. Cộng ví tài xế phí ship bồi dưỡng.`);
        const grossShip = selectedComplaint.shipping_Fee || 15000;
        setCompDriverAmount(Math.round(grossShip / (1.0 + feePercent / 100.0)));
        break;
      case 'restaurant_comp':
        setResolutionText(`Bồi thường thiệt hại đồ ăn cho nhà hàng do lỗi đơn hoặc bom hàng.`);
        const grossSFee = selectedComplaint.shipping_Fee || 15000;
        const grossFood = Math.max(0, selectedComplaint.total_Amount - grossSFee);
        setCompRestaurantAmount(Math.round(grossFood / (1.0 + resFeePercent / 100.0)));
        break;
      case 'double_comp':
        setResolutionText(`Bồi thường đồng thời song phương: Đền bù công sức giao hàng cho Tài xế và hoàn tiền hao phí nguyên liệu cho Nhà hàng.`);
        const gSFee = selectedComplaint.shipping_Fee || 15000;
        const gFood = Math.max(0, selectedComplaint.total_Amount - gSFee);
        setCompDriverAmount(Math.round(gSFee / (1.0 + feePercent / 100.0)));
        setCompRestaurantAmount(Math.round(gFood / (1.0 + resFeePercent / 100.0)));
        setCompCustomerAmount(0);
        break;
      case 'reject':
        setResolutionText(`Từ chối khiếu nại. Bằng chứng đính kèm không đủ cơ sở hoặc vi phạm thời hạn khiếu nại của hệ thống.`);
        setCompCustomerAmount(0);
        setCompDriverAmount(0);
        setCompRestaurantAmount(0);
        break;
      default:
        break;
    }
  };

  const runAutoPilotAutomation = async (pendingList) => {
    setIsAutoPilotProcessing(true);
    setAutoPilotLogs([]);
    
    const logs = [];
    const addLog = (msg) => {
      logs.push(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
      setAutoPilotLogs([...logs]);
    };

    addLog('🤖 Khởi động Trợ lý AI Quyết Định Tự Động (Auto-Pilot)...');
    await new Promise(r => setTimeout(r, 800));
    
    addLog(`🔍 Phát hiện ${pendingList.length} khiếu nại đang ở trạng thái CHỜ XỬ LÝ.`);
    await new Promise(r => setTimeout(r, 1000));

    const token = localStorage.getItem('token');

    for (let i = 0; i < pendingList.length; i++) {
      const c = pendingList[i];
      addLog(`⚡ Đang phân tích khiếu nại #${c.id_Complaint} (Nguồn: ${c.sender_role === 'driver' ? 'Tài xế' : c.sender_role === 'restaurant_owner' ? 'Nhà hàng' : 'Khách hàng'})...`);
      await new Promise(r => setTimeout(r, 1200));

      const suggestion = generateAISuggestion(c.description, c.total_Amount, c.sender_role);
      addLog(`💡 AI Phân Tích: "${c.description.substring(0, 40)}..."`);
      await new Promise(r => setTimeout(r, 800));

      const status = c.description.toLowerCase().includes('spam') ? 'rejected' : 'resolved';
      
      let custAmt = 0;
      let drivAmt = 0;
      let restAmt = 0;
      if (status === 'resolved') {
        if (c.sender_role === 'driver' || c.sender_role === 'restaurant_owner') {
          drivAmt = c.shipping_Fee || 15000;
          restAmt = Math.max(0, c.total_Amount - drivAmt);
        } else {
          custAmt = c.description.toLowerCase().includes('thiếu') ? Math.round(c.total_Amount * 0.5) : c.total_Amount;
        }
      }

      addLog(`✨ Đề xuất: ${status === 'resolved' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} | Bồi hoàn Khách: +${formatPrice(custAmt)} | Shipper: +${formatPrice(drivAmt)} | Nhà hàng: +${formatPrice(restAmt)}`);
      addLog(`✍️ Quyết định: "${suggestion}"`);
      await new Promise(r => setTimeout(r, 1000));

      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/admin/complaints/${c.id_Complaint}`, {
          status,
          resolution: `[AI Auto-Pilot] ${suggestion}`,
          compCustomerAmount: custAmt,
          compDriverAmount: drivAmt,
          compRestaurantAmount: restAmt
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        addLog(`✅ Cập nhật cơ sở dữ liệu khiếu nại #${c.id_Complaint} thành công.`);
      } catch (err) {
        console.error(err);
        addLog(`❌ Cập nhật cơ sở dữ liệu khiếu nại #${c.id_Complaint} thất bại.`);
      }
      await new Promise(r => setTimeout(r, 800));
    }

    addLog('🎉 Đã hoàn tất xử lý tự động toàn bộ khiếu nại pending!');
    await new Promise(r => setTimeout(r, 1000));
    
    setIsAutoPilotProcessing(false);
    fetchComplaints();
  };

  const handleToggleAutoPilot = () => {
    if (autoPilot) {
      setAutoPilot(false);
      localStorage.setItem('admin_autopilot_complaints', 'false');
      return;
    }

    localStorage.setItem('admin_autopilot_complaints', 'true');
    const pendingComplaints = complaints.filter(c => c.status === 'pending');
    if (pendingComplaints.length === 0) {
      alert('Chế độ Auto-Pilot AI đã kích hoạt! Hiện không có khiếu nại pending nào. Hệ thống sẽ tự động giải quyết ngay khi có khiếu nại mới.');
      setAutoPilot(true);
      return;
    }

    if (window.confirm(`Trợ lý AI phát hiện có ${pendingComplaints.length} khiếu nại đang ở trạng thái Chờ xử lý.\n\nBạn có muốn kích hoạt Auto-Pilot để tự động phân tích và giải quyết toàn bộ ngay bây giờ không?`)) {
      setAutoPilot(true);
      runAutoPilotAutomation(pendingComplaints);
    } else {
      setAutoPilot(true);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    // Source role filter
    if (sourceFilter !== 'all' && c.sender_role !== sourceFilter) {
      return false;
    }

    const matchesSearch = 
      (c.sender_name && c.sender_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.sender_phone && c.sender_phone.includes(searchQuery)) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.customer_phone && c.customer_phone.includes(searchQuery)) ||
      (c.order_Code && c.order_Code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const displayedComplaints = isCollapsed ? filteredComplaints.slice(0, 5) : filteredComplaints;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-red-500 animate-pulse text-xl" />
            Xử Lý Khiếu Nại
          </h2>
          <p className="text-slate-400 text-sm">Phân loại nguồn khiếu nại (khách hàng, tài xế, nhà hàng) và đưa ra phương án bồi hoàn tài chính tương ứng.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleAutoPilot}
            disabled={isAutoPilotProcessing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-lg cursor-pointer ${
              autoPilot 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-purple-500/20' 
                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className={`w-4 h-4 ${autoPilot ? 'animate-spin text-purple-300' : ''}`} />
            <span>Auto-Pilot AI: {autoPilot ? 'ĐANG BẬT' : 'TẮT'}</span>
          </button>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý (Pending)</option>
            <option value="processing">Đang tiến hành (Processing)</option>
            <option value="resolved">Đã giải quyết (Resolved)</option>
            <option value="rejected">Từ chối giải quyết (Rejected)</option>
          </select>
        </div>
      </div>

      {/* Source classification tabs */}
      <div className="flex gap-2 border-b border-slate-800/80 pb-px">
        {[
          { id: 'all', label: 'Tất cả nguồn', icon: MessageSquare, count: complaints.length },
          { id: 'customer', label: 'Từ Khách hàng', icon: User, count: complaints.filter(c => c.sender_role === 'customer').length },
          { id: 'driver', label: 'Từ Tài xế (Shipper)', icon: Truck, count: complaints.filter(c => c.sender_role === 'driver').length },
          { id: 'restaurant_owner', label: 'Từ Nhà hàng', icon: Store, count: complaints.filter(c => c.sender_role === 'restaurant_owner').length },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = sourceFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setSourceFilter(tab.id); setIsCollapsed(true); }}
              className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                isActive 
                  ? 'border-red-500 text-slate-100 bg-red-500/5' 
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/40'
              } rounded-t-xl`}
            >
              <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-red-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                isActive ? 'bg-red-500/20 text-red-400' : 'bg-slate-900 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full relative">
          <input 
            type="text" 
            placeholder="Tìm theo tên/số điện thoại người khiếu nại, mã đơn hàng, nội dung tranh chấp..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải danh sách khiếu nại...</div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>
      ) : filteredComplaints.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800 rounded-2xl text-slate-500 text-xs py-12">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2" />
          <span className="font-bold text-slate-300">Không có khiếu nại nào</span>
          <span>Không tìm thấy khiếu nại nào khớp với tiêu chí lọc của bạn.</span>
        </div>
      ) : isAutoPilotProcessing ? (
        <div className="bg-slate-950 border border-purple-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden font-mono text-xs text-purple-300 min-h-[400px]">
          {/* Purple scanner light glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse"></div>
          <div className="flex justify-between items-center border-b border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="font-extrabold text-slate-200">AI AUTO-PILOT DECISION ENGINE</span>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Running...</span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar text-left pr-2">
            {autoPilotLogs.map((log, idx) => (
              <div key={idx} className="transition-all duration-300">
                {log}
              </div>
            ))}
            <div className="w-2 h-4 bg-purple-400 animate-pulse inline-block"></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* COMPLAINTS LIST */}
          <div className="lg:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
            {displayedComplaints.map((c) => {
              const statusStyles = {
                pending: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
                processing: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
                resolved: 'border-green-500/30 bg-green-500/5 text-green-400',
                rejected: 'border-slate-850 bg-slate-950/20 text-slate-500'
              };

              const senderStyles = {
                customer: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                driver: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                restaurant_owner: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              };

              const senderLabel = {
                customer: 'Khách hàng',
                driver: 'Tài xế/Shipper',
                restaurant_owner: 'Nhà hàng'
              };

              const isSelected = selectedComplaint?.id_Complaint === c.id_Complaint;

              return (
                <div 
                  key={c.id_Complaint}
                  onClick={() => setSelectedComplaint(c)}
                  className={`p-5 rounded-2xl border cursor-pointer text-left transition-all ${
                    isSelected 
                      ? 'border-red-500/40 bg-red-500/5 shadow-inner' 
                      : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase tracking-wide ${senderStyles[c.sender_role] || 'bg-slate-950 text-slate-400'}`}>
                        {senderLabel[c.sender_role] || 'Không rõ'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-slate-950 text-slate-400 border-slate-800">
                        Đơn: #{c.order_Code}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.created_At).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${statusStyles[c.status]}`}>
                      {c.status}
                    </span>
                  </div>

                  <span className="block font-black text-slate-200 text-sm mb-1">
                    {c.sender_role === 'restaurant_owner' ? (c.restaurant_name || c.sender_name) : c.sender_name}
                  </span>
                  <span className="block text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    "{c.description}"
                  </span>

                  {c.resolution && (
                    <div className="mt-3 pl-3 border-l-2 border-slate-700/60 text-[10px] text-slate-400 flex flex-col gap-1.5">
                      <div className="flex items-start gap-1">
                        <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-300">Quyết định giải quyết: </strong> {c.resolution}
                        </span>
                      </div>
                      {(c.comp_customer_amount > 0 || c.comp_driver_amount > 0 || c.comp_restaurant_amount > 0) && (
                        <div className="text-[9px] font-extrabold text-red-400/90 pl-4 uppercase tracking-wide flex flex-col gap-0.5">
                          {c.comp_customer_amount > 0 && <span>• Đền bù Khách: +{formatPrice(c.comp_customer_amount)}</span>}
                          {c.comp_driver_amount > 0 && <span>• Đền bù Shipper: +{formatPrice(c.comp_driver_amount)}</span>}
                          {c.comp_restaurant_amount > 0 && <span>• Đền bù Nhà hàng: +{formatPrice(c.comp_restaurant_amount)}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredComplaints.length > 5 && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {isCollapsed ? `Hiển thị tất cả (${filteredComplaints.length} khiếu nại)` : 'Thu gọn danh sách'}
                </button>
              </div>
            )}
          </div>

          {/* COMPLAINT PROCESSOR SIDE DRAWER */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-6 rounded-3xl shadow-2xl h-fit flex flex-col justify-between">
            {selectedComplaint ? (
              <div className="space-y-5 text-left">
                <div className="flex justify-between items-start border-b border-slate-800/60 pb-3">
                  <h3 className="font-extrabold text-slate-200 text-sm">Chi Tiết Tranh Chấp</h3>
                  <button className="text-slate-500 hover:text-white" onClick={() => setSelectedComplaint(null)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sender of the complaint */}
                <div className="flex items-center gap-2.5 bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/20">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                    {selectedComplaint.sender_role === 'driver' ? <Truck className="w-4 h-4" /> : selectedComplaint.sender_role === 'restaurant_owner' ? <Store className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <strong className="text-indigo-300 text-[10px] block uppercase tracking-wider font-extrabold">Nguồn khiếu nại: {
                      selectedComplaint.sender_role === 'customer' ? 'Khách hàng' :
                      selectedComplaint.sender_role === 'driver' ? 'Tài xế/Shipper' : 'Nhà hàng'
                    }</strong>
                    <span className="text-slate-200 text-xs font-bold">{selectedComplaint.sender_name} ({selectedComplaint.sender_phone})</span>
                  </div>
                </div>

                {/* Dispute metadata */}
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-850 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-500 border-b border-slate-900 pb-1.5">
                    <span className="font-black text-[9px] uppercase tracking-wider">Thông tin liên quan</span>
                    <span className="text-slate-400 font-bold">Đơn: #{selectedComplaint.order_Code}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Khách hàng:</span>
                    <span className="text-slate-200 font-medium">{selectedComplaint.customer_name} ({selectedComplaint.customer_phone})</span>
                  </div>

                  {selectedComplaint.driver_name && (
                    <div className="flex justify-between text-slate-400">
                      <span>Tài xế (Shipper):</span>
                      <span className="text-slate-200 font-medium">{selectedComplaint.driver_name} ({selectedComplaint.driver_phone})</span>
                    </div>
                  )}

                  {selectedComplaint.restaurant_name && (
                    <div className="flex justify-between text-slate-400">
                      <span>Nhà hàng:</span>
                      <span className="text-slate-200 font-medium">{selectedComplaint.restaurant_name} ({selectedComplaint.owner_phone})</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-900">
                    <span className="text-slate-400">Tổng thanh toán:</span>
                    <span className="text-emerald-400 font-extrabold">{formatPrice(selectedComplaint.total_Amount)}</span>
                  </div>
                </div>

                {/* Evidence Attachments */}
                {(() => {
                  const rawImages = selectedComplaint.image ? selectedComplaint.image.split(',') : [];
                  const images = rawImages.map(img => img.trim()).filter(Boolean);
                  if (images.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Hình ảnh minh chứng ({images.length})
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((img, idx) => {
                          const fullUrl = img.startsWith('http')
                            ? img
                            : `${import.meta.env.VITE_API_URL.replace('/api', '')}${img.startsWith('/') ? '' : '/'}${img}`;
                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedPreviewImage(fullUrl)}
                              className="h-20 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden relative group cursor-pointer hover:border-slate-750 transition-all"
                            >
                              <img 
                                src={fullUrl} 
                                alt={`Evidence photo ${idx + 1}`} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-all duration-300"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://placehold.co/400x300/0f172a/94a3b8?text=Loi+anh';
                                }}
                              />
                              <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-black transition-all">
                                <Eye className="w-3.5 h-3.5 mr-0.5" /> XEM
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Description details */}
                <div className="space-y-1.5 bg-slate-950/20 border border-slate-850 p-3 rounded-xl">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mô tả chi tiết</span>
                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "{selectedComplaint.description}"
                  </p>
                </div>

                {/* Resolution field */}
                {selectedComplaint.status === 'pending' || selectedComplaint.status === 'processing' ? (
                  <div className="space-y-3 pt-3 border-t border-slate-800/60">
                    
                    {/* Financial Compensation Target and Amount */}
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-850 space-y-3">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        💸 Cấu hình đền bù tài chính (Có thể đền bù đồng thời)
                      </span>

                      <div className="space-y-3">
                        {/* Customer Row */}
                        <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={compCustomerAmount > 0}
                              onChange={(e) => setCompCustomerAmount(e.target.checked ? selectedComplaint.total_Amount : 0)}
                              className="w-3.5 h-3.5 accent-red-500 rounded border-slate-700 cursor-pointer"
                            />
                            <span>Khách hàng ({selectedComplaint.customer_name})</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={compCustomerAmount}
                              onChange={(e) => setCompCustomerAmount(parseFloat(e.target.value) || 0)}
                              className="w-24 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-right text-slate-300 focus:outline-none"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">đ</span>
                          </div>
                        </div>

                        {/* Driver Row */}
                        <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={compDriverAmount > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const grossShipFee = selectedComplaint.shipping_Fee || 15000;
                                  const netShipFee = Math.round(grossShipFee / (1.0 + feePercent / 100.0));
                                  setCompDriverAmount(netShipFee);
                                } else {
                                  setCompDriverAmount(0);
                                }
                              }}
                              className="w-3.5 h-3.5 accent-emerald-500 rounded border-slate-700 cursor-pointer"
                            />
                            <span>Tài xế ({selectedComplaint.driver_name || 'Không có'})</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={compDriverAmount}
                              onChange={(e) => setCompDriverAmount(parseFloat(e.target.value) || 0)}
                              disabled={!selectedComplaint.driver_name}
                              className="w-24 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-right text-slate-300 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">đ</span>
                          </div>
                        </div>

                        {/* Restaurant Row */}
                        <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <input 
                              type="checkbox"
                              checked={compRestaurantAmount > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const grossShipFee = selectedComplaint.shipping_Fee || 15000;
                                  const grossFoodCost = Math.max(0, selectedComplaint.total_Amount - grossShipFee);
                                  const netFoodCost = Math.round(grossFoodCost / (1.0 + resFeePercent / 100.0));
                                  setCompRestaurantAmount(netFoodCost);
                                } else {
                                  setCompRestaurantAmount(0);
                                }
                              }}
                              className="w-3.5 h-3.5 accent-amber-500 rounded border-slate-700 cursor-pointer"
                            />
                            <span>Nhà hàng ({selectedComplaint.restaurant_name || selectedComplaint.owner_name || 'Không có'})</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={compRestaurantAmount}
                              onChange={(e) => setCompRestaurantAmount(parseFloat(e.target.value) || 0)}
                              disabled={!selectedComplaint.restaurant_name && !selectedComplaint.owner_name}
                              className="w-24 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-right text-slate-300 focus:outline-none disabled:opacity-40"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">đ</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giải trình & Phản hồi *</label>
                      <button
                        type="button"
                        onClick={handleAISuggestionClick}
                        disabled={isAnalyzing}
                        className="flex items-center gap-1 text-[9px] font-black text-purple-400 hover:text-purple-300 transition-all bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Đang phân tích...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>AI Gợi Ý</span>
                          </>
                        )}
                      </button>
                    </div>

                    <textarea
                      required
                      rows="3"
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Ghi nhận phương án bồi thường và giải quyết mâu thuẫn tranh chấp..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500/40 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none"
                    ></textarea>

                    {/* Quick Templates Row */}
                    <div className="space-y-1">
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider pl-0.5">Phản hồi nhanh bằng Mẫu</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => applyTemplate('refund_100')}
                          className="px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          💸 Hoàn 100% Khách
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('refund_50')}
                          className="px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          🤝 Hòa giải 50%
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('driver_comp')}
                          className="px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          🛵 Đền bù Shipper
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('restaurant_comp')}
                          className="px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          🍳 Đền bù Nhà hàng
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('double_comp')}
                          className="px-2 py-0.5 bg-purple-950 border border-purple-800 hover:bg-purple-900 text-purple-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          ✨ Đền bù Cả Hai
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('reject')}
                          className="px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          ⚠️ Từ Chối
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2.5 pt-1">
                      <button 
                        onClick={() => handleResolve(selectedComplaint.id_Complaint, 'rejected')}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold border border-slate-750 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" /> Từ Chối
                      </button>
                      <button 
                        onClick={() => handleResolve(selectedComplaint.id_Complaint, 'resolved')}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Chấp Nhận
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-850 space-y-2.5 text-xs">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                      <span>Đã giải quyết bởi {selectedComplaint.admin_name || 'Admin'}</span>
                    </div>

                    {(selectedComplaint.comp_customer_amount > 0 || selectedComplaint.comp_driver_amount > 0 || selectedComplaint.comp_restaurant_amount > 0) && (
                      <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-300 rounded-xl text-xs space-y-1.5">
                        <span className="font-bold flex items-center gap-1 border-b border-red-950/30 pb-1 text-[10px] uppercase tracking-wider text-slate-400">
                          <DollarSign className="w-4 h-4 text-red-400" />
                          Chi tiết đền bù tài chính đã duyệt:
                        </span>
                        {selectedComplaint.comp_customer_amount > 0 && (
                          <div className="flex justify-between">
                            <span>Khách hàng:</span>
                            <span className="font-black text-red-400">+{formatPrice(selectedComplaint.comp_customer_amount)}</span>
                          </div>
                        )}
                        {selectedComplaint.comp_driver_amount > 0 && (
                          <div className="flex justify-between">
                            <span>Tài xế (Shipper):</span>
                            <span className="font-black text-red-400">+{formatPrice(selectedComplaint.comp_driver_amount)}</span>
                          </div>
                        )}
                        {selectedComplaint.comp_restaurant_amount > 0 && (
                          <div className="flex justify-between">
                            <span>Nhà hàng:</span>
                            <span className="font-black text-red-400">+{formatPrice(selectedComplaint.comp_restaurant_amount)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 italic text-slate-400">
                      "{selectedComplaint.resolution}"
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center">
                <MessageSquare className="w-8 h-8 text-slate-600 mb-3 animate-pulse" />
                <span className="font-semibold text-slate-400">Chọn khiếu nại để giải quyết</span>
                <span className="mt-1 text-slate-500 text-[10px]">
                  Bảng hiển thị chi tiết các bên, thông tin đơn hàng, hình ảnh bằng chứng và các phương án bồi hoàn ví.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click-to-enlarge Preview Image Modal */}
      {selectedPreviewImage && (
        <div 
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out"
        >
          <div 
            className="relative max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/50"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={selectedPreviewImage} 
              alt="Enlarged evidence" 
              className="w-full max-h-[80vh] object-contain"
            />
            <button 
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-950/80 text-slate-400 hover:text-white border border-slate-850 transition-all shadow-xl hover:scale-105"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
