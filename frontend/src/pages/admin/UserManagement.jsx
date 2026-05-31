import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, UserPlus, ShieldAlert, Edit3, Trash2, Ban, ShieldCheck, 
  X, Check, AlertTriangle, Star, CheckSquare, PlusCircle
} from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search and filter states
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    fullName: '',
    email: '',
    role: 'customer',
    status: 'active',
    reputation_score: 100
  });

  const fetchUsers = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    console.log('FRONTEND Search: fetchUsers called with params:', { search, roleFilter, statusFilter });
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/users`, {
        params: { search, role: roleFilter, status: statusFilter },
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh sách người dùng từ API');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(() => {
      fetchUsers(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, [search, roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleOpenEdit = (user) => {
    setCurrentUser(user);
    setFormData({
      phone: user.phone || '',
      password: '', // do not display password
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'customer',
      status: user.status || 'active',
      reputation_score: user.reputation_score !== undefined ? user.reputation_score : 100
    });
    setShowEditModal(true);
  };

  const handleOpenCreate = () => {
    setFormData({
      phone: '',
      password: '',
      fullName: '',
      email: '',
      role: 'customer',
      status: 'active',
      reputation_score: 100
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/users`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo người dùng.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/users/${currentUser.id_User}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật.');
    }
  };

  const handleBanUser = async (id) => {
    if (!window.confirm('Bạn có thực sự muốn khoá tài khoản người dùng này?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi khoá người dùng.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Quản Lý Người Dùng</h2>
          <p className="text-slate-400 text-sm">Xem danh sách, phân quyền, quản lý uy tín và điều phối tài khoản hệ thống.</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="self-start flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 hover:scale-102 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Tạo Người Dùng Mới
        </button>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search box */}
          <div className="w-full md:flex-1 relative">
            <input 
              type="text" 
              placeholder="Tìm kiếm theo họ tên, số điện thoại, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          </div>

          {/* Role filter */}
          <div className="w-full md:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả các vai trò</option>
              <option value="customer">Khách hàng</option>
              <option value="driver">Tài xế (Shipper)</option>
              <option value="restaurant_owner">Chủ nhà hàng</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>

          {/* Status filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đang chờ duyệt</option>
              <option value="banned">Đã bị khoá</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full md:w-28 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700/60"
          >
            Tìm Kiếm
          </button>
        </form>
      </div>

      {/* USER LIST TABLE */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải danh sách người dùng...</div>
      ) : users.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800 rounded-2xl text-slate-500 text-xs py-12">
          <AlertTriangle className="w-8 h-8 text-slate-600 mb-2" />
          <span>Không tìm thấy người dùng phù hợp.</span>
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Họ Tên / Phone</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Vai Trò</th>
                  <th className="px-6 py-4">Uy Tín</th>
                  <th className="px-6 py-4">Đơn Hàng</th>
                  <th className="px-6 py-4">Trạng Thái</th>
                  <th className="px-6 py-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(isCollapsed ? users.slice(0, 5) : users).map((u) => {
                  const roleColors = {
                    admin: 'bg-red-500/10 text-red-400 border-red-500/20',
                    restaurant_owner: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    driver: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                    customer: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  };

                  const statusColors = {
                    active: 'bg-green-500/10 text-green-400',
                    inactive: 'bg-yellow-500/10 text-yellow-400',
                    banned: 'bg-red-500/10 text-red-400'
                  };

                  return (
                    <tr key={u.id_User} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold uppercase text-xs border border-slate-700 shadow-inner">
                            {u.avatar ? (
                              <img src={u.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              u.fullName[0]
                            )}
                          </div>
                          <div>
                            <span className="block font-bold text-slate-200 text-sm">{u.fullName}</span>
                            <span className="block text-[10px] text-slate-500">{u.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{u.email || 'Chưa cung cấp'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${roleColors[u.role] || 'bg-slate-500/10'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span className="font-extrabold text-slate-200">{u.reputation_score || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-300">{u.total_orders || 0} đơn</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${statusColors[u.status] || 'bg-slate-500/10'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {u.status !== 'banned' && u.role !== 'admin' && (
                            <button 
                              onClick={() => handleBanUser(u.id_User)}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-all cursor-pointer"
                              title="Khoá tài khoản"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.length > 5 && (
            <div className="flex justify-center p-4 border-t border-slate-800 bg-slate-900/10">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-750 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isCollapsed ? `Hiển thị tất cả (${users.length} người dùng)` : 'Thu gọn danh sách'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative z-10 overflow-hidden">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setShowCreateModal(false)}>
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <UserPlus className="text-blue-500" />
              Tạo Người Dùng Mới
            </h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Họ và tên *</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Số điện thoại *</label>
                  <input required type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Mật khẩu *</label>
                  <input required type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Vai trò</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                    <option value="customer">Customer</option>
                    <option value="driver">Driver</option>
                    <option value="restaurant_owner">Restaurant Owner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Trạng thái</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                  Hủy
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
                  Tạo Mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 relative z-10 overflow-hidden">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setShowEditModal(false)}>
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <Edit3 className="text-amber-500" />
              Chỉnh Sửa Người Dùng
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Họ và tên *</label>
                <input required type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Vai trò</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                    <option value="customer">Customer</option>
                    <option value="driver">Driver</option>
                    <option value="restaurant_owner">Restaurant Owner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Trạng thái</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Điểm Uy Tín (0 - 100)</label>
                <input type="number" min="0" max="100" name="reputation_score" value={formData.reputation_score} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                  Hủy
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
