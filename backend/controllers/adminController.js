const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');

// Helper to log administrative actions
async function createLog(pool, id_User, action, entity, id_Entity, oldValue, newValue) {
  try {
    await pool.request()
      .input('id_User', id_User)
      .input('action', action)
      .input('entity', entity)
      .input('id_Entity', id_Entity || null)
      .input('old_Value', oldValue ? JSON.stringify(oldValue) : null)
      .input('new_Value', newValue ? JSON.stringify(newValue) : null)
      .query(`
        INSERT INTO SystemLog (id_User, action, entity, id_Entity, old_Value, new_Value, created_At)
        VALUES (@id_User, @action, @entity, @id_Entity, @old_Value, @new_Value, GETDATE())
      `);
  } catch (err) {
    console.error('Failed to write SystemLog:', err);
  }
}

// 1. Dashboard, Statistics & System Logs
exports.getStats = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const pool = await poolPromise;

    // Fetch active service fee percentages
    const configRes = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('op_service_fee_percent', 'op_shipper_fee_percent')
    `);

    let resFeePercent = 15.0; // default 15%
    let shipFeePercent = 5.0;  // default 5%

    configRes.recordset.forEach(c => {
      if (c.config_key === 'op_service_fee_percent' && c.is_enabled) {
        resFeePercent = parseFloat(c.config_value) || 0;
      }
      if (c.config_key === 'op_shipper_fee_percent' && c.is_enabled) {
        shipFeePercent = parseFloat(c.config_value) || 0;
      }
    });

    // A. Overview Counts
    const overviewRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM [User] WHERE role = 'customer') AS total_customers,
        (SELECT COUNT(*) FROM [User] WHERE role = 'driver' AND status = 'active') AS active_drivers,
        (SELECT COUNT(*) FROM [User] WHERE role = 'restaurant_owner' AND status = 'active') AS active_restaurants,
        (SELECT COUNT(*) FROM [Order]) AS total_orders,
        (SELECT ISNULL(SUM(total_Amount), 0) FROM [Order] WHERE payment_Status = 'paid') AS total_revenue,
        (SELECT ISNULL(SUM(commission_amount), 0) FROM Commission) AS total_commissions,
        (SELECT wallet_balance FROM [User] WHERE id_User = 1) AS wallet_balance
    `);

    // B. Order Status Split
    const orderSplitRes = await pool.request().query(`
      SELECT order_Status, COUNT(*) AS count 
      FROM [Order] 
      GROUP BY order_Status
    `);

    // C. Top Selling Foods
    const topFoodsRes = await pool.request().query(`
      SELECT TOP 5 f.name, r.name_Restaurant, SUM(ofood.quantity) AS sold_quantity
      FROM Order_Food ofood
      JOIN Food f ON ofood.id_Food = f.id_Food
      JOIN Restaurant r ON f.id_Restaurant = r.id_Restaurant
      JOIN [Order] o ON ofood.id_Order = o.id_Order
      WHERE o.order_Status = 'delivered'
      GROUP BY f.name, r.name_Restaurant
      ORDER BY sold_quantity DESC
    `);

    // D. Revenue by month
    const monthlyRevenueRes = await pool.request().query(`
      SELECT 
        FORMAT(created_At, 'yyyy-MM') AS month,
        SUM(total_Amount) AS revenue,
        COUNT(*) AS orders
      FROM [Order]
      WHERE payment_Status = 'paid'
      GROUP BY FORMAT(created_At, 'yyyy-MM')
      ORDER BY month ASC
    `);

    // E. System Monitoring Logs (Recent 15 logs)
    const logsRes = await pool.request().query(`
      SELECT TOP 15 l.*, u.fullName AS user_name, u.role AS user_role
      FROM SystemLog l
      LEFT JOIN [User] u ON l.id_User = u.id_User
      ORDER BY l.created_At DESC
    `);

    // F. Daily System Earnings Breakdown
    let dailyQuery = `
      SELECT 
        CAST(created_At AS DATE) AS date,
        COUNT(id_Order) AS order_count,
        SUM(food_Amount) AS total_food_amount,
        SUM(shipping_Fee) AS total_shipping_fee,
        SUM(food_Amount) * @resFeePercent / 100.0 AS restaurant_service_fee,
        SUM(shipping_Fee) * @shipFeePercent / 100.0 AS shipper_service_fee,
        (SUM(food_Amount) * @resFeePercent / 100.0) + (SUM(shipping_Fee) * @shipFeePercent / 100.0) AS total_system_earnings
      FROM [Order]
      WHERE order_Status = 'delivered'
    `;

    const reqDaily = pool.request()
      .input('resFeePercent', resFeePercent)
      .input('shipFeePercent', shipFeePercent);

    if (startDate) {
      dailyQuery += ` AND created_At >= @startDate`;
      reqDaily.input('startDate', new Date(startDate));
    }
    if (endDate) {
      dailyQuery += ` AND created_At <= @endDate`;
      reqDaily.input('endDate', new Date(endDate + ' 23:59:59'));
    }

    dailyQuery += ` GROUP BY CAST(created_At AS DATE) ORDER BY date DESC`;
    const dailyRes = await reqDaily.query(dailyQuery);

    res.json({
      overview: overviewRes.recordset[0],
      orderSplit: orderSplitRes.recordset,
      topFoods: topFoodsRes.recordset,
      monthlyRevenue: monthlyRevenueRes.recordset,
      recentLogs: logsRes.recordset,
      dailyEarnings: dailyRes.recordset,
      activeRates: {
        restaurantFeePercent: resFeePercent,
        shipperFeePercent: shipFeePercent
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy số liệu thống kê', error: error.message });
  }
};

// 2. User CRUD
exports.getUsers = async (req, res) => {
  const { search, role, status } = req.query;
  console.log('--- BACKEND SEARCH DEBUG ---');
  console.log('Received search query params:', { search, role, status });
  try {
    const pool = await poolPromise;
    let query = `
      SELECT id_User, phone, fullName, email, avatar, role, status, created_at, reputation_score, total_orders 
      FROM [User]
      WHERE 1=1
    `;

    const request = pool.request();

    if (search) {
      query += ` AND (fullName LIKE @search OR phone LIKE @search OR email LIKE @search)`;
      request.input('search', `%${search}%`);
    }

    if (role) {
      query += ` AND role = @role`;
      request.input('role', role);
    }

    if (status) {
      query += ` AND status = @status`;
      request.input('status', status);
    }

    query += ` ORDER BY created_at DESC`;
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi danh sách người dùng', error: error.message });
  }
};

exports.createUser = async (req, res) => {
  const { phone, password, fullName, email, role, status } = req.body;
  if (!phone || !password || !fullName || !role) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc!' });
  }

  try {
    const pool = await poolPromise;

    // Check unique phone
    const checkUser = await pool.request()
      .input('phone', phone)
      .query('SELECT id_User FROM [User] WHERE phone = @phone');

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký!' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const insertResult = await pool.request()
      .input('phone', phone)
      .input('password', hashedPassword)
      .input('fullName', fullName)
      .input('email', email || null)
      .input('role', role)
      .input('status', status || 'active')
      .query(`
        INSERT INTO [User] (phone, password, fullName, email, role, status, created_at, reputation_score)
        OUTPUT inserted.id_User
        VALUES (@phone, @password, @fullName, @email, @role, @status, GETDATE(), 100)
      `);

    const newId = insertResult.recordset[0].id_User;

    // If driver role, add Driver record
    if (role === 'driver') {
      await pool.request()
        .input('id_User', newId)
        .query(`
          INSERT INTO Driver (id_User, is_Busy, is_Online, rating_Avg, total_Orders)
          VALUES (@id_User, 0, 0, 5.0, 0)
        `);
    }

    await createLog(pool, req.user.id, 'CREATE_USER', 'User', newId, null, { phone, fullName, role, status });

    res.status(201).json({ message: 'Tạo tài khoản thành công!', id_User: newId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi tạo người dùng', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, role, status, reputation_score } = req.body;

  try {
    const pool = await poolPromise;

    // Get old data for logging
    const oldRes = await pool.request()
      .input('id', id)
      .query('SELECT fullName, email, role, status, reputation_score FROM [User] WHERE id_User = @id');

    if (oldRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const oldVal = oldRes.recordset[0];

    await pool.request()
      .input('id', id)
      .input('fullName', fullName)
      .input('email', email || null)
      .input('role', role)
      .input('status', status)
      .input('reputation_score', reputation_score !== undefined ? reputation_score : 100)
      .query(`
        UPDATE [User]
        SET fullName = @fullName, email = @email, role = @role, status = @status, 
            reputation_score = @reputation_score, updated_at = GETDATE()
        WHERE id_User = @id
      `);

    await createLog(pool, req.user.id, 'UPDATE_USER', 'User', id, oldVal, { fullName, email, role, status, reputation_score });

    res.json({ message: 'Cập nhật người dùng thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi cập nhật người dùng', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    // Switch status to inactive/banned to maintain db relational integrity instead of hard delete
    const oldRes = await pool.request()
      .input('id', id)
      .query('SELECT status FROM [User] WHERE id_User = @id');

    if (oldRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    await pool.request()
      .input('id', id)
      .query("UPDATE [User] SET status = 'banned', updated_at = GETDATE() WHERE id_User = @id");

    await createLog(pool, req.user.id, 'DISABLE_USER', 'User', id, oldRes.recordset[0], { status: 'banned' });

    res.json({ message: 'Đã khoá tài khoản người dùng thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi vô hiệu hoá người dùng', error: error.message });
  }
};

// 3. Partner Approval
exports.getPartners = async (req, res) => {
  try {
    const pool = await poolPromise;

    // Query both inactive drivers and restaurant owners
    const partnersResult = await pool.request().query(`
      SELECT 
        u.id_User, u.fullName, u.phone, u.email, u.role, u.status, u.created_at,
        d.license_plate, d.cccd_Front, d.cccd_Back, d.driving_License,
        r.name_Restaurant, r.address AS restaurant_address, r.logo AS restaurant_logo
      FROM [User] u
      LEFT JOIN Driver d ON u.id_User = d.id_User
      LEFT JOIN Restaurant r ON u.id_User = r.owner_id
      WHERE u.status = 'inactive' AND u.role IN ('driver', 'restaurant_owner')
      ORDER BY u.created_at ASC
    `);

    res.json(partnersResult.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách đối tác chờ duyệt', error: error.message });
  }
};

exports.approvePartner = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    const userRes = await pool.request()
      .input('id', id)
      .query("SELECT role, fullName FROM [User] WHERE id_User = @id AND status = 'inactive'");

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đối tác cần duyệt!' });
    }

    const user = userRes.recordset[0];

    await pool.request()
      .input('id', id)
      .query("UPDATE [User] SET status = 'active', updated_at = GETDATE() WHERE id_User = @id");

    // Add push notification for them
    await pool.request()
      .input('id_User', id)
      .input('title', 'Đối tác đã được phê duyệt!')
      .input('body', 'Tài khoản đối tác của bạn đã được Admin xác minh và kích hoạt. Chào mừng bạn!')
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
        VALUES (@id_User, @title, @body, 'system', 0, GETDATE())
      `);

    await createLog(pool, req.user.id, 'APPROVE_PARTNER', 'User', id, { status: 'inactive' }, { status: 'active' });

    res.json({ message: `Đã duyệt kích hoạt tài khoản cho đối tác ${user.fullName}!` });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi duyệt đối tác', error: error.message });
  }
};

exports.rejectPartner = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const pool = await poolPromise;

    const userRes = await pool.request()
      .input('id', id)
      .query("SELECT fullName FROM [User] WHERE id_User = @id");

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đối tác!' });
    }

    await pool.request()
      .input('id', id)
      .query("UPDATE [User] SET status = 'banned', updated_at = GETDATE() WHERE id_User = @id");

    await createLog(pool, req.user.id, 'REJECT_PARTNER', 'User', id, { status: 'inactive' }, { status: 'banned', reject_reason: reason });

    res.json({ message: 'Từ chối đăng ký và khoá tài khoản đối tác thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi từ chối đối tác', error: error.message });
  }
};

// 4. System Configurations (Operation, Logistics, Payment, UI & Notification)
exports.getConfigs = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM SystemConfig ORDER BY category, config_key');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy cấu hình hệ thống', error: error.message });
  }
};

exports.updateConfigs = async (req, res) => {
  const configs = req.body; // Expecting an array of: [{ config_key, config_value, is_enabled }]
  if (!Array.isArray(configs)) {
    return res.status(400).json({ message: 'Định dạng cấu hình không hợp lệ. Phải là một mảng!' });
  }

  try {
    const pool = await poolPromise;
    const mssql = require('mssql');
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of configs) {
        await transaction.request()
          .input('key', item.config_key)
          .input('val', String(item.config_value))
          .input('enabled', item.is_enabled ? 1 : 0)
          .query(`
            UPDATE SystemConfig 
            SET config_value = @val, is_enabled = @enabled, updated_at = GETDATE()
            WHERE config_key = @key
          `);
      }

      await transaction.commit();
      await createLog(pool, req.user.id, 'UPDATE_SYSTEM_CONFIGS', 'SystemConfig', null, null, configs);
      res.json({ message: 'Cấu hình hệ thống được lưu thành công!' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật cấu hình hệ thống', error: error.message });
  }
};

// 5. Complaints
exports.getComplaints = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      DECLARE @resFeePercent FLOAT = ISNULL((SELECT MAX(CAST(config_value AS FLOAT)) FROM SystemConfig WHERE config_key = 'op_service_fee_percent'), 15.0);
      DECLARE @shipFeePercent FLOAT = ISNULL((SELECT MAX(CAST(config_value AS FLOAT)) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'), 5.0);

      SELECT 
        c.id_Complaint, c.id_Order, c.id_User, c.type, c.description, c.status, c.resolution, c.image, c.video, c.created_At, c.resolved_At, c.handled_By,
        c.comp_customer_amount,
        ROUND(c.comp_driver_amount / (1.0 + @shipFeePercent / 100.0), 0) as comp_driver_amount,
        ROUND(c.comp_restaurant_amount / (1.0 + @resFeePercent / 100.0), 0) as comp_restaurant_amount,
        sender.fullName AS sender_name, sender.phone AS sender_phone, sender.role AS sender_role,
        cust.fullName AS customer_name, cust.phone AS customer_phone,
        driv.fullName AS driver_name, driv.phone AS driver_phone,
        rest.name_Restaurant AS restaurant_name, own.fullName AS owner_name, own.phone AS owner_phone,
        o.order_Code, o.total_Amount, o.shipping_Fee, o.created_At AS order_date,
        a.fullName AS admin_name
      FROM Complaint c
      JOIN [User] sender ON c.id_User = sender.id_User
      JOIN [Order] o ON c.id_Order = o.id_Order
      JOIN [User] cust ON o.id_User = cust.id_User
      LEFT JOIN Driver d ON o.id_Driver = d.id_Driver
      LEFT JOIN [User] driv ON d.id_User = driv.id_User
      LEFT JOIN Restaurant rest ON o.id_Restaurant = rest.id_Restaurant
      LEFT JOIN [User] own ON rest.owner_id = own.id_User
      LEFT JOIN [User] a ON c.handled_By = a.id_User
      ORDER BY c.created_At DESC
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách khiếu nại', error: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  const { id } = req.params;
  const { status, resolution, compCustomerAmount, compDriverAmount, compRestaurantAmount } = req.body; // status: 'resolved' or 'rejected'

  if (!status || !resolution) {
    return res.status(400).json({ message: 'Vui lòng cung cấp phương án và trạng thái giải quyết!' });
  }

  try {
    const pool = await poolPromise;

    // Check complaint exists
    const checkComp = await pool.request()
      .input('id', id)
      .query('SELECT status, id_User, id_Order, type, description FROM Complaint WHERE id_Complaint = @id');

    if (checkComp.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn khiếu nại!' });
    }

    const complaint = checkComp.recordset[0];

    await pool.request()
      .input('id', id)
      .input('status', status)
      .input('resolution', resolution)
      .input('admin_id', req.user.id)
      .input('comp_customer_amount', status === 'resolved' ? (parseFloat(compCustomerAmount) || 0) : 0)
      .input('comp_driver_amount', status === 'resolved' ? (parseFloat(compDriverAmount) || 0) : 0)
      .input('comp_restaurant_amount', status === 'resolved' ? (parseFloat(compRestaurantAmount) || 0) : 0)
      .query(`
        UPDATE Complaint
        SET status = @status, 
            resolution = @resolution, 
            handled_By = @admin_id, 
            resolved_At = GETDATE(),
            comp_customer_amount = @comp_customer_amount,
            comp_driver_amount = @comp_driver_amount,
            comp_restaurant_amount = @comp_restaurant_amount
        WHERE id_Complaint = @id
      `);

    // Nếu khiếu nại được phê duyệt (resolved) và là loại báo cáo từ tài xế với lý do bom hàng
    if (status === 'resolved' && complaint.type === 'Shipper Report') {
      const boomReasons = ['không liên hệ được', 'từ chối nhận', 'bom hàng', 'bom đơn', 'bùng hàng', 'bùng đơn'];
      const isBoom = boomReasons.some(reason => complaint.description && complaint.description.toLowerCase().includes(reason));
      
      if (isBoom && complaint.id_Order) {
        const { chargeBoomOrder } = require('./orderController');
        await chargeBoomOrder(pool, complaint.id_Order);
      }
    }

    // Xử lý bồi hoàn tài chính đa đối tượng (nếu có)
    const custAmt = parseFloat(compCustomerAmount) || 0;
    const drivAmt = parseFloat(compDriverAmount) || 0;
    const restAmt = parseFloat(compRestaurantAmount) || 0;
    const totalPayout = custAmt + drivAmt + restAmt;

    if (status === 'resolved' && totalPayout > 0) {
      // Truy vấn thông tin các đối tác liên quan đến đơn hàng
      const orderQuery = await pool.request()
        .input('id_Order', complaint.id_Order)
        .query(`
          SELECT 
            o.id_Order, o.order_Code, o.id_User AS customer_id, d.id_User AS driver_id,
            own.id_User AS owner_id, rest.name_Restaurant AS restaurant_name
          FROM [Order] o
          LEFT JOIN Driver d ON o.id_Driver = d.id_Driver
          LEFT JOIN Restaurant rest ON o.id_Restaurant = rest.id_Restaurant
          LEFT JOIN [User] own ON rest.owner_id = own.id_User
          WHERE o.id_Order = @id_Order
        `);
        
        if (orderQuery.recordset.length > 0) {
          const orderInfo = orderQuery.recordset[0];
          
          // Lấy cấu hình phí dịch vụ và phí giao hàng hệ thống để tính gốc và hoa hồng
          const resFeePercentRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
          const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
          
          const configRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'");
          const feePercent = configRes.recordset[0].fee_percent;

          // Tính toán số gốc và hoa hồng
          const drivAmtBase = drivAmt > 0 ? Math.round(drivAmt / (1.0 + feePercent / 100.0)) : 0;
          const drivCommission = drivAmt - drivAmtBase;

          const restAmtBase = restAmt > 0 ? Math.round(restAmt / (1.0 + resFeePercent / 100.0)) : 0;
          const restCommission = restAmt - restAmtBase;

          const totalCommission = drivCommission + restCommission;

          const transaction = pool.transaction();
          
          try {
            await transaction.begin();
            
            // 1. Trừ tiền ví Admin (hệ thống) theo tổng số tiền đền bù trước
            const adminRes = await transaction.request()
              .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = 1');
            const adminBefore = parseFloat(adminRes.recordset[0].wallet_balance || 0);
            const adminAfterPayout = adminBefore - totalPayout;
            
            await transaction.request()
              .input('balance', adminAfterPayout)
              .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = 1');
              
            const adminNote = `Bồi hoàn khiếu nại #${id} đơn #${orderInfo.order_Code}: Khách (+${custAmt.toLocaleString('vi-VN')}đ), Tài xế (+${drivAmt.toLocaleString('vi-VN')}đ), Nhà hàng (+${restAmt.toLocaleString('vi-VN')}đ)`;
            await transaction.request()
              .input('id_Order', complaint.id_Order)
              .input('amount', -totalPayout)
              .input('balance_before', adminBefore)
              .input('balance_after', adminAfterPayout)
              .input('note', adminNote)
              .query(`
                INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                VALUES (1, @id_Order, 'payout', @amount, @balance_before, @balance_after, @note, GETDATE())
              `);

            let adminFinalBalance = adminAfterPayout;

            // 1.5 Cộng lại tiền hoa hồng (chiết khấu) thu hồi chuyển về ví Admin
            if (totalCommission > 0) {
              const adminAfterCommission = adminAfterPayout + totalCommission;
              await transaction.request()
                .input('balance', adminAfterCommission)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = 1');
                
              const commissionNote = `Thu hồi hoa hồng từ bồi hoàn khiếu nại #${id} đơn #${orderInfo.order_Code}: Tài xế (+${drivCommission.toLocaleString('vi-VN')}đ), Nhà hàng (+${restCommission.toLocaleString('vi-VN')}đ)`;
              await transaction.request()
                .input('id_Order', complaint.id_Order)
                .input('amount', totalCommission)
                .input('balance_before', adminAfterPayout)
                .input('balance_after', adminAfterCommission)
                .input('note', commissionNote)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (1, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
              adminFinalBalance = adminAfterCommission;
            }

            // 2. Bồi hoàn cho Khách hàng
            if (custAmt > 0 && orderInfo.customer_id) {
              const custRes = await transaction.request()
                .input('uid', orderInfo.customer_id)
                .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @uid');
              const custBefore = parseFloat(custRes.recordset[0].wallet_balance || 0);
              const custAfter = custBefore + custAmt;
              
              await transaction.request()
                .input('uid', orderInfo.customer_id)
                .input('balance', custAfter)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @uid');
                
              await transaction.request()
                .input('uid', orderInfo.customer_id)
                .input('id_Order', complaint.id_Order)
                .input('amount', custAmt)
                .input('balance_before', custBefore)
                .input('balance_after', custAfter)
                .input('note', `Nhận bồi hoàn khiếu nại đơn #${orderInfo.order_Code}: ${resolution}`)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@uid, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              await transaction.request()
                .input('uid', orderInfo.customer_id)
                .input('body', `Ví của bạn đã được bồi hoàn ${custAmt.toLocaleString('vi-VN')} đ cho khiếu nại đơn #${orderInfo.order_Code}.`)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  VALUES (@uid, N'Nhận tiền bồi hoàn', @body, 'WALLET', 0, GETDATE())
                `);
            }

            // 3. Bồi hoàn cho Tài xế (Chỉ nhận đúng số tiền gốc drivAmtBase)
            if (drivAmtBase > 0 && orderInfo.driver_id) {
              const drivRes = await transaction.request()
                .input('uid', orderInfo.driver_id)
                .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @uid');
              const drivBefore = parseFloat(drivRes.recordset[0].wallet_balance || 0);
              const drivAfter = drivBefore + drivAmtBase;
              
              await transaction.request()
                .input('uid', orderInfo.driver_id)
                .input('balance', drivAfter)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @uid');
                
              const driverNote = `Nhận bồi dưỡng/đền bù khiếu nại đơn #${orderInfo.order_Code} (Gốc: ${drivAmtBase.toLocaleString('vi-VN')}đ, Hoa hồng hệ thống thu hồi: -${drivCommission.toLocaleString('vi-VN')}đ)`;
              await transaction.request()
                .input('uid', orderInfo.driver_id)
                .input('id_Order', complaint.id_Order)
                .input('amount', drivAmtBase)
                .input('balance_before', drivBefore)
                .input('balance_after', drivAfter)
                .input('note', driverNote)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@uid, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              await transaction.request()
                .input('uid', orderInfo.driver_id)
                .input('body', `Ví của bạn đã được đền bù ${drivAmtBase.toLocaleString('vi-VN')} đ cho sự cố đơn #${orderInfo.order_Code}.`)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  VALUES (@uid, N'Nhận tiền đền bù', @body, 'WALLET', 0, GETDATE())
                `);
            }

            // 4. Bồi hoàn cho Nhà hàng (Chủ nhà hàng) (Chỉ nhận đúng số tiền gốc restAmtBase)
            if (restAmtBase > 0 && orderInfo.owner_id) {
              const ownerRes = await transaction.request()
                .input('uid', orderInfo.owner_id)
                .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @uid');
              const ownerBefore = parseFloat(ownerRes.recordset[0].wallet_balance || 0);
              const ownerAfter = ownerBefore + restAmtBase;
              
              await transaction.request()
                .input('uid', orderInfo.owner_id)
                .input('balance', ownerAfter)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @uid');
                
              const restaurantNote = `Nhận hỗ trợ/đền bù tổn thất khiếu nại đơn #${orderInfo.order_Code} (Gốc: ${restAmtBase.toLocaleString('vi-VN')}đ, Hoa hồng hệ thống thu hồi: -${restCommission.toLocaleString('vi-VN')}đ)`;
              await transaction.request()
                .input('uid', orderInfo.owner_id)
                .input('id_Order', complaint.id_Order)
                .input('amount', restAmtBase)
                .input('balance_before', ownerBefore)
                .input('balance_after', ownerAfter)
                .input('note', restaurantNote)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@uid, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              await transaction.request()
                .input('uid', orderInfo.owner_id)
                .input('body', `Ví cửa hàng của bạn đã được đền bù ${restAmtBase.toLocaleString('vi-VN')} đ cho sự cố đơn #${orderInfo.order_Code}.`)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  VALUES (@uid, N'Nhận tiền đền bù', @body, 'WALLET', 0, GETDATE())
                `);
            }
          
          await transaction.commit();
        } catch (txErr) {
          await transaction.rollback();
          console.error('Error during compensation transaction:', txErr);
          throw txErr;
        }
      }
    }

    // Notify user (sender of complaint)
    await pool.request()
      .input('id_User', complaint.id_User)
      .input('title', 'Khiếu nại của bạn đã được giải quyết')
      .input('body', 'Phản hồi khiếu nại: ' + resolution)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
        VALUES (@id_User, @title, @body, 'system', 0, GETDATE())
      `);

    await createLog(pool, req.user.id, 'RESOLVE_COMPLAINT', 'Complaint', id, complaint, { status, resolution });

    res.json({ message: 'Giải quyết khiếu nại thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi giải quyết khiếu nại', error: error.message });
  }
};

// 6. Category Management
exports.getCategories = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Category ORDER BY display_order ASC, name ASC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh mục món ăn', error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  const { name, icon, display_order, is_active } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Tên danh mục là bắt buộc!' });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('name', name)
      .input('icon', icon || null)
      .input('display_order', display_order !== undefined ? display_order : 0)
      .input('is_active', is_active !== undefined ? (is_active ? 1 : 0) : 1)
      .query(`
        INSERT INTO Category (name, icon, display_order, is_active)
        OUTPUT inserted.id_Category
        VALUES (@name, @icon, @display_order, @is_active)
      `);

    const newId = result.recordset[0].id_Category;
    await createLog(pool, req.user.id, 'CREATE_CATEGORY', 'Category', newId, null, { name, icon, display_order, is_active });

    res.status(201).json({ message: 'Tạo danh mục món ăn thành công!', id_Category: newId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo danh mục', error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, icon, display_order, is_active } = req.body;

  try {
    const pool = await poolPromise;

    const oldRes = await pool.request()
      .input('id', id)
      .query('SELECT name, icon, display_order, is_active FROM Category WHERE id_Category = @id');

    if (oldRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy danh mục!' });
    }

    await pool.request()
      .input('id', id)
      .input('name', name)
      .input('icon', icon || null)
      .input('display_order', display_order !== undefined ? display_order : 0)
      .input('is_active', is_active !== undefined ? (is_active ? 1 : 0) : 1)
      .query(`
        UPDATE Category
        SET name = @name, icon = @icon, display_order = @display_order, is_active = @is_active
        WHERE id_Category = @id
      `);

    await createLog(pool, req.user.id, 'UPDATE_CATEGORY', 'Category', id, oldRes.recordset[0], { name, icon, display_order, is_active });

    res.json({ message: 'Cập nhật danh mục thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật danh mục', error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    // Check if category has foods connected to it
    const foodCheck = await pool.request()
      .input('id', id)
      .query('SELECT COUNT(*) AS count FROM Food WHERE id_Category = @id');

    if (foodCheck.recordset[0].count > 0) {
      // If has foods, toggle active status instead of delete to keep database relational constraints
      await pool.request()
        .input('id', id)
        .query('UPDATE Category SET is_active = 0 WHERE id_Category = @id');

      await createLog(pool, req.user.id, 'DEACTIVATE_CATEGORY', 'Category', id, { is_active: 1 }, { is_active: 0 });
      return res.json({ message: 'Danh mục đang có món ăn trực thuộc nên hệ thống đã ẩn danh mục này thay vì xóa!' });
    }

    await pool.request()
      .input('id', id)
      .query('DELETE FROM Category WHERE id_Category = @id');

    await createLog(pool, req.user.id, 'DELETE_CATEGORY', 'Category', id, null, null);
    res.json({ message: 'Đã xoá danh mục thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xoá danh mục', error: error.message });
  }
};

// 7. Hot Campaigns & Promotions
exports.getCampaigns = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Promotion ORDER BY star_Date DESC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy chương trình khuyến mãi', error: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  const { code, type, value, min_OrderValue, max_Discount, usage_Limit, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To, sys_funding_percent, res_funding_percent, usage_limit_per_user } = req.body;
  if (!code || !type || !value) {
    return res.status(400).json({ message: 'Mã, Loại và Giá trị khuyến mãi là bắt buộc!' });
  }

  // Safe helper to parse dates and prevent node-mssql 'Invalid Date' crash
  const parseDate = (dStr) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  try {
    const pool = await poolPromise;

    const checkRes = await pool.request()
      .input('code', code)
      .query('SELECT id_Promo FROM Promotion WHERE code = @code');

    if (checkRes.recordset.length > 0) {
      return res.status(400).json({ message: 'Mã khuyến mãi này đã tồn tại!' });
    }

    const result = await pool.request()
      .input('code', code)
      .input('type', type)
      .input('value', Number(value))
      .input('min_OrderValue', min_OrderValue ? Number(min_OrderValue) : null)
      .input('max_Discount', max_Discount ? Number(max_Discount) : null)
      .input('usage_Limit', usage_Limit ? Number(usage_Limit) : null)
      .input('star_Date', parseDate(star_Date))
      .input('end_Date', parseDate(end_Date))
      .input('is_hot', is_hot ? 1 : 0)
      .input('id_Restaurant', id_Restaurant ? Number(id_Restaurant) : null)
      .input('is_Applicable_To', is_Applicable_To || 'all')
      .input('sys_funding_percent', sys_funding_percent ? Number(sys_funding_percent) : 100)
      .input('res_funding_percent', res_funding_percent ? Number(res_funding_percent) : 0)
      .input('usage_limit_per_user', usage_limit_per_user ? Number(usage_limit_per_user) : 1)
      .query(`
        INSERT INTO Promotion (code, type, value, min_OrderValue, max_Discount, usage_Limit, used_Count, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To, sys_funding_percent, res_funding_percent, usage_limit_per_user)
        OUTPUT inserted.id_Promo
        VALUES (@code, @type, @value, @min_OrderValue, @max_Discount, @usage_Limit, 0, @star_Date, @end_Date, @is_hot, @id_Restaurant, @is_Applicable_To, @sys_funding_percent, @res_funding_percent, @usage_limit_per_user)
      `);

    const newId = result.recordset[0].id_Promo;
    await createLog(pool, req.user.id, 'CREATE_PROMOTION', 'Promotion', newId, null, req.body);

    res.status(201).json({ message: 'Tạo chương trình khuyến mãi mới thành công!', id_Promo: newId });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ message: 'Lỗi tạo khuyến mãi', error: error.message });
  }
};

exports.toggleHotCampaign = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;

    const oldRes = await pool.request()
      .input('id', id)
      .query('SELECT is_hot, code FROM Promotion WHERE id_Promo = @id');

    if (oldRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy khuyến mãi!' });
    }

    const oldVal = oldRes.recordset[0];
    const newHot = oldVal.is_hot ? 0 : 1;

    await pool.request()
      .input('id', id)
      .input('newHot', newHot)
      .query('UPDATE Promotion SET is_hot = @newHot WHERE id_Promo = @id');

    await createLog(pool, req.user.id, 'TOGGLE_HOT_CAMPAIGN', 'Promotion', id, oldVal, { is_hot: newHot });

    res.json({ message: `Đã ${newHot ? 'bật' : 'tắt'} cấu hình chương trình Hot hệ thống cho mã ${oldVal.code}!` });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi kích hoạt hot campaign', error: error.message });
  }
};

exports.updateCampaign = async (req, res) => {
  const { id } = req.params;
  const { code, type, value, min_OrderValue, max_Discount, usage_Limit, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To, sys_funding_percent, res_funding_percent, usage_limit_per_user } = req.body;

  if (!code || !type || !value) {
    return res.status(400).json({ message: 'Mã, Loại và Giá trị khuyến mãi là bắt buộc!' });
  }

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? null : d;
  };

  try {
    const pool = await poolPromise;

    const existRes = await pool.request()
      .input('id', id)
      .query('SELECT * FROM Promotion WHERE id_Promo = @id');

    if (existRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy mã khuyến mãi!' });
    }

    // Check duplicate code (exclude self)
    const dupRes = await pool.request()
      .input('code', code)
      .input('id', id)
      .query('SELECT id_Promo FROM Promotion WHERE code = @code AND id_Promo <> @id');

    if (dupRes.recordset.length > 0) {
      return res.status(400).json({ message: 'Mã khuyến mãi này đã được sử dụng bởi chiến dịch khác!' });
    }

    const oldVal = existRes.recordset[0];

    await pool.request()
      .input('id', id)
      .input('code', code)
      .input('type', type)
      .input('value', Number(value))
      .input('min_OrderValue', min_OrderValue ? Number(min_OrderValue) : null)
      .input('max_Discount', max_Discount ? Number(max_Discount) : null)
      .input('usage_Limit', usage_Limit ? Number(usage_Limit) : null)
      .input('star_Date', parseDate(star_Date))
      .input('end_Date', parseDate(end_Date))
      .input('is_hot', is_hot ? 1 : 0)
      .input('id_Restaurant', id_Restaurant ? Number(id_Restaurant) : null)
      .input('is_Applicable_To', is_Applicable_To || 'all')
      .input('sys_funding_percent', sys_funding_percent ? Number(sys_funding_percent) : 100)
      .input('res_funding_percent', res_funding_percent ? Number(res_funding_percent) : 0)
      .input('usage_limit_per_user', usage_limit_per_user ? Number(usage_limit_per_user) : 1)
      .query(`
        UPDATE Promotion SET
          code = @code,
          type = @type,
          value = @value,
          min_OrderValue = @min_OrderValue,
          max_Discount = @max_Discount,
          usage_Limit = @usage_Limit,
          star_Date = @star_Date,
          end_Date = @end_Date,
          is_hot = @is_hot,
          id_Restaurant = @id_Restaurant,
          is_Applicable_To = @is_Applicable_To,
          sys_funding_percent = @sys_funding_percent,
          res_funding_percent = @res_funding_percent,
          usage_limit_per_user = @usage_limit_per_user
        WHERE id_Promo = @id
      `);

    await createLog(pool, req.user.id, 'UPDATE_PROMOTION', 'Promotion', id, oldVal, req.body);

    res.json({ message: 'Cập nhật chiến dịch khuyến mãi thành công!' });
  } catch (error) {
    console.error('Error updating promotion:', error);
    res.status(500).json({ message: 'Lỗi cập nhật khuyến mãi', error: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  const { id } = req.params;
  console.log('--- BACKEND CAMPAIGN DELETE DEBUG ---');
  console.log('Attempting to delete campaign with ID:', id);
  try {
    const pool = await poolPromise;

    const existRes = await pool.request()
      .input('id', id)
      .query('SELECT code, used_Count FROM Promotion WHERE id_Promo = @id');

    if (existRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy mã khuyến mãi!' });
    }

    const campaign = existRes.recordset[0];

    // Check if referenced in Order_Promotion
    const refCheck = await pool.request()
      .input('id', id)
      .query('SELECT COUNT(*) AS count FROM Order_Promotion WHERE id_Promo = @id');

    if (refCheck.recordset[0].count > 0) {
      // If referenced, soft-deactivate by setting end_Date to yesterday and matching usage_Limit to used_Count
      await pool.request()
        .input('id', id)
        .query(`
          UPDATE Promotion 
          SET end_Date = DATEADD(day, -1, GETDATE()), usage_Limit = used_Count 
          WHERE id_Promo = @id
        `);

      await createLog(pool, req.user.id, 'DEACTIVATE_PROMOTION', 'Promotion', id, campaign, { end_Date: 'expired', usage_Limit: 'capped' });
      return res.json({ message: 'Chiến dịch này đang được liên kết với lịch sử đơn hàng. Hệ thống đã tự động kết thúc chiến dịch để bảo toàn dữ liệu!' });
    }

    // Otherwise, safe to hard delete
    await pool.request()
      .input('id', id)
      .query('DELETE FROM Promotion WHERE id_Promo = @id');

    await createLog(pool, req.user.id, 'DELETE_PROMOTION', 'Promotion', id, campaign, null);

    res.json({ message: `Đã xóa chiến dịch khuyến mãi mã "${campaign.code}" thành công!` });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ message: 'Lỗi xóa khuyến mãi', error: error.message });
  }
};

exports.getAdminNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;

    // 1. Query pending partners
    const partnersResult = await pool.request().query(`
      SELECT id_User, fullName, phone, role, created_at
      FROM [User]
      WHERE status = 'inactive' AND role IN ('driver', 'restaurant_owner')
      ORDER BY created_at DESC
    `);

    // 2. Query pending complaints
    const complaintsResult = await pool.request().query(`
      SELECT c.id_Complaint, c.description, c.created_At, o.order_Code, u.fullName AS customer_name
      FROM Complaint c
      JOIN [User] u ON c.id_User = u.id_User
      JOIN [Order] o ON c.id_Order = o.id_Order
      WHERE c.status = 'pending'
      ORDER BY c.created_At DESC
    `);

    const notifications = [];

    // Map partners
    partnersResult.recordset.forEach(p => {
      notifications.push({
        id: `partner_${p.id_User}`,
        title: `Đăng ký ${p.role === 'driver' ? 'Shipper' : 'Nhà hàng'} mới`,
        desc: `${p.fullName} (${p.phone}) đang chờ phê duyệt`,
        type: 'partner',
        read: false,
        created_at: p.created_at
      });
    });

    // Map complaints
    complaintsResult.recordset.forEach(c => {
      notifications.push({
        id: `complaint_${c.id_Complaint}`,
        title: 'Khiếu nại chưa xử lý',
        desc: `Đơn #${c.order_Code}: ${c.description}`,
        type: 'complaint',
        read: false,
        created_at: c.created_At
      });
    });

    // Sort by created_at desc
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      notifications,
      unreadCounts: {
        partners: partnersResult.recordset.length,
        complaints: complaintsResult.recordset.length
      }
    });

  } catch (error) {
    console.error('Error fetching admin notifications:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông báo admin', error: error.message });
  }
};

