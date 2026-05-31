import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UserCheck, ShieldCheck, ShieldAlert, FileText, Check, X, 
  MapPin, Phone, Mail, Award, Eye, AlertTriangle, Search
} from 'lucide-react';

export default function PartnerApproval() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Selected items for quick preview modal
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPartners = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/partners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPartners(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh sách đối tác đăng ký chờ duyệt.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
    const interval = setInterval(() => {
      fetchPartners(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id, name) => {
    if (!window.confirm(`Bạn có đồng ý phê duyệt và kích hoạt hoạt động cho đối tác ${name}?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/partners/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPartners();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi phê duyệt.');
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason) {
      alert('Vui lòng cung cấp lý do từ chối đăng ký!');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/partners/${rejectId}/reject`, {
        reason: rejectReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRejectId(null);
      setRejectReason('');
      fetchPartners();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi từ chối hồ sơ.');
    }
  };
  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery)) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.name_Restaurant && p.name_Restaurant.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.license_plate && p.license_plate.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter ? p.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  const displayedPartners = isCollapsed ? filteredPartners.slice(0, 4) : filteredPartners;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
          <UserCheck className="text-indigo-400" />
          Duyệt Đăng Ký Đối Tác
        </h2>
        <p className="text-slate-400 text-sm">
          Phê duyệt tài khoản và xác minh thông tin pháp lý của Đối tác Nhà hàng và Tài xế giao hàng mới đăng ký.
        </p>
      </div>

      {/* Search and Filter Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <input 
            type="text" 
            placeholder="Tìm theo tên, số điện thoại, email, biển số xe, nhà hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        </div>

        <div className="w-full md:w-56">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-350 text-sm focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
          >
            <option value="">Tất cả đối tác</option>
            <option value="driver">Tài xế giao hàng (Shipper)</option>
            <option value="restaurant_owner">Đối tác Nhà hàng</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải hồ sơ đăng ký đối tác...</div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>
      ) : filteredPartners.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800 rounded-2xl text-slate-500 text-xs py-12">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2 animate-bounce" />
          <span className="font-bold text-slate-300">Không tìm thấy hồ sơ</span>
          <span>Không tìm thấy đăng ký đối tác nào khớp với tiêu chí tìm kiếm!</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {displayedPartners.map((p) => (
            <div 
              key={p.id_User}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700/60 transition-all group"
            >
              <div className="space-y-5">
                {/* Header card: Role & Basic info */}
                <div className="flex justify-between items-start border-b border-slate-800/60 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-extrabold uppercase shadow-inner text-sm">
                      {p.role === 'driver' ? 'Ship' : 'Res'}
                    </div>
                    <div>
                      <span className="block text-sm font-black text-slate-100">{p.fullName}</span>
                      <span className="block text-[10px] text-slate-500">Đăng ký ngày: {new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${
                    p.role === 'driver' 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  }`}>
                    {p.role === 'driver' ? 'Shipper Partner' : 'Restaurant Partner'}
                  </span>
                </div>

                {/* Details Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Common contacts */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{p.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{p.email || 'Chưa cung cấp email'}</span>
                    </div>
                  </div>

                  {/* Specific profiles */}
                  {p.role === 'driver' ? (
                    <div className="space-y-2 border-l border-slate-800 md:pl-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Award className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-semibold">BKS: {p.license_plate || 'N/A'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {p.cccd_Front && (
                          <button 
                            onClick={() => setPreviewImage({ title: 'CCCD Mặt Trước', url: p.cccd_Front })}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] rounded-lg text-slate-300 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-slate-400" /> CCCD Trước
                          </button>
                        )}
                        {p.cccd_Back && (
                          <button 
                            onClick={() => setPreviewImage({ title: 'CCCD Mặt Sau', url: p.cccd_Back })}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] rounded-lg text-slate-300 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-slate-400" /> CCCD Sau
                          </button>
                        )}
                        {p.driving_License && (
                          <button 
                            onClick={() => setPreviewImage({ title: 'Bằng Lái Xe', url: p.driving_License })}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] rounded-lg text-slate-300 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-slate-400" /> Bằng Lái
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 border-l border-slate-800 md:pl-4">
                      <div className="font-bold text-slate-200">{p.name_Restaurant || 'Tên nhà hàng N/A'}</div>
                      <div className="flex items-start gap-1 text-[10px] text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{p.restaurant_address || 'Địa chỉ N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval Actions buttons */}
              <div className="flex gap-3 border-t border-slate-800/60 pt-4 mt-5">
                <button 
                  onClick={() => setRejectId(p.id_User)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-xl transition-all font-semibold text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Từ Chối Hồ Sơ
                </button>
                <button 
                  onClick={() => handleApprove(p.id_User, p.fullName)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl transition-all font-semibold text-xs shadow-lg shadow-emerald-500/10 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  Phê Duyệt
                </button>
              </div>
            </div>
          ))
        }
      </div>
      {filteredPartners.length > 4 && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isCollapsed ? `Hiển thị tất cả (${filteredPartners.length} hồ sơ)` : 'Thu gọn hồ sơ'}
              </button>
            </div>
          )}
        </>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={() => setPreviewImage(null)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-5 relative z-10 overflow-hidden text-center">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setPreviewImage(null)}>
              <X className="w-6 h-6" />
            </button>
            <h4 className="text-sm font-black text-slate-200 mb-3 tracking-wide uppercase">{previewImage.title}</h4>
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[450px]">
              <img 
                src={previewImage.url} 
                alt="Document preview" 
                className="max-w-full max-h-[440px] object-contain"
                onError={(e) => {
                  // Fallback for missing photos in dev/dummy data
                  e.target.onerror = null;
                  e.target.src = 'https://placehold.co/600x400/0f172a/94a3b8?text=Anh+Xac+Minh+Bao+Mat';
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">Tất cả hình ảnh đã được mã hóa truyền tải an toàn SSL.</p>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setRejectId(null)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative z-10 text-left">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setRejectId(null)}>
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-100 mb-2 flex items-center gap-2">
              <AlertTriangle className="text-red-500 animate-pulse" />
              Từ Chối Đăng Ký Đối Tác
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Bạn đang thực hiện từ chối đăng ký. Vui lòng cung cấp lý do cụ thể (ví dụ: CCCD mờ, bằng lái hết hạn...) để hệ thống tự động thông báo và hỗ trợ đối tác đăng ký lại.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Lý do từ chối *</label>
                <textarea 
                  required
                  rows="3"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do chi tiết tại đây..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-red-500 placeholder-slate-600"
                ></textarea>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setRejectId(null); setRejectReason(''); }}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Xác Nhận Từ Chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
