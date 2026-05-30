import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Phone, Lock, User, Store, MapPin, AlignLeft, 
  Image, Upload, ChevronRight, ChevronLeft, Mail 
} from 'lucide-react';

const RegisterRestaurant = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    name_Restaurant: '',
    description: '',
    address: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoFile(reader.result);
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverFile(reader.result);
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.fullName || !formData.phone || !formData.password || !formData.confirmPassword) {
      return setError('Vui lòng nhập đầy đủ thông tin bắt buộc');
    }

    if (formData.password !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp');
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name_Restaurant || !formData.address) {
      return setError('Vui lòng cung cấp tên nhà hàng và địa chỉ');
    }

    setIsLoading(true);
    try {
      const payload = {
        phone: formData.phone,
        password: formData.password,
        fullName: formData.fullName,
        email: formData.email,
        name_Restaurant: formData.name_Restaurant,
        description: formData.description,
        address: formData.address,
        logo: logoFile || '',
        cover_image: coverFile || ''
      };

      const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/register-restaurant`, payload);

      alert(res.data.message || 'Đăng ký tài khoản Đối tác nhà hàng thành công! Vui lòng chờ quản trị viên phê duyệt để kích hoạt hoạt động.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-orange-200/50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-yellow-200/40 blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link to="/" className="flex justify-center text-orange-500 mb-6">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-orange-100">
            <span className="font-bold text-2xl tracking-tight">MonNgonTaiNha</span>
          </div>
        </Link>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          Đăng ký đối tác nhà hàng
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Tạo gian hàng bán món ngon của bạn ngay hôm nay
        </p>

        {/* Step Indicator */}
        <div className="mt-6 flex justify-center items-center gap-2">
          <div className={`w-8 h-2 rounded-full transition-all duration-300 ${step === 1 ? 'bg-orange-500 w-12' : 'bg-slate-300'}`}></div>
          <div className={`w-8 h-2 rounded-full transition-all duration-300 ${step === 2 ? 'bg-orange-500 w-12' : 'bg-slate-300'}`}></div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/80 backdrop-blur-xl py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-white">
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100 mb-5">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form className="space-y-5" onSubmit={handleNextStep}>
              <h3 className="text-base font-semibold text-slate-900 border-b pb-2 mb-4">
                Bước 1: Thông tin cá nhân
              </h3>

              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Nhập họ và tên"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email (nếu có)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="example@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Nhập mật khẩu"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                  Xác nhận mật khẩu <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all"
                >
                  Tiếp theo <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <h3 className="text-base font-semibold text-slate-900 border-b pb-2 mb-4 flex items-center justify-between">
                <span>Bước 2: Thông tin nhà hàng</span>
                <button 
                  type="button" 
                  onClick={() => setStep(1)} 
                  className="text-xs text-orange-500 hover:underline flex items-center gap-1 font-medium"
                >
                  <ChevronLeft className="w-3 h-3" /> Quay lại
                </button>
              </h3>

              <div>
                <label htmlFor="name_Restaurant" className="block text-sm font-medium text-slate-700">
                  Tên nhà hàng <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Store className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="name_Restaurant"
                    name="name_Restaurant"
                    type="text"
                    required
                    value={formData.name_Restaurant}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Nhập tên nhà hàng/quán ăn"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-slate-700">
                  Địa chỉ nhà hàng <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="address"
                    name="address"
                    type="text"
                    required
                    value={formData.address}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                  Giới thiệu ngắn (mô tả)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <AlignLeft className="h-5 w-5 text-slate-400" />
                  </div>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm bg-slate-50/50 transition-colors"
                    placeholder="Mô tả ngắn về quán ăn (không bắt buộc)..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Logo nhà hàng</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-all text-center min-h-[90px]">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-full object-cover shadow-sm border border-slate-100" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[11px] text-slate-500">Tải ảnh lên</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ảnh bìa (Cover)</label>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-all text-center min-h-[90px]">
                    {coverPreview ? (
                      <img src={coverPreview} alt="Cover" className="w-full h-16 rounded-lg object-cover shadow-sm border border-slate-100" />
                    ) : (
                      <>
                        <Image className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[11px] text-slate-500">Tải ảnh lên</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none transition-all flex justify-center items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Hoàn tất đăng ký <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="text-xs text-center text-slate-500 mt-5">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-orange-500 hover:underline">
              Đăng nhập tại đây
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterRestaurant;
