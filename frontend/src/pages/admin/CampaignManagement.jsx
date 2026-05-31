import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Flame, PlusCircle, ToggleLeft, ToggleRight, Sparkles, X, 
  Check, Calendar, DollarSign, Award, Percent, Ticket,
  Pencil, Trash2, AlertTriangle, Save, RefreshCw, Search
} from 'lucide-react';

const EMPTY_FORM = {
  code: '',
  type: 'percent',
  value: '',
  min_OrderValue: '',
  max_Discount: '',
  usage_Limit: '',
  star_Date: '',
  end_Date: '',
  is_hot: false,
  id_Restaurant: '',
  is_Applicable_To: 'all',
  sys_funding_percent: 100,
  res_funding_percent: 0,
  usage_limit_per_user: 1
};

export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);

  const typeLabel = (t) => {
    if (t === 'percent') return 'Giảm phần trăm';
    if (t === 'fixed') return 'Số tiền cố định';
    return 'Miễn phí giao hàng';
  };

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null); // campaign object
  const [deleting, setDeleting] = useState(false);

  const fetchCampaigns = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh sách chương trình khuyến mãi.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(() => {
      fetchCampaigns(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setModalMode('create');
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (campaign) => {
    // Format dates back to yyyy-MM-dd for input[type=date]
    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 10);
    };
    setFormData({
      code: campaign.code || '',
      type: campaign.type || 'percent',
      value: campaign.value ?? '',
      min_OrderValue: campaign.min_OrderValue ?? '',
      max_Discount: campaign.max_Discount ?? '',
      usage_Limit: campaign.usage_Limit ?? '',
      star_Date: fmtDate(campaign.star_Date),
      end_Date: fmtDate(campaign.end_Date),
      is_hot: !!(campaign.is_hot),
      id_Restaurant: campaign.id_Restaurant ?? '',
      is_Applicable_To: campaign.is_Applicable_To || 'all',
      sys_funding_percent: campaign.sys_funding_percent ?? 100,
      res_funding_percent: campaign.res_funding_percent ?? 0,
      usage_limit_per_user: campaign.usage_limit_per_user ?? 1
    });
    setModalMode('edit');
    setEditingId(campaign.id_Promo);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        id_Restaurant: formData.is_Applicable_To === 'restaurant' && formData.id_Restaurant !== '' ? Number(formData.id_Restaurant) : null
      };

      if (modalMode === 'create') {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/campaigns`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.put(`${import.meta.env.VITE_API_URL}/admin/campaigns/${editingId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      closeModal();
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message;
      const serverErr = err.response?.data?.error;
      alert(`${serverMsg || 'Có lỗi xảy ra.'}${serverErr ? `\nChi tiết: ${serverErr}` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHot = async (campaign) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/campaigns/${campaign.id_Promo}/hot`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message;
      alert(serverMsg || 'Có lỗi xảy ra khi kích hoạt chương trình hot.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`${import.meta.env.VITE_API_URL}/admin/campaigns/${deleteTarget.id_Promo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      setDeleteTarget(null);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message;
      alert(serverMsg || 'Có lỗi xảy ra khi xóa chiến dịch.');
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = 
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.id_Restaurant && String(c.id_Restaurant).includes(searchQuery));
    const matchesType = typeFilter ? c.type === typeFilter : true;
    return matchesSearch && matchesType;
  });

  const displayedCampaigns = isCollapsed ? filteredCampaigns.slice(0, 4) : filteredCampaigns;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Flame className="text-orange-500 animate-pulse" />
            Cập Nhật Chương Trình Hot Hệ Thống
          </h2>
          <p className="text-slate-400 text-sm">
            Kích hoạt các chương trình khuyến mãi khẩn cấp, banner quảng cáo nổi bật và phân phối mã Voucher hệ thống.
          </p>
        </div>
        <button 
          onClick={openCreate}
          className="self-start flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/15 transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
        >
          <PlusCircle className="w-4 h-4" />
          Tạo Chiến Dịch Mới
        </button>
      </div>

      {/* Search and Filter Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <input 
            type="text" 
            placeholder="Tìm theo mã khuyến mãi, ID nhà hàng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        </div>

        <div className="w-full md:w-56">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
          >
            <option value="">Tất cả hình thức</option>
            <option value="percent">Giảm phần trăm</option>
            <option value="fixed">Số tiền cố định</option>
            <option value="freeship">Miễn phí giao hàng</option>
          </select>
        </div>
      </div>

      {/* CAMPAIGN LIST */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải chiến dịch...</div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800 rounded-2xl text-slate-500 text-xs py-12">
          <Sparkles className="w-8 h-8 text-amber-500 mb-2 animate-bounce" />
          <span className="font-bold text-slate-300">Không tìm thấy chiến dịch</span>
          <span>Không tìm thấy chương trình khuyến mãi nào khớp với tiêu chí tìm kiếm!</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedCampaigns.map((c) => {
            const isHot = c.is_hot === 1 || c.is_hot === true;
            return (
              <div 
                key={c.id_Promo}
                className={`bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700/80 transition-all relative overflow-hidden group ${
                  isHot ? 'border-orange-500/30' : 'border-slate-800/80'
                }`}
              >
                {/* Visual heat waves background for Hot Program */}
                {isHot && (
                  <div className="absolute -top-12 -right-12 w-28 h-28 bg-orange-600/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-all"></div>
                )}

                <div className="space-y-4">
                  {/* Top card metadata */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 text-blue-400">
                        {c.type === 'percent' ? (
                          <Percent className="w-4 h-4 text-orange-400" />
                        ) : c.type === 'fixed' ? (
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                        )}
                      </div>
                      <div>
                        <span className="block font-black text-slate-100 text-sm tracking-wide">{c.code}</span>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                          {typeLabel(c.type)}
                        </span>
                      </div>
                    </div>

                    {/* Hot Campaign Switch badge */}
                    <button 
                      onClick={() => handleToggleHot(c)}
                      title={isHot ? 'Tắt Hot' : 'Bật Hot'}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-extrabold uppercase transition-all tracking-wider cursor-pointer ${
                        isHot 
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 animate-pulse hover:bg-orange-500/20' 
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Flame className={`w-3.5 h-3.5 ${isHot ? 'text-orange-500' : 'text-slate-500'}`} />
                      {isHot ? 'Chương trình Hot' : 'Bật Hot'}
                    </button>
                  </div>

                  {/* Promotion details summary */}
                  <div className="space-y-2 bg-slate-950/20 border border-slate-850 p-4 rounded-xl text-xs leading-relaxed">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Mức giảm giá:</span>
                      <strong className="text-slate-200 font-extrabold">
                        {c.type === 'percent' ? `${c.value}%` : formatPrice(c.value)}
                      </strong>
                    </div>
                    {c.min_OrderValue && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Đơn tối thiểu:</span>
                        <strong className="text-slate-200">{formatPrice(c.min_OrderValue)}</strong>
                      </div>
                    )}
                    {c.max_Discount && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Giảm tối đa:</span>
                        <strong className="text-slate-200">{formatPrice(c.max_Discount)}</strong>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Lượt sử dụng:</span>
                      <strong className="text-slate-200">
                        {c.used_Count} / {c.usage_Limit !== null ? c.usage_Limit : 'Vô hạn'}
                      </strong>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>
                      {c.star_Date ? new Date(c.star_Date).toLocaleDateString('vi-VN') : 'Bắt đầu ngay'}
                      <span className="mx-1">➔</span>
                      {c.end_Date ? new Date(c.end_Date).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                    </span>
                  </div>
                </div>

                {/* Footer: type label + action buttons */}
                <div className="pt-4 border-t border-slate-800/60 mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    {c.is_Applicable_To === 'restaurant' ? 'Voucher Nhà hàng' : c.is_Applicable_To === 'driver' ? 'Voucher Shipper' : 'Voucher Hệ thống'}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Edit button */}
                    <button
                      onClick={() => openEdit(c)}
                      title="Chỉnh sửa chiến dịch"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500/20 border border-slate-700 hover:border-blue-500/40 text-slate-400 hover:text-blue-400 transition-all cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteTarget(c)}
                      title="Xóa chiến dịch"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filteredCampaigns.length > 4 && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {isCollapsed ? `Hiển thị tất cả (${filteredCampaigns.length} chiến dịch)` : 'Thu gọn khuyến mãi'}
            </button>
          </div>
        )}
      </>
    )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative z-10 text-left overflow-hidden max-h-[90vh] overflow-y-auto">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={closeModal}>
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              {modalMode === 'create' ? (
                <><Ticket className="text-orange-500" />Tạo Chương Trình Chiến Dịch Mới</>
              ) : (
                <><Pencil className="text-blue-400" />Chỉnh Sửa Chiến Dịch</>
              )}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Mã Khuyến Mãi *</label>
                  <input 
                    required 
                    type="text" 
                    name="code" 
                    value={formData.code} 
                    onChange={handleInputChange} 
                    placeholder="ví dụ: GIAM50K"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 font-mono" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Loại Khuyến Mãi</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-orange-500">
                    <option value="percent">Percent (%) - Giảm theo phần trăm</option>
                    <option value="fixed">Fixed (VND) - Giảm tiền cố định</option>
                    <option value="freeship">Freeship - Miễn phí giao hàng</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Đối Tượng Áp Dụng</label>
                  <select 
                    name="is_Applicable_To" 
                    value={formData.is_Applicable_To} 
                    onChange={handleInputChange} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-orange-500 cursor-pointer font-semibold"
                  >
                    <option value="all">Mã Hệ Thống dành cho Khách Hàng</option>
                    <option value="restaurant">Mã Đối Tác Nhà Hàng dành cho Khách Hàng</option>
                    <option value="driver">Mã Đối Tác Shipper dành cho Khách Hàng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">
                    {formData.is_Applicable_To === 'restaurant' ? 'Mã Nhà Hàng (ID Restaurant) *' : 'Mã Nhà Hàng (Không áp dụng)'}
                  </label>
                  <input 
                    type="number" 
                    name="id_Restaurant" 
                    value={formData.id_Restaurant} 
                    onChange={handleInputChange} 
                    placeholder={formData.is_Applicable_To === 'restaurant' ? 'ví dụ: 1, 2...' : 'Chỉ mở khóa cho Nhà hàng'}
                    disabled={formData.is_Applicable_To !== 'restaurant'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600 disabled:opacity-40 disabled:cursor-not-allowed" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Giá Trị Giảm *</label>
                  <input 
                    required 
                    type="number" 
                    name="value" 
                    value={formData.value} 
                    onChange={handleInputChange} 
                    placeholder="ví dụ: 10 hoặc 50000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Đơn Hàng Tối Thiểu (VND)</label>
                  <input 
                    type="number" 
                    name="min_OrderValue" 
                    value={formData.min_OrderValue} 
                    onChange={handleInputChange} 
                    placeholder="ví dụ: 100000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" 
                  />
                </div>
              </div>

              {/* CO-FUNDING SPLIT & PERSONAL LIMIT UPGRADE */}
              <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl space-y-4">
                <span className="block text-[10px] font-black text-orange-400 uppercase tracking-wider">Cấu hình đồng tài trợ & giới hạn người dùng</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Tài trợ Hệ Thống (%)</label>
                    <input 
                      type="number" 
                      name="sys_funding_percent" 
                      min="0"
                      max="100"
                      value={formData.sys_funding_percent} 
                      onChange={(e) => {
                        const val = Math.min(Math.max(Number(e.target.value) || 0, 0), 100);
                        setFormData(prev => ({
                          ...prev,
                          sys_funding_percent: val,
                          res_funding_percent: 100 - val
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 font-bold" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Tài trợ Nhà Hàng (%)</label>
                    <input 
                      type="number" 
                      name="res_funding_percent" 
                      min="0"
                      max="100"
                      value={formData.res_funding_percent} 
                      onChange={(e) => {
                        const val = Math.min(Math.max(Number(e.target.value) || 0, 0), 100);
                        setFormData(prev => ({
                          ...prev,
                          res_funding_percent: val,
                          sys_funding_percent: 100 - val
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase">Giới hạn sử dụng / mỗi khách hàng *</label>
                  <input 
                    required
                    type="number" 
                    name="usage_limit_per_user" 
                    min="1"
                    value={formData.usage_limit_per_user} 
                    onChange={handleInputChange}
                    placeholder="ví dụ: 1 lượt/khách"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Giới Hạn Lượt Dùng</label>
                  <input 
                    type="number" 
                    name="usage_Limit" 
                    value={formData.usage_Limit} 
                    onChange={handleInputChange} 
                    placeholder="ví dụ: 100"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Giảm Tối Đa (cho %)</label>
                  <input 
                    type="number" 
                    name="max_Discount" 
                    value={formData.max_Discount} 
                    onChange={handleInputChange} 
                    placeholder="ví dụ: 50000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500 placeholder-slate-600" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Ngày bắt đầu</label>
                  <input 
                    type="date" 
                    name="star_Date" 
                    value={formData.star_Date} 
                    onChange={handleInputChange} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-orange-500 cursor-pointer" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Ngày kết thúc</label>
                  <input 
                    type="date" 
                    name="end_Date" 
                    value={formData.end_Date} 
                    onChange={handleInputChange} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-orange-500 cursor-pointer" 
                  />
                </div>
              </div>

              <div className="flex items-center pl-2 pt-2">
                <input 
                  type="checkbox" 
                  id="is_hot" 
                  name="is_hot" 
                  checked={formData.is_hot} 
                  onChange={handleInputChange} 
                  className="w-4 h-4 bg-slate-950 border border-slate-800 rounded text-orange-600 focus:ring-orange-500 cursor-pointer" 
                />
                <label htmlFor="is_hot" className="ml-2 text-xs font-bold text-slate-300 select-none cursor-pointer">
                  Đặt làm chiến dịch Hot chạy banner hệ thống
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all text-white ${
                    modalMode === 'create'
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : modalMode === 'create' ? (
                    <><Ticket className="w-3.5 h-3.5" />Kích Hoạt Mã</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" />Lưu Thay Đổi</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}></div>
          <div className="bg-slate-900 border border-red-500/20 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative z-10">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-100 mb-1">Xác nhận xóa chiến dịch</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bạn có chắc chắn muốn xóa mã khuyến mãi <span className="font-mono font-bold text-red-400">"{deleteTarget.code}"</span>?
                  <br />Hành động này không thể hoàn tác.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <><Trash2 className="w-3.5 h-3.5" />Xóa ngay</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
