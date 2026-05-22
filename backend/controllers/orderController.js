const { poolPromise } = require('../config/db');

// Lấy danh sách đơn hàng của user
exports.getOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', req.user.id)
      .query(`
        SELECT o.*, r.name_Restaurant, r.logo,
               CASE WHEN EXISTS (SELECT 1 FROM Review rev WHERE rev.id_Order = o.id_Order) THEN 1 ELSE 0 END as is_Reviewed
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        WHERE o.id_User = @userId
        ORDER BY o.created_At DESC
      `);
      
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết đơn hàng
exports.getOrderDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const orderResult = await pool.request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, a.name as user_name, a.phone as user_phone
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        WHERE o.id_Order = @id AND o.id_User = @userId
      `);

    if (orderResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orderResult.recordset[0];

    // Lấy chi tiết món ăn
    const itemsResult = await pool.request()
      .input('orderId', id)
      .query(`
        SELECT ofood.*, f.name, f.image
        FROM Order_Food ofood
        JOIN Food f ON ofood.id_Food = f.id_Food
        WHERE ofood.id_Order = @orderId
      `);
      
    order.items = itemsResult.recordset;

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đặt hàng (Checkout)
exports.placeOrder = async (req, res) => {
  const { id_Address, id_Restaurant, payment_Method, note, id_Promo } = req.body;
  const id_User = req.user.id;
  
  try {
    const pool = await poolPromise;
    
    // 1. Lấy giỏ hàng
    const cartResult = await pool.request()
      .input('id_User', id_User)
      .input('id_Restaurant', id_Restaurant)
      .query(`
        SELECT c.id_Cart, cf.id_Food, cf.quantity, cf.note, f.price, f.discount_Price 
        FROM Cart c
        JOIN Cart_Food cf ON c.id_Cart = cf.id_Cart
        JOIN Food f ON cf.id_Food = f.id_Food
        WHERE c.id_User = @id_User AND c.id_Restaurant = @id_Restaurant
      `);
      
    if (cartResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }
    
    const id_Cart = cartResult.recordset[0].id_Cart;
    let food_Amount = 0;
    
    cartResult.recordset.forEach(item => {
      const price = item.discount_Price || item.price;
      food_Amount += price * item.quantity;
    });
    
    let shipping_Fee = 20000; // Hardcode 20k
    let discount_Amount = 0;
    
    // 2. Kiểm tra promo/voucher nếu có
    if (id_Promo) {
      if (typeof id_Promo === 'string' && id_Promo.startsWith('voucher_')) {
        const voucherId = parseInt(id_Promo.replace('voucher_', ''), 10);
        const voucherResult = await pool.request()
          .input('voucherId', voucherId)
          .input('id_User', id_User)
          .query(`
            SELECT v.* 
            FROM Voucher v
            JOIN User_Voucher uv ON v.id_Voucher = uv.id_Voucher
            WHERE v.id_Voucher = @voucherId AND uv.id_User = @id_User AND v.used = 0 AND v.expiry_date >= GETDATE()
          `);
          
        if (voucherResult.recordset.length > 0) {
          const voucher = voucherResult.recordset[0];
          discount_Amount = voucher.value;
        }
      } else {
        // Tương thích cả khi truyền ID dạng số hoặc chuỗi "promo_X"
        const promoId = typeof id_Promo === 'string' && id_Promo.startsWith('promo_')
          ? parseInt(id_Promo.replace('promo_', ''), 10)
          : parseInt(id_Promo, 10);
          
        if (!isNaN(promoId)) {
          const promoResult = await pool.request()
            .input('promoId', promoId)
            .query('SELECT * FROM Promotion WHERE id_Promo = @promoId');
            
          if (promoResult.recordset.length > 0) {
            const promo = promoResult.recordset[0];
            const isApplicable = !promo.id_Restaurant || promo.id_Restaurant == id_Restaurant;
            
            if (isApplicable && food_Amount >= (promo.min_OrderValue || 0)) {
              if (promo.type === 'percent') {
                discount_Amount = (food_Amount * promo.value) / 100;
                if (promo.max_Discount && discount_Amount > promo.max_Discount) {
                  discount_Amount = promo.max_Discount;
                }
              } else if (promo.type === 'fixed') {
                discount_Amount = promo.value;
              } else if (promo.type === 'freeship') {
                discount_Amount = shipping_Fee;
              }
            }
          }
        }
      }
    }
    
    let total_Amount = food_Amount + shipping_Fee - discount_Amount;
    if (total_Amount < 0) total_Amount = 0;
    
    const order_Code = 'ORD' + Date.now().toString().slice(-8);
    const payment_Status = payment_Method === 'online' ? 'paid' : 'pending';
    
    // 3. Tạo Order
    const orderInsert = await pool.request()
      .input('id_User', id_User)
      .input('id_Restaurant', id_Restaurant)
      .input('id_Address', id_Address)
      .input('order_Code', order_Code)
      .input('total_Amount', total_Amount)
      .input('food_Amount', food_Amount)
      .input('shipping_Fee', shipping_Fee)
      .input('discount_Amount', discount_Amount)
      .input('payment_Method', payment_Method)
      .input('payment_Status', payment_Status)
      .input('note', note || null)
      .query(`
        INSERT INTO [Order] (id_User, id_Restaurant, id_Address, order_Code, total_Amount, food_Amount, shipping_Fee, discount_Amount, payment_Method, payment_Status, order_Status, note, created_At)
        OUTPUT inserted.id_Order
        VALUES (@id_User, @id_Restaurant, @id_Address, @order_Code, @total_Amount, @food_Amount, @shipping_Fee, @discount_Amount, @payment_Method, @payment_Status, 'pending', @note, GETDATE())
      `);
      
    const id_Order = orderInsert.recordset[0].id_Order;
    
    // 4. Thêm Order_Food
    for (const item of cartResult.recordset) {
      const price = item.discount_Price || item.price;
      await pool.request()
        .input('id_Order', id_Order)
        .input('id_Food', item.id_Food)
        .input('quantity', item.quantity)
        .input('unit_Price', price)
        .input('note', item.note || null)
        .query(`
          INSERT INTO Order_Food (id_Order, id_Food, quantity, unit_Price, note)
          VALUES (@id_Order, @id_Food, @quantity, @unit_Price, @note)
        `);
    }
    
    // 5. Thêm Order_Restaurant
    await pool.request()
      .input('id_Order', id_Order)
      .input('id_Restaurant', id_Restaurant)
      .input('shippingfee', shipping_Fee)
      .query(`
        INSERT INTO Order_Restaurant (id_Order, id_Restaurant, shippingfee, status)
        VALUES (@id_Order, @id_Restaurant, @shippingfee, 'pending')
      `);
      
    // 6. Thêm PaymentMethod
    await pool.request()
      .input('id_Order', id_Order)
      .input('method', payment_Method)
      .input('status', payment_Status)
      .input('amount', total_Amount)
      .query(`
        INSERT INTO PaymentMethod (id_Order, method, status, amount, created_At)
        VALUES (@id_Order, @method, @status, @amount, GETDATE())
      `);
      
    // 7. Xoá giỏ hàng
    await pool.request()
      .input('id_Cart', id_Cart)
      .query('DELETE FROM Cart_Food WHERE id_Cart = @id_Cart');
    await pool.request()
      .input('id_Cart', id_Cart)
      .query('DELETE FROM Cart WHERE id_Cart = @id_Cart');
      
    // 8. Đánh dấu Voucher đã sử dụng hoặc tăng used_Count của Promotion
    if (id_Promo) {
      if (typeof id_Promo === 'string' && id_Promo.startsWith('voucher_')) {
        const voucherId = parseInt(id_Promo.replace('voucher_', ''), 10);
        await pool.request()
          .input('voucherId', voucherId)
          .query('UPDATE Voucher SET used = 1 WHERE id_Voucher = @voucherId');
      } else {
        const promoId = typeof id_Promo === 'string' && id_Promo.startsWith('promo_')
          ? parseInt(id_Promo.replace('promo_', ''), 10)
          : parseInt(id_Promo, 10);
          
        if (!isNaN(promoId)) {
          await pool.request()
            .input('promoId', promoId)
            .query('UPDATE Promotion SET used_Count = used_Count + 1 WHERE id_Promo = @promoId');
        }
      }
    }
      
    res.json({ message: 'Đặt hàng thành công', id_Order });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi đặt hàng', error: err.message });
  }
};

// Hủy đơn hàng
exports.cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const pool = await poolPromise;
    const orderCheck = await pool.request()
      .input('id', id)
      .input('userId', req.user.id)
      .query('SELECT order_Status, order_Code, id_User FROM [Order] WHERE id_Order = @id AND id_User = @userId');
      
    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    if (orderCheck.recordset[0].order_Status !== 'pending') {
      return res.status(400).json({ message: 'Chỉ có thể hủy đơn đang chờ xác nhận' });
    }
    
    await pool.request()
      .input('id', id)
      .input('reason', reason || 'Khách hàng hủy')
      .query(`
        UPDATE [Order] 
        SET order_Status = 'cancelled', cancelled_By = 'customer', cancellation_Reason = @reason
        WHERE id_Order = @id
      `);
      
    const order = orderCheck.recordset[0];
    const notiTitle = 'Đơn hàng đã bị hủy';
    const notiBody = `Đơn hàng #${order.order_Code} đã được hủy thành công theo yêu cầu của bạn.`;
    
    const notiResult = await pool.request()
      .input('id_User', order.id_User)
      .input('title', notiTitle)
      .input('body', notiBody)
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
      
    res.json({ message: 'Đã hủy đơn hàng' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật trạng thái đơn hàng (Dành cho Admin/Nhà hàng - Giả lập)
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params; // id_Order
  const { status } = req.body; // 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'
  
  try {
    const pool = await poolPromise;
    
    // 1. Kiểm tra đơn hàng tồn tại
    const orderCheck = await pool.request()
      .input('id', id)
      .query('SELECT id_User, order_Code FROM [Order] WHERE id_Order = @id');
      
    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    
    const order = orderCheck.recordset[0];
    
    // 2. Cập nhật trạng thái đơn hàng
    await pool.request()
      .input('id', id)
      .input('status', status)
      .query('UPDATE [Order] SET order_Status = @status WHERE id_Order = @id');
      
    // 3. Tạo thông báo tự động cho Khách hàng
    let notiTitle = '';
    let notiBody = '';
    
    if (status === 'confirmed') {
      notiTitle = 'Đơn hàng đã được xác nhận';
      notiBody = `Đơn hàng #${order.order_Code} đã được nhà hàng xác nhận và bắt đầu chuẩn bị.`;
    } else if (status === 'preparing') {
      notiTitle = 'Đơn hàng đang được chuẩn bị';
      notiBody = `Nhà hàng đang chuẩn bị món ăn cho đơn hàng #${order.order_Code}.`;
    } else if (status === 'delivering') {
      notiTitle = 'Đơn hàng đang được giao';
      notiBody = `Tài xế đang giao đơn hàng #${order.order_Code} đến bạn. Vui lòng chú ý điện thoại.`;
    } else if (status === 'delivered') {
      notiTitle = 'Giao hàng thành công';
      notiBody = `Đơn hàng #${order.order_Code} đã được giao thành công. Chúc bạn ngon miệng!`;
    } else if (status === 'cancelled') {
      notiTitle = 'Đơn hàng đã bị hủy';
      notiBody = `Đơn hàng #${order.order_Code} đã bị hủy.`;
    }
    
    if (notiTitle && notiBody) {
      // Thêm vào bảng Notification
      const notiResult = await pool.request()
        .input('id_User', order.id_User)
        .input('title', notiTitle)
        .input('body', notiBody)
        .input('type', 'order')
        .input('related_OrderId', id)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
          OUTPUT inserted.id_Noti
          VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
        `);
        
      const id_Noti = notiResult.recordset[0].id_Noti;
      
      // Thêm vào bảng trung gian User_Notification
      await pool.request()
        .input('id_Noti', id_Noti)
        .input('id_User', order.id_User)
        .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
    }
    
    res.json({ message: 'Cập nhật trạng thái và tạo thông báo thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đánh giá
exports.submitReview = async (req, res) => {
  const { id } = req.params; // id_Order
  const { rating_Res, comment_ForRes, rating_Dri, comment_ForDri, foods } = req.body;
  // foods: [{ id_Food, rating_Food, comment_Food }]
  try {
    const pool = await poolPromise;
    
    // Check if review exists
    const checkRev = await pool.request()
      .input('id_Order', id)
      .query('SELECT * FROM Review WHERE id_Order = @id_Order');
    if (checkRev.recordset.length > 0) {
      return res.status(400).json({ message: 'Đơn hàng này đã được đánh giá' });
    }
    
    const revInsert = await pool.request()
      .input('id_User', req.user.id)
      .input('id_Order', id)
      .input('rating_Res', rating_Res)
      .input('comment_ForRes', comment_ForRes || null)
      .input('rating_Dri', rating_Dri || null)
      .input('comment_ForDri', comment_ForDri || null)
      .query(`
        INSERT INTO Review (id_User, id_Order, rating_Res, comment_ForRes, rating_Dri, comment_ForDri, created_At)
        OUTPUT inserted.id_Review
        VALUES (@id_User, @id_Order, @rating_Res, @comment_ForRes, @rating_Dri, @comment_ForDri, GETDATE())
      `);
      
    const id_Review = revInsert.recordset[0].id_Review;
    
    if (foods && foods.length > 0) {
      for (const f of foods) {
        await pool.request()
          .input('id_Review', id_Review)
          .input('id_Food', f.id_Food)
          .input('rating_Food', f.rating_Food || 5)
          .input('comment_Food', f.comment_Food || null)
          .query(`
            INSERT INTO Review_Food (id_Review, id_Food, rating_Food, comment_Food)
            VALUES (@id_Review, @id_Food, @rating_Food, @comment_Food)
          `);
      }
    }
    
    
    // Tạo thông báo gửi lời cảm ơn đã đánh giá
    const orderCheck = await pool.request()
      .input('id', id)
      .query('SELECT order_Code FROM [Order] WHERE id_Order = @id');
      
    if (orderCheck.recordset.length > 0) {
      const order = orderCheck.recordset[0];
      const notiTitle = 'Cảm ơn ý kiến đóng góp của bạn';
      const notiBody = `Đánh giá của bạn cho đơn hàng #${order.order_Code} đã được gửi thành công. Cảm ơn bạn đã đồng hành cùng Món Ngon Tại Nhà!`;
      
      const notiResult = await pool.request()
        .input('id_User', req.user.id)
        .input('title', notiTitle)
        .input('body', notiBody)
        .input('type', 'promo')
        .input('related_OrderId', id)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
          OUTPUT inserted.id_Noti
          VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
        `);
        
      const id_Noti = notiResult.recordset[0].id_Noti;
      await pool.request()
        .input('id_Noti', id_Noti)
        .input('id_User', req.user.id)
        .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
    }

    res.json({ message: 'Đánh giá thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Khiếu nại
exports.submitComplaint = async (req, res) => {
  const { id } = req.params; // id_Order
  const { type, description } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id_Order', id)
      .input('id_User', req.user.id)
      .input('type', type)
      .input('description', description)
      .query(`
        INSERT INTO Complaint (id_Order, id_User, type, description, status, created_At)
        VALUES (@id_Order, @id_User, @type, @description, 'pending', GETDATE())
      `);
    res.json({ message: 'Gửi khiếu nại thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
