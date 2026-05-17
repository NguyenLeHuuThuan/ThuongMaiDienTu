import { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Plus, Edit2, Trash2, Check, X } from 'lucide-react';

const AddressesList = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', full_Address: '', note: '', is_Default: false });
  const [editingId, setEditingId] = useState(null);

  const fetchAddresses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/users/addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAddresses(res.data);
    } catch (error) {
      console.error('Error fetching addresses', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (editingId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/users/addresses/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/users/addresses`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', full_Address: '', note: '', is_Default: false });
      fetchAddresses();
    } catch (error) {
      console.error('Error saving address', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL}/users/addresses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAddresses();
    } catch (error) {
      console.error('Error deleting address', error);
    }
  };

  const handleEdit = (addr) => {
    setFormData(addr);
    setEditingId(addr.id_Address);
    setShowForm(true);
  };

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-bold text-lg text-slate-800">Sổ địa chỉ</h3>
        {!showForm && (
          <button 
            onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', phone: '', full_Address: '', note: '', is_Default: false }); }}
            className="flex items-center gap-1 text-sm font-medium bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition"
          >
            <Plus className="w-4 h-4" /> Thêm địa chỉ mới
          </button>
        )}
      </div>

      <div className="p-6">
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="font-semibold text-slate-800 mb-2">{editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên (Nhà/Công ty)</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số điện thoại</label>
                <input required type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Địa chỉ đầy đủ</label>
                <input required type="text" value={formData.full_Address} onChange={e => setFormData({...formData, full_Address: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú (Tùy chọn)</label>
                <input type="text" value={formData.note || ''} onChange={e => setFormData({...formData, note: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="is_Default" checked={formData.is_Default} onChange={e => setFormData({...formData, is_Default: e.target.checked})} className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4" />
                <label htmlFor="is_Default" className="text-sm font-medium text-slate-700">Đặt làm địa chỉ mặc định</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 transition">Hủy</button>
              <button type="submit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">Lưu địa chỉ</button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {addresses.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Chưa có địa chỉ nào.</div>
            ) : (
              addresses.map(addr => (
                <div key={addr.id_Address} className="flex justify-between items-start p-4 border rounded-xl hover:border-orange-300 transition relative">
                  {addr.is_Default && <span className="absolute top-2 right-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">Mặc định</span>}
                  <div className="flex gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        {addr.name} 
                        <span className="text-sm font-normal text-slate-500 border-l pl-2 border-slate-300">{addr.phone}</span>
                      </div>
                      <div className="text-slate-600 mt-1">{addr.full_Address}</div>
                      {addr.note && <div className="text-sm text-slate-500 mt-0.5">Ghi chú: {addr.note}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <button onClick={() => handleEdit(addr)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Sửa"><Edit2 className="w-4 h-4" /></button>
                    {!addr.is_Default && (
                      <button onClick={() => handleDelete(addr.id_Address)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressesList;
