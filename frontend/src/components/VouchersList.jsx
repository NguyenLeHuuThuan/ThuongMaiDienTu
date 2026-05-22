import { useState, useEffect } from 'react';
import axios from 'axios';
import { Ticket, Calendar, ShieldAlert } from 'lucide-react';

const VouchersList = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/users/vouchers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Lọc hiển thị voucher cá nhân (hoặc hiển thị tất cả tùy ý, lọc voucher cá nhân là đúng tính chất ví)
        const myVouchers = res.data.filter(v => v.discount_type === 'voucher');
        setVouchers(myVouchers);
      } catch (error) {
        console.error('Error fetching vouchers', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVouchers();
  }, []);

  const formatValue = (v) => {
    if (v.type === 'freeship') return 'Freeship';
    if (v.type === 'percent' || v.value < 100) return `-${v.value}%`;
    return `-${(v.value / 1000)}k`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-lg text-slate-800">Ví Voucher của tôi</h3>
          <p className="text-xs text-slate-400 mt-1">Các mã giảm giá bạn đã lưu hoặc được tặng</p>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vouchers.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center">
              <Ticket className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="font-bold text-slate-700 text-sm">Chưa có voucher nào</h3>
              <p className="text-xs text-slate-400 mt-1">Hãy quay lại trang chủ và lưu các voucher hot nhé!</p>
            </div>
          ) : (
            vouchers.map(v => (
              <div key={v.id} className="flex border border-dashed border-orange-200 rounded-2xl overflow-hidden relative shadow-sm hover:shadow-md transition bg-slate-50/50">
                <div className="bg-gradient-to-br from-orange-400 to-red-500 w-28 flex flex-col justify-center items-center text-white p-4 relative">
                  {/* Circular ticket notches */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white rounded-full"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white rounded-full"></div>
                  <Ticket className="w-6 h-6 mb-1 opacity-90" />
                  <div className="text-lg font-black whitespace-nowrap">{formatValue(v)}</div>
                </div>
                <div className="p-4 flex-1 bg-white flex flex-col justify-center overflow-hidden">
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full self-start mb-2 border border-orange-100">
                    Voucher cá nhân
                  </span>
                  <div className="font-mono font-bold text-slate-800 text-sm mb-1 truncate">{v.code}</div>
                  <div className="text-[11px] flex items-center gap-1 text-slate-500">
                    <Calendar className="w-3.5 h-3.5" /> 
                    HSD: {v.end_Date ? new Date(v.end_Date).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VouchersList;
