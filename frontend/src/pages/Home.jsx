import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, Star, Clock, ShoppingCart } from 'lucide-react';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, resRes, foodRes] = await Promise.all([
          axios.get('http://localhost:5000/api/food/categories'),
          axios.get('http://localhost:5000/api/food/restaurants'),
          axios.get('http://localhost:5000/api/food')
        ]);
        setCategories(catRes.data);
        setRestaurants(resRes.data);
        setFoods(foodRes.data.slice(0, 8)); // Lấy 8 món đầu
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
            
            <div className="bg-white p-2 rounded-full shadow-lg flex items-center max-w-md border border-slate-100">
              <div className="pl-4 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                placeholder="Tìm món ăn, quán ăn..." 
                className="w-full py-3 px-4 outline-none text-slate-700 bg-transparent"
              />
              <button className="bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-full transition-colors shadow-md hover:shadow-lg">
                Tìm kiếm
              </button>
            </div>
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
                  {/* Mock Image for now, since db paths are relative to an unknown static folder */}
                  <img src={`https://source.unsplash.com/400x300/?${food.categoryName === 'Pizza - Burger' ? 'pizza' : 'asian,food'}&sig=${food.id_Food}`} 
                       onError={(e) => {e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'}}
                       alt={food.name} 
                       className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-slate-800 mb-1 truncate" title={food.name}>{food.name}</h3>
                  <p className="text-sm text-slate-500 mb-3 truncate">{food.name_Restaurant}</p>
                  
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
                    <div className="bg-orange-50 p-2 rounded-full text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
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
              <div key={res.id_Restaurant} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer">
                <div className="h-40 overflow-hidden relative">
                  <img src={`https://source.unsplash.com/600x300/?restaurant,interior&sig=${res.id_Restaurant}`}
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
                      <span>{res.rating_avg}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>30 phút</span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm line-clamp-2">{res.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