// 8. Admin Wallet Management
exports.getWallet = async (req, res) => {
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    
    // Fetch current wallet balance
    const userRes = await pool.request()
      .input('userId', userId)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @userId');
      
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng admin' });
    }
    
    const balance = parseFloat(userRes.recordset[0].wallet_balance) || 0;
    
    // Fetch all transactions
    const txRes = await pool.request()
      .input('userId', userId)
      .query('SELECT * FROM Wallet_Transaction WHERE id_User = @userId ORDER BY created_At DESC');
      
    // Fetch total commissions collected
    const collectedRes = await pool.request()
      .input('userId', userId)
      .query("SELECT SUM(amount) AS total FROM Wallet_Transaction WHERE id_User = @userId AND transaction_type = 'commission_deduction'");
      
    // Fetch total complaint payouts
    const refundedRes = await pool.request()
      .input('userId', userId)
      .query("SELECT SUM(amount) AS total FROM Wallet_Transaction WHERE id_User = @userId AND transaction_type = 'refund'");
      
    // Fetch total withdrawals
    const withdrawnRes = await pool.request()
      .input('userId', userId)
      .query("SELECT SUM(amount) AS total FROM Wallet_Transaction WHERE id_User = @userId AND transaction_type = 'withdraw'");

    res.json({
      balance,
      transactions: txRes.recordset,
      stats: {
        totalCollected: parseFloat(collectedRes.recordset[0].total) || 0,
        totalRefunded: Math.abs(parseFloat(refundedRes.recordset[0].total) || 0),
        totalWithdrawn: Math.abs(parseFloat(withdrawnRes.recordset[0].total) || 0)
      }
    });
  } catch (error) {
    console.error('Error in getWallet:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin ví', error: error.message });
  }
};

