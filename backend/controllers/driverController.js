const { poolPromise } = require('../config/db');

// Lấy danh sách đơn hàng chờ nhận (cho Shipper)
// Status có thể là 'pending', 'confirmed', 'ready', 'preparing' và chưa có shipper (id_Driver IS NULL)
exports.getAvailableOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.order_Status = 'confirmed'
          AND (o.id_Driver IS NULL OR o.id_Driver = 0)
        ORDER BY o.created_At DESC
      `);
      
    const orders = result.recordset.map(row => ({...row}));

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id_Order).join(',');
      const itemsResult = await pool.request()
        .query(`
          SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price
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
          price: item.price
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
        SELECT c.*, o.order_Status, r.name_Restaurant, u.fullName as user_name
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
        SELECT c.*, o.order_Status, r.name_Restaurant, u.fullName as complainant_name
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
      .query('SELECT order_Status, id_Driver FROM [Order] WHERE id_Order = @id_Order');

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    const order = orderCheck.recordset[0];
    if (order.id_Driver !== null) {
      return res.status(400).json({ message: 'Đơn hàng này đã có người nhận.' });
    }

    // 3. Cập nhật đơn hàng (gán id_Driver, đổi trạng thái)
    await pool.request()
      .input('id_Order', id)
      .input('id_Driver', id_Driver)
      .query(`
        UPDATE [Order]
        SET id_Driver = @id_Driver,
            order_Status = 'picking',
            accepted_At = GETDATE()
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
      .query('SELECT order_Status FROM [Order] WHERE id_Order = @id_Order AND id_Driver = @id_Driver');

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

    // 4. Thêm thông báo
    let notiTitle = '';
    let notiBody = '';
    let notiType = '';

    if (status === 'delivering') {
      notiTitle = 'Đã lấy hàng';
      notiBody = 'Bạn đã lấy thành công đơn hàng #' + id;
      notiType = 'ORDER_PICKED';
    } else if (status === 'delivered') {
      notiTitle = 'Giao hàng thành công';
      notiBody = 'Đơn hàng #' + id + ' đã được giao thành công. Tiền ship đã được cộng vào thu nhập!';
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
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        JOIN [User] u ON o.id_User = u.id_User
        WHERE o.id_Driver = @id_Driver
          AND o.order_Status IN ('picking', 'delivering', 'delivered')
        ORDER BY o.accepted_At DESC
      `);
      
    const orders = result.recordset.map(row => ({...row}));

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id_Order).join(',');
      const itemsResult = await pool.request()
        .query(`
          SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price
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
          price: item.price
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
      .query("SELECT order_Status FROM [Order] WHERE id_Order = @id_Order AND id_Driver = @id_Driver AND order_Status IN ('picking', 'delivering')");

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng đang giao của bạn.' });
    }

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

    // 4. Thêm thông báo
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

  if (!description) {
    return res.status(400).json({ message: 'Vui lòng nhập mô tả sự cố.' });
  }

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id_Order', id)
      .input('id_User', userId)
      .input('type', 'Shipper Report')
      .input('description', description)
      .query(`
        INSERT INTO Complaint (id_Order, id_User, type, description, status, created_At)
        VALUES (@id_Order, @id_User, @type, @description, 'pending', GETDATE())
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
        SELECT ISNULL(SUM(shipping_Fee), 0) AS todayEarnings, COUNT(id_Order) AS totalOrders
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
        SELECT ISNULL(SUM(shipping_Fee), 0) AS totalEarnings, COUNT(id_Order) AS completedOrders
        FROM [Order]
        WHERE id_Driver = @id_Driver 
          AND order_Status = 'delivered' 
          AND ${dateFilter}
      `);

    // Lọc cho đơn hủy (dùng created_At)
    const cancelledResult = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        SELECT COUNT(id_Order) AS cancelledOrders
        FROM [Order]
        WHERE id_Driver = @id_Driver 
          AND order_Status = 'cancelled' 
          AND ${cancelDateFilter}
      `);
      
    // Lịch sử đơn hàng (Lấy 20 đơn gần nhất)
    const historyResult = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        SELECT TOP 20 o.id_Order, o.order_Status, o.shipping_Fee, o.payment_Method, o.delivered_At, o.created_At, o.cancelled_By,
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
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, u.fullName as user_name, a.phone as user_phone,
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

    const order = result.recordset[0];

    const itemsResult = await pool.request()
      .input('id_Order', id)
      .query(`
        SELECT ofood.id_Order AS id_Order, ofood.quantity AS quantity, f.name AS name, ofood.unit_Price AS price
        FROM Order_Food ofood
        JOIN Food f ON ofood.id_Food = f.id_Food
        WHERE ofood.id_Order = @id_Order
      `);
    
    order.items = itemsResult.recordset.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    res.json(order);
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
      .query('SELECT id_Driver FROM Driver WHERE id_User = @id_User');

    if (driverResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Tài khoản của bạn không phải là Shipper.' });
    }

    const id_Driver = driverResult.recordset[0].id_Driver;

    // Tính tổng shipping_Fee cho các đơn hàng hoàn thành hôm nay
    const earningsResult = await pool.request()
      .input('id_Driver', id_Driver)
      .query(`
        SELECT SUM(shipping_Fee) AS todayEarnings
        FROM [Order]
        WHERE id_Driver = @id_Driver 
          AND order_Status = 'delivered' 
          AND CAST(delivered_At AS DATE) = CAST(GETDATE() AS DATE)
      `);

    let earnings = earningsResult.recordset[0].todayEarnings;
    if (!earnings) earnings = 0;

    res.json({ todayEarnings: earnings });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách khiếu nại (của tôi và về tôi)
