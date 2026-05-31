import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, Calendar, ShoppingBag, ArrowRight } from 'lucide-react';

const VnPayReturn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const [message, setMessage] = useState('Đang xác thực giao dịch từ VNPAY...');
  const [orderCode, setOrderCode] = useState('');
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        
        // Chuyển searchParams thành object gửi lên backend
        const paramsObj = {};
        for (const [key, value] of searchParams.entries()) {
          paramsObj[key] = value;
        }

        // Lấy thông tin cơ bản hiển thị tạm thời
        setOrderCode(paramsObj['vnp_TxnRef'] || '');
        setAmount(Number(paramsObj['vnp_Amount']) / 100 || 0);

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/orders/vnpay-verify`,
          paramsObj,
          { headers }
        );

        const isTopUp = (paramsObj['vnp_TxnRef'] || '').startsWith('TOPUP_');
        if (response.data.success) {
          setStatus('success');
          setMessage(isTopUp ? 'Nạp tiền vào ví thành công qua VNPAY!' : 'Thanh toán đơn hàng thành công qua VNPAY!');
        } else {
          setStatus('failed');
          setMessage(response.data.message || 'Thanh toán thất bại.');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setStatus('failed');
        setMessage(error.response?.data?.message || 'Có lỗi xảy ra khi xác thực giao dịch.');
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 transition-all duration-300">
        
        {status === 'verifying' && (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
            <h2 className="text-2xl font-black text-slate-800">Đang xác thực</h2>
            <p className="text-slate-500 max-w-sm">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100 animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-850">Thành Công!</h2>
              <p className="text-slate-500 font-medium px-2">{message}</p>
            </div>

            <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{orderCode.startsWith('TOPUP_') ? 'Mã giao dịch ví:' : 'Mã đơn hàng:'}</span>
                <span className="font-bold text-slate-800">{orderCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Số tiền thanh toán:</span>
                <span className="font-bold text-slate-800">{amount.toLocaleString('vi-VN')} đ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Phương thức:</span>
                <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">VNPAY (ATM/QR)</span>
              </div>
            </div>

            <div className="w-full pt-4 space-y-3">
              {orderCode.startsWith('TOPUP_') ? (
                <button
                  onClick={() => navigate('/profile?tab=wallet')}
                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Xem ví của tôi</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/orders')}
                  className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Xem đơn hàng của tôi</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
              >
                Tiếp tục mua sắm
              </button>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="bg-red-50 p-4 rounded-full border border-red-100">
              <XCircle className="w-16 h-16 text-red-550" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-850">Thất Bại!</h2>
              <p className="text-slate-500 font-medium px-2">{message}</p>
            </div>

            {orderCode && (
              <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Mã đơn hàng:</span>
                  <span className="font-bold text-slate-800">{orderCode}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Số tiền dự kiến:</span>
                  <span className="font-bold text-slate-800">{amount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            )}

            <div className="w-full pt-4 space-y-3">
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 px-6 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md shadow-orange-200 cursor-pointer"
              >
                Về Trang Chủ
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="w-full py-4 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
              >
                Xem lại giỏ hàng
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VnPayReturn;
