import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Power, Info, Eye, Sliders, CheckSquare, Sparkles, Check, 
  AlertCircle, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Lock,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SystemConfig() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Wizard active step: 1 (Activate), 2 (Display), 3 (Operate), 4 (Validate), 5 (Complete)
  const [currentStep, setCurrentStep] = useState(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Buffer state to store edits during Step 3
  const [editedConfigs, setEditedConfigs] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Normalize BIT field from database (true/false or 1/0) strictly to 1 or 0
      const normalizedData = res.data.map(c => ({
        ...c,
        is_enabled: (c.is_enabled === true || c.is_enabled === 1 || String(c.is_enabled) === 'true') ? 1 : 0
      }));
      
      setConfigs(normalizedData);
      
      // Initialize editedConfigs buffer map with normalized values
      const buffer = {};
      normalizedData.forEach(c => {
        buffer[c.config_key] = {
          config_value: c.config_value,
          is_enabled: c.is_enabled
        };
      });
      setEditedConfigs(buffer);
    } catch (err) {
      console.error(err);
      setError('Lỗi tải cấu hình vận hành hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleToggleModule = (key) => {
    setEditedConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        is_enabled: prev[key].is_enabled === 1 ? 0 : 1
      }
    }));
  };

  const handleValueChange = (key, val) => {
    setEditedConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        config_value: val
      }
    }));
  };

  // Step 4: Local Bounds and business-logic validation
  const validateEditedConfigs = () => {
    const errors = [];
    
    // Time bounds
    if (editedConfigs['op_open_time']?.is_enabled === 1 && editedConfigs['op_close_time']?.is_enabled === 1) {
      const openTime = editedConfigs['op_open_time']?.config_value;
      const closeTime = editedConfigs['op_close_time']?.config_value;
      if (openTime && closeTime) {
        const [oH, oM] = openTime.split(':').map(Number);
        const [cH, cM] = closeTime.split(':').map(Number);
        if (oH > cH || (oH === cH && oM >= cM)) {
          errors.push('Giờ mở cửa phải trước giờ đóng cửa hệ thống!');
        }
      }
    }

    // Number bounds validation
    if (editedConfigs['op_service_fee_percent']?.is_enabled === 1) {
      const serviceFee = Number(editedConfigs['op_service_fee_percent']?.config_value);
      if (isNaN(serviceFee) || serviceFee < 0 || serviceFee > 50) {
        errors.push('Phần trăm phí dịch vụ thu của nhà hàng phải nằm trong khoảng từ 0% đến 50%.');
      }
    }

    if (editedConfigs['op_shipper_fee_percent']?.is_enabled === 1) {
      const shipperFee = Number(editedConfigs['op_shipper_fee_percent']?.config_value);
      if (isNaN(shipperFee) || shipperFee < 0 || shipperFee > 50) {
        errors.push('Phần trăm phí dịch vụ thu của shipper phải nằm trong khoảng từ 0% đến 50%.');
      }
    }

    if (editedConfigs['log_base_delivery_fee']?.is_enabled === 1) {
      const baseDeliveryFee = Number(editedConfigs['log_base_delivery_fee']?.config_value);
      if (isNaN(baseDeliveryFee) || baseDeliveryFee < 0 || baseDeliveryFee > 100000) {
        errors.push('Phí giao hàng cơ bản không được âm và không được quá 100.000đ.');
      }
    }

    if (editedConfigs['log_per_km_fee']?.is_enabled === 1) {
      const perKmFee = Number(editedConfigs['log_per_km_fee']?.config_value);
      if (isNaN(perKmFee) || perKmFee < 0 || perKmFee > 50000) {
        errors.push('Phí giao hàng tăng thêm mỗi km không được quá 50.000đ.');
      }
    }

    if (editedConfigs['log_max_delivery_distance']?.is_enabled === 1) {
      const maxDistance = Number(editedConfigs['log_max_delivery_distance']?.config_value);
      if (isNaN(maxDistance) || maxDistance <= 0 || maxDistance > 50) {
        errors.push('Khoảng cách giao hàng tối đa phải lớn hơn 0 và không vượt quá 50km.');
      }
    }

    if (editedConfigs['pay_min_checkout_value']?.is_enabled === 1) {
      const minCheckout = Number(editedConfigs['pay_min_checkout_value']?.config_value);
      if (isNaN(minCheckout) || minCheckout < 0) {
        errors.push('Giá trị đơn hàng tối thiểu để thanh toán không được phép là số âm.');
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleNextStep = () => {
    if (currentStep === 3) {
      // Validate before going to Step 4
      validateEditedConfigs();
    }
    setCurrentStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Step 5: Save configurations
  const handleSaveConfigs = async () => {
    setSaving(true);
    try {
      const payload = Object.keys(editedConfigs).map(key => ({
        config_key: key,
        config_value: editedConfigs[key].config_value,
        is_enabled: editedConfigs[key].is_enabled
      }));
      
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL}/admin/configs`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSaveSuccess(true);
      setCurrentStep(5);
    } catch (err) {
      console.error(err);
      alert('Lỗi cập nhật cấu hình lên server.');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryTitle = (cat) => {
    const titles = {
      operation: 'Thông số vận hành (Operation)',
      logistics: 'Tham số vận chuyển (Logistics)',
      payment: 'Cấu hình thanh toán (Payment)',
      ui_notification: 'Giao diện & Thông báo (UI & Notifications)'
    };
    return titles[cat] || cat;
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs">Đang tải thông số vận hành...</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-slate-900 border border-red-500/20 text-red-400 rounded-2xl text-xs">{error}</div>
    );
  }

  const enabledConfigs = configs.filter(c => editedConfigs[c.config_key]?.is_enabled === 1);
  const noEnabledModules = enabledConfigs.length === 0;

  const stepsList = [
    { id: 1, name: 'Kích Hoạt', desc: 'Chọn Module Bật/Tắt' },
    { id: 2, name: 'Hiển Thị', desc: 'Xem Cấu Hình Hiện Tại' },
    { id: 3, name: 'Thao Tác', desc: 'Chỉnh Sửa Thông Số' },
    { id: 4, name: 'Kiểm Tra', desc: 'Xác Minh Tính Hợp Lệ' },
    { id: 5, name: 'Hoàn Tất', desc: 'Lưu & Khởi Chạy' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
            <Settings className="text-blue-500 animate-spin-slow" />
            Cấu Hình Hệ Thống
          </h2>
          <p className="text-slate-400 text-sm">Điều phối cổng thanh toán, cự ly vận chuyển và múi giờ làm việc toàn hệ thống.</p>
        </div>
      </div>

      {/* STEP INDICATOR TIMELINE */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 px-6 py-5 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {stepsList.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs transition-all border ${
                currentStep === s.id 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-110 font-extrabold'
                  : currentStep > s.id 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-bold'
                    : 'bg-slate-850 border-slate-800 text-slate-500'
              }`}>
                {currentStep > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              <div className="text-left">
                <span className={`block text-xs font-bold leading-none ${currentStep === s.id ? 'text-slate-100' : 'text-slate-400'}`}>
                  {s.name}
                </span>
                <span className="block text-[9px] text-slate-500 mt-0.5">{s.desc}</span>
              </div>
              {idx < stepsList.length - 1 && (
                <div className="hidden md:block w-8 h-0.5 bg-slate-850 rounded"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP BODY WRAPPER */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 min-h-[350px] shadow-2xl relative overflow-hidden">
        {/* Glow behind steps */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* STEP 1: KÍCH HOẠT (ACTIVATE) */}
        {currentStep === 1 && (
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Power className="w-5 h-5 text-blue-400" />
              <h3 className="font-extrabold text-slate-200 text-sm">Bước 1: Kích Hoạt / Vô Hiệu Hóa Module</h3>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
              Chọn các tính năng và module nghiệp vụ bạn muốn áp dụng. Module bị tắt sẽ không hiển thị ở phía khách hàng, tài xế hay nhà hàng.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configs.map((c) => {
                const bufferItem = editedConfigs[c.config_key] || { is_enabled: c.is_enabled };
                const isEnabled = bufferItem.is_enabled === 1;

                return (
                  <div 
                    key={c.config_key}
                    onClick={() => handleToggleModule(c.config_key)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                      isEnabled 
                        ? 'bg-blue-600/5 border-blue-500/20 hover:bg-blue-600/10' 
                        : 'bg-slate-950/20 border-slate-850 hover:bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-200 tracking-wide">{c.config_key}</span>
                      <span className="block text-[10px] text-slate-400 mt-1 leading-relaxed">{c.description}</span>
                    </div>
                    <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: HIỂN THỊ (DISPLAY) */}
        {currentStep === 2 && (
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Eye className="w-5 h-5 text-emerald-400" />
              <h3 className="font-extrabold text-slate-200 text-sm">Bước 2: Hiển Thị Tham Số Đang Chạy</h3>
            </div>
            {noEnabledModules ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border border-dashed border-slate-800/40 rounded-3xl bg-slate-950/20 my-6">
                <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                <h4 className="text-slate-200 font-bold text-sm">Không Có Module Nào Được Kích Hoạt</h4>
                <p className="text-slate-400 text-[11px] max-w-md leading-relaxed">
                  Tất cả các tính năng và cổng vận hành đang ở trạng thái tắt. Vui lòng quay lại <strong>Bước 1: Kích Hoạt</strong> để bật ít nhất một module trước khi tiếp tục cấu hình.
                </p>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  Quay lại Bước 1
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-xs">
                  Các thông số cấu hình thời gian thực đang được nạp trực tiếp từ Database. Để chỉnh sửa, vui lòng ấn Tiếp theo.
                </p>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {['operation', 'logistics', 'payment', 'ui_notification'].map((cat) => {
                    const catConfigs = configs.filter(c => c.category === cat && editedConfigs[c.config_key]?.is_enabled === 1);
                    if (catConfigs.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-3">
                        <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest pl-1">{getCategoryTitle(cat)}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {catConfigs.map((c) => (
                            <div key={c.config_key} className="bg-slate-950/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                              <div>
                                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">{c.config_key}</span>
                                <span className="block text-sm font-black text-slate-200 mt-0.5">{c.config_value}</span>
                                <span className="block text-[9px] text-slate-400 mt-1">{c.description}</span>
                              </div>
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${
                                c.is_enabled ? 'bg-green-500/10 text-green-400' : 'bg-slate-850 text-slate-500'
                              }`}>
                                {c.is_enabled ? 'Hoạt Động' : 'Tắt'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: THAO TÁC (OPERATE) */}
        {currentStep === 3 && (
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-slate-200 text-sm">Bước 3: Chỉnh Sửa Giá Trị (Thao Tác)</h3>
            </div>
            {noEnabledModules ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border border-dashed border-slate-800/40 rounded-3xl bg-slate-950/20 my-6">
                <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                <h4 className="text-slate-200 font-bold text-sm">Không Có Module Nào Được Kích Hoạt</h4>
                <p className="text-slate-400 text-[11px] max-w-md leading-relaxed">
                  Tất cả các tính năng và cổng vận hành đang ở trạng thái tắt. Vui lòng quay lại <strong>Bước 1: Kích Hoạt</strong> để bật ít nhất một module trước khi tiếp tục cấu hình.
                </p>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  Quay lại Bước 1
                </button>
              </div>
            ) : (
              <>
                <p className="text-slate-400 text-xs">
                  Thay đổi các giá trị tham số bên dưới. Giá trị của bạn sẽ được lưu đệm cục bộ và kiểm tra an toàn trước khi nạp vào hệ thống.
                </p>

                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {['operation', 'logistics', 'payment', 'ui_notification'].map((cat) => {
                    const catConfigs = configs.filter(c => c.category === cat && editedConfigs[c.config_key]?.is_enabled === 1);
                    if (catConfigs.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-3">
                        <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-widest pl-1">{getCategoryTitle(cat)}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {catConfigs.map((c) => {
                            const bufferItem = editedConfigs[c.config_key] || { config_value: c.config_value };
                            return (
                              <div key={c.config_key} className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold">{c.config_key}</span>
                                  <span className="text-[9px] text-slate-400 italic font-semibold">{c.description}</span>
                                </div>
                                <input 
                                  type="text" 
                                  value={bufferItem.config_value} 
                                  onChange={(e) => handleValueChange(c.config_key, e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-200 text-xs font-bold transition-all focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4: KIỂM TRA TÍNH HỢP LỆ (VALIDATE) */}
        {currentStep === 4 && (
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <CheckSquare className="w-5 h-5 text-cyan-400" />
              <h3 className="font-extrabold text-slate-200 text-sm">Bước 4: Kiểm Tra Hợp Lệ & Hạn Mức An Toàn</h3>
            </div>
            {noEnabledModules ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 border border-dashed border-slate-800/40 rounded-3xl bg-slate-950/20 my-6">
                <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
                <h4 className="text-slate-200 font-bold text-sm">Không Có Module Nào Được Kích Hoạt</h4>
                <p className="text-slate-400 text-[11px] max-w-md leading-relaxed">
                  Tất cả các tính năng và cổng vận hành đang ở trạng thái tắt. Vui lòng quay lại <strong>Bước 1: Kích Hoạt</strong> để bật ít nhất một module trước khi tiếp tục cấu hình.
                </p>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  Quay lại Bước 1
                </button>
              </div>
            ) : (
              <>
                {validationErrors.length > 0 ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 animate-bounce" />
                      <span>Phát hiện lỗi nhập liệu ngoài hạn mức an toàn:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
                      {validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-red-400/80 italic font-semibold pt-1">
                      * Vui lòng quay lại Bước 3 để hiệu chỉnh trước khi lưu.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Xác minh tính hợp lệ hoàn hảo!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Tất cả các tham số nằm trong khoảng hạn mức tối ưu của doanh số và quy trình vận tải thông minh. Sẵn sàng khởi chạy.
                    </p>
                  </div>
                )}

                {/* Checklist Preview */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Bản Xem Trước Các Thay Đổi Cấu Hình</h4>
                  <div className="bg-slate-950/60 border border-slate-850 rounded-2xl overflow-hidden text-xs">
                    <div className="grid grid-cols-3 bg-slate-950/80 p-3 border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                      <div>Tham Số Cấu Hình</div>
                      <div>Giá Trị Đã Chỉnh Sửa</div>
                      <div>Trạng Thái Module</div>
                    </div>
                    <div className="divide-y divide-slate-850 max-h-[220px] overflow-y-auto custom-scrollbar">
                      {configs.filter(c => editedConfigs[c.config_key]?.is_enabled === 1).map((c) => {
                        const edited = editedConfigs[c.config_key] || { config_value: c.config_value, is_enabled: c.is_enabled };
                        const isChanged = edited.config_value !== c.config_value || edited.is_enabled !== c.is_enabled;

                        return (
                          <div key={c.config_key} className={`grid grid-cols-3 p-3 items-center ${isChanged ? 'bg-blue-600/5' : ''}`}>
                            <div className="font-mono text-[10px] text-slate-300">{c.config_key}</div>
                            <div className="font-black text-slate-200">
                              {edited.config_value} 
                              {edited.config_value !== c.config_value && (
                                <span className="text-[10px] text-amber-500 block line-through font-normal">cũ: {c.config_value}</span>
                              )}
                            </div>
                            <div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                edited.is_enabled ? 'bg-green-500/10 text-green-400' : 'bg-slate-850 text-slate-500'
                              }`}>
                                {edited.is_enabled ? 'Hoạt động' : 'Tắt'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 5: HOÀN TẤT (COMPLETE) */}
        {currentStep === 5 && saveSuccess && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center p-8 space-y-4 h-full"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 mb-2 relative">
              <Check className="w-8 h-8 animate-pulse" />
              <div className="absolute inset-0 bg-emerald-500 rounded-full blur animate-ping opacity-15"></div>
            </div>
            <h3 className="text-xl font-black text-slate-100 tracking-tight">Cập Nhật Cấu Hình Thành Công!</h3>
            <p className="text-slate-400 text-xs text-center max-w-sm leading-relaxed">
              Các tham số vận hành, phí logistics và cấu hình thanh toán mới đã được cập nhật và kích hoạt tức thì trên hệ thống. 
              Các thông số cũ đã được lưu trữ an toàn trong Nhật Ký Hệ Thống.
            </p>
            <button 
              onClick={() => { setCurrentStep(1); fetchConfigs(); setSaveSuccess(false); }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer mt-4"
            >
              Quay lại Bảng Cấu Hình
            </button>
          </motion.div>
        )}
      </div>

      {/* FOOTER WIZARD ACTIONS BUTTONS */}
      {currentStep < 5 && (
        <div className="flex justify-between items-center bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 px-6 py-4 rounded-2xl shadow-xl">
          <button 
            disabled={currentStep === 1}
            onClick={handlePrevStep}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all border border-slate-750 ${
              currentStep === 1 
                ? 'opacity-30 cursor-not-allowed text-slate-600 bg-transparent' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Quay Lại
          </button>

          {currentStep === 4 ? (
            <button 
              disabled={saving || validationErrors.length > 0}
              onClick={handleSaveConfigs}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-lg transition-all ${
                validationErrors.length > 0
                  ? 'bg-slate-800 border border-slate-750 opacity-40 cursor-not-allowed text-slate-500'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-102 cursor-pointer shadow-blue-500/20'
              }`}
            >
              {saving ? 'Đang lưu...' : 'Hoàn Tất & Khởi Chạy'}
              <Sparkles className="w-4 h-4 animate-pulse" />
            </button>
          ) : (
            <button 
              onClick={handleNextStep}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 hover:scale-102 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              Tiếp Theo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
