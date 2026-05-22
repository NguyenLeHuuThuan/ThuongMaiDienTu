const { poolPromise } = require('../config/db');

// Lấy danh sách danh mục
exports.getCategories = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Category');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách nhà hàng nổi bật
exports.getRestaurants = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT id_Restaurant, name_Restaurant, description, logo, cover_image, address, rating_avg FROM Restaurant');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách món ăn (có thể filter theo category, search)
exports.getFoods = async (req, res) => {
  const { categoryId, search, restaurantId } = req.query;
  try {
    const pool = await poolPromise;
    let query = `
      SELECT f.*, r.name_Restaurant, c.name as categoryName 
      FROM Food f
      JOIN Restaurant r ON f.id_Restaurant = r.id_Restaurant
      JOIN Category c ON f.id_Category = c.id_Category
      WHERE f.is_Availabe = 1
    `;
    
    const request = pool.request();

    if (categoryId) {
      query += ` AND f.id_Category = @categoryId`;
      request.input('categoryId', categoryId);
    }
    
    if (restaurantId) {
      query += ` AND f.id_Restaurant = @restaurantId`;
      request.input('restaurantId', restaurantId);
    }

    if (search) {
      query += ` AND (f.name LIKE '%' + @search + '%' OR f.description LIKE '%' + @search + '%')`;
      request.input('search', search);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết món ăn
exports.getFoodDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT f.*, r.name_Restaurant, r.address 
        FROM Food f
        JOIN Restaurant r ON f.id_Restaurant = r.id_Restaurant
        WHERE f.id_Food = @id
      `);
      
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy món ăn' });
    }

    // Lấy thêm hình ảnh
    const imagesResult = await pool.request()
      .input('id', id)
      .query('SELECT image FROM Food_Image WHERE id_Food = @id');
      
    const food = result.recordset[0];
    food.images = imagesResult.recordset.map(img => img.image);

    res.json(food);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết nhà hàng và menu
exports.getRestaurantDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const resResult = await pool.request()
      .input('id', id)
      .query(`
        SELECT * FROM Restaurant WHERE id_Restaurant = @id
      `);
      
    if (resResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    
    const restaurant = resResult.recordset[0];
    
    // Lấy menu (các món ăn của nhà hàng)
    const menuResult = await pool.request()
      .input('id', id)
      .query(`
        SELECT f.*, c.name as categoryName 
        FROM Food f
        JOIN Category c ON f.id_Category = c.id_Category
        WHERE f.id_Restaurant = @id AND f.is_Availabe = 1
      `);
      
    restaurant.menu = menuResult.recordset;
    
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy đánh giá của món ăn
exports.getFoodReviews = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT rf.rating_Food, rf.comment_Food, rf.image, r.created_At, u.fullName, u.avatar
        FROM Review_Food rf
        JOIN Review r ON rf.id_Review = r.id_Review
        JOIN [User] u ON r.id_User = u.id_User
        WHERE rf.id_Food = @id
        ORDER BY r.created_At DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách promotions (Vouchers hot) chung
exports.getPromotions = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT id_Promo, code, type, value, min_OrderValue, max_Discount, end_Date, id_Restaurant
      FROM Promotion
      WHERE (usage_Limit IS NULL OR used_Count < usage_Limit)
        AND (star_Date IS NULL OR star_Date <= GETDATE())
        AND (end_Date IS NULL OR end_Date >= GETDATE())
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

