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
  try {
    const pool = await poolPromise;

    // A. Overview Counts
    const overviewRes = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM [User] WHERE role = 'customer') AS total_customers,
        (SELECT COUNT(*) FROM [User] WHERE role = 'driver' AND status = 'active') AS active_drivers,
        (SELECT COUNT(*) FROM [User] WHERE role = 'restaurant_owner' AND status = 'active') AS active_restaurants,
        (SELECT COUNT(*) FROM [Order]) AS total_orders,
        (SELECT ISNULL(SUM(total_Amount), 0) FROM [Order] WHERE payment_Status = 'paid') AS total_revenue,
        (SELECT ISNULL(SUM(commission_amount), 0) FROM Commission) AS total_commissions
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

    // D. Revenue by month (dummy database support, using created_At)
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

    res.json({
      overview: overviewRes.recordset[0],
      orderSplit: orderSplitRes.recordset,
      topFoods: topFoodsRes.recordset,
      monthlyRevenue: monthlyRevenueRes.recordset,
      recentLogs: logsRes.recordset
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
      SELECT 
        c.*, 
        u.fullName AS customer_name, u.phone AS customer_phone,
        o.order_Code, o.total_Amount, o.created_At AS order_date,
        a.fullName AS admin_name
      FROM Complaint c
      JOIN [User] u ON c.id_User = u.id_User
      JOIN [Order] o ON c.id_Order = o.id_Order
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
  const { status, resolution } = req.body; // status: 'resolved' or 'rejected'

  if (!status || !resolution) {
    return res.status(400).json({ message: 'Vui lòng cung cấp phương án và trạng thái giải quyết!' });
  }

  try {
    const pool = await poolPromise;

    // Check complaint exists
    const checkComp = await pool.request()
      .input('id', id)
      .query('SELECT status, id_User FROM Complaint WHERE id_Complaint = @id');

    if (checkComp.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn khiếu nại!' });
    }

    const complaint = checkComp.recordset[0];

    await pool.request()
      .input('id', id)
      .input('status', status)
      .input('resolution', resolution)
      .input('admin_id', req.user.id)
      .query(`
        UPDATE Complaint
        SET status = @status, resolution = @resolution, handled_By = @admin_id, resolved_At = GETDATE()
        WHERE id_Complaint = @id
      `);

    // Notify user
    await pool.request()
      .input('id_User', complaint.id_User)
      .input('title', 'Khiếu nại của bạn đã được giải quyết')
      .input('body', 'Phản hồi khiếu nại: ' + resolution)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
        VALUES (@id_User, @title, @body, 'system', 0, GETDATE())
      `);

    await createLog(pool, req.user.id, 'RESOLVE_COMPLAINT', 'Complaint', id, complaint, { status, resolution });

    res.json({ message: 'Giải quyết khiếu nại của khách hàng thành công!' });
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
  const { code, type, value, min_OrderValue, max_Discount, usage_Limit, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To } = req.body;
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
      .query(`
        INSERT INTO Promotion (code, type, value, min_OrderValue, max_Discount, usage_Limit, used_Count, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To)
        OUTPUT inserted.id_Promo
        VALUES (@code, @type, @value, @min_OrderValue, @max_Discount, @usage_Limit, 0, @star_Date, @end_Date, @is_hot, @id_Restaurant, @is_Applicable_To)
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
  const { code, type, value, min_OrderValue, max_Discount, usage_Limit, star_Date, end_Date, is_hot, id_Restaurant, is_Applicable_To } = req.body;

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
          is_Applicable_To = @is_Applicable_To
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
