import { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, Star, Clock, Info, ShoppingCart, MessageSquare } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { getImageUrl } from '../utils/imageHelper';

const RestaurantDetail = () => {
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const { openChatWith } = useContext(ChatContext);
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/food/restaurants/${id}`);
        setRestaurant(res.data);
      } catch (error) {
        console.error('Error fetching restaurant', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurant();
  }, [id]);

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!restaurant) return <div className="min-h-screen flex justify-center items-center text-slate-500">Không tìm thấy nhà hàng.</div>;

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Cover Image */}
      <div className="h-64 md:h-80 w-full relative">
        <img 
          src={getImageUrl(restaurant.cover_image, 'cover')} 
          alt="Cover" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col md:flex-row gap-6 items-start">
          <img 
            src={getImageUrl(restaurant.logo, 'logo')} 
            alt="Logo" 
            className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover border-4 border-white shadow-sm flex-shrink-0"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://ui-avatars.com/api/?name='+restaurant.name_Restaurant+'&background=f97316&color=fff&size=128';
            }}
          />
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{restaurant.name_Restaurant}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-600">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-orange-500" /> {restaurant.address}</span>
              <span className="flex items-center gap-1 text-orange-600 font-medium"><Star className="w-4 h-4 fill-orange-500" /> {(restaurant.rating_avg ? Number(restaurant.rating_avg) : 5.0).toFixed(1)}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-500" /> {restaurant.openTime?.slice(0,5)} - {restaurant.closeTime?.slice(0,5)}</span>
            </div>
            {restaurant.description && (
              <p className="mt-3 text-slate-500 text-sm md:text-base flex items-start gap-1">
                <Info className="w-4 h-4 mt-1 flex-shrink-0 text-slate-400" /> {restaurant.description}
              </p>
            )}
            {user && (
              <button
                onClick={() => openChatWith({
                  id: restaurant.owner_id,
                  fullName: restaurant.name_Restaurant,
                  avatar: restaurant.logo,
                  role: 'restaurant_owner'
                })}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold rounded-xl transition duration-300 text-sm cursor-pointer shadow-sm border border-orange-200/50"
              >
                <MessageSquare className="w-4 h-4" />
                Trò chuyện với cửa hàng
              </button>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2 border-slate-200">Menu nhà hàng</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {restaurant.menu?.map(food => (
              <div key={food.id_Food} className="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group relative">
                <Link to={`/food/${food.id_Food}`} className="flex gap-4 flex-1">
                  <img 
                    src={getImageUrl(food.image, 'food')} 
                    alt={food.name} 
                    className="w-24 h-24 rounded-lg object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="font-bold text-slate-800 group-hover:text-orange-500 transition-colors">{food.name}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">{food.description}</p>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="font-bold text-orange-600">{Number(food.discount_Price || food.price).toLocaleString()}đ</span>
                      {food.discount_Price && <span className="text-sm text-slate-400 line-through">{Number(food.price).toLocaleString()}đ</span>}
                    </div>
                  </div>
                </Link>
                <button 
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      await addToCart(restaurant.id_Restaurant, food.id_Food, 1, '');
                    } catch (err) {
                      alert('Vui lòng đăng nhập trước khi thêm món ăn vào giỏ hàng!');
                    }
                  }}
                  className="absolute bottom-4 right-4 bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white p-2.5 rounded-full transition cursor-pointer border border-orange-100 flex items-center justify-center z-10 shadow-sm"
                  title="Thêm vào giỏ"
                >
                  <ShoppingCart className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(!restaurant.menu || restaurant.menu.length === 0) && (
              <div className="col-span-full text-center py-8 text-slate-500">Nhà hàng chưa có món ăn nào.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
