import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, MapPin, Check, Plus, Minus, ShoppingCart } from 'lucide-react';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageHelper';

const FoodDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext);
  
  const [food, setFood] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const fetchFoodData = async () => {
      try {
        const [foodRes, revRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/food/${id}`),
          axios.get(`${import.meta.env.VITE_API_URL}/food/${id}/reviews`)
        ]);
        setFood(foodRes.data);
        setReviews(revRes.data);
      } catch (error) {
        console.error('Error fetching food detail', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFoodData();
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const success = await addToCart(food.id_Restaurant, food.id_Food, quantity, note);
    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      setQuantity(1);
      setNote('');
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  if (!food) return <div className="min-h-screen flex justify-center items-center text-slate-500">Không tìm thấy món ăn.</div>;

  const currentPrice = food.discount_Price || food.price;

  return (
    <div className="bg-slate-50 min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Product Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row mb-8">
          <div className="md:w-1/2 h-64 md:h-auto">
            <img 
              src={getImageUrl(food.image, 'food')} 
              alt={food.name} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-center">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">{food.name}</h1>
            <p className="text-slate-500 mb-4">{food.description}</p>
            
            <Link to={`/restaurant/${food.id_Restaurant}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-orange-500 transition-colors mb-4 bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
              <MapPin className="w-4 h-4" /> {food.name_Restaurant}
            </Link>

            <div className="flex items-end gap-3 mb-6 pb-6 border-b border-slate-100">
              <span className="text-3xl font-bold text-orange-600">{Number(currentPrice).toLocaleString()}đ</span>
              {food.discount_Price && <span className="text-lg text-slate-400 line-through pb-0.5">{Number(food.price).toLocaleString()}đ</span>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú cho quán (Tùy chọn)</label>
              <input 
                type="text" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Ít cay, không hành..."
                className="w-full px-4 py-2 border rounded-xl focus:ring-orange-500 focus:border-orange-500 bg-slate-50 text-sm"
              />
            </div>

            <div className="flex items-center gap-4 mt-auto">
              <div className="flex items-center border rounded-xl overflow-hidden bg-white">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-3 text-slate-600 hover:bg-slate-100 transition"><Minus className="w-4 h-4" /></button>
                <div className="w-12 text-center font-medium text-slate-800">{quantity}</div>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-3 text-slate-600 hover:bg-slate-100 transition"><Plus className="w-4 h-4" /></button>
              </div>
              <button 
                onClick={handleAddToCart}
                disabled={added}
                className={`flex-1 py-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  added ? 'bg-green-500 text-white shadow-green-200' : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200 shadow-lg'
                }`}
              >
                {added ? <><Check className="w-5 h-5" /> Đã thêm</> : <><ShoppingCart className="w-5 h-5" /> Thêm vào giỏ - {(Number(currentPrice) * quantity).toLocaleString()}đ</>}
              </button>
            </div>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-2 border-slate-100">
            Đánh giá từ khách hàng ({reviews.length})
          </h2>
          
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <p className="text-slate-500 italic">Chưa có đánh giá nào cho món này.</p>
            ) : (
              reviews.map((r, i) => (
                <div key={i} className="flex gap-4">
                  <img 
                    src={getImageUrl(r.avatar, 'avatar')} 
                    alt={r.fullName} 
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://ui-avatars.com/api/?name='+r.fullName+'&background=random';
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{r.fullName}</span>
                      <span className="text-xs text-slate-400">{new Date(r.created_At).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex items-center mt-1 mb-2 text-orange-400">
                      {[...Array(5)].map((_, idx) => (
                        <Star key={idx} className={`w-3 h-3 ${idx < r.rating_Food ? 'fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    {r.comment_Food && <p className="text-slate-600 text-sm">{r.comment_Food}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FoodDetail;
