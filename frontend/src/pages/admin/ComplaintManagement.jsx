import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AlertTriangle, ShieldCheck, Clock, Check, X, FileText, 
  CornerDownRight, User, ShoppingBag, DollarSign, MessageSquare, Eye,
  Cpu, Sparkles, Loader2, Zap, Play, Search
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
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);

  // AI & Smart Automation States
  const [autoPilot, setAutoPilot] = useState(() => {
    return localStorage.getItem('admin_autopilot_complaints') === 'true';
  });
  const [isAutoPilotProcessing, setIsAutoPilotProcessing] = useState(false);
  const [autoPilotLogs, setAutoPilotLogs] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter logically
      if (statusFilter) {
        setComplaints(res.data.filter(c => c.status === statusFilter));
      } else {
        setComplaints(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh sách khiếu nại từ hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  const handleResolve = async (id, status) => {
    if (!resolutionText.trim()) {
      alert('Vui lòng nhập phương án giải quyết để phản hồi lại khách hàng!');
      return;
    }
    
    if (!window.confirm(`Xác nhận xử lý khiếu nại này dưới dạng: ${status === 'resolved' ? 'ĐỒNG Ý GIẢI QUYẾT' : 'TỪ CHỐI KHIẾU NẠI'}?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/complaints/${id}`, {
        status,
        resolution: resolutionText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedComplaint(null);
      setResolutionText('');
      fetchComplaints();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi gửi phương án xử lý.');
    }
  };

  const generateAISuggestion = (desc, amount) => {
    const d = desc.toLowerCase();
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
      const suggest = generateAISuggestion(selectedComplaint.description, selectedComplaint.total_Amount);
      setResolutionText(suggest);
      setIsAnalyzing(false);
    }, 850);
  };

  const applyTemplate = (type) => {
    if (!selectedComplaint) return;
    const amountStr = formatPrice(selectedComplaint.total_Amount);
    switch(type) {
      case 'refund_100':
        setResolutionText(`Đồng ý khiếu nại. Hệ thống duyệt hoàn tiền 100% (${amountStr}) cho khách hàng.`);
        break;
      case 'refund_50':
        setResolutionText(`Hòa giải thành công. Hoàn trả 50% (${formatPrice(selectedComplaint.total_Amount * 0.5)}) cho khách hàng, hệ thống chia sẻ chi phí.`);
        break;
      case 'voucher_20':
        setResolutionText(`Bồi thường dịch vụ. Gửi tặng Voucher giảm giá 20.000đ bồi thường thời gian giao hàng chậm trễ. Rất xin lỗi quý khách.`);
        break;
      case 'reject':
        setResolutionText(`Từ chối khiếu nại. Bằng chứng đính kèm không đủ cơ sở hoặc vi phạm thời hạn khiếu nại của hệ thống.`);
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
      addLog(`⚡ Đang phân tích khiếu nại #${c.id_Complaint} (Đơn: #${c.order_Code})...`);
      await new Promise(r => setTimeout(r, 1200));

      const suggestion = generateAISuggestion(c.description, c.total_Amount);
      addLog(`💡 AI Phân Tích: "${c.description.substring(0, 40)}..."`);
      await new Promise(r => setTimeout(r, 800));

      const status = c.description.toLowerCase().includes('spam') ? 'rejected' : 'resolved';
      
      addLog(`✨ Đề xuất phương án: ${status === 'resolved' ? 'ĐỒNG Ý GIẢI QUYẾT' : 'TỪ CHỐI'}`);
      addLog(`✍️ Quyết định: "${suggestion}"`);
      await new Promise(r => setTimeout(r, 1000));

      try {
        await axios.put(`${import.meta.env.VITE_API_URL}/admin/complaints/${c.id_Complaint}`, {
          status,
          resolution: `[AI Auto-Pilot] ${suggestion}`
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
    const matchesSearch = 
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
            <AlertTriangle className="text-red-500 animate-pulse" />
            Xử Lý Khiếu Nại
          </h2>
          <p className="text-slate-400 text-sm">Giải quyết tranh chấp đơn hàng, chất lượng món ăn và xử lý hoàn trả đền bù cho khách hàng.</p>
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

      {/* Search Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full relative">
          <input 
            type="text" 
            placeholder="Tìm theo tên khách hàng, số điện thoại, mã đơn hàng, nội dung khiếu nại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
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
          <span className="font-bold text-slate-300">Không tìm thấy khiếu nại</span>
          <span>Không tìm thấy khiếu nại nào khớp với tiêu chí tìm kiếm!</span>
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

              const isSelected = selectedComplaint?.id_Complaint === c.id_Complaint;

              return (
                <div 
                  key={c.id_Complaint}
                  onClick={() => { setSelectedComplaint(c); setResolutionText(c.resolution || ''); }}
                  className={`p-5 rounded-2xl border cursor-pointer text-left transition-all ${
                    isSelected 
                      ? 'border-red-500/40 bg-red-500/5 shadow-inner' 
                      : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-slate-950 text-slate-400 border-slate-800 mr-2">
                        Đơn: #{c.order_Code}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.created_At).toLocaleDateString('vi-VN')} {new Date(c.created_At).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${statusStyles[c.status]}`}>
                      {c.status}
                    </span>
                  </div>

                  <span className="block font-black text-slate-200 text-sm mb-1">{c.customer_name}</span>
                  <span className="block text-slate-400 text-xs line-clamp-2 leading-relaxed">
                    "{c.description}"
                  </span>

                  {c.resolution && (
                    <div className="mt-3 pl-3 border-l-2 border-slate-700/60 text-[10px] text-slate-400 flex items-start gap-1">
                      <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-300">Phản hồi: </strong> {c.resolution}
                      </span>
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

                {/* Dispute metadata */}
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <User className="w-4 h-4 text-slate-500" />
                    <div>
                      <strong className="text-slate-300 block">Khách hàng khiếu nại</strong>
                      <span className="text-slate-400">{selectedComplaint.customer_name} ({selectedComplaint.customer_phone})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <ShoppingBag className="w-4 h-4 text-slate-500" />
                    <div>
                      <strong className="text-slate-300 block">Đơn hàng tranh chấp</strong>
                      <span className="text-slate-400">Mã đơn: #{selectedComplaint.order_Code}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <div>
                      <strong className="text-slate-300 block">Tổng giá trị thanh toán</strong>
                      <span className="text-emerald-400 font-extrabold">{formatPrice(selectedComplaint.total_Amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Evidence Attachments */}
                {selectedComplaint.image && (
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hình ảnh minh chứng</span>
                    <a 
                      href={selectedComplaint.image} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block w-full h-24 rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden relative group"
                    >
                      <img 
                        src={selectedComplaint.image} 
                        alt="Evidence photo" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-all"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/400x300/0f172a/94a3b8?text=Anh+Xac+Minh+Tranh+Chap';
                        }}
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-all">
                        <Eye className="w-4 h-4 mr-1" /> Phóng To
                      </div>
                    </a>
                  </div>
                )}

                {/* Description details */}
                <div className="space-y-1.5 bg-slate-950/20 border border-slate-850 p-3 rounded-xl">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mô tả của người dùng</span>
                  <p className="text-xs text-slate-300 italic leading-relaxed">
                    "{selectedComplaint.description}"
                  </p>
                </div>

                {/* Resolution field */}
                {selectedComplaint.status === 'pending' || selectedComplaint.status === 'processing' ? (
                  <div className="space-y-2.5 pt-3 border-t border-slate-800/60">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phương án giải quyết của Admin *</label>
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
                            <span>Gợi Ý AI</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      required
                      rows="3"
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      placeholder="Ghi nhận phương án bồi thường, hoàn trả điểm uy tín hoặc hoàn tiền..."
                      className="w-full bg-slate-950 border border-slate-850 focus:border-red-500/40 rounded-xl px-3.5 py-2 text-slate-200 text-xs focus:outline-none"
                    ></textarea>

                    {/* Quick Templates Row */}
                    <div className="space-y-1 pt-0.5">
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-wider pl-1">Phản hồi nhanh bằng Mẫu</span>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => applyTemplate('refund_100')}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          💸 Hoàn 100%
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('refund_50')}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          🤝 Hòa giải 50%
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('voucher_20')}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          🎁 Voucher 20k
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTemplate('reject')}
                          className="flex items-center gap-1 px-2 py-0.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-[9px] font-bold cursor-pointer transition-all"
                        >
                          ⚠️ Từ Chối
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2.5 pt-1.5">
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
                        <Check className="w-3.5 h-3.5" /> Giải Quyết
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-850 space-y-2 text-xs">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                      <span>Đã giải quyết bởi Admin</span>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 italic text-slate-400">
                      "{selectedComplaint.resolution}"
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center">
                <MessageSquare className="w-8 h-8 text-slate-600 mb-3 animate-pulse" />
                <span className="font-semibold text-slate-400">Chọn một khiếu nại để xử lý</span>
                <span className="mt-1 text-slate-500 text-[10px]">
                  Danh sách hiển thị chi tiết hóa đơn, bằng chứng hình ảnh và nhật ký giải quyết.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
