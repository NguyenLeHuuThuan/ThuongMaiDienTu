const { poolPromise } = require('../config/db');

// Xem thông tin cá nhân (đã có ở authController.getMe, nhưng có thể mở rộng)
exports.getProfile = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', req.user.id)
      .query(`
        SELECT id_User, phone, fullName, email, avatar, role, reputation_score, default_Address_Id, total_orders 
        FROM [User] 
        WHERE id_User = @id
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
  const { fullName, email } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', req.user.id)
      .input('fullName', fullName)
      .input('email', email)
      .query(`
        UPDATE [User] 
        SET fullName = @fullName, email = @email, updated_at = GETDATE()
        WHERE id_User = @id
      `);

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
    
    // 1. Lấy Vouchers cá nhân của user
    const vouchersResult = await pool.request()
      .input('id_User', req.user.id)
      .query(`
        SELECT v.id_Voucher, v.code, v.value, v.expiry_date
        FROM Voucher v
        JOIN User_Voucher uv ON v.id_Voucher = uv.id_Voucher
        WHERE uv.id_User = @id_User AND v.used = 0 AND v.expiry_date >= GETDATE()
      `);
      
    // 2. Lấy Promotions chung của hệ thống / nhà hàng
    let promotionsQuery = `
      SELECT p.id_Promo, p.code, p.type, p.value, p.min_OrderValue, p.max_Discount, p.end_Date, p.id_Restaurant
      FROM Promotion p
      WHERE (p.usage_Limit IS NULL OR p.used_Count < p.usage_Limit)
        AND (p.star_Date IS NULL OR p.star_Date <= GETDATE())
        AND (p.end_Date IS NULL OR p.end_Date >= GETDATE())
    `;
    
    const promoRequest = pool.request();
    if (id_Restaurant) {
      promotionsQuery += ` AND (p.id_Restaurant = @id_Restaurant OR p.id_Restaurant IS NULL)`;
      promoRequest.input('id_Restaurant', id_Restaurant);
    } else {
      promotionsQuery += ` AND p.id_Restaurant IS NULL`;
    }
    
    const promotionsResult = await promoRequest.query(promotionsQuery);
    
    // 3. Chuẩn hóa dữ liệu trả về
    const list = [
      ...vouchersResult.recordset.map(v => ({
        id: `voucher_${v.id_Voucher}`,
        db_id: v.id_Voucher,
        discount_type: 'voucher',
        code: v.code,
        value: v.value,
        type: 'fixed', // Voucher mặc định giảm số tiền cố định
        min_OrderValue: 0,
        max_Discount: v.value,
        end_Date: v.expiry_date
      })),
      ...promotionsResult.recordset.map(p => ({
        id: `promo_${p.id_Promo}`,
        db_id: p.id_Promo,
        discount_type: 'promotion',
        code: p.code,
        value: p.value,
        type: p.type, // 'percent', 'fixed', 'freeship'
        min_OrderValue: p.min_OrderValue || 0,
        max_Discount: p.max_Discount || null,
        end_Date: p.end_Date
      }))
    ];
    
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
