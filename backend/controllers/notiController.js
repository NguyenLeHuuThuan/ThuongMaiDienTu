const { poolPromise } = require('../config/db');

// Lấy danh sách thông báo
exports.getNotifications = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', req.user.id)
      .query(`
        SELECT n.* 
        FROM Notification n
        JOIN User_Notification un ON n.id_Noti = un.id_Noti
        WHERE un.id_User = @userId
        ORDER BY n.created_At DESC
      `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Đánh dấu đã đọc
exports.markAsRead = async (req, res) => {
  const { id } = req.params; // id_Noti
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id', id)
      .query(`
        UPDATE Notification 
        SET is_Read = 1 
        WHERE id_Noti = @id
      `);
    res.json({ message: 'Đã đánh dấu đọc' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
