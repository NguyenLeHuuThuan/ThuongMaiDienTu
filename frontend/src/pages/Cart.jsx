import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';

const Cart = () => {
  const { carts, fetchCarts } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  const updateQuantity = async (id_CartFood, quantity) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/cart/item/${id_CartFood}`, 
        { quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCarts();
    } catch (error) {
      console.error('Error updating quantity', error);
    }
  };

  const removeItem = async (id_CartFood) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/cart/item/${id_CartFood}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchCarts();
    } catch (error) {
      console.error('Error removing item', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
          <ShoppingBag className="w-10 h-10 text-slate-300" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Bạn chưa đăng nhập</h2>
        <p className="text-slate-500 mb-8 text-center max-w-sm">Vui lòng đăng nhập để xem giỏ hàng và tiến hành đặt món.</p>
        <Link to="/login" className="px-8 py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors shadow-md">
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  if (carts.length === 0 || carts.every(c => c.items.length === 0)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
          <ShoppingBag className="w-10 h-10 text-orange-200" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Giỏ hàng trống</h2>
        <p className="text-slate-500 mb-8 text-center max-w-sm">Có vẻ như bạn chưa chọn món nào. Khám phá ngay hàng ngàn món ngon đang chờ bạn.</p>
        <Link to="/explore" className="px-8 py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors shadow-md">
          Khám phá món ngon
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Giỏ hàng của bạn</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Carts List */}
          <div className="lg:col-span-2 space-y-6">
            {carts.map(cart => cart.items.length > 0 && (
              <div key={cart.id_Cart} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-lg text-slate-800">{cart.name_Restaurant}</h3>
                  <span className="text-sm font-medium text-slate-500">{cart.items.length} món</span>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {cart.items.map(item => (
                    <div key={item.id_CartFood} className="p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                      <img 
                        src={`https://source.unsplash.com/200x200/?food&sig=${item.id_Food}`}
                        onError={(e) => {e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop'}}
                        alt={item.name} 
                        className="w-24 h-24 object-cover rounded-xl"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-slate-800 mb-1 truncate">{item.name}</h4>
                        <div className="text-orange-500 font-bold mb-2">
                          {(item.price).toLocaleString('vi-VN')} đ
                        </div>
                        {item.note && (
                          <div className="text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
                            Ghi chú: {item.note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start mt-4 sm:mt-0">
                        <div className="flex items-center bg-slate-50 rounded-full border border-slate-200">
                          <button 
                            onClick={() => updateQuantity(item.id_CartFood, item.quantity - 1)}
                            className="p-2 text-slate-600 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium text-slate-700">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id_CartFood, item.quantity + 1)}
                            className="p-2 text-slate-600 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <button 
                          onClick={() => removeItem(item.id_CartFood)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary (for the first cart as example, or a unified one. Usually 1 order per restaurant) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h3 className="font-bold text-xl text-slate-800 mb-6 border-b border-slate-100 pb-4">Tổng quan đơn hàng</h3>
              
              <div className="space-y-4 mb-6">
                {carts.filter(c => c.items.length > 0).map(cart => {
                  const cartTotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                  return (
                    <div key={cart.id_Cart} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-medium truncate pr-4">{cart.name_Restaurant}</span>
                      <span className="font-bold text-slate-800 whitespace-nowrap">{cartTotal.toLocaleString('vi-VN')} đ</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-t border-slate-100 pt-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tổng cộng (chưa phí ship)</span>
                  <span className="text-2xl font-extrabold text-orange-500">
                    {carts.reduce((acc, cart) => acc + cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0), 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors shadow-md hover:shadow-lg">
                <span>Tiến hành thanh toán</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <p className="text-xs text-center text-slate-400 mt-4">
                Phí vận chuyển và khuyến mãi sẽ được tính ở bước thanh toán. *Hệ thống hỗ trợ thanh toán cho từng nhà hàng riêng biệt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
