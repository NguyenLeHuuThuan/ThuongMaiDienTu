import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Star, Clock, ShoppingCart } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { getImageUrl } from '../utils/imageHelper';

const Home = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2500);
  };

  const handleClaimPromo = async (id_Promo) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Vui lòng đăng nhập trước khi lưu voucher!');
      return;
    }
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/users/vouchers/claim`, { id_Promo }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(res.data.message || 'Lưu voucher thành công!');
      // Cập nhật trạng thái đã lưu local lập tức
      setPromotions(prev => prev.map(p => p.id_Promo === id_Promo ? { ...p, is_claimed: 1 } : p));
      setTimeout(() => {
        navigate('/profile?tab=vouchers');
      }, 1500);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Lưu voucher thất bại!';
      showToast(errMsg);
    }
  };

  const getPromoStyle = (promo, index) => {
    const colors = [
      'from-orange-500 to-red-500',
      'from-blue-500 to-indigo-500',
      'from-pink-500 to-rose-500',
      'from-amber-500 to-orange-600',
      'from-emerald-550 to-teal-600'
    ];
    
    let valueStr = '';
    let titleStr = '';
    let conditionStr = `Đơn tối thiểu từ ${promo.min_OrderValue ? (promo.min_OrderValue / 1000) + 'k' : '0k'}`;

    if (promo.type === 'freeship') {
      valueStr = `Freeship ${promo.value ? (promo.value / 1000) + 'k' : ''}`;
      titleStr = 'Miễn phí vận chuyển';
    } else if (promo.type === 'percent') {
      valueStr = `Giảm ${promo.value}%`;
      titleStr = `Giảm tối đa ${promo.max_Discount ? (promo.max_Discount / 1000) + 'k' : ''}`;
    } else { // fixed
      valueStr = `Giảm ${promo.value ? (promo.value / 1000) + 'k' : ''}`;
      titleStr = 'Ưu đãi đặc biệt';
    }

    return {
      color: colors[index % colors.length],
      value: valueStr,
      title: titleStr,
      condition: conditionStr
    };
  };
  
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const promoHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

        const [catRes, resRes, foodRes, promoRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/food/categories`),
          axios.get(`${import.meta.env.VITE_API_URL}/food/restaurants`),
          axios.get(`${import.meta.env.VITE_API_URL}/food`),
          axios.get(`${import.meta.env.VITE_API_URL}/food/promotions`, promoHeaders)
        ]);
        setCategories(catRes.data);
        setRestaurants(resRes.data);
        setFoods(foodRes.data.slice(0, 8)); // Lấy 8 món đầu
        setPromotions(promoRes.data || []);
      } catch (error) {
        console.error('Error fetching data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  }

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-orange-50 pt-16 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-100 to-orange-50 opacity-90"></div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-orange-200 opacity-50 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-yellow-200 opacity-50 blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
              Món ngon nóng hổi, <br/><span className="text-orange-500">giao ngay tận cửa</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-lg">
              Hàng ngàn món ăn ngon từ các nhà hàng hàng đầu đang chờ bạn khám phá. Đặt món ngay hôm nay!
            </p>
            
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                if (searchVal.trim()) {
                  navigate(`/explore?q=${encodeURIComponent(searchVal.trim())}`);
                } else {
                  navigate('/explore');
                }
              }} 
              className="bg-white p-2 rounded-full shadow-lg flex items-center max-w-md border border-slate-100"
            >
              <div className="pl-4 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                placeholder="Tìm món ăn, quán ăn..." 
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full py-3 px-4 outline-none text-slate-700 bg-transparent"
              />
              <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-full transition-colors shadow-md hover:shadow-lg cursor-pointer">
                Tìm kiếm
              </button>
            </form>
          </div>
          
          <div className="hidden md:block relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop" alt="Delicious Food" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Danh mục món ăn</h2>
              <p className="text-slate-500 mt-1">Khám phá theo sở thích của bạn</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {categories.map(cat => (
              <Link to={`/explore?category=${cat.id_Category}`} key={cat.id_Category} className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-lg hover:-translate-y-1 transition-all bg-slate-50 hover:bg-orange-50">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-2xl">
                  {/* Mock icon using emoji based on name if icon is missing or not a valid path */}
                  {cat.name.includes('Cơm') ? '🍱' : 
                   cat.name.includes('Bún') ? '🍜' : 
                   cat.name.includes('Bánh') ? '🥪' : 
                   cat.name.includes('uống') ? '🥤' : 
                   cat.name.includes('Lẩu') ? '🍲' : 
                   cat.name.includes('Pizza') ? '🍕' : '🥗'}
                </div>
                <span className="font-medium text-slate-700 text-center text-sm">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Voucher Hot Section */}
      {promotions.length > 0 && (
        <section className="pb-16 bg-white animate-in fade-in duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 border-t border-slate-100 pt-16">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <span className="text-3xl animate-bounce">🔥</span> Voucher Hot
              </h2>
              <p className="text-slate-500 mt-1">Săn ngay ưu đãi khủng hôm nay!</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {promotions.map((promo, index) => {
                const style = getPromoStyle(promo, index);
                return (
                  <div key={promo.id_Promo} className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 overflow-hidden flex items-center shadow-sm hover:shadow-md transition duration-300 relative group">
                    <div className={`w-24 h-24 bg-gradient-to-br ${style.color} text-white flex flex-col justify-center items-center text-center p-2 flex-shrink-0 relative`}>
                      {/* Ticket decorative notches */}
                      <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white rounded-full border-r border-slate-100"></div>
                      <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white rounded-full border-l border-slate-100"></div>
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-90">Mã Giảm</span>
                      <span className="text-sm font-black mt-1 whitespace-nowrap">{style.value}</span>
                    </div>
                    <div className="p-4 flex-grow overflow-hidden">
                      <h3 className="font-extrabold text-slate-800 text-sm mb-0.5 truncate">{style.title}</h3>
                      <p className="text-[11px] text-slate-400 mb-2 truncate" title={`${style.condition}${promo.usage_Limit !== null && promo.usage_Limit !== undefined ? ` - Còn ${promo.usage_Limit - promo.used_Count} lượt` : ''}`}>
                        {style.condition}
                        {promo.usage_Limit !== null && promo.usage_Limit !== undefined && ` • Còn ${promo.usage_Limit - promo.used_Count} lượt`}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-300/40 select-all">{promo.code}</span>
                        <button 
                          onClick={() => !promo.is_claimed && handleClaimPromo(promo.id_Promo)}
                          disabled={!!promo.is_claimed}
                          className={`text-[11px] font-bold px-3 py-1 rounded-lg transition flex-shrink-0 ${
                            promo.is_claimed 
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300/40' 
                              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow cursor-pointer'
                          }`}
                        >
                          {promo.is_claimed ? 'Đã lưu' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured Foods */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Món ngon nổi bật</h2>
              <p className="text-slate-500 mt-1">Những món ăn được yêu thích nhất</p>
            </div>
            <Link to="/explore" className="text-orange-500 font-medium hover:text-orange-600 flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {foods.map(food => (
              <Link to={`/food/${food.id_Food}`} key={food.id_Food} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 group">
                <div className="relative h-48 overflow-hidden">
                  <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-orange-600 shadow-sm">
                    {food.categoryName}
                  </div>
                  <img src={getImageUrl(food.image, 'food')} 
                       onError={(e) => {e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'}}
                       alt={food.name} 
                       className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-800 mb-1 truncate" title={food.name}>{food.name}</h3>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-sm text-slate-500 truncate">{food.name_Restaurant}</p>
                    <div className="flex items-center gap-1 bg-yellow-50 text-yellow-750 px-1.5 py-0.5 rounded-md font-bold text-xs flex-shrink-0">
                      <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                      <span>{food.restaurant_rating ? Number(food.restaurant_rating).toFixed(1) : '5.0'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex flex-col">
                      {food.discount_Price ? (
                        <>
                          <span className="text-xs text-slate-400 line-through">{food.price.toLocaleString('vi-VN')} đ</span>
                          <span className="text-lg font-bold text-orange-500">{food.discount_Price.toLocaleString('vi-VN')} đ</span>
                        </>
                      ) : (
                        <span className="text-lg font-bold text-orange-500">{food.price.toLocaleString('vi-VN')} đ</span>
                      )}
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        try {
                          await addToCart(food.id_Restaurant, food.id_Food, 1, '');
                        } catch (err) {
                          alert('Vui lòng đăng nhập trước khi thêm món ăn vào giỏ hàng!');
                        }
                      }}
                      className="bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white p-2 rounded-full transition-colors cursor-pointer border border-orange-100 flex items-center justify-center"
                      title="Thêm vào giỏ"
                    >
                      <ShoppingCart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Restaurants */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Quán ăn được yêu thích</h2>
              <p className="text-slate-500 mt-1">Top các nhà hàng đánh giá cao</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {restaurants.slice(0,3).map(res => (
              <Link 
                to={`/restaurant/${res.id_Restaurant}`}
                key={res.id_Restaurant} 
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all group block cursor-pointer"
              >
                <div className="h-40 overflow-hidden relative">
                  <img src={getImageUrl(res.cover_image, 'cover')}
                       onError={(e) => {e.target.src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop'}}
                       alt={res.name_Restaurant} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <h3 className="text-white font-bold text-xl">{res.name_Restaurant}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md font-medium">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      <span>{res.rating_avg ? Number(res.rating_avg).toFixed(1) : '5.0'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>30 phút</span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm line-clamp-2">{res.address}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      {/* Toast Alert */}
      {toast.show && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-950/90 backdrop-blur-md border border-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Home;
