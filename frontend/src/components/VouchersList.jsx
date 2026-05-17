import { useState, useEffect } from 'react';
import axios from 'axios';
import { Ticket, Calendar } from 'lucide-react';

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
        setVouchers(res.data);
      } catch (error) {
        console.error('Error fetching vouchers', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVouchers();
  }, []);

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-lg text-slate-800">Voucher của tôi</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vouchers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-500">Bạn chưa có voucher nào.</div>
          ) : (
            vouchers.map(v => (
              <div key={v.id_Voucher} className="flex border border-orange-200 rounded-xl overflow-hidden relative shadow-sm">
                <div className="bg-gradient-to-br from-orange-400 to-red-500 w-1/3 flex flex-col justify-center items-center text-white p-4 border-r border-dashed border-white">
                  <Ticket className="w-8 h-8 mb-2 opacity-80" />
                  <div className="text-xl font-bold">{v.value.toLocaleString()}đ</div>
                </div>
                <div className="p-4 flex-1 bg-white flex flex-col justify-center">
                  <div className="font-bold text-slate-800 mb-1">{v.code}</div>
                  <div className="text-sm flex items-center gap-1 text-slate-500">
                    <Calendar className="w-4 h-4" /> 
                    HSD: {new Date(v.expiry_date).toLocaleDateString('vi-VN')}
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