exports.getComplaints = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;

    const myResult = await pool.request()
      .input('id_User', userId)
      .query(`
        SELECT c.*, o.order_Status, r.name_Restaurant, u.fullName as user_name
        FROM Complaint c
        JOIN [Order] o ON c.id_Order = o.id_Order
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        LEFT JOIN [User] u ON o.id_User = u.id_User
        WHERE c.id_User = @id_User
        ORDER BY c.created_At DESC
      `);

    const aboutMeResult = await pool.request()
      .input('id_User', userId)
      .query(`
        SELECT c.*, o.order_Status, r.name_Restaurant, u.fullName as user_name
        FROM Complaint c
        JOIN [Order] o ON c.id_Order = o.id_Order
        JOIN Driver d ON o.id_Driver = d.id_Driver
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        LEFT JOIN [User] u ON c.id_User = u.id_User
        WHERE d.id_User = @id_User AND c.id_User != @id_User
        ORDER BY c.created_At DESC
      `);

    res.json({
      myComplaints: myResult.recordset,
      complaintsAboutMe: aboutMeResult.recordset
    });
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
  } catch(err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_User', userId)
      .query(`
        SELECT * FROM Notification 
        WHERE id_User = @id_User 
        ORDER BY created_At DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;
    await pool.request()
      .input('id', id)
      .input('id_User', userId)
      .query(`
        UPDATE Notification SET is_Read = 1 
        WHERE id_Notification = @id AND id_User = @id_User
      `);
    res.json({ message: 'Đã đánh dấu đọc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = await poolPromise;
    await pool.request()
      .input('id', id)
      .input('id_User', userId)
      .query(`
        DELETE FROM Notification 
        WHERE id_Notification = @id AND id_User = @id_User
      `);
    res.json({ message: 'Đã xóa thông báo' });
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
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    
    // Update User table
    await pool.request()
      .input('id', userId)
      .input('fullName', fullName)
      .input('email', email)
      .input('phone', phone)
      .query(`
        UPDATE [User] 
        SET fullName = @fullName, email = @email, phone = @phone, updated_at = GETDATE()
        WHERE id_User = @id
      `);

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
