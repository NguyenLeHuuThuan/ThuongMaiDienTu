const { poolPromise } = require('../config/db');

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Khoảng cách (km)
}

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
        SELECT o.*, r.name_Restaurant, r.address as res_address, r.owner_id as res_owner_id, 
               a.full_Address as user_address, a.name as user_name, a.phone as user_phone,
               driver_u.id_User as driver_user_id, driver_u.fullName as driver_name
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        LEFT JOIN Driver d ON o.id_Driver = d.id_Driver
        LEFT JOIN [User] driver_u ON d.id_User = driver_u.id_User
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

// Tính phí vận chuyển cho khách hàng (gồm cả chiết khấu shipper)
exports.getShippingFee = async (req, res) => {
  const { id_Address, id_Restaurant } = req.query;
  if (!id_Address || !id_Restaurant) {
    return res.status(400).json({ message: 'Thiếu id_Address hoặc id_Restaurant' });
  }

  try {
    const pool = await poolPromise;
    
    // Fetch Restaurant coords
    const restaurantRes = await pool.request()
      .input('id_Restaurant', id_Restaurant)
      .query('SELECT lat, lng FROM Restaurant WHERE id_Restaurant = @id_Restaurant');
      
    if (restaurantRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    
    const addressRes = await pool.request()
      .input('id_Address', id_Address)
      .query('SELECT lat, lng FROM Address WHERE id_Address = @id_Address');
      
    if (addressRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }
    
    const restaurant = restaurantRes.recordset[0];
    const address = addressRes.recordset[0];
    
    if (restaurant.lat == null || restaurant.lng == null || address.lat == null || address.lng == null) {
      return res.status(400).json({ message: 'Vị trí của nhà hàng hoặc địa chỉ chưa được cấu hình tọa độ' });
    }
    
    const distance = calculateDistance(restaurant.lat, restaurant.lng, address.lat, address.lng);
    
    const configRes = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('log_base_delivery_fee', 'log_per_km_fee', 'op_shipper_fee_percent', 'log_max_delivery_distance')
    `);

    let baseFee = 15000;
    let perKmFee = 5000;
    let maxDistance = 15.0;
    let shipperFeePercent = 5.0;

    configRes.recordset.forEach(c => {
      if (c.config_key === 'log_base_delivery_fee' && c.is_enabled) {
        baseFee = parseFloat(c.config_value) || 15000;
      }
      if (c.config_key === 'log_per_km_fee' && c.is_enabled) {
        perKmFee = parseFloat(c.config_value) || 5000;
      }
      if (c.config_key === 'log_max_delivery_distance' && c.is_enabled) {
        maxDistance = parseFloat(c.config_value) || 15.0;
      }
      if (c.config_key === 'op_shipper_fee_percent' && c.is_enabled) {
        shipperFeePercent = parseFloat(c.config_value) || 5.0;
      }
    });

    if (distance > maxDistance) {
      return res.status(400).json({ 
        message: `Khoảng cách giao hàng (${distance.toFixed(1)}km) vượt quá giới hạn tối đa (${maxDistance}km)`,
        distance,
        maxDistance,
        shippingFee: null
      });
    }

    let baseShippingFee = baseFee;
    if (distance > 2) {
      baseShippingFee += Math.ceil(distance - 2) * perKmFee;
    }
    const customerShippingFee = Math.round(baseShippingFee * (1 + shipperFeePercent / 100.0));

    res.json({
      distance: parseFloat(distance.toFixed(2)),
      baseShippingFee,
      shippingFee: customerShippingFee,
      shipperFeePercent
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đặt hàng (Checkout)
exports.placeOrder = async (req, res) => {
  const { id_Address, id_Restaurant, payment_Method, note, id_Promo, id_Promo_Freeship, id_Promo_Discount } = req.body;
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
    
    // A. Lấy cấu hình chiết khấu nhà hàng
    const configRes = await pool.request()
      .query("SELECT config_value FROM SystemConfig WHERE config_key = 'op_service_fee_percent' AND is_enabled = 1");
    let resFeePercent = 15.0; // default 15%
    if (configRes.recordset.length > 0) {
      resFeePercent = parseFloat(configRes.recordset[0].config_value) || 15.0;
    }
    const resFactor = 1 + resFeePercent / 100.0;

    let food_Amount = 0;
    cartResult.recordset.forEach(item => {
      const price = item.discount_Price || item.price;
      const inflatedPrice = Math.round(price * resFactor);
      food_Amount += inflatedPrice * item.quantity;
    });

    // B. Tính phí giao hàng động
    const restaurantRes = await pool.request()
      .input('id_Restaurant', id_Restaurant)
      .query('SELECT lat, lng FROM Restaurant WHERE id_Restaurant = @id_Restaurant');
      
    const addressRes = await pool.request()
      .input('id_Address', id_Address)
      .query('SELECT lat, lng FROM Address WHERE id_Address = @id_Address');
      
    if (restaurantRes.recordset.length === 0 || addressRes.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy nhà hàng hoặc địa chỉ giao hàng' });
    }
    
    const restaurant = restaurantRes.recordset[0];
    const address = addressRes.recordset[0];
    
    if (restaurant.lat == null || restaurant.lng == null || address.lat == null || address.lng == null) {
      return res.status(400).json({ message: 'Vị trí nhà hàng hoặc địa chỉ giao hàng chưa được cấu hình tọa độ' });
    }
    
    const distance = calculateDistance(restaurant.lat, restaurant.lng, address.lat, address.lng);
    
    const shippingConfigRes = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('log_base_delivery_fee', 'log_per_km_fee', 'op_shipper_fee_percent', 'log_max_delivery_distance')
    `);

    let baseFee = 15000;
    let perKmFee = 5000;
    let maxDistance = 15.0;
    let shipperFeePercent = 5.0;

    shippingConfigRes.recordset.forEach(c => {
      if (c.config_key === 'log_base_delivery_fee' && c.is_enabled) {
        baseFee = parseFloat(c.config_value) || 15000;
      }
      if (c.config_key === 'log_per_km_fee' && c.is_enabled) {
        perKmFee = parseFloat(c.config_value) || 5000;
      }
      if (c.config_key === 'log_max_delivery_distance' && c.is_enabled) {
        maxDistance = parseFloat(c.config_value) || 15.0;
      }
      if (c.config_key === 'op_shipper_fee_percent' && c.is_enabled) {
        shipperFeePercent = parseFloat(c.config_value) || 5.0;
      }
    });

    if (distance > maxDistance) {
      return res.status(400).json({ message: `Khoảng cách giao hàng (${distance.toFixed(1)}km) vượt quá giới hạn tối đa (${maxDistance}km)` });
    }

    let baseShippingFee = baseFee;
    if (distance > 2) {
      baseShippingFee += Math.ceil(distance - 2) * perKmFee;
    }
    const shipping_Fee = Math.round(baseShippingFee * (1 + shipperFeePercent / 100.0));
    
    let discount_Amount = 0;
    const appliedPromos = [];

    // Helper validate cục bộ
    const validatePromo = async (promoOrVoucherId, expectedType) => {
      if (!promoOrVoucherId) return null;
      
      let promo = null;
      let voucherId = null;
      
      if (typeof promoOrVoucherId === 'string' && promoOrVoucherId.startsWith('voucher_')) {
        voucherId = parseInt(promoOrVoucherId.replace('voucher_', ''), 10);
        const voucherResult = await pool.request()
          .input('voucherId', voucherId)
          .input('id_User', id_User)
          .query(`
            SELECT v.id_Voucher, p.id_Promo, p.code, p.value, p.end_Date AS expiry_date,
                   p.type, p.min_OrderValue, p.max_Discount, p.id_Restaurant,
                   p.sys_funding_percent, p.res_funding_percent, p.usage_limit_per_user
            FROM Voucher v
            JOIN Promotion p ON v.id_Promo = p.id_Promo
            WHERE v.id_Voucher = @voucherId AND v.id_User = @id_User AND v.used = 0 AND (p.end_Date IS NULL OR p.end_Date >= GETDATE())
          `);
        
        if (voucherResult.recordset.length === 0) {
          throw new Error('Voucher không tồn tại, đã hết hạn hoặc đã sử dụng');
        }
        
        const row = voucherResult.recordset[0];
        promo = {
          id_Promo: row.id_Promo || null,
          code: row.code,
          type: row.type || 'fixed',
          value: Number(row.value),
          min_OrderValue: row.min_OrderValue !== null ? Number(row.min_OrderValue) : 0,
          max_Discount: row.max_Discount !== null ? Number(row.max_Discount) : Number(row.value),
          id_Restaurant: row.id_Restaurant || null,
          id_Voucher: row.id_Voucher,
          sys_funding_percent: row.sys_funding_percent !== null ? Number(row.sys_funding_percent) : 100,
          res_funding_percent: row.res_funding_percent !== null ? Number(row.res_funding_percent) : 0,
          usage_limit_per_user: row.usage_limit_per_user !== null ? Number(row.usage_limit_per_user) : 1
        };
      } else {
        const promoId = typeof promoOrVoucherId === 'string' && promoOrVoucherId.startsWith('promo_')
          ? parseInt(promoOrVoucherId.replace('promo_', ''), 10)
          : parseInt(promoOrVoucherId, 10);
          
        if (!isNaN(promoId)) {
          const promoResult = await pool.request()
            .input('promoId', promoId)
            .query('SELECT * FROM Promotion WHERE id_Promo = @promoId');
            
          if (promoResult.recordset.length === 0) {
            throw new Error('Chương trình khuyến mãi không tồn tại');
          }
          
          const row = promoResult.recordset[0];
          
          if (row.end_Date && new Date(row.end_Date) < new Date()) {
            throw new Error('Chương trình khuyến mãi đã hết hạn');
          }
          
          if (row.usage_Limit !== null && row.used_Count >= row.usage_Limit) {
            throw new Error('Chương trình khuyến mãi đã hết lượt sử dụng');
          }
          
          promo = {
            id_Promo: row.id_Promo,
            code: row.code,
            type: row.type,
            value: Number(row.value),
            min_OrderValue: row.min_OrderValue !== null ? Number(row.min_OrderValue) : 0,
            max_Discount: row.max_Discount !== null ? Number(row.max_Discount) : Number(row.value),
            id_Restaurant: row.id_Restaurant || null,
            id_Voucher: null,
            sys_funding_percent: row.sys_funding_percent !== null ? Number(row.sys_funding_percent) : 100,
            res_funding_percent: row.res_funding_percent !== null ? Number(row.res_funding_percent) : 0,
            usage_limit_per_user: row.usage_limit_per_user !== null ? Number(row.usage_limit_per_user) : 1
          };
        }
      }
      
      if (!promo) return null;
      
      if (promo.id_Restaurant !== null && Number(promo.id_Restaurant) !== Number(id_Restaurant)) {
        throw new Error(`Voucher ${promo.code} không áp dụng cho nhà hàng này`);
      }
      
      if (expectedType === 'freeship' && promo.type !== 'freeship') {
        throw new Error(`Voucher ${promo.code} không phải là voucher miễn phí vận chuyển`);
      }
      if (expectedType === 'discount' && promo.type === 'freeship') {
        throw new Error(`Voucher ${promo.code} không phải là voucher giảm giá đơn hàng`);
      }
      
      // Personal Usage Limit per User Check
      if (promo.id_Promo) {
        const userUsedResult = await pool.request()
          .input('id_Promo', promo.id_Promo)
          .input('id_User', id_User)
          .query(`
            SELECT COUNT(*) AS count 
            FROM [Order] o
            JOIN Order_Promotion op ON o.id_Order = op.id_Order
            WHERE o.id_User = @id_User AND op.id_Promo = @id_Promo AND o.order_Status <> 'cancelled'
          `);
        const userUsedCount = userUsedResult.recordset[0].count;
        if (userUsedCount >= promo.usage_limit_per_user) {
          throw new Error(`Bạn đã vượt quá giới hạn sử dụng tối đa của voucher ${promo.code} (${promo.usage_limit_per_user} lần)`);
        }
      }

      if (food_Amount < promo.min_OrderValue) {
        throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu từ ${promo.min_OrderValue.toLocaleString('vi-VN')} đ để áp dụng voucher ${promo.code}`);
      }
      
      let discount = 0;
      if (promo.type === 'freeship') {
        discount = Math.min(shipping_Fee, promo.value || shipping_Fee);
      } else if (promo.type === 'percent') {
        discount = (food_Amount * promo.value) / 100;
        if (promo.max_Discount && discount > promo.max_Discount) {
          discount = promo.max_Discount;
        }
      } else if (promo.type === 'fixed') {
        discount = promo.value;
      }
      
      return {
        ...promo,
        calculatedDiscount: discount
      };
    };

    // Thực hiện validate
    if (id_Promo_Freeship) {
      const fs = await validatePromo(id_Promo_Freeship, 'freeship');
      if (fs) {
        discount_Amount += fs.calculatedDiscount;
        appliedPromos.push(fs);
      }
    }
    
    if (id_Promo_Discount) {
      const ds = await validatePromo(id_Promo_Discount, 'discount');
      if (ds) {
        discount_Amount += ds.calculatedDiscount;
        appliedPromos.push(ds);
      }
    }
    
    if (!id_Promo_Freeship && !id_Promo_Discount && id_Promo) {
      const single = await validatePromo(id_Promo, null);
      if (single) {
        discount_Amount += single.calculatedDiscount;
        appliedPromos.push(single);
      }
    }
    
    let total_Amount = food_Amount + shipping_Fee - discount_Amount;
    if (total_Amount < 0) total_Amount = 0;
    
    const order_Code = 'ORD' + Date.now().toString().slice(-8);
    // Ánh xạ 'vnpay' hoặc 'momo' thành 'online' để thỏa mãn check constraint của bảng [Order]
    const dbPaymentMethod = (payment_Method === 'vnpay' || payment_Method === 'momo') ? 'online' : payment_Method;
    const payment_Status = (payment_Method === 'vnpay') ? 'pending' : ((payment_Method === 'online' || payment_Method === 'momo') ? 'paid' : 'pending');
    
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
      .input('payment_Method', dbPaymentMethod)
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
      const inflatedPrice = Math.round(price * resFactor);
      await pool.request()
        .input('id_Order', id_Order)
        .input('id_Food', item.id_Food)
        .input('quantity', item.quantity)
        .input('unit_Price', inflatedPrice)
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
      
    // 8. Đánh dấu Voucher đã sử dụng và thêm vào Order_Promotion
    for (const app of appliedPromos) {
      if (app.id_Voucher) {
        await pool.request()
          .input('voucherId', app.id_Voucher)
          .query('UPDATE Voucher SET used = 1 WHERE id_Voucher = @voucherId');
      }
      
      if (app.id_Promo) {
        await pool.request()
          .input('id_Order', id_Order)
          .input('id_Promo', app.id_Promo)
          .input('discount_Amount', app.calculatedDiscount)
          .query(`
            INSERT INTO Order_Promotion (id_Order, id_Promo, discount_Amount)
            VALUES (@id_Order, @id_Promo, @discount_Amount)
          `);
          
        await pool.request()
          .input('promoId', app.id_Promo)
          .query('UPDATE Promotion SET used_Count = used_Count + 1 WHERE id_Promo = @promoId');
      }
    }
      

    // 9. Thông báo cho tất cả Shipper (chỉ gửi nếu không thanh toán qua vnpay)
    if (payment_Method !== 'vnpay') {
      const driversResult = await pool.request().query("SELECT id_User FROM Driver");
      for (const driver of driversResult.recordset) {
        await pool.request()
          .input('id_User', driver.id_User)
          .input('id_Order', id_Order)
          .query(`
            INSERT INTO Notification (id_User, title, body, type, related_OrderId)
            VALUES (@id_User, N'Đơn hàng mới', N'Có đơn hàng mới cần giao', 'NEW_ORDER', @id_Order)
          `);
      }
    }

    let paymentUrl = null;
    if (payment_Method === 'vnpay') {
      paymentUrl = generateVnPayUrl(req, order_Code, total_Amount);
    }

    res.json({ message: 'Đặt hàng thành công', id_Order, paymentUrl });
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
    if (status === 'cancelled') {
      await pool.request()
        .input('id', id)
        .query(`
          UPDATE [Order] SET order_Status = 'cancelled' WHERE id_Order = @id;

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
    } else {
      await pool.request()
        .input('id', id)
        .input('status', status)
        .query('UPDATE [Order] SET order_Status = @status WHERE id_Order = @id');
    }
      
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
    
    // Lấy thông tin nhà hàng và tài xế từ đơn hàng để cập nhật điểm đánh giá
    const orderInfo = await pool.request()
      .input('id_Order', id)
      .query('SELECT id_Restaurant, id_Driver FROM [Order] WHERE id_Order = @id_Order');
    const { id_Restaurant, id_Driver } = orderInfo.recordset[0] || {};

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

    // Tự động tính toán lại và cập nhật điểm đánh giá trung bình của Nhà Hàng
    if (rating_Res && id_Restaurant) {
      const avgResResult = await pool.request()
        .input('id_Restaurant', id_Restaurant)
        .query(`
          SELECT AVG(CAST(rating_Res AS FLOAT)) as avgRating 
          FROM Review r
          JOIN [Order] o ON r.id_Order = o.id_Order
          WHERE o.id_Restaurant = @id_Restaurant AND r.rating_Res IS NOT NULL
        `);
      const newResAvg = avgResResult.recordset[0].avgRating || rating_Res;
      await pool.request()
        .input('id_Restaurant', id_Restaurant)
        .input('rating_avg', newResAvg)
        .query('UPDATE Restaurant SET rating_avg = @rating_avg WHERE id_Restaurant = @id_Restaurant');
    }

    // Tự động tính toán lại và cập nhật điểm đánh giá trung bình của Tài Xế
    if (rating_Dri && id_Driver) {
      const avgDriResult = await pool.request()
        .input('id_Driver', id_Driver)
        .query(`
          SELECT AVG(CAST(rating_Dri AS FLOAT)) as avgRating 
          FROM Review r
          JOIN [Order] o ON r.id_Order = o.id_Order
          WHERE o.id_Driver = @id_Driver AND r.rating_Dri IS NOT NULL
        `);
      const newDriAvg = avgDriResult.recordset[0].avgRating || rating_Dri;
      await pool.request()
        .input('id_Driver', id_Driver)
        .input('rating_Avg', newDriAvg)
        .query('UPDATE Driver SET rating_Avg = @rating_Avg WHERE id_Driver = @id_Driver');
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

// --- VNPay Payment Integration Logic ---

function sortObject(obj) {
  let sorted = {};
  let keys = Object.keys(obj).sort();
  for (let key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  }
  return sorted;
}

function generateVnPayUrl(req, orderCode, amount) {
  const tmnCode = process.env.VNP_TMNCODE || 'ECQGNZXS';
  const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
  const vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  
  const origin = req.headers.origin || 'http://localhost:5173';
  const returnUrl = `${origin}/vnpay-return`;
  
  const date = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const createDate = date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds());
    
  let vnp_Params = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = 'vn';
  vnp_Params['vnp_CurrCode'] = 'VND';
  vnp_Params['vnp_TxnRef'] = orderCode;
  vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + orderCode;
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = Math.round(amount) * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  vnp_Params['vnp_CreateDate'] = createDate;
  
  vnp_Params = sortObject(vnp_Params);
  
  const signData = Object.keys(vnp_Params)
    .map(key => `${key}=${vnp_Params[key]}`)
    .join('&');
    
  const crypto = require('crypto');
  const hmac = crypto.createHmac("sha512", secretKey);
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
  
  vnp_Params['vnp_SecureHash'] = secureHash;
  const paymentUrl = vnpUrl + '?' + Object.keys(vnp_Params)
    .map(key => `${key}=${vnp_Params[key]}`)
    .join('&');
    
  return paymentUrl;
}

async function notifyShippers(pool, id_Order) {
  const driversResult = await pool.request().query("SELECT id_User FROM Driver");
  for (const driver of driversResult.recordset) {
    await pool.request()
      .input('id_User', driver.id_User)
      .input('id_Order', id_Order)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, related_OrderId)
        VALUES (@id_User, N'Đơn hàng mới', N'Có đơn hàng mới cần giao', 'NEW_ORDER', @id_Order)
      `);
  }
}

exports.vnpayIpn = async (req, res) => {
  try {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
    
    const signData = Object.keys(vnp_Params)
      .map(key => `${key}=${vnp_Params[key]}`)
      .join('&');
      
    const crypto = require('crypto');
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const orderCode = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];
      const pool = await poolPromise;
      
      const orderRes = await pool.request()
        .input('orderCode', orderCode)
        .query('SELECT id_Order, payment_Status FROM [Order] WHERE order_Code = @orderCode');
        
      if (orderRes.recordset.length === 0) {
        return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
      }
      
      const order = orderRes.recordset[0];
      
      if (order.payment_Status === 'paid') {
        return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
      }
      
      if (responseCode === '00') {
        await pool.request()
          .input('id', order.id_Order)
          .query("UPDATE [Order] SET payment_Status = 'paid' WHERE id_Order = @id");
          
        await pool.request()
          .input('id_Order', order.id_Order)
          .query("UPDATE PaymentMethod SET status = 'paid' WHERE id_Order = @id_Order");
          
        // Notify drivers
        await notifyShippers(pool, order.id_Order);
      } else {
        await pool.request()
          .input('id', order.id_Order)
          .query("UPDATE [Order] SET payment_Status = 'failed', order_Status = 'cancelled', cancellation_Reason = N'Thanh toán VNPay thất bại' WHERE id_Order = @id");
          
        await pool.request()
          .input('id_Order', order.id_Order)
          .query("UPDATE PaymentMethod SET status = 'failed' WHERE id_Order = @id_Order");
          
        // Revert vouchers/promotions
        await pool.request()
          .input('id', order.id_Order)
          .query(`
            UPDATE Voucher 
            SET used = 0 
            WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
              AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

            UPDATE Promotion
            SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
            WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
          `);
      }
      
      res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
    } else {
      res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
    }
  } catch (error) {
    console.error('VNPay IPN Error:', error);
    res.status(200).json({ RspCode: '99', Message: 'Input data format error' });
  }
};

exports.verifyVnPay = async (req, res) => {
  try {
    let vnp_Params = req.body;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
    
    const signData = Object.keys(vnp_Params)
      .map(key => `${key}=${vnp_Params[key]}`)
      .join('&');
      
    const crypto = require('crypto');
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const orderCode = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];
      const pool = await poolPromise;
      
      const orderRes = await pool.request()
        .input('orderCode', orderCode)
        .query('SELECT id_Order, payment_Status FROM [Order] WHERE order_Code = @orderCode');
        
      if (orderRes.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      
      const order = orderRes.recordset[0];
      
      if (responseCode === '00') {
        if (order.payment_Status !== 'paid') {
          await pool.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'paid' WHERE id_Order = @id");
            
          await pool.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'paid' WHERE id_Order = @id_Order");
            
          // Notify drivers
          await notifyShippers(pool, order.id_Order);
        }
        res.json({ success: true, message: 'Thanh toán thành công' });
      } else {
        if (order.payment_Status !== 'failed') {
          await pool.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'failed', order_Status = 'cancelled', cancellation_Reason = N'Thanh toán VNPay thất bại' WHERE id_Order = @id");
            
          await pool.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'failed' WHERE id_Order = @id_Order");
            
          // Revert vouchers/promotions
          await pool.request()
            .input('id', order.id_Order)
            .query(`
              UPDATE Voucher 
              SET used = 0 
              WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
                AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

              UPDATE Promotion
              SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
              WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
            `);
        }
        res.json({ success: false, message: 'Thanh toán thất bại hoặc đã bị hủy' });
      }
    } else {
      res.status(400).json({ success: false, message: 'Chữ ký không hợp lệ' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xác thực thanh toán', error: error.message });
  }
};

// Lấy trạng thái cấu hình thanh toán hoạt động (pay_cod_enabled, pay_momo_enabled)
exports.getPaymentConfigs = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('pay_cod_enabled', 'pay_momo_enabled')
    `);
    
    const configs = {};
    result.recordset.forEach(c => {
      configs[c.config_key] = {
        value: c.config_value,
        enabled: c.is_enabled === 1 || c.is_enabled === true || String(c.is_enabled) === 'true'
      };
    });
    
    res.json(configs);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy cấu hình thanh toán', error: err.message });
  }
};
