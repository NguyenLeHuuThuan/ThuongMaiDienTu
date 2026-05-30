import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Star, Edit3, Trash2, Eye, EyeOff, Camera, X } from 'lucide-react';
import { getImageUrl } from '../../utils/imageHelper';

const API = import.meta.env.VITE_API_URL;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const RestaurantMenu = () => {
  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFood, setSelectedFood] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', discount_Price: '', id_Category: '', prep_Time: '', image: ''
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const [menuRes, catRes] = await Promise.all([
        axios.get(`${API}/restaurant/menu`, { headers }),
        axios.get(`${API}/restaurant/categories`, { headers }),
      ]);
      setFoods(menuRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error('Lỗi tải thực đơn:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const totalFoods = foods.length;
  const activeFoods = foods.filter(f => f.is_Availabe).length;
  const hiddenFoods = totalFoods - activeFoods;

  const formatPrice = (price) => {
    if (!price) return '';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  };

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setImageFile(null); // Reset image file state
    setFormData({
      name: food.name,
      description: food.description || '',
      price: food.price,
      discount_Price: food.discount_Price || '',
      id_Category: food.id_Category,
      prep_Time: food.prep_Time || '',
      image: food.image || ''
    });
  };

   const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggle = async (foodId) => {
    try {
      await axios.put(`${API}/restaurant/menu/${foodId}/toggle`, {}, { headers });
      fetchMenu();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi');
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!selectedFood) return;
    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price),
        discount_Price: formData.discount_Price !== '' && formData.discount_Price !== 'null' ? Number(formData.discount_Price) : null,
        prep_Time: formData.prep_Time !== '' && formData.prep_Time !== 'null' ? Number(formData.prep_Time) : null,
        id_Category: formData.id_Category ? Number(formData.id_Category) : null,
        image: formData.image || ''
      };

      await axios.put(`${API}/restaurant/menu/${selectedFood.id_Food}`, payload, { headers });
      alert('Cập nhật thành công!');
      fetchMenu();
      setSelectedFood(null);
      setImageFile(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật');
    }
  };

  const handleAddFood = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description || '',
        price: Number(formData.price),
        discount_Price: formData.discount_Price !== '' && formData.discount_Price !== 'null' ? Number(formData.discount_Price) : null,
        prep_Time: formData.prep_Time !== '' && formData.prep_Time !== 'null' ? Number(formData.prep_Time) : null,
        id_Category: formData.id_Category ? Number(formData.id_Category) : null,
        image: formData.image || ''
      };

      await axios.post(`${API}/restaurant/menu`, payload, { headers });
      alert('Thêm món thành công!');
      setShowModal(false);
      setImageFile(null);
      setFormData({ name: '', description: '', price: '', discount_Price: '', id_Category: '', prep_Time: '', image: '' });
      fetchMenu();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thêm món');
    }
  };

  const openAddModal = () => {
    setImageFile(null);
    setFormData({ name: '', description: '', price: '', discount_Price: '', id_Category: '', prep_Time: '', image: '' });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setImageFile(null);
    setFormData({ name: '', description: '', price: '', discount_Price: '', id_Category: '', prep_Time: '', image: '' });
  };

  return (
    <>
      <div className="res-content">
        <div className="res-content-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1>Quản lý Thực đơn</h1>
              <p>Cập nhật món ăn và điều chỉnh giá bán hôm nay.</p>
            </div>
            <button className="res-btn res-btn-primary" onClick={openAddModal}>
              <Plus size={18} />
              Thêm món mới
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="res-stats-grid" style={{ marginBottom: 24 }}>
          <div className="res-stat-card">
            <div className="res-stat-value">{totalFoods}</div>
            <div className="res-stat-label">Tổng số món</div>
          </div>
          <div className="res-stat-card">
            <div className="res-stat-value" style={{ color: '#2e7d32' }}>{activeFoods}</div>
            <div className="res-stat-label">Đang kinh doanh</div>
          </div>
          <div className="res-stat-card">
            <div className="res-stat-value" style={{ color: '#999' }}>{hiddenFoods}</div>
            <div className="res-stat-label">Tạm ngưng</div>
          </div>
        </div>

        {/* Menu Grid */}
        {loading ? (
          <div className="res-loading"><div className="res-spinner"></div></div>
        ) : (
          <div className="res-menu-grid">
            {foods.map((food) => (
              <div
                key={food.id_Food}
                className={`res-menu-card ${selectedFood?.id_Food === food.id_Food ? 'selected' : ''}`}
                onClick={() => handleSelectFood(food)}
                style={{ opacity: food.is_Availabe ? 1 : 0.5 }}
              >
                <div style={{ position: 'relative' }}>
                  {food.image ? (
                    <img 
                      className="res-menu-card-img" 
                      src={getImageUrl(food.image, 'food')} 
                      alt={food.name} 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop';
                      }}
                    />
                  ) : (
                    <div className="res-menu-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                      🍽️
                    </div>
                  )}
                  {!food.is_Availabe && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600
                    }}>
                      Tạm ngưng
                    </div>
                  )}
                  {food.sold_Count > 100 && (
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8,
                      background: '#ff5722', color: '#fff',
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700
                    }}>
                      Bán chạy nhất
                    </div>
                  )}
                </div>
                <div className="res-menu-card-body">
                  <div className="res-menu-card-name">{food.name}</div>
                  <div className="res-menu-card-price">
                    {formatPrice(food.discount_Price || food.price)}
                    {food.discount_Price && (
                      <span className="original">{formatPrice(food.price)}</span>
                    )}
                  </div>
                  <div className="res-menu-card-status">
                    <div className="res-menu-card-rating">
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <span>{food.avg_rating ? food.avg_rating.toFixed(1) : '—'}</span>
                      <span>({food.review_count || 0})</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(food.id_Food); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                      title={food.is_Availabe ? 'Tạm ngưng' : 'Kích hoạt'}
                    >
                      {food.is_Availabe ? <Eye size={16} color="#2e7d32" /> : <EyeOff size={16} color="#999" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Sidebar - Quick Edit */}
      <aside className="res-right-sidebar">
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Chỉnh sửa nhanh
        </h3>

        {selectedFood ? (
          <>
            {/* Image */}
            <div className="res-form-group" style={{ marginBottom: 16 }}>
              <label className="res-form-label">Hình ảnh món ăn</label>
              <input 
                type="file" 
                id="quick-edit-file" 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
                accept="image/*" 
              />
              <div 
                className="res-img-upload" 
                onClick={() => document.getElementById('quick-edit-file').click()}
                style={{ overflow: 'hidden', position: 'relative' }}
              >
                {formData.image ? (
                  <img 
                    src={formData.image.startsWith('blob:') ? formData.image : getImageUrl(formData.image, 'food')} 
                    alt="Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <>
                    <Camera size={24} />
                    <span style={{ fontSize: 13 }}>Thay đổi ảnh</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick edit form */}
            <div className="res-form-group">
              <label className="res-form-label">Tên món ăn</label>
              <input
                className="res-form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Giá bán (VNĐ)</label>
              <input
                className="res-form-input"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Mô tả món ăn</label>
              <textarea
                className="res-form-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <button className="res-btn res-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSaveQuickEdit}>
              Lưu thay đổi
            </button>
            <button
              className="res-btn res-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => setSelectedFood(null)}
            >
              Hủy bỏ
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
            <div style={{ fontSize: 14 }}>Chọn một món ăn để chỉnh sửa nhanh</div>
          </div>
        )}

        {/* Tip */}
        <div className="res-tip-card" style={{ marginTop: 24 }}>
          <div className="res-tip-card-title">💡 Mẹo tăng doanh thu</div>
          <div className="res-tip-card-text">
            "Hình ảnh sáng và rõ nét có thể tăng tỷ lệ đặt món lên đến 25%."
          </div>
        </div>
      </aside>

      {/* Add Food Modal */}
      {showModal && (
        <div className="res-modal-overlay" onClick={handleCloseModal}>
          <div className="res-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="res-modal-title" style={{ margin: 0 }}>Thêm món mới</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="res-form-group" style={{ marginBottom: 16 }}>
              <label className="res-form-label">Hình ảnh món ăn</label>
              <input 
                type="file" 
                id="add-food-file" 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
                accept="image/*" 
              />
              <div 
                className="res-img-upload" 
                onClick={() => document.getElementById('add-food-file').click()}
                style={{ overflow: 'hidden', position: 'relative' }}
              >
                {formData.image ? (
                  <img 
                    src={formData.image.startsWith('blob:') ? formData.image : getImageUrl(formData.image, 'food')} 
                    alt="Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <>
                    <Camera size={24} />
                    <span style={{ fontSize: 13 }}>Tải ảnh lên</span>
                  </>
                )}
              </div>
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Tên món ăn *</label>
              <input
                className="res-form-input"
                placeholder="VD: Phở bò đặc biệt"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Danh mục *</label>
              <select
                className="res-form-select"
                value={formData.id_Category}
                onChange={(e) => setFormData({ ...formData, id_Category: e.target.value })}
              >
                <option value="">Chọn danh mục</option>
                {categories.map(cat => (
                  <option key={cat.id_Category} value={cat.id_Category}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="res-form-group">
                <label className="res-form-label">Giá gốc (VNĐ) *</label>
                <input
                  className="res-form-input"
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div className="res-form-group">
                <label className="res-form-label">Giá giảm (VNĐ)</label>
                <input
                  className="res-form-input"
                  type="number"
                  placeholder="0"
                  value={formData.discount_Price}
                  onChange={(e) => setFormData({ ...formData, discount_Price: e.target.value })}
                />
              </div>
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Thời gian chuẩn bị (phút)</label>
              <input
                className="res-form-input"
                type="number"
                placeholder="15"
                value={formData.prep_Time}
                onChange={(e) => setFormData({ ...formData, prep_Time: e.target.value })}
              />
            </div>

            <div className="res-form-group">
              <label className="res-form-label">Mô tả</label>
              <textarea
                className="res-form-textarea"
                placeholder="Mô tả chi tiết về món ăn..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="res-btn res-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCloseModal}>
                Hủy
              </button>
              <button className="res-btn res-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleAddFood}>
                Thêm món
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RestaurantMenu;
