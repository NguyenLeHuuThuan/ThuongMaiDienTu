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
