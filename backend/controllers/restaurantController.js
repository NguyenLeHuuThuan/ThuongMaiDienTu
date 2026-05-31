const { sql, poolPromise } = require('../config/db');

// ============================================
// THÔNG TIN NHÀ HÀNG
// ============================================

// Lấy thông tin nhà hàng của owner đang đăng nhập
exports.getMyRestaurant = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ownerId', req.user.id)
      .query(`
        SELECT r.*, u.fullName as ownerName, u.avatar as ownerAvatar
        FROM Restaurant r
        JOIN [User] u ON r.owner_id = u.id_User
        WHERE r.owner_id = @ownerId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật thông tin nhà hàng
exports.updateRestaurant = async (req, res) => {
  const { name_Restaurant, description, address, openTime, closeTime } = req.body;
  try {
    const pool = await poolPromise;
    
    // Tìm nhà hàng của owner
    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }

    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    await pool.request()
      .input('id', id_Restaurant)
      .input('name', name_Restaurant)
      .input('desc', description)
      .input('addr', address)
      .input('open', openTime)
      .input('close', closeTime)
      .query(`
        UPDATE Restaurant 
        SET name_Restaurant = @name, description = @desc, address = @addr, openTime = @open, closeTime = @close
        WHERE id_Restaurant = @id
      `);

    res.json({ message: 'Cập nhật thông tin nhà hàng thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// QUẢN LÝ ĐƠN HÀNG
// ============================================

// Lấy đơn hàng của nhà hàng (filter theo status)
exports.getRestaurantOrders = async (req, res) => {
  const { status } = req.query;
  try {
    const pool = await poolPromise;

    // Lấy id nhà hàng
    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');

    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    let query = `
      SELECT o.*, u.fullName as customerName, u.phone as customerPhone, u.avatar as customerAvatar,
             a.full_Address as deliveryAddress,
             pm.method as paymentMethodDetail, pm.gateway,
             (SELECT COUNT(*) FROM Order_Food WHERE id_Order = o.id_Order) as itemCount
      FROM [Order] o
      JOIN [User] u ON o.id_User = u.id_User
      JOIN Address a ON o.id_Address = a.id_Address
      LEFT JOIN PaymentMethod pm ON pm.id_Order = o.id_Order
      WHERE o.id_Restaurant = @resId
    `;

    const request = pool.request().input('resId', id_Restaurant);

    if (status) {
      if (status === 'new') {
        query += ` AND o.order_Status = 'pending'`;
      } else if (status === 'processing') {
        query += ` AND o.order_Status IN ('confirmed', 'preparing', 'picking')`;
      } else if (status === 'completed') {
        query += ` AND o.order_Status IN ('ready', 'delivering', 'delivered')`;
      } else {
        query += ` AND o.order_Status = @status`;
        request.input('status', status);
      }
    }

    query += ` ORDER BY o.created_At DESC`;

    const result = await request.query(query);

    // Lấy chi tiết món cho từng đơn
    for (let order of result.recordset) {
      const items = await pool.request()
        .input('orderId', order.id_Order)
        .query(`
          SELECT ofood.*, f.name, f.image, f.description as foodDesc
          FROM Order_Food ofood
          JOIN Food f ON ofood.id_Food = f.id_Food
          WHERE ofood.id_Order = @orderId
        `);
      order.items = items.recordset;
    }

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Chấp nhận đơn hàng (pending → confirmed)
exports.acceptOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    // Verify owner
    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    // Kiểm tra đơn hàng
    const orderCheck = await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`SELECT id_Order, id_User, order_Code, order_Status FROM [Order] WHERE id_Order = @id AND id_Restaurant = @resId`);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    if (orderCheck.recordset[0].order_Status !== 'pending') {
      return res.status(400).json({ message: 'Đơn hàng không ở trạng thái chờ xác nhận' });
    }

    // Cập nhật trạng thái
    await pool.request()
      .input('id', id)
      .query(`UPDATE [Order] SET order_Status = 'confirmed', accepted_At = GETDATE() WHERE id_Order = @id`);

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`UPDATE Order_Restaurant SET status = 'confirmed' WHERE id_Order = @id AND id_Restaurant = @resId`);

    // Thông báo cho khách hàng
    const order = orderCheck.recordset[0];
    const notiResult = await pool.request()
      .input('id_User', order.id_User)
      .input('title', 'Đơn hàng đã được xác nhận')
      .input('body', `Đơn hàng #${order.order_Code} đã được nhà hàng xác nhận.`)
      .input('type', 'order')
      .input('related_OrderId', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
        OUTPUT inserted.id_Noti
        VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
      `);

    const id_Noti = notiResult.recordset[0].id_Noti;
    await pool.request()
      .input('id_Noti', id_Noti)
      .input('id_User', order.id_User)
      .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');

    res.json({ message: 'Đã chấp nhận đơn hàng' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Từ chối đơn hàng
exports.rejectOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const orderCheck = await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`SELECT id_Order, id_User, order_Code FROM [Order] WHERE id_Order = @id AND id_Restaurant = @resId AND order_Status = 'pending'`);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc đơn không ở trạng thái chờ' });
    }

    await pool.request()
      .input('id', id)
      .input('reason', reason || 'Nhà hàng từ chối')
      .query(`
        UPDATE [Order] SET order_Status = 'cancelled', cancelled_By = 'restaurant', cancellation_Reason = @reason
        WHERE id_Order = @id;

        -- Hoàn tác trạng thái sử dụng voucher
        UPDATE Voucher 
        SET used = 0 
        WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
          AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

        -- Giảm lượt sử dụng của Promotion
        UPDATE Promotion
        SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
        WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
      `);

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`UPDATE Order_Restaurant SET status = 'cancelled' WHERE id_Order = @id AND id_Restaurant = @resId`);

    // Thông báo cho khách
    const order = orderCheck.recordset[0];
    const notiResult = await pool.request()
      .input('id_User', order.id_User)
      .input('title', 'Đơn hàng đã bị từ chối')
      .input('body', `Đơn hàng #${order.order_Code} đã bị nhà hàng từ chối. Lý do: ${reason || 'Không rõ'}`)
      .input('type', 'order')
      .input('related_OrderId', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
        OUTPUT inserted.id_Noti
        VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
      `);

    const id_Noti = notiResult.recordset[0].id_Noti;
    await pool.request()
      .input('id_Noti', id_Noti)
      .input('id_User', order.id_User)
      .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');

    res.json({ message: 'Đã từ chối đơn hàng' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Hoàn thành chế biến (confirmed/preparing → ready)
exports.completeOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const orderCheck = await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`
        SELECT o.id_Order, o.id_User, o.order_Code, o.id_Driver, d.id_User as driver_id_User 
        FROM [Order] o 
        LEFT JOIN Driver d ON o.id_Driver = d.id_Driver 
        WHERE o.id_Order = @id AND o.id_Restaurant = @resId AND o.order_Status IN ('confirmed', 'preparing', 'picking')
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc đơn chưa sẵn sàng hoàn thành' });
    }

    await pool.request()
      .input('id', id)
      .query(`UPDATE [Order] SET order_Status = 'ready', ready_At = GETDATE() WHERE id_Order = @id`);

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`UPDATE Order_Restaurant SET status = 'ready' WHERE id_Order = @id AND id_Restaurant = @resId`);

    // Thông báo cho khách
    const order = orderCheck.recordset[0];
    const notiResult = await pool.request()
      .input('id_User', order.id_User)
      .input('title', 'Món ăn đã sẵn sàng')
      .input('body', `Đơn hàng #${order.order_Code} đã được chuẩn bị xong. Đang chờ tài xế đến lấy.`)
      .input('type', 'order')
      .input('related_OrderId', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
        OUTPUT inserted.id_Noti
        VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
      `);

    const id_Noti = notiResult.recordset[0].id_Noti;
    await pool.request()
      .input('id_Noti', id_Noti)
      .input('id_User', order.id_User)
      .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');

    // Thông báo cho shipper (nếu đã nhận đơn)
    if (order.driver_id_User) {
      const notiDriverResult = await pool.request()
        .input('id_User', order.driver_id_User)
        .input('title', 'Món ăn đã nấu xong')
        .input('body', `Đơn hàng #${order.order_Code} đã nấu xong, bạn có thể đến nhà hàng để lấy hàng.`)
        .input('type', 'order')
        .input('related_OrderId', id)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
          OUTPUT inserted.id_Noti
          VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
        `);
      const driver_id_Noti = notiDriverResult.recordset[0].id_Noti;
      await pool.request()
        .input('id_Noti', driver_id_Noti)
        .input('id_User', order.driver_id_User)
        .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
    }

    res.json({ message: 'Đơn hàng đã hoàn thành chế biến' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// QUẢN LÝ THỰC ĐƠN
// ============================================

// Lấy tất cả món ăn của nhà hàng (kể cả đang ẩn)
exports.getRestaurantMenu = async (req, res) => {
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const result = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT f.*, c.name as categoryName,
          (SELECT AVG(CAST(rf.rating_Food AS FLOAT)) FROM Review_Food rf WHERE rf.id_Food = f.id_Food) as avg_rating,
          (SELECT COUNT(*) FROM Review_Food rf WHERE rf.id_Food = f.id_Food) as review_count
        FROM Food f
        JOIN Category c ON f.id_Category = c.id_Category
        WHERE f.id_Restaurant = @resId
        ORDER BY f.id_Food DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Thêm món ăn mới
exports.addFood = async (req, res) => {
  const { name, description, price, discount_Price, id_Category, prep_Time, image } = req.body;
  const imagePath = image || 'default-food.svg';
  
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const parsedPrice = price ? parseFloat(price) : 0;
    const parsedDiscountPrice = (discount_Price && discount_Price !== 'null' && discount_Price !== '') ? parseFloat(discount_Price) : null;
    const parsedPrepTime = (prep_Time && prep_Time !== 'null' && prep_Time !== '') ? parseInt(prep_Time) : null;
    const parsedCategoryId = id_Category ? parseInt(id_Category) : null;

    const result = await pool.request()
      .input('id_Category', parsedCategoryId)
      .input('id_Restaurant', id_Restaurant)
      .input('name', name)
      .input('description', description || null)
      .input('image', imagePath)
      .input('price', parsedPrice)
      .input('discount_Price', parsedDiscountPrice)
      .input('prep_Time', parsedPrepTime)
      .query(`
        INSERT INTO Food (id_Category, id_Restaurant, name, description, image, price, discount_Price, is_Availabe, sold_Count, prep_Time)
        OUTPUT inserted.id_Food
        VALUES (@id_Category, @id_Restaurant, @name, @description, @image, @price, @discount_Price, 1, 0, @prep_Time)
      `);

    res.json({ message: 'Thêm món ăn thành công', id_Food: result.recordset[0].id_Food });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật món ăn
exports.updateFood = async (req, res) => {
  const { id } = req.params;
  const { name, description, image, price, discount_Price, id_Category, prep_Time } = req.body;
  
  let imagePath = image;
  if (!imagePath || imagePath === 'null' || imagePath === 'undefined') {
    imagePath = 'default-food.svg';
  }

  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const parsedPrice = price ? parseFloat(price) : 0;
    const parsedDiscountPrice = (discount_Price && discount_Price !== 'null' && discount_Price !== '') ? parseFloat(discount_Price) : null;
    const parsedPrepTime = (prep_Time && prep_Time !== 'null' && prep_Time !== '') ? parseInt(prep_Time) : null;
    const parsedCategoryId = id_Category ? parseInt(id_Category) : null;

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .input('name', name)
      .input('description', description || null)
      .input('image', imagePath)
      .input('price', parsedPrice)
      .input('discount_Price', parsedDiscountPrice)
      .input('id_Category', parsedCategoryId)
      .input('prep_Time', parsedPrepTime)
      .query(`
        UPDATE Food 
        SET name = @name, description = @description, image = @image, price = @price, 
            discount_Price = @discount_Price, id_Category = @id_Category, prep_Time = @prep_Time
        WHERE id_Food = @id AND id_Restaurant = @resId
      `);

    res.json({ message: 'Cập nhật món ăn thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Bật/Tắt trạng thái món ăn
exports.toggleFoodAvailability = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query(`
        UPDATE Food SET is_Availabe = CASE WHEN is_Availabe = 1 THEN 0 ELSE 1 END
        WHERE id_Food = @id AND id_Restaurant = @resId
      `);

    res.json({ message: 'Đã cập nhật trạng thái món ăn' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// QUẢN LÝ KHUYẾN MÃI
// ============================================

// Lấy danh sách khuyến mãi của nhà hàng
exports.getRestaurantPromotions = async (req, res) => {
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const result = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT *, 
               CAST(CASE WHEN id_Restaurant = @resId THEN 1 ELSE 0 END AS BIT) as is_owner 
        FROM Promotion 
        WHERE id_Restaurant = @resId OR is_Applicable_To = 'all'
        ORDER BY end_Date DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Tạo khuyến mãi mới
exports.createPromotion = async (req, res) => {
  const { code, type, value, min_OrderValue, max_Discount, usage_Limit, star_Date, end_Date } = req.body;
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    // Check duplicate code
    const codeCheck = await pool.request()
      .input('code', code)
      .query('SELECT id_Promo FROM Promotion WHERE code = @code');
    if (codeCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Mã khuyến mãi đã tồn tại' });
    }

    const result = await pool.request()
      .input('code', code)
      .input('type', type)
      .input('value', value)
      .input('min_OrderValue', min_OrderValue || null)
      .input('max_Discount', max_Discount || null)
      .input('usage_Limit', usage_Limit || null)
      .input('star_Date', star_Date || null)
      .input('end_Date', end_Date || null)
      .input('resId', id_Restaurant)
      .query(`
        INSERT INTO Promotion (code, type, value, min_OrderValue, max_Discount, usage_Limit, used_Count, star_Date, end_Date, is_Applicable_To, id_Restaurant)
        OUTPUT inserted.id_Promo
        VALUES (@code, @type, @value, @min_OrderValue, @max_Discount, @usage_Limit, 0, @star_Date, @end_Date, 'restaurant', @resId)
      `);

    res.json({ message: 'Tạo khuyến mãi thành công', id_Promo: result.recordset[0].id_Promo });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xóa khuyến mãi
exports.deletePromotion = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    // Check if the restaurant owns this promotion
    const promoCheck = await pool.request()
      .input('id', id)
      .query('SELECT id_Restaurant FROM Promotion WHERE id_Promo = @id');
    
    if (promoCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });
    }
    if (promoCheck.recordset[0].id_Restaurant !== id_Restaurant) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa khuyến mãi của hệ thống' });
    }

    // Xóa các liên kết Order_Promotion trước
    await pool.request()
      .input('id', id)
      .query('DELETE FROM Order_Promotion WHERE id_Promo = @id');

    await pool.request()
      .input('id', id)
      .input('resId', id_Restaurant)
      .query('DELETE FROM Promotion WHERE id_Promo = @id AND id_Restaurant = @resId');

    res.json({ message: 'Xóa khuyến mãi thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// PHÂN TÍCH KINH DOANH
// ============================================

exports.getAnalytics = async (req, res) => {
  const { period } = req.query; // 'day' or 'month'
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    // Fetch system service fee percent config
    const feeConfig = await pool.request()
      .query("SELECT config_value FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
    const serviceFeePercent = feeConfig.recordset.length > 0 ? parseFloat(feeConfig.recordset[0].config_value) : 10.0;

    // 1. Doanh thu theo ngày hoặc tháng (Tính khấu trừ trên từng đơn rồi cộng dồn lại)
    let revenueQuery = '';
    if (period === 'month') {
      revenueQuery = `
        SELECT 
          CONVERT(VARCHAR(7), o.created_At, 120) as date,
          SUM(o.total_Amount) as originalRevenue,
          SUM(o.total_Amount * @feePercent / 100.0) as serviceFee,
          SUM(o.total_Amount - (o.total_Amount * @feePercent / 100.0)) as netRevenue,
          COUNT(*) as orderCount
        FROM [Order] o
        WHERE o.id_Restaurant = @resId 
          AND o.order_Status = 'delivered'
          AND o.created_At >= DATEADD(MONTH, -6, GETDATE())
        GROUP BY CONVERT(VARCHAR(7), o.created_At, 120)
        ORDER BY date ASC
      `;
    } else {
      revenueQuery = `
        SELECT 
          CAST(o.created_At AS DATE) as date,
          SUM(o.total_Amount) as originalRevenue,
          SUM(o.total_Amount * @feePercent / 100.0) as serviceFee,
          SUM(o.total_Amount - (o.total_Amount * @feePercent / 100.0)) as netRevenue,
          COUNT(*) as orderCount
        FROM [Order] o
        WHERE o.id_Restaurant = @resId 
          AND o.order_Status = 'delivered'
          AND o.created_At >= DATEADD(DAY, -7, GETDATE())
        GROUP BY CAST(o.created_At AS DATE)
        ORDER BY date ASC
      `;
    }

    const revenueResult = await pool.request()
      .input('resId', id_Restaurant)
      .input('feePercent', serviceFeePercent)
      .query(revenueQuery);

    const processedRevenue = revenueResult.recordset.map(item => {
      return {
        ...item,
        originalRevenue: parseFloat(item.originalRevenue || 0),
        serviceFee: parseFloat(item.serviceFee || 0),
        netRevenue: parseFloat(item.netRevenue || 0)
      };
    });

    // 2. Doanh thu hôm nay (Tính khấu trừ trên từng đơn rồi cộng dồn lại)
    const todayRevenue = await pool.request()
      .input('resId', id_Restaurant)
      .input('feePercent', serviceFeePercent)
      .query(`
        SELECT 
          ISNULL(SUM(o.total_Amount), 0) as originalTodayRevenue,
          ISNULL(SUM(o.total_Amount * @feePercent / 100.0), 0) as todayServiceFee,
          ISNULL(SUM(o.total_Amount - (o.total_Amount * @feePercent / 100.0)), 0) as todayNetRevenue,
          COUNT(*) as todayOrders
        FROM [Order] o
        WHERE o.id_Restaurant = @resId 
          AND o.order_Status IN ('delivered', 'confirmed', 'preparing', 'ready', 'picking', 'delivering')
          AND CAST(o.created_At AS DATE) = CAST(GETDATE() AS DATE)
      `);

    const originalTodayRevenue = parseFloat(todayRevenue.recordset[0].originalTodayRevenue || 0);
    const todayServiceFee = parseFloat(todayRevenue.recordset[0].todayServiceFee || 0);
    const todayNetRevenue = parseFloat(todayRevenue.recordset[0].todayNetRevenue || 0);

    // 3. Top 3 món bán chạy (tháng này)
    const topFoods = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT TOP 3 f.id_Food, f.name, f.image, f.price,
          SUM(ofood.quantity) as total_sold
        FROM Order_Food ofood
        JOIN Food f ON ofood.id_Food = f.id_Food
        JOIN [Order] o ON ofood.id_Order = o.id_Order
        WHERE f.id_Restaurant = @resId 
          AND o.order_Status = 'delivered'
          AND o.created_At >= DATEADD(MONTH, -1, GETDATE())
        GROUP BY f.id_Food, f.name, f.image, f.price
        ORDER BY total_sold DESC
      `);

    // 4. Rating trung bình
    const ratingResult = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT 
          AVG(CAST(r.rating_Res AS FLOAT)) as avg_rating,
          COUNT(*) as review_count
        FROM Review r
        JOIN [Order] o ON r.id_Order = o.id_Order
        WHERE o.id_Restaurant = @resId
      `);

    // 5. Tổng số đơn hàng
    const totalOrders = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN order_Status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN order_Status IN ('confirmed','preparing', 'picking') THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN order_Status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN order_Status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM [Order]
        WHERE id_Restaurant = @resId
      `);

    res.json({
      serviceFeePercent,
      revenue: processedRevenue,
      today: {
        ...todayRevenue.recordset[0],
        todayRevenue: todayNetRevenue,
        originalTodayRevenue,
        todayServiceFee,
        todayNetRevenue
      },
      topFoods: topFoods.recordset,
      rating: ratingResult.recordset[0],
      orders: totalOrders.recordset[0]
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// KHIẾU NẠI
// ============================================

// Lấy khiếu nại liên quan đến nhà hàng
exports.getComplaints = async (req, res) => {
  try {
    const pool = await poolPromise;

    const resCheck = await pool.request()
      .input('ownerId', req.user.id)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    const result = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        DECLARE @resFeePercent FLOAT = ISNULL((SELECT MAX(CAST(config_value AS FLOAT)) FROM SystemConfig WHERE config_key = 'op_service_fee_percent'), 15.0);
        SELECT c.id_Complaint, c.id_Order, c.id_User, c.type, c.description, c.status, c.resolution, c.image, c.video, c.created_At, c.resolved_At, c.handled_By,
               c.comp_customer_amount, c.comp_driver_amount,
               ROUND(c.comp_restaurant_amount / (1.0 + @resFeePercent / 100.0), 0) as comp_restaurant_amount,
               u.fullName as customerName, u.avatar as customerAvatar, o.order_Code
        FROM Complaint c
        JOIN [Order] o ON c.id_Order = o.id_Order
        JOIN [User] u ON c.id_User = u.id_User
        WHERE o.id_Restaurant = @resId
        ORDER BY c.created_At DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Phản hồi khiếu nại
exports.respondComplaint = async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  try {
    const pool = await poolPromise;

    await pool.request()
      .input('id', id)
      .input('resolution', resolution)
      .input('handledBy', req.user.id)
      .query(`
        UPDATE Complaint 
        SET status = 'resolved', resolution = @resolution, handled_By = @handledBy, resolved_At = GETDATE()
        WHERE id_Complaint = @id
      `);

    res.json({ message: 'Phản hồi khiếu nại thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách danh mục (để dropdown khi thêm/sửa món)
exports.getCategories = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Category WHERE is_active = 1 ORDER BY display_order ASC, name ASC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// QUẢN LÝ TRÒ CHUYỆN (CHAT)
// ============================================

// Lấy danh sách cuộc trò chuyện của nhà hàng
exports.getConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        WITH LastMessages AS (
          SELECT 
            id_Message, sender_id, receiver_id, message_text, created_at, is_read,
            ROW_NUMBER() OVER (PARTITION BY 
              CASE WHEN sender_id = @userId THEN receiver_id ELSE sender_id END 
              ORDER BY created_at DESC) as rn
          FROM RestaurantMessage
          WHERE sender_id = @userId OR receiver_id = @userId
        )
        SELECT 
          lm.message_text as lastMessage,
          lm.created_at as lastMessageTime,
          lm.is_read as lastMessageIsRead,
          lm.sender_id as lastMessageSenderId,
          u.id_User as partnerId,
          u.fullName as partnerName,
          u.avatar as partnerAvatar,
          u.role as partnerRole,
          (
            SELECT COUNT(*) 
            FROM RestaurantMessage 
            WHERE sender_id = u.id_User AND receiver_id = @userId AND is_read = 0
          ) as unreadCount
        FROM LastMessages lm
        JOIN [User] u ON u.id_User = CASE WHEN lm.sender_id = @userId THEN lm.receiver_id ELSE lm.sender_id END
        WHERE lm.rn = 1
        ORDER BY lm.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy hội thoại', error: err.message });
  }
};

// Lấy tin nhắn chi tiết giữa nhà hàng và một đối tác
exports.getMessages = async (req, res) => {
  const userId = req.user.id;
  const { partnerId } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .input('partnerId', partnerId)
      .query(`
        SELECT m.*, 
               s.fullName as senderName, s.avatar as senderAvatar,
               r.fullName as receiverName, r.avatar as receiverAvatar
        FROM RestaurantMessage m
        JOIN [User] s ON m.sender_id = s.id_User
        JOIN [User] r ON m.receiver_id = r.id_User
        WHERE (m.sender_id = @userId AND m.receiver_id = @partnerId)
           OR (m.sender_id = @partnerId AND m.receiver_id = @userId)
        ORDER BY m.created_at ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy tin nhắn', error: err.message });
  }
};

// Gửi tin nhắn mới
exports.sendMessage = async (req, res) => {
  const userId = req.user.id;
  const { receiverId, messageText } = req.body;
  if (!receiverId || !messageText) {
    return res.status(400).json({ message: 'Thiếu thông tin người nhận hoặc nội dung tin nhắn' });
  }
  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('senderId', userId)
      .input('receiverId', receiverId)
      .input('messageText', messageText)
      .query(`
        INSERT INTO RestaurantMessage (sender_id, receiver_id, message_text, created_at, is_read)
        OUTPUT inserted.*
        VALUES (@senderId, @receiverId, @messageText, GETDATE(), 0)
      `);
      
    res.json({ message: 'Gửi tin nhắn thành công', data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi gửi tin nhắn', error: err.message });
  }
};

// Đánh dấu tin nhắn đã đọc
exports.markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { partnerId } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('userId', userId)
      .input('partnerId', partnerId)
      .query(`
        UPDATE RestaurantMessage
        SET is_read = 1
        WHERE sender_id = @partnerId AND receiver_id = @userId AND is_read = 0
      `);
    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách liên hệ (khách hàng, tài xế liên quan tới đơn hàng)
exports.getContacts = async (req, res) => {
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    
    // Lấy id nhà hàng
    const resCheck = await pool.request()
      .input('ownerId', userId)
      .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
    if (resCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    const id_Restaurant = resCheck.recordset[0].id_Restaurant;

    // Lấy danh sách Khách hàng và Shipper từ các đơn hàng của nhà hàng này
    const result = await pool.request()
      .input('resId', id_Restaurant)
      .query(`
        SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
        FROM [Order] o
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.id_Restaurant = @resId
        
        UNION
        
        SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
        FROM [Order] o
        JOIN Driver d ON o.id_Driver = d.id_Driver
        JOIN [User] u ON d.id_User = u.id_User
        WHERE o.id_Restaurant = @resId
      `);
      
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách liên hệ', error: err.message });
  }
};

// ============================================
// QUẢN LÝ VÍ (WALLET)
// ============================================

exports.getWallet = async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.id;

    // Lấy số dư ví từ bảng [User]
    const userRes = await pool.request()
      .input('userId', userId)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @userId');

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin tài khoản' });
    }

    const wallet_balance = parseFloat(userRes.recordset[0].wallet_balance || 0);

    // Lấy danh sách lịch sử giao dịch từ bảng Wallet_Transaction
    const txRes = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT wt.*, o.order_Code 
        FROM Wallet_Transaction wt
        LEFT JOIN [Order] o ON wt.id_Order = o.id_Order
        WHERE wt.id_User = @userId
        ORDER BY wt.created_At DESC
      `);

    res.json({
      balance: wallet_balance,
      transactions: txRes.recordset.map(t => ({
        ...t,
        amount: parseFloat(t.amount || 0),
        balance_before: parseFloat(t.balance_before || 0),
        balance_after: parseFloat(t.balance_after || 0)
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin ví', error: err.message });
  }
};

exports.topUpWallet = async (req, res) => {
  const { amount, note } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: 'Số tiền nạp không hợp lệ' });
  }

  try {
    const pool = await poolPromise;
    const userId = req.user.id;

    // Bắt đầu một transaction để an toàn dữ liệu
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const userRes = await transaction.request()
        .input('userId', userId)
        .query('SELECT wallet_balance FROM [User] WHERE id_User = @userId');

      if (userRes.recordset.length === 0) {
        throw new Error('Không tìm thấy tài khoản');
      }

      const balance_before = parseFloat(userRes.recordset[0].wallet_balance || 0);
      const balance_after = balance_before + numAmount;

      // Cập nhật số dư trong bảng [User]
      await transaction.request()
        .input('userId', userId)
        .input('newBalance', balance_after)
        .query('UPDATE [User] SET wallet_balance = @newBalance WHERE id_User = @userId');

      // Ghi nhận lịch sử trong Wallet_Transaction
      await transaction.request()
        .input('userId', userId)
        .input('amount', numAmount)
        .input('before', balance_before)
        .input('after', balance_after)
        .input('note', note || 'Nạp tiền vào ví')
        .query(`
          INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@userId, 'top_up', @amount, @before, @after, @note, GETDATE())
        `);

      await transaction.commit();

      res.json({
        message: 'Nạp tiền vào ví thành công',
        balance: balance_after
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi nạp tiền', error: err.message });
  }
};

exports.withdrawWallet = async (req, res) => {
  const { amount, note } = req.body;
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: 'Số tiền rút không hợp lệ' });
  }

  try {
    const pool = await poolPromise;
    const userId = req.user.id;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const userRes = await transaction.request()
        .input('userId', userId)
        .query('SELECT wallet_balance FROM [User] WHERE id_User = @userId');

      if (userRes.recordset.length === 0) {
        throw new Error('Không tìm thấy tài khoản');
      }

      const balance_before = parseFloat(userRes.recordset[0].wallet_balance || 0);
      
      if (balance_before < numAmount) {
        return res.status(400).json({ message: 'Số dư ví không đủ để thực hiện giao dịch này' });
      }

      const balance_after = balance_before - numAmount;

      // Cập nhật số dư trong bảng [User]
      await transaction.request()
        .input('userId', userId)
        .input('newBalance', balance_after)
        .query('UPDATE [User] SET wallet_balance = @newBalance WHERE id_User = @userId');

      // Ghi nhận lịch sử trong Wallet_Transaction
      await transaction.request()
        .input('userId', userId)
        .input('amount', numAmount)
        .input('before', balance_before)
        .input('after', balance_after)
        .input('note', note || 'Rút tiền về tài khoản ngân hàng')
        .query(`
          INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@userId, 'withdraw', @amount, @before, @after, @note, GETDATE())
        `);

      await transaction.commit();

      res.json({
        message: 'Rút tiền thành công',
        balance: balance_after
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi rút tiền', error: err.message });
  }
};


