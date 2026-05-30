import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Filter, ShoppingCart, Star } from 'lucide-react';
import { getImageUrl } from '../utils/imageHelper';

const Explore = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const categoryId = searchParams.get('category');
  const searchQuery = searchParams.get('q') || '';
  
  const [searchTerm, setSearchTerm] = useState(searchQuery);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/food/categories`);
        setCategories(res.data);
      } catch (error) {
        console.error('Error fetching categories', error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchFoods = async () => {
      setLoading(true);
      try {
        let url = `${import.meta.env.VITE_API_URL}/food?`;
        if (categoryId) url += `categoryId=${categoryId}&`;
        if (searchQuery) url += `search=${searchQuery}`;
        
        const res = await axios.get(url);
        setFoods(res.data);
      } catch (error) {
        console.error('Error fetching foods', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFoods();
  }, [categoryId, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm) {
      setSearchParams({ q: searchTerm });
    } else {
      setSearchParams({});
    }
  };

  const handleCategorySelect = (id) => {
    if (categoryId === String(id)) {
      searchParams.delete('category');
    } else {
      searchParams.set('category', id);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Khám phá món ngon</h1>
            <p className="text-slate-500 mt-2">Tìm kiếm món ăn yêu thích của bạn</p>
          </div>
          
          <form onSubmit={handleSearch} className="w-full md:w-auto flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm món ăn, nhà hàng..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <button type="submit" className="hidden">Tìm</button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Filters */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <Filter className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-bold text-slate-800">Bộ lọc</h2>
              </div>
              
              <div className="mb-6">
                <h3 className="font-semibold text-slate-700 mb-3">Danh mục</h3>
                <div className="space-y-2">
                  <button 
                    onClick={() => { searchParams.delete('category'); setSearchParams(searchParams); }}
                    className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${!categoryId ? 'bg-orange-50 text-orange-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Tất cả
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id_Category}
                      onClick={() => handleCategorySelect(cat.id_Category)}
                      className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${categoryId === String(cat.id_Category) ? 'bg-orange-50 text-orange-600 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Results */}
          <div className="lg:col-span-3">
            {/* Mobile Categories (Horizontal Scroll) */}
            <div className="lg:hidden flex overflow-x-auto pb-4 mb-6 gap-2 snap-x hide-scrollbar">
              <button 
                onClick={() => { searchParams.delete('category'); setSearchParams(searchParams); }}
                className={`flex-none px-4 py-2 rounded-full whitespace-nowrap snap-start border ${!categoryId ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}
              >
                Tất cả
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id_Category}
                  onClick={() => handleCategorySelect(cat.id_Category)}
                  className={`flex-none px-4 py-2 rounded-full whitespace-nowrap snap-start border ${categoryId === String(cat.id_Category) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : foods.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Không tìm thấy món nào!</h3>
                <p className="text-slate-500">Thử tìm kiếm với từ khóa khác hoặc thay đổi bộ lọc.</p>
                <button 
                  onClick={() => {setSearchParams({}); setSearchTerm('');}}
                  className="mt-6 px-6 py-2 bg-orange-100 text-orange-600 font-medium rounded-full hover:bg-orange-200 transition-colors"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {foods.map(food => (
                  <Link to={`/food/${food.id_Food}`} key={food.id_Food} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 group flex flex-col h-full">
                    <div className="relative h-48 overflow-hidden flex-shrink-0">
                      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-orange-600 shadow-sm">
                        {food.categoryName}
                      </div>
                      <img src={getImageUrl(food.image, 'food')} 
                           onError={(e) => {e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'}}
                           alt={food.name} 
                           className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="p-5 flex flex-col flex-grow">
                      <h3 className="font-bold text-lg text-slate-800 mb-1 line-clamp-2" title={food.name}>{food.name}</h3>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-sm text-slate-500 truncate">{food.name_Restaurant}</p>
                        <div className="flex items-center gap-1 bg-yellow-50 text-yellow-750 px-1.5 py-0.5 rounded-md font-bold text-xs flex-shrink-0">
                          <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                          <span>{food.restaurant_rating ? Number(food.restaurant_rating).toFixed(1) : '5.0'}</span>
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
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
                        <button className="bg-orange-50 p-2.5 rounded-full text-orange-500 hover:bg-orange-500 hover:text-white transition-colors cursor-pointer z-10">
                          <ShoppingCart className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Explore;