exports.withdrawWallet = async (req, res) => {
  const userId = req.user.id;
  const { amount, bankName, accountNumber, accountName } = req.body;
  
  const withdrawAmount = parseFloat(amount);
  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ message: 'Số tiền rút không hợp lệ' });
  }
  
  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin tài khoản ngân hàng' });
  }
  
  try {
    const pool = await poolPromise;
    
    // 1. Get current balance
    const userRes = await pool.request()
      .input('userId', userId)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @userId');
      
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản admin' });
    }
    
    const currentBalance = parseFloat(userRes.recordset[0].wallet_balance) || 0;
    if (currentBalance < withdrawAmount) {
      return res.status(400).json({ message: 'Số dư ví hệ thống không đủ để thực hiện yêu cầu rút tiền này!' });
    }
    
    const newBalance = currentBalance - withdrawAmount;
    const note = `Rút tiền về tài khoản ngân hàng ${bankName} (${accountNumber}) - Chủ TK: ${accountName}`;
    
    // 2. Perform updates inside a transaction
    const transaction = pool.transaction();
    await transaction.begin();
    try {
      // Update User Balance
      await transaction.request()
        .input('userId', userId)
        .input('withdrawAmount', withdrawAmount)
        .query('UPDATE [User] SET wallet_balance = wallet_balance - @withdrawAmount WHERE id_User = @userId');
        
      // Insert Transaction Log
      await transaction.request()
        .input('userId', userId)
        .input('amount', -withdrawAmount)
        .input('balanceBefore', currentBalance)
        .input('balanceAfter', newBalance)
        .input('note', note)
        .query(`
          INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@userId, 'withdraw', @amount, @balanceBefore, @balanceAfter, @note, GETDATE())
        `);
        
      // Create admin system log for auditing
      await createLog(transaction, userId, 'WALLET_WITHDRAWAL', 'User', userId, { balance: currentBalance }, { balance: newBalance, amount: withdrawAmount, bankName, accountNumber });
      
      await transaction.commit();
      
      res.json({
        success: true,
        message: `Đã thực hiện rút ${withdrawAmount.toLocaleString('vi-VN')}đ về tài khoản ngân hàng ${bankName} thành công!`,
        balance: newBalance
      });
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error in withdrawWallet:', error);
    res.status(500).json({ message: 'Lỗi server khi thực hiện rút tiền', error: error.message });
  }
};

