const { poolPromise } = require('../config/db');

// Xem thông tin cá nhân (đã có ở authController.getMe, nhưng có thể mở rộng)
exports.getProfile = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', req.user.id)
      .query(`
        SELECT u.id_User, u.phone, u.fullName, u.email, u.avatar, u.role, u.reputation_score, u.default_Address_Id, u.total_orders, a.full_Address AS default_Address_Text
        FROM [User] u
        LEFT JOIN Address a ON u.default_Address_Id = a.id_Address
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

// Cập nhật thông tin cá nhân
exports.updateProfile = async (req, res) => {
  const { fullName, email, avatar } = req.body;
  try {
    const pool = await poolPromise;
    
    let query = `
      UPDATE [User] 
      SET fullName = @fullName, email = @email, updated_at = GETDATE()
    `;
    const request = pool.request()
      .input('id', req.user.id)
      .input('fullName', fullName)
      .input('email', email || null);

    if (avatar !== undefined) {
      query += `, avatar = @avatar`;
      request.input('avatar', avatar || 'default-avatar.png');
    }

    query += ` WHERE id_User = @id`;

    await request.query(query);

    res.json({ message: 'Cập nhật thông tin thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// ============================================
// ĐỊA CHỈ (ADDRESS)
// ============================================

exports.getAddresses = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_User', req.user.id)
      .query(`
        SELECT * FROM Address 
        WHERE id_User = @id_User
      `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.addAddress = async (req, res) => {
  const { name, phone, full_Address, lat, lng, note, is_Default } = req.body;
  try {
    const pool = await poolPromise;
    
    // Nếu is_Default = 1, set các địa chỉ khác thành 0
    if (is_Default) {
      await pool.request()
        .input('id_User', req.user.id)
        .query(`UPDATE Address SET is_Default = 0 WHERE id_User = @id_User`);
    }

    const result = await pool.request()
      .input('id_User', req.user.id)
      .input('name', name)
      .input('phone', phone)
      .input('full_Address', full_Address)
      .input('lat', lat || null)
      .input('lng', lng || null)
      .input('note', note || null)
      .input('is_Default', is_Default ? 1 : 0)
      .query(`
        INSERT INTO Address (id_User, name, phone, full_Address, lat, lng, note, is_Default)
        OUTPUT inserted.id_Address
        VALUES (@id_User, @name, @phone, @full_Address, @lat, @lng, @note, @is_Default)
      `);
      
    const newId = result.recordset[0].id_Address;
    
    // Thêm vào bảng User_Address
    await pool.request()
      .input('id_User', req.user.id)
      .input('id_Address', newId)
      .query(`INSERT INTO User_Address (id_User, id_Address) VALUES (@id_User, @id_Address)`);

    // Cập nhật bảng User nếu là default
    if (is_Default) {
      await pool.request()
        .input('id_User', req.user.id)
        .input('id_Address', newId)
        .query(`UPDATE [User] SET default_Address_Id = @id_Address WHERE id_User = @id_User`);
    }

    res.json({ message: 'Thêm địa chỉ thành công', id_Address: newId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  const { id } = req.params;
  const { name, phone, full_Address, lat, lng, note, is_Default } = req.body;
  
  try {
    const pool = await poolPromise;
    
    if (is_Default) {
      await pool.request()
        .input('id_User', req.user.id)
        .query(`UPDATE Address SET is_Default = 0 WHERE id_User = @id_User`);
        
      await pool.request()
        .input('id_User', req.user.id)
        .input('id_Address', id)
        .query(`UPDATE [User] SET default_Address_Id = @id_Address WHERE id_User = @id_User`);
    }

    await pool.request()
      .input('id', id)
      .input('id_User', req.user.id)
      .input('name', name)
      .input('phone', phone)
      .input('full_Address', full_Address)
      .input('lat', lat || null)
      .input('lng', lng || null)
      .input('note', note || null)
      .input('is_Default', is_Default ? 1 : 0)
      .query(`
        UPDATE Address 
        SET name = @name, phone = @phone, full_Address = @full_Address, lat = @lat, lng = @lng, note = @note, is_Default = @is_Default
        WHERE id_Address = @id AND id_User = @id_User
      `);

    res.json({ message: 'Cập nhật địa chỉ thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    
    // Xoá bảng phụ
    await pool.request()
      .input('id_User', req.user.id)
      .input('id_Address', id)
      .query(`DELETE FROM User_Address WHERE id_User = @id_User AND id_Address = @id_Address`);
      
    // Xóa bảng chính
    await pool.request()
      .input('id_User', req.user.id)
      .input('id', id)
      .query(`DELETE FROM Address WHERE id_Address = @id AND id_User = @id_User`);

    res.json({ message: 'Xóa địa chỉ thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// ============================================
// VOUCHER
// ============================================
exports.getVouchers = async (req, res) => {
  const { id_Restaurant } = req.query;
  try {
    const pool = await poolPromise;
    
    // 1. Lấy Vouchers cá nhân trong ví của user kết hợp thông tin cấu hình từ Promotion
    const vouchersResult = await pool.request()
      .input('id_User', req.user.id)
      .query(`
        SELECT v.id_Voucher, v.code, v.value, v.expiry_date,
               p.id_Promo, p.type, p.min_OrderValue, p.max_Discount, p.id_Restaurant
        FROM Voucher v
        JOIN User_Voucher uv ON v.id_Voucher = uv.id_Voucher
        LEFT JOIN Promotion p ON v.code = p.code
        WHERE uv.id_User = @id_User AND v.used = 0 AND v.expiry_date >= GETDATE()
      `);
      
    // 2. Chuẩn hóa dữ liệu trả về
    let list = vouchersResult.recordset.map(v => {
      const type = v.type || 'fixed';
      const min_OrderValue = v.min_OrderValue !== null ? Number(v.min_OrderValue) : 0;
      const max_Discount = v.max_Discount !== null ? Number(v.max_Discount) : Number(v.value);
      const id_Restaurant_Promo = v.id_Restaurant || null;

      return {
        id: `voucher_${v.id_Voucher}`,
        db_id: v.id_Voucher,
        discount_type: 'voucher',
        code: v.code,
        value: Number(v.value),
        type: type, // 'percent', 'fixed', 'freeship'
        min_OrderValue: min_OrderValue,
        max_Discount: max_Discount,
        id_Restaurant: id_Restaurant_Promo,
        end_Date: v.expiry_date
      };
    });

    if (id_Restaurant) {
      list = list.filter(v => v.id_Restaurant === null || Number(v.id_Restaurant) === Number(id_Restaurant));
    }
    
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.claimVoucher = async (req, res) => {
  const { id_Promo } = req.body;
  const id_User = req.user.id;

  try {
    const pool = await poolPromise;
    
    // 1. Lấy thông tin Promotion
    const promoRes = await pool.request()
      .input('id_Promo', id_Promo)
      .query('SELECT * FROM Promotion WHERE id_Promo = @id_Promo');

    if (promoRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy chương trình khuyến mãi!' });
    }

    const promo = promoRes.recordset[0];

    // Kiểm tra thời hạn khuyến mãi
    if (promo.end_Date && new Date(promo.end_Date) < new Date()) {
      return res.status(400).json({ message: 'Voucher này đã hết hạn!' });
    }

    // Kiểm tra giới hạn lượt dùng của promotion
    if (promo.usage_Limit !== null && promo.used_Count >= promo.usage_Limit) {
      return res.status(400).json({ message: 'Voucher này đã hết lượt lưu!' });
    }

    // 2. Kiểm tra xem user đã sở hữu hoặc từng sử dụng voucher này chưa
    const checkRes = await pool.request()
      .input('id_User', id_User)
      .input('code', promo.code)
      .query(`
        SELECT id_Voucher, used FROM Voucher 
        WHERE id_User = @id_User AND code = @code
      `);

    if (checkRes.recordset.length > 0) {
      const existingV = checkRes.recordset[0];
      if (existingV.used) {
        return res.status(400).json({ message: 'Bạn đã sử dụng voucher này cho một đơn hàng trước đó!' });
      } else {
        return res.status(400).json({ message: 'Bạn đã lưu voucher này vào ví rồi!' });
      }
    }

    // 3. Tiến hành lưu Voucher và ánh xạ User_Voucher
    let discountValue = promo.value;

    const mssql = require('mssql');
    const transaction = new mssql.Transaction(pool);
    await transaction.begin();

    try {
      // Thêm vào bảng Voucher
      const voucherInsertRes = await transaction.request()
        .input('id_User', id_User)
        .input('code', promo.code)
        .input('value', discountValue)
        .input('expiry_date', promo.end_Date || new Date(Date.now() + 30*24*60*60*1000))
        .query(`
          INSERT INTO Voucher (id_User, code, value, expiry_date, used)
          VALUES (@id_User, @code, @value, @expiry_date, 0);
          SELECT SCOPE_IDENTITY() AS id_Voucher;
        `);

      const newVoucherId = voucherInsertRes.recordset[0].id_Voucher;

      // Thêm vào bảng User_Voucher
      await transaction.request()
        .input('id_Voucher', newVoucherId)
        .input('id_User', id_User)
        .query(`
          INSERT INTO User_Voucher (id_Voucher, id_User)
          VALUES (@id_Voucher, @id_User)
        `);

      // Tăng lượt dùng Promotion
      await transaction.request()
        .input('id_Promo', id_Promo)
        .query(`
          UPDATE Promotion SET used_Count = used_Count + 1 WHERE id_Promo = @id_Promo
        `);

      await transaction.commit();
      res.json({ message: 'Lưu voucher thành công!', id_Voucher: newVoucherId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

