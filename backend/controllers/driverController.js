const { poolPromise } = require('../config/db');

// Helper tính khoảng cách bằng công thức Haversine
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Lấy danh sách đơn hàng chờ nhận (cho Shipper)
// Status có thể là 'pending', 'confirmed', 'ready', 'preparing' và chưa có shipper (id_Driver IS NULL)
exports.getAvailableOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT o.*, r.name_Restaurant, r.address as res_address, r.owner_id as res_owner_id, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
               r.lat as res_lat, r.lng as res_lng, a.lat as user_lat, a.lng as user_lng,
               ROUND(o.shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0) as shipper_Earned,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.order_Status IN ('confirmed', 'preparing', 'ready')
          AND (o.id_Driver IS NULL OR o.id_Driver = 0)
        ORDER BY o.created_At DESC
      `);

    const orders = result.recordset.map(row => {
      const distanceKm = getDistanceFromLatLonInKm(row.res_lat, row.res_lng, row.user_lat, row.user_lng);
      return { ...row, distanceKm };
    });

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id_Order).join(',');
      const itemsResult = await pool.request()
        .query(`
          SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price, ofood.note AS note
          FROM Order_Food ofood
          JOIN Food f ON ofood.id_Food = f.id_Food
          WHERE ofood.id_Order IN (${orderIds})
        `);

      const itemsMap = {};
      itemsResult.recordset.forEach(item => {
        if (!itemsMap[item.id_Order]) {
          itemsMap[item.id_Order] = [];
        }
        itemsMap[item.id_Order].push({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          note: item.note
        });
      });

      orders.forEach(order => {
        order.items = itemsMap[order.id_Order] || [];
      });
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách khiếu nại (của tôi và về tôi)
exports.getComplaints = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query(`SELECT id_Driver FROM Driver WHERE id_User = @id_User`);

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // 1. Khiếu nại của tôi (do Shipper tạo)
    const myComplaints = await pool.request()
      .input('id_User', userId)
      .query(`
        DECLARE @shipFeePercent FLOAT = ISNULL((SELECT MAX(CAST(config_value AS FLOAT)) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'), 5.0);
        SELECT c.id_Complaint, c.id_Order, c.id_User, c.type, c.description, c.status, c.resolution, c.image, c.video, c.created_At, c.resolved_At, c.handled_By,
               c.comp_customer_amount,
               ROUND(c.comp_driver_amount / (1.0 + @shipFeePercent / 100.0), 0) as comp_driver_amount,
               c.comp_restaurant_amount,
               o.order_Status, r.name_Restaurant, u.fullName as user_name
        FROM Complaint c
        JOIN [Order] o ON c.id_Order = o.id_Order
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN [User] u ON o.id_User = u.id_User
        WHERE c.id_User = @id_User
        ORDER BY c.created_At DESC
      `);

    // 2. Khiếu nại về tôi (do User/Restaurant tạo đối với đơn hàng mà Shipper này giao)
    const complaintsAboutMe = await pool.request()
      .input('id_Driver', id_Driver)
      .input('id_User', userId)
      .query(`
        DECLARE @shipFeePercent FLOAT = ISNULL((SELECT MAX(CAST(config_value AS FLOAT)) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'), 5.0);
        SELECT c.id_Complaint, c.id_Order, c.id_User, c.type, c.description, c.status, c.resolution, c.image, c.video, c.created_At, c.resolved_At, c.handled_By,
               c.comp_customer_amount,
               ROUND(c.comp_driver_amount / (1.0 + @shipFeePercent / 100.0), 0) as comp_driver_amount,
               c.comp_restaurant_amount,
               o.order_Status, r.name_Restaurant, u.fullName as complainant_name
        FROM Complaint c
        JOIN [Order] o ON c.id_Order = o.id_Order
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN [User] u ON c.id_User = u.id_User
        WHERE o.id_Driver = @id_Driver AND c.id_User != @id_User
        ORDER BY c.created_At DESC
      `);

    res.json({
      myComplaints: myComplaints.recordset,
      complaintsAboutMe: complaintsAboutMe.recordset
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Shipper nhận đơn hàng
exports.acceptOrder = async (req, res) => {
  const { id } = req.params; // id_Order
  const userId = req.user.id; // id của Shipper đang đăng nhập (từ token)

  try {
    const pool = await poolPromise;

    // 1. Lấy thông tin driver dựa trên id_User
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // 2. Kiểm tra xem đơn hàng còn có thể nhận không (id_Driver vẫn NULL)
    const orderCheck = await pool.request()
      .input('id_Order', id)
      .query(`
        SELECT o.order_Status, o.id_Driver, o.food_Amount, o.payment_Method, o.payment_Status, o.id_Restaurant, r.owner_id
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        WHERE o.id_Order = @id_Order
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    const order = orderCheck.recordset[0];
    if (order.id_Driver !== null) {
      return res.status(400).json({ message: 'Đơn hàng này đã có người nhận.' });
    }

    if (!['confirmed', 'preparing', 'ready'].includes(order.order_Status)) {
      return res.status(400).json({ message: 'Đơn hàng hiện không ở trạng thái chờ giao.' });
    }

    const isOnlinePaid = order.payment_Status === 'paid' || (order.payment_Method && !['cod', 'tiền mặt', 'cash'].includes(order.payment_Method.toLowerCase()));

    // 2.5 Kiểm tra số dư ví Shipper (phải >= giá gốc món ăn) NẾU là đơn COD
    const walletCheck = await pool.request()
      .input('id_User', userId)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
    const walletBalance = walletCheck.recordset[0]?.wallet_balance || 0;
    
    // Tính giá gốc món ăn (100% của nhà hàng)
    const resFeePercentRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
    const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
    const foodAmount = order.food_Amount || 0;
    const foodAmountBase = Math.round(foodAmount / (1.0 + resFeePercent / 100.0));

    // Nếu là đơn Online đã thanh toán thì shipper không cần ứng tiền ký quỹ
    const depositAmount = isOnlinePaid ? 0 : foodAmountBase;

    if (walletBalance < depositAmount) {
      return res.status(400).json({ message: 'Số dư ví không đủ để ký quỹ nhận đơn hàng này (Cần tối thiểu ' + depositAmount.toLocaleString('vi-VN') + 'đ).' });
    }

    // 3. Trừ tiền ví Shipper (Ký quỹ) - Chỉ thực hiện nếu depositAmount > 0
    if (depositAmount > 0) {
      const newBalance = walletBalance - depositAmount;
      await pool.request()
        .input('id_User', userId)
        .input('newBalance', newBalance)
        .input('amount', -depositAmount)
        .input('balance_before', walletBalance)
        .input('note', 'Ký quỹ nhận đơn hàng COD #' + id)
        .input('id_Order', id)
        .query(`
          UPDATE [User] SET wallet_balance = @newBalance WHERE id_User = @id_User;
          INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@id_User, @id_Order, 'order_deduction', @amount, @balance_before, @newBalance, @note, GETDATE());
        `);
    }


    // 4. Cập nhật đơn hàng (gán id_Driver, đổi trạng thái)
    await pool.request()
      .input('id_Order', id)
      .input('id_Driver', id_Driver)
      .query(`
        UPDATE [Order]
        SET id_Driver = @id_Driver,
            order_Status = 'picking',
            accepted_Delivery_At = GETDATE()
        WHERE id_Order = @id_Order
      `);

    // 4. Thêm thông báo cho Shipper
    await pool.request()
      .input('id_User', userId)
      .input('id_Order', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, related_OrderId)
        VALUES (@id_User, N'Nhận đơn thành công', N'Bạn đã nhận giao đơn hàng #' + CAST(@id_Order AS NVARCHAR), 'ORDER_ACCEPTED', @id_Order)
      `);

    res.json({ message: 'Nhận đơn hàng thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Shipper cập nhật trạng thái đơn (từ Đang lấy hàng -> Đang giao -> Đã giao)
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params; // id_Order
  const { status } = req.body; // status mới (vd: 'delivering', 'delivered')
  const userId = req.user.id;

  if (!['delivering', 'delivered'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
  }

  try {
    const pool = await poolPromise;

    // 1. Lấy thông tin driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // 2. Kiểm tra đơn hàng có thuộc về driver này không
    const orderCheck = await pool.request()
      .input('id_Order', id)
      .input('id_Driver', id_Driver)
      .query(`
        SELECT o.order_Status, o.payment_Method, o.food_Amount, o.shipping_Fee, o.discount_Amount, o.order_Code, o.id_Restaurant, r.owner_id
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        WHERE o.id_Order = @id_Order AND o.id_Driver = @id_Driver
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về bạn.' });
    }

    // 3. Cập nhật trạng thái
    let query = `UPDATE [Order] SET order_Status = @status `;

    if (status === 'delivering') {
      query += `, picked_UpAt = GETDATE() `;
    } else if (status === 'delivered') {
      query += `, delivered_At = GETDATE() `;
    }

    query += ` WHERE id_Order = @id_Order`;

    await pool.request()
      .input('id_Order', id)
      .input('status', status)
      .query(query);

    // 3.5 Xử lý Ví (Wallet) nếu giao hàng thành công
    if (status === 'delivered') {
      const order = orderCheck.recordset[0];
      const configRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'");
      const feePercent = configRes.recordset[0].fee_percent;
      
      const foodAmount = order.food_Amount || 0;
      const shippingFee = order.shipping_Fee || 0;
      const discountAmount = order.discount_Amount || 0;
      const shipperEarned = Math.round(shippingFee / (1.0 + feePercent / 100.0));
      const adminShipperCommission = shippingFee - shipperEarned;
      const resOwnerId = order.owner_id;

      // Lấy chiết khấu nhà hàng để tính giá gốc
      const resFeePercentRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
      const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
      const restaurantRevenue = Math.round(foodAmount / (1.0 + resFeePercent / 100.0));
      const adminResCommission = foodAmount - restaurantRevenue;

      // A. Cộng tiền cho nhà hàng (Pay Merchant) khi giao hàng thành công (Nhà hàng nhận đúng 100% giá gốc món ăn)
      if (resOwnerId && restaurantRevenue > 0) {
        const wResCheck = await pool.request().input('id_User', resOwnerId).query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
        const wRes = parseFloat(wResCheck.recordset[0]?.wallet_balance || 0);
        const newResBalance = wRes + restaurantRevenue;

        await pool.request()
          .input('id_User', resOwnerId)
          .input('amount', restaurantRevenue)
          .input('new_balance', newResBalance)
          .input('id_Order', id)
          .input('wRes', wRes)
          .input('note', `Doanh thu đơn hàng #${order.order_Code} (Nhận 100% giá gốc món ăn)`)
          .query(`
            UPDATE [User] SET wallet_balance = @new_balance WHERE id_User = @id_User;
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (@id_User, @id_Order, 'order_revenue', @amount, @wRes, @new_balance, @note, GETDATE());
          `);
      }

      // B. Xử lý ví cho Shipper
      const isCod = order.payment_Method && ['cod', 'tiền mặt', 'cash'].includes(order.payment_Method.toLowerCase());
      if (isCod) {
        // Đơn Tiền Mặt: Shipper nhận tiền mặt từ khách = food_Amount + shipping_Fee - discount_Amount.
        // Shipper đã bị trừ ký quỹ giá gốc món ăn (restaurantRevenue = 100% giá gốc) trước đó.
        // Chia làm nhiều giao dịch con riêng biệt để hiển thị rõ ràng trên lịch sử ví
        await pool.request()
          .input('id_User', userId)
          .input('id_Order', id)
          .input('shipperEarned', shipperEarned)
          .input('discountAmount', discountAmount)
          .input('adminResCommission', adminResCommission)
          .input('adminShipperCommission', adminShipperCommission)
          .query(`
            DECLARE @curr_balance DECIMAL(15,2);
            SELECT @curr_balance = wallet_balance FROM [User] WHERE id_User = @id_User;

            -- 1. Cộng phí ship shipperEarned
            DECLARE @b1 DECIMAL(15,2) = @curr_balance;
            DECLARE @b1_after DECIMAL(15,2) = @b1 + @shipperEarned;
            UPDATE [User] SET wallet_balance = @b1_after WHERE id_User = @id_User;
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (@id_User, @id_Order, 'shipping_reward', @shipperEarned, @b1, @b1_after, N'Phí ship nhận từ đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());

            -- 2. Cộng hoàn khuyến mãi nếu discountAmount > 0
            DECLARE @b2 DECIMAL(15,2) = @b1_after;
            IF @discountAmount > 0
            BEGIN
                DECLARE @b2_after DECIMAL(15,2) = @b2 + @discountAmount;
                UPDATE [User] SET wallet_balance = @b2_after WHERE id_User = @id_User;
                INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                VALUES (@id_User, @id_Order, 'refund', @discountAmount, @b2, @b2_after, N'Hoàn khuyến mãi khách dùng đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                SET @b2 = @b2_after;
            END

            -- 3. Trừ chiết khấu món ăn nếu adminResCommission > 0
            DECLARE @b3 DECIMAL(15,2) = @b2;
            IF @adminResCommission > 0
            BEGIN
                DECLARE @b3_after DECIMAL(15,2) = @b3 - @adminResCommission;
                UPDATE [User] SET wallet_balance = @b3_after WHERE id_User = @id_User;
                INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                VALUES (@id_User, @id_Order, 'order_deduction', -@adminResCommission, @b3, @b3_after, N'Thu hồi chiết khấu món ăn đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                SET @b3 = @b3_after;
            END

            -- 4. Trừ chiết khấu ship nếu adminShipperCommission > 0
            IF @adminShipperCommission > 0
            BEGIN
                DECLARE @b4_after DECIMAL(15,2) = @b3 - @adminShipperCommission;
                UPDATE [User] SET wallet_balance = @b4_after WHERE id_User = @id_User;
                INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                VALUES (@id_User, @id_Order, 'order_deduction', -@adminShipperCommission, @b3, @b4_after, N'Phí dịch vụ giao hàng đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
            END
          `);
      } else {
        // Đơn Online: Shipper không thu tiền mặt và không ký quỹ.
        // Hệ thống cộng tiền công ship (shipperEarned = 100% phí ship gốc) vào ví cho Shipper.
        const wShipperCheck = await pool.request().input('id_User', userId).query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
        const wShipper = parseFloat(wShipperCheck.recordset[0]?.wallet_balance || 0);
        const newShipperBalance = wShipper + shipperEarned;

        const noteMsg = `Phí ship nhận từ đơn hàng Online #${order.order_Code}`;

        await pool.request()
          .input('id_User', userId)
          .input('amount', shipperEarned)
          .input('new_balance', newShipperBalance)
          .input('id_Order', id)
          .input('wShipper', wShipper)
          .input('note', noteMsg)
          .query(`
            UPDATE [User] SET wallet_balance = @new_balance WHERE id_User = @id_User;
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (@id_User, @id_Order, 'shipping_reward', @amount, @wShipper, @new_balance, @note, GETDATE());
          `);
      }
    }

    // 4. Thêm thông báo
    let notiTitle = '';
    let notiBody = '';
    let notiType = '';

    if (status === 'delivering') {
      notiTitle = 'Đã lấy hàng';
      notiBody = 'Bạn đã lấy thành công đơn hàng #' + id;
      notiType = 'ORDER_PICKED';
    } else if (status === 'delivered') {
      const order = orderCheck.recordset[0];
      const configRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'");
      const feePercent = configRes.recordset[0].fee_percent;
      const shippingFee = order.shipping_Fee || 0;
      const shipperEarned = Math.round(shippingFee / (1.0 + feePercent / 100.0));
      const adminCommission = shippingFee - shipperEarned;

      notiTitle = 'Giao hàng thành công';
      notiBody = `Đơn hàng #${id} giao thành công! Phí ship: +${shippingFee.toLocaleString('vi-VN')}đ, Chiết khấu: -${adminCommission.toLocaleString('vi-VN')}đ.`;
      notiType = 'ORDER_DELIVERED';
    }

    if (notiTitle !== '') {
      await pool.request()
        .input('id_User', userId)
        .input('id_Order', id)
        .input('title', notiTitle)
        .input('body', notiBody)
        .input('type', notiType)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, related_OrderId)
          VALUES (@id_User, @title, @body, @type, @id_Order)
        `);
    }

    res.json({ message: 'Cập nhật trạng thái thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách đơn hàng ĐÃ NHẬN của shipper
exports.getAcceptedOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    const result = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT o.*, r.name_Restaurant, r.address as res_address, r.owner_id as res_owner_id, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
               r.lat as res_lat, r.lng as res_lng, a.lat as user_lat, a.lng as user_lng,
               ROUND(o.shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0) as shipper_Earned,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.id_Driver = @id_Driver
          AND o.order_Status IN ('ready', 'picking', 'delivering', 'delivered')
        ORDER BY o.accepted_Delivery_At DESC
      `);

    const orders = result.recordset.map(row => {
      const distanceKm = getDistanceFromLatLonInKm(row.res_lat, row.res_lng, row.user_lat, row.user_lng);
      return { ...row, distanceKm };
    });

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id_Order).join(',');
      const itemsResult = await pool.request()
        .query(`
          SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price, ofood.note AS note
          FROM Order_Food ofood
          JOIN Food f ON ofood.id_Food = f.id_Food
          WHERE ofood.id_Order IN (${orderIds})
        `);

      const itemsMap = {};
      itemsResult.recordset.forEach(item => {
        if (!itemsMap[item.id_Order]) {
          itemsMap[item.id_Order] = [];
        }
        itemsMap[item.id_Order].push({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          note: item.note
        });
      });

      orders.forEach(order => {
        order.items = itemsMap[order.id_Order] || [];
      });
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Shipper hủy đơn hàng
exports.cancelOrder = async (req, res) => {
  const { id } = req.params; // id_Order
  const { cancellation_Reason } = req.body;
  const userId = req.user.id;

  if (!cancellation_Reason || cancellation_Reason.trim() === '') {
    return res.status(400).json({ message: 'Vui lòng cung cấp lý do hủy.' });
  }

  try {
    const pool = await poolPromise;

    // 1. Lấy thông tin driver dựa trên id_User
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // 2. Kiểm tra xem đơn hàng có phải của driver này không
    const orderCheck = await pool.request()
      .input('id_Order', id)
      .input('id_Driver', id_Driver)
      .query("SELECT order_Code, payment_Method, food_Amount FROM [Order] WHERE id_Order = @id_Order AND id_Driver = @id_Driver AND order_Status IN ('ready', 'picking', 'delivering')");

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng đang giao của bạn.' });
    }

    const order = orderCheck.recordset[0];
    const isCod = order.payment_Method && ['cod', 'tiền mặt', 'cash'].includes(order.payment_Method.toLowerCase());

    // 3. Hủy đơn hàng, trả về trạng thái confirmed và gỡ driver
    await pool.request()
      .input('id_Order', id)
      .input('reason', cancellation_Reason)
      .query(`
        UPDATE [Order]
        SET order_Status = 'confirmed',
            id_Driver = NULL,
            cancellation_Reason = @reason,
            cancelled_By = 'Driver'
        WHERE id_Order = @id_Order
      `);

    // 3.5 Nếu là đơn COD, hoàn tiền ký quỹ cho shipper
    if (isCod) {
      const resFeePercentRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
      const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
      const refundAmount = Math.round((order.food_Amount || 0) / (1.0 + resFeePercent / 100.0));

      const wShipperCheck = await pool.request().input('id_User', userId).query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
      const wShipper = parseFloat(wShipperCheck.recordset[0]?.wallet_balance || 0);
      const newShipperBalance = wShipper + refundAmount;

      await pool.request()
        .input('id_User', userId)
        .input('amount', refundAmount)
        .input('new_balance', newShipperBalance)
        .input('id_Order', id)
        .input('wShipper', wShipper)
        .query(`
          UPDATE [User] SET wallet_balance = @new_balance WHERE id_User = @id_User;
          INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@id_User, @id_Order, 'refund', @amount, @wShipper, @new_balance, N'Hoàn trả tiền ký quỹ đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
        `);
    }

    // 4. Cập nhật số đơn hàng đã hủy của shipper
    await pool.request()
      .input('id_User', userId)
      .query(`
        UPDATE [User]
        SET cancelled_Orders = ISNULL(cancelled_Orders, 0) + 1
        WHERE id_User = @id_User
      `);

    // 5. Thêm thông báo
    await pool.request()
      .input('id_User', userId)
      .input('id_Order', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, related_OrderId)
        VALUES (@id_User, N'Đã hủy đơn hàng', N'Bạn đã hủy giao đơn hàng #' + CAST(@id_Order AS NVARCHAR), 'ORDER_CANCELLED', @id_Order)
      `);

    res.json({ message: 'Đã hủy đơn hàng thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Báo cáo sự cố
exports.reportComplaint = async (req, res) => {
  const { id } = req.params; // id_Order
  const userId = req.user.id;
  const { description } = req.body;
  const image = req.files && req.files.length > 0
    ? req.files.map(f => `/img/issue/${f.filename}`).join(',')
    : null;

  if (!description) {
    return res.status(400).json({ message: 'Vui lòng nhập mô tả sự cố.' });
  }

  try {
    const pool = await poolPromise;

    // Check if the order is valid for reporting (e.g., delivered within 7 days)
    const orderCheck = await pool.request()
      .input('id_Order', id)
      .query('SELECT order_Status, delivered_At FROM [Order] WHERE id_Order = @id_Order');

    if (orderCheck.recordset.length > 0) {
      const order = orderCheck.recordset[0];
      if (order.order_Status === 'delivered' && order.delivered_At) {
        const deliveredDate = new Date(order.delivered_At);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - deliveredDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          return res.status(400).json({ message: 'Không thể khiếu nại đơn hàng đã giao quá 7 ngày.' });
        }
      }
    }

    // Đảm bảo bảng Complaint có cột image (nếu chưa có thì thêm vào)
    try { await pool.request().query('ALTER TABLE Complaint ADD image VARCHAR(MAX)'); } catch (e) { }

    await pool.request()
      .input('id_Order', id)
      .input('id_User', userId)
      .input('type', 'Shipper Report')
      .input('description', description)
      .input('image', image)
      .query(`
        INSERT INTO Complaint (id_Order, id_User, type, description, status, created_At, image)
        VALUES (@id_Order, @id_User, @type, @description, 'pending', GETDATE(), @image)
      `);

    res.json({ message: 'Báo cáo sự cố thành công.' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy tổng thu nhập hôm nay
exports.getTodayEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query(`SELECT id_Driver FROM Driver WHERE id_User = @id_User`);

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // Tính tổng shipping_Fee của các đơn đã giao trong ngày hôm nay
    const result = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT ISNULL(SUM(ROUND(shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0)), 0) AS todayEarnings, COUNT(id_Order) AS totalOrders
        FROM [Order]
        WHERE id_Driver = @id_Driver 
          AND order_Status = 'delivered' 
          AND CAST(delivered_At AS DATE) = CAST(GETDATE() AS DATE)
      `);

    res.json({
      todayEarnings: result.recordset[0].todayEarnings,
      totalOrders: result.recordset[0].totalOrders
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách thông báo
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('id_User', userId)
      .query(`
        SELECT id_Noti, title, body, type, is_Read, related_OrderId, created_At
        FROM Notification
        WHERE id_User = @id_User
        ORDER BY created_At DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi lấy thông báo', error: err.message });
  }
};

// Đánh dấu thông báo đã đọc
exports.markNotificationRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notiId = req.params.id;
    const pool = await poolPromise;

    await pool.request()
      .input('id_Noti', notiId)
      .input('id_User', userId)
      .query(`
        UPDATE Notification
        SET is_Read = 1
        WHERE id_Noti = @id_Noti AND id_User = @id_User
      `);

    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi cập nhật thông báo', error: err.message });
  }
};

// Xóa thông báo
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notiId = req.params.id;
    const pool = await poolPromise;

    await pool.request()
      .input('id_Noti', notiId)
      .input('id_User', userId)
      .query(`
        DELETE FROM Notification
        WHERE id_Noti = @id_Noti AND id_User = @id_User
      `);

    res.json({ message: 'Đã xóa thông báo' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xóa thông báo', error: err.message });
  }
};

// Lấy thống kê cho màn hình Thống kê
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { filter } = req.query; // 'today', 'week', 'month'
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query(`SELECT id_Driver, rating_Avg FROM Driver WHERE id_User = @id_User`);

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const driver = driverResult.recordset[0];
    const id_Driver = driver.id_Driver;
    const rating_Avg = driver.rating_Avg;

    // Lọc theo thời gian
    let dateFilter = '';
    let cancelDateFilter = '';
    if (filter === 'today') {
      dateFilter = `CAST(delivered_At AS DATE) = CAST(GETDATE() AS DATE)`;
      cancelDateFilter = `CAST(created_At AS DATE) = CAST(GETDATE() AS DATE)`;
    } else if (filter === 'month') {
      dateFilter = `MONTH(delivered_At) = MONTH(GETDATE()) AND YEAR(delivered_At) = YEAR(GETDATE())`;
      cancelDateFilter = `MONTH(created_At) = MONTH(GETDATE()) AND YEAR(created_At) = YEAR(GETDATE())`;
    } else {
      // default: week
      dateFilter = `DATEPART(isoww, delivered_At) = DATEPART(isoww, GETDATE()) AND YEAR(delivered_At) = YEAR(GETDATE())`;
      cancelDateFilter = `DATEPART(isoww, created_At) = DATEPART(isoww, GETDATE()) AND YEAR(created_At) = YEAR(GETDATE())`;
    }

    // Lấy tổng thu nhập và đơn hoàn thành
    const earningsResult = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT ISNULL(SUM(ROUND(shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0)), 0) AS totalEarnings, COUNT(id_Order) AS completedOrders
        FROM [Order]
        WHERE id_Driver = @id_Driver 
          AND order_Status = 'delivered' 
          AND ${dateFilter}
      `);

    // Lọc cho đơn hủy (dựa vào Notification ORDER_CANCELLED để đếm số đơn tài xế đã hủy trong khoảng thời gian)
    const cancelledResult = await pool.request()
      .input('id_User', userId)
      .query(`
        SELECT COUNT(id_Noti) AS cancelledOrders
        FROM Notification
        WHERE id_User = @id_User 
          AND type = 'ORDER_CANCELLED' 
          AND ${cancelDateFilter}
      `);

    // Lịch sử đơn hàng (Lấy 20 đơn gần nhất)
    const historyResult = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT TOP 20 o.id_Order, o.order_Status, 
                      ROUND(o.shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0) as shipping_Fee, 
                      o.payment_Method, o.delivered_At, o.created_At, o.cancelled_By,
                      a.full_Address, r.name_Restaurant, u.fullName
        FROM [Order] o
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.id_Driver = @id_Driver 
          AND o.order_Status IN ('delivered', 'cancelled')
        ORDER BY o.created_At DESC
      `);

    res.json({
      totalEarnings: earningsResult.recordset[0].totalEarnings,
      completedOrders: earningsResult.recordset[0].completedOrders,
      cancelledOrders: cancelledResult.recordset[0].cancelledOrders,
      ratingAvg: rating_Avg,
      activeHours: 32, // Tạm fix cứng vì database chưa có bảng Tracking giờ hoạt động
      history: historyResult.recordset
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết một đơn hàng theo ID
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const result = await pool.request()
      .input('id_Order', id)
      .query(`
        DECLARE @shipper_fee_percent FLOAT = (SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent');
        SELECT o.*, r.name_Restaurant, r.address as res_address, r.owner_id as res_owner_id, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
               r.lat as res_lat, r.lng as res_lng, a.lat as user_lat, a.lng as user_lng,
               ROUND(o.shipping_Fee / (1.0 + @shipper_fee_percent / 100.0), 0) as shipper_Earned,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.id_Order = @id_Order
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const orderRow = result.recordset[0];
    const distanceKm = getDistanceFromLatLonInKm(orderRow.res_lat, orderRow.res_lng, orderRow.user_lat, orderRow.user_lng);
    const order = { ...orderRow, distanceKm };

    const itemsResult = await pool.request()
      .input('id_Order', id)
      .query(`
        SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price, ofood.note AS note
        FROM Order_Food ofood
        JOIN Food f ON ofood.id_Food = f.id_Food
        WHERE ofood.id_Order = @id_Order
      `);

    order.items = itemsResult.recordset.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      note: item.note
    }));

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.withdrawComplaint = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { resolution } = req.body;
    const userId = req.user.id;

    if (!resolution) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do gỡ khiếu nại' });
    }

    const pool = await poolPromise;

    // Only allow withdrawing if the complaint belongs to the user and is pending/processing
    const result = await pool.request()
      .input('id_Complaint', complaintId)
      .input('resolution', resolution)
      .input('id_User', userId)
      .query(`
        UPDATE Complaint 
        SET status = 'resolved', resolution = @resolution
        WHERE id_Complaint = @id_Complaint 
          AND id_User = @id_User 
          AND status IN ('pending', 'processing')
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(400).json({ message: 'Không thể gỡ khiếu nại này hoặc trạng thái không hợp lệ' });
    }

    res.json({ message: 'Gỡ khiếu nại thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách cuộc trò chuyện (Chat)
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    // Lấy id_Driver
    const driverResult = await pool.request()
      .input('id_User', userId)
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    const result = await pool.request()
      .input('id_User', userId)
      .input('id_Driver', id_Driver)
      .query(`
        WITH LastMessages AS (
          SELECT 
            id_Message, sender_id, receiver_id, message_text, created_at, is_read,
            ROW_NUMBER() OVER (PARTITION BY 
              CASE WHEN sender_id = @id_User THEN receiver_id ELSE sender_id END 
              ORDER BY created_at DESC, id_Message DESC) as rn
          FROM RestaurantMessage
          WHERE sender_id = @id_User OR receiver_id = @id_User
        )
        SELECT 
          lm.message_text as lastMessage,
          lm.created_at as time,
          -- Cast sang BIT để Node.js serialize thành boolean (true/false) khớp với Gson trong Android
          CASE WHEN lm.sender_id = @id_User THEN CAST(1 AS BIT) ELSE CAST(lm.is_read AS BIT) END as is_read,
          lm.sender_id as sender_id,
          partner.id_User as partner_id,
          COALESCE(r.name_Restaurant, partner.fullName) as partner_name,
          partner.role as partner_role,
          (
            SELECT TOP 1 o.order_Code 
            FROM [Order] o
            WHERE (
                o.id_User = partner.id_User 
                AND (o.id_Driver = @id_Driver OR o.id_Driver IS NULL OR o.id_Driver = 0)
            ) OR (
                o.id_Restaurant = (SELECT id_Restaurant FROM Restaurant WHERE owner_id = partner.id_User) 
                AND (o.id_Driver = @id_Driver OR o.id_Driver IS NULL OR o.id_Driver = 0)
            ) 
            ORDER BY 
                CASE WHEN o.id_Driver = @id_Driver THEN 0 ELSE 1 END,
                CASE WHEN o.order_Status IN ('confirmed', 'preparing', 'ready', 'picking', 'delivering') THEN 0 ELSE 1 END,
                o.created_At DESC
          ) as orderId
        FROM LastMessages lm
        JOIN [User] partner ON partner.id_User = CASE WHEN lm.sender_id = @id_User THEN lm.receiver_id ELSE lm.sender_id END
        LEFT JOIN Restaurant r ON partner.id_User = r.owner_id AND partner.role = 'restaurant_owner'
        WHERE lm.rn = 1
        ORDER BY lm.created_at DESC, lm.id_Message DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.partnerId;
    const pool = await poolPromise;

    const result = await pool.request()
      .input('id_User', userId)
      .input('partnerId', partnerId)
      .query(`
        SELECT * FROM RestaurantMessage
        WHERE (sender_id = @id_User AND receiver_id = @partnerId)
           OR (sender_id = @partnerId AND receiver_id = @id_User)
        ORDER BY created_at ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, message_text } = req.body;

    if (!receiver_id || !message_text) {
      return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin' });
    }

    const pool = await poolPromise;
    await pool.request()
      .input('sender_id', senderId)
      .input('receiver_id', receiver_id)
      .input('message_text', message_text)
      .query(`
        INSERT INTO RestaurantMessage (sender_id, receiver_id, message_text, created_at, is_read)
        VALUES (@sender_id, @receiver_id, @message_text, GETDATE(), 0)
      `);

    res.json({ message: 'Đã gửi tin nhắn' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const partnerId = req.params.partnerId;
    const pool = await poolPromise;

    await pool.request()
      .input('id_User', userId)
      .input('partnerId', partnerId)
      .query(`
        UPDATE RestaurantMessage
        SET is_read = 1
        WHERE receiver_id = @id_User AND sender_id = @partnerId AND is_read = 0
      `);

    res.json({ message: 'Đã cập nhật trạng thái' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// ============================================
// PROFILE SHIPPER
// ============================================
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', userId)
      .query(`
        SELECT u.id_User, u.phone, u.fullName, u.email, u.avatar, u.role, u.reputation_score, u.total_orders, d.id_Driver, d.license_plate, d.rating_Avg, d.total_Orders as driver_total_orders
        FROM [User] u
        LEFT JOIN Driver d ON u.id_User = d.id_User
        WHERE u.id_User = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { fullName, email, phone, license_plate } = req.body;
  const avatar = req.file ? `/img/avatar/${req.file.filename}` : null;
  const userId = req.user.id;
  try {
    const pool = await poolPromise;

    let updateQuery = `UPDATE [User] SET fullName = @fullName, email = @email, phone = @phone, updated_at = GETDATE()`;
    if (avatar) updateQuery += `, avatar = @avatar`;
    updateQuery += ` WHERE id_User = @id`;

    // Update User table
    const reqUser = pool.request()
      .input('id', userId)
      .input('fullName', fullName)
      .input('email', email)
      .input('phone', phone);

    if (avatar) reqUser.input('avatar', avatar);

    await reqUser.query(updateQuery);

    // Update Driver table
    await pool.request()
      .input('id', userId)
      .input('license_plate', license_plate)
      .query(`
        UPDATE Driver 
        SET license_plate = @license_plate
        WHERE id_User = @id
      `);

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