exports.getLogisticsData = async (req, res) => {
  try {
    const pool = await poolPromise;
    
    // 1. Fetch active orders
    const ordersResult = await pool.request().query(`
      SELECT o.id_Order, o.order_Status AS status, o.total_Amount, o.shipping_Fee, o.created_At, o.id_Restaurant,
             r.name_Restaurant AS restaurant_name, u.fullName AS customer_name, o.id_Driver, d.fullName AS driver_name
      FROM [Order] o
      LEFT JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
      LEFT JOIN [User] u ON o.id_User = u.id_User
      LEFT JOIN [User] d ON o.id_Driver = d.id_User
      WHERE o.order_Status NOT IN ('completed', 'cancelled')
      ORDER BY o.created_At DESC
    `);
    
    // 2. Fetch all drivers (shippers)
    const driversResult = await pool.request().query(`
      SELECT id_User, fullName, email, status, avatar
      FROM [User]
      WHERE role = 'driver'
    `);
    
    // 3. Compute stats
    const activeOrdersCount = ordersResult.recordset.length;
    const totalDriversCount = driversResult.recordset.length;
    const onlineDriversCount = driversResult.recordset.filter(d => d.status === 'active').length;
    
    // Enrich drivers with operational statuses dynamically: 'busy' if they are currently delivering an active order, else 'online' or 'offline'
    const enrichedDrivers = driversResult.recordset.map(d => {
      const isBusy = ordersResult.recordset.some(o => o.id_Driver === d.id_User && o.status === 'delivering');
      let opStatus = 'offline';
      if (isBusy) {
        opStatus = 'busy';
      } else if (d.status === 'active') {
        opStatus = 'online';
      }
      
      // Seed some realistic simulation stats for driver performance
      const seedSuccessRate = 94 + (d.id_User % 6);
      const seedCancelRate = 100 - seedSuccessRate;
      
      return {
        ...d,
        opStatus,
        successRate: seedSuccessRate,
        cancelRate: seedCancelRate
      };
    });
    
    res.json({
      success: true,
      stats: {
        activeOrders: activeOrdersCount,
        totalDrivers: totalDriversCount,
        onlineDrivers: onlineDriversCount,
        deliveryRate: 98.4
      },
      orders: ordersResult.recordset,
      drivers: enrichedDrivers
    });
  } catch (error) {
    console.error('Error in getLogisticsData:', error);
    res.status(500).json({ message: 'Lỗi lấy dữ liệu tháp điều hành vận đơn', error: error.message });
  }
};

