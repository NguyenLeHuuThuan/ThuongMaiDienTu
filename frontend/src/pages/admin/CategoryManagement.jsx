import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ListCollapse, PlusCircle, Edit3, Trash2, ArrowUp, ArrowDown, 
  X, Check, AlertCircle, RefreshCw, Layers
} from 'lucide-react';

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Modals and form state
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    display_order: 0,
    is_active: true
  });

  const fetchCategories = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
 
      // Self-healing database curation: check if any display_order is 0
      const needsCure = res.data.some(c => c.display_order === 0);
 
      if (needsCure && res.data.length > 0) {
        // Sort them alphabetically first to establish a clean initial alphabetical order
        const sortedAlphabetically = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
        // Perform silent sequential update
        for (let i = 0; i < sortedAlphabetically.length; i++) {
          const cat = sortedAlphabetically[i];
          await axios.put(`${import.meta.env.VITE_API_URL}/admin/categories/${cat.id_Category}`, {
            name: cat.name,
            icon: cat.icon,
            display_order: i + 1,
            is_active: cat.is_active === 1 || cat.is_active === true
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
        // Fetch fresh cured data
        const freshRes = await axios.get(`${import.meta.env.VITE_API_URL}/admin/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const curedSorted = freshRes.data.sort((a, b) => a.display_order - b.display_order);
        setCategories(curedSorted);
      } else {
        const sorted = res.data.sort((a, b) => a.display_order - b.display_order);
        setCategories(sorted);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi tải danh mục món ăn từ database.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchCategories();
    const interval = setInterval(() => {
      fetchCategories(true);
    }, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setFormData({
      name: '',
      icon: '',
      display_order: categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) + 1 : 1,
      is_active: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setIsEditMode(true);
    setCurrentCategory(cat);
    setFormData({
      name: cat.name || '',
      icon: cat.icon || '',
      display_order: cat.display_order !== undefined ? cat.display_order : 0,
      is_active: cat.is_active === 1 || cat.is_active === true
    });
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        display_order: Number(formData.display_order) || 0
      };

      if (isEditMode) {
        await axios.put(`${import.meta.env.VITE_API_URL}/admin/categories/${currentCategory.id_Category}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/categories`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleToggleActive = async (cat) => {
    try {
      const token = localStorage.getItem('token');
      const isActive = cat.is_active === 1 || cat.is_active === true;
      const updatedData = {
        name: cat.name,
        icon: cat.icon,
        display_order: cat.display_order,
        is_active: !isActive
      };
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/categories/${cat.id_Category}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCategories();
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi ẩn/hiện danh mục.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có đồng ý xóa hoặc ẩn danh mục món ăn này?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL}/admin/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCategories();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa danh mục.');
    }
  };

  // Up/Down visual display_order sorting
  const handleMoveOrder = async (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const currentCat = categories[index];
    const targetCat = categories[newIndex];

    try {
      const token = localStorage.getItem('token');
      
      // Swap display_order in database
      const currentOrder = currentCat.display_order;
      const targetOrder = targetCat.display_order;

      // Update current
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/categories/${currentCat.id_Category}`, {
        name: currentCat.name,
        icon: currentCat.icon,
        display_order: targetOrder,
        is_active: currentCat.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update target
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/categories/${targetCat.id_Category}`, {
        name: targetCat.name,
        icon: targetCat.icon,
        display_order: currentOrder,
        is_active: targetCat.is_active
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchCategories();
    } catch (err) {
      console.error(err);
      alert('Lỗi đồng bộ hóa thứ tự danh mục.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <ListCollapse className="text-blue-400" />
            Quản Lý Danh Mục Món Ăn
          </h2>
          <p className="text-slate-400 text-sm">
            Tối ưu hóa UX trải nghiệm tìm kiếm của Khách hàng, tạo nền tảng cho bộ lọc và chiến dịch kinh doanh linh hoạt.
          </p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="self-start flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Thêm Mới Danh Mục
        </button>
      </div>

      {/* CATEGORY GRID */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải danh mục...</div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>
      ) : categories.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-900/20 border border-slate-800 rounded-2xl text-slate-500 text-xs">
          <span>Không có danh mục nào. Thêm mới để tạo dữ liệu.</span>
        </div>
      ) : (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4 w-20">Thứ Tự</th>
                  <th className="px-6 py-4">Tên Danh Mục</th>
                  <th className="px-6 py-4">Đường dẫn Icon</th>
                  <th className="px-6 py-4 w-40">Trạng Thái</th>
                  <th className="px-6 py-4 text-right w-44">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {(isCollapsed ? categories.slice(0, 5) : categories).map((c, index) => {
                  const isActive = c.is_active === 1 || c.is_active === true;
                  return (
                    <tr key={c.id_Category} className={`hover:bg-slate-800/10 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        {/* Up/Down arrow sort buttons */}
                        <div className="flex items-center gap-1.5">
                          <button 
                            disabled={index === 0}
                            onClick={() => handleMoveOrder(index, 'up')}
                            className={`p-1 rounded bg-slate-800 border border-slate-700/60 hover:bg-slate-750 transition-all ${
                              index === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-blue-400'
                            }`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            disabled={index === categories.length - 1}
                            onClick={() => handleMoveOrder(index, 'down')}
                            className={`p-1 rounded bg-slate-800 border border-slate-700/60 hover:bg-slate-750 transition-all ${
                              index === categories.length - 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:text-blue-400'
                            }`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shadow-inner">
                            <Layers className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-extrabold text-slate-200 text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-[10px]">{c.icon || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleToggleActive(c)}
                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors cursor-pointer ${
                              isActive ? 'bg-blue-600' : 'bg-slate-800'
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 bg-white rounded-full transition-transform shadow ${
                              isActive ? 'translate-x-4.5' : 'translate-x-0'
                            }`}></div>
                          </button>
                          <span className={`text-[10px] font-bold uppercase ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                            {isActive ? 'Hiển Thị' : 'Đang Ẩn'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Chỉnh sửa danh mục"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id_Category)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/35 rounded-lg text-red-400 hover:text-red-300 transition-all cursor-pointer"
                            title="Xóa danh mục"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {categories.length > 5 && (
            <div className="flex justify-center p-4 border-t border-slate-800 bg-slate-900/10">
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-750 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isCollapsed ? `Hiển thị tất cả (${categories.length} danh mục)` : 'Thu gọn danh sách'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative z-10 text-left overflow-hidden">
            <button className="absolute top-4 right-4 text-slate-400 hover:text-white" onClick={() => setShowModal(false)}>
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-100 mb-4 flex items-center gap-2">
              <Layers className="text-blue-500" />
              {isEditMode ? 'Cập Nhật Danh Mục' : 'Thêm Danh Mục Mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Tên danh mục *</label>
                <input 
                  required 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  placeholder="ví dụ: Cơm trưa, Đồ ăn nhanh..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Đường dẫn Icon (URL / Path)</label>
                <input 
                  type="text" 
                  name="icon" 
                  value={formData.icon} 
                  onChange={handleInputChange} 
                  placeholder="ví dụ: icons/com.png"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-600" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Thứ tự hiển thị</label>
                  <input 
                    type="number" 
                    name="display_order" 
                    value={formData.display_order} 
                    onChange={handleInputChange} 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="flex items-center pt-5 pl-2">
                  <input 
                    type="checkbox" 
                    id="is_active" 
                    name="is_active" 
                    checked={formData.is_active} 
                    onChange={handleInputChange} 
                    className="w-4 h-4 bg-slate-950 border border-slate-800 rounded text-blue-600 focus:ring-blue-500" 
                  />
                  <label htmlFor="is_active" className="ml-2 text-xs font-bold text-slate-300 select-none cursor-pointer">
                    Hiện ngoài trang chủ
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                  Hủy
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all">
                  {isEditMode ? 'Lưu Cập Nhật' : 'Tạo Danh Mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
