import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Phone, MapPin, Edit2, Check, Star, ShoppingBag, Shield } from 'lucide-react';

const Profile = () => {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/users/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(res.data);
        setFormData({ fullName: res.data.fullName, email: res.data.email || '' });
      } catch (error) {
        console.error('Error fetching profile', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5000/api/users/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Cập nhật thành công!');
      setIsEditing(false);
      setProfile({ ...profile, ...formData });
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Cập nhật thất bại!');
      console.error(error);
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Trang cá nhân</h1>

        {message && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-200 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar Info */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-orange-400 to-orange-500 z-0"></div>
              
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto bg-white rounded-full p-1 mb-4 shadow-md">
                  <img 
                    src={profile.avatar ? `http://localhost:5000/${profile.avatar}` : 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200&auto=format&fit=crop'} 
                    alt="Avatar" 
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {e.target.src = 'https://ui-avatars.com/api/?name=' + profile.fullName + '&background=f97316&color=fff'}}
                  />
                </div>
                
                <h2 className="text-xl font-bold text-slate-800">{profile.fullName}</h2>
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600 mt-2">
                  <Shield className="w-3 h-3 text-orange-500" />
                  Thành viên
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-orange-500 flex justify-center items-center gap-1">
                      {profile.reputation_score} <Star className="w-4 h-4 fill-orange-500" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Điểm uy tín</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-700 flex justify-center items-center gap-1">
                      {profile.total_orders || 0} <ShoppingBag className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Đơn hàng</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Info Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Thông tin liên hệ</h3>
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="p-2 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" /> {isEditing ? 'Hủy' : 'Chỉnh sửa'}
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled
                          value={profile.phone}
                          className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 sm:text-sm cursor-not-allowed"
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Số điện thoại không thể thay đổi</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Họ và tên</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled={!isEditing}
                          value={isEditing ? formData.fullName : profile.fullName}
                          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                          className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl sm:text-sm transition-colors ${
                            isEditing 
                              ? 'border-slate-300 focus:ring-orange-500 focus:border-orange-500 bg-white' 
                              : 'border-transparent bg-slate-50 text-slate-700'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="email"
                          disabled={!isEditing}
                          value={isEditing ? formData.email : (profile.email || 'Chưa cập nhật')}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className={`block w-full pl-10 pr-3 py-2.5 border rounded-xl sm:text-sm transition-colors ${
                            isEditing 
                              ? 'border-slate-300 focus:ring-orange-500 focus:border-orange-500 bg-white' 
                              : 'border-transparent bg-slate-50 text-slate-700'
                          }`}
                          placeholder="Cập nhật địa chỉ email"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ mặc định</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          disabled
                          value={profile.default_Address_Id ? 'Địa chỉ ID: ' + profile.default_Address_Id : 'Chưa thiết lập'}
                          className="block w-full pl-10 pr-3 py-2.5 border border-transparent bg-slate-50 rounded-xl sm:text-sm text-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-6 py-2 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors mr-3"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-orange-500 text-white font-medium rounded-xl hover:bg-orange-600 transition-colors shadow-md"
                      >
                        Lưu thay đổi
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
