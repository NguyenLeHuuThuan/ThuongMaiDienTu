const { poolPromise } = require('../config/db');

// Lấy danh sách đơn hàng chờ nhận (cho Shipper)
// Status có thể là 'pending', 'confirmed', 'ready', 'preparing' và chưa có shipper (id_Driver IS NULL)
exports.getAvailableOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query(`
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, a.name as user_name, a.phone as user_phone,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        WHERE o.order_Status = 'confirmed'
          AND (o.id_Driver IS NULL OR o.id_Driver = 0)
        ORDER BY o.created_At DESC
      `);
      
    res.json(result.recordset);
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
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, a.name as user_name, a.phone as user_phone,
               DATEADD(minute, ISNULL(NULLIF((SELECT SUM(ISNULL(f.prep_Time, 15) * ofood.quantity) FROM Order_Food ofood JOIN Food f ON ofood.id_Food = f.id_Food WHERE ofood.id_Order = o.id_Order), 0), 15), o.accepted_At) as expected_Completion_Time
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        WHERE o.id_Driver = @id_Driver
          AND o.order_Status IN ('picking', 'delivering')
        ORDER BY o.accepted_At DESC
      `);
      
    res.json(result.recordset);
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
