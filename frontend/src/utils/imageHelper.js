const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

export const getImageUrl = (path, type = 'food') => {
  if (!path || path.includes('default') || path.includes('placeholder') || path === 'NULL' || path === 'null') {
    if (type === 'avatar') return 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=200&auto=format&fit=crop';
    if (type === 'logo') return 'https://ui-avatars.com/api/?name=Restaurant&background=f97316&color=fff&size=128';
    if (type === 'cover') return 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=400&fit=crop';
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop';
  }

  // Nếu là một URL đầy đủ (ví dụ Unsplash, Imgur) hoặc dữ liệu Base64 thì trả về luôn
  if (path.startsWith('data:image/') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Chuẩn hóa đường dẫn bằng cách loại bỏ dấu gạch chéo đầu nếu có
  let cleanPath = path;
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }

  // Ánh xạ các đường dẫn giả định từ database cũ sang ảnh thật từ Unsplash
  const mockMaps = {
    // Avatars người dùng
    'avatars/an.jpg': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    'avatars/bich.jpg': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    'avatars/hoamai.jpg': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop',
    'avatars/thanhtung.jpg': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    'avatars/dung.jpg': 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&h=150&fit=crop',

    // Logo Nhà hàng
    'logos/hoamai.png': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&h=150&fit=crop',
    'logos/thanhtung.png': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=150&h=150&fit=crop',
    'logos/kim.png': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=150&h=150&fit=crop',

    // Ảnh bìa Nhà hàng
    'covers/hoamai.jpg': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop',
    'covers/thanhtung.jpg': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&h=400&fit=crop',
    'covers/kim.jpg': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&h=400&fit=crop',

    // Ảnh món ăn
    'food/com_suon.jpg': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=400&fit=crop',
    'food/com_ga.jpg': 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500&h=400&fit=crop',
    'food/com_tam.jpg': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&h=400&fit=crop',
    'food/bunbo_dacbiet.jpg': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&h=400&fit=crop',
    'food/bunbo_thuong.jpg': 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&h=400&fit=crop',
    'food/banhmi_bo.jpg': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&h=400&fit=crop',
    'food/pizza_haissan.jpg': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&h=400&fit=crop',
    'food/pizza_bbq.jpg': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&h=400&fit=crop',
    'food/burger_bo.jpg': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=400&fit=crop',
    'food/nuoc_cam.jpg': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500&h=400&fit=crop',
    'food/com_duongchau.jpg': 'https://images.unsplash.com/photo-1603133872878-685f5888279a?w=500&h=400&fit=crop',
    'food/dauhu_tuxuyen.jpg': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=500&h=400&fit=crop',
    'food/tra_sua.jpg': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&h=400&fit=crop',

    // Ảnh chi tiết món ăn (Food_Image)
    'food_imgs/com_suon_1.jpg': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=400&fit=crop',
    'food_imgs/com_suon_2.jpg': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=400&fit=crop',
    'food_imgs/bunbo_dacbiet_1.jpg': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&h=400&fit=crop',
    'food_imgs/bunbo_dacbiet_2.jpg': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&h=400&fit=crop',
    'food_imgs/pizza_haisan_1.jpg': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&h=400&fit=crop',
    'food_imgs/burger_bo_1.jpg': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=400&fit=crop',
  };

  if (mockMaps[cleanPath]) {
    return mockMaps[cleanPath];
  }

  // Nếu là file tải lên thông thường qua backend (chứa thư mục upload hoặc lưu trữ backend)
  if (cleanPath.startsWith('img/')) {
    return `${SERVER_URL}/${cleanPath}`;
  }

  // Mặc định nối SERVER_URL
  return `${SERVER_URL}/${cleanPath}`;
};
