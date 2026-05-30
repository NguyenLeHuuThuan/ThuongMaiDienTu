const { poolPromise } = require('../config/db');

// Lấy danh sách cuộc trò chuyện của người dùng hiện tại (áp dụng cho cả Customer, Restaurant, Driver)
exports.getConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        WITH LastMessages AS (
          SELECT 
            id_Message, sender_id, receiver_id, message_text, created_at, is_read,
            ROW_NUMBER() OVER (PARTITION BY 
              CASE WHEN sender_id = @userId THEN receiver_id ELSE sender_id END 
              ORDER BY created_at DESC) as rn
          FROM RestaurantMessage
          WHERE sender_id = @userId OR receiver_id = @userId
        )
        SELECT 
          lm.message_text as lastMessage,
          lm.created_at as lastMessageTime,
          lm.is_read as lastMessageIsRead,
          lm.sender_id as lastMessageSenderId,
          u.id_User as partnerId,
          -- Nếu đối tác là chủ cửa hàng, hiển thị tên nhà hàng, ngược lại hiển thị tên cá nhân
          COALESCE(r.name_Restaurant, u.fullName) as partnerName,
          -- Nếu đối tác là chủ cửa hàng, hiển thị logo nhà hàng, ngược lại hiển thị avatar cá nhân
          COALESCE(r.logo, u.avatar) as partnerAvatar,
          u.role as partnerRole,
          (
            SELECT COUNT(*) 
            FROM RestaurantMessage 
            WHERE sender_id = u.id_User AND receiver_id = @userId AND is_read = 0
          ) as unreadCount
        FROM LastMessages lm
        JOIN [User] u ON u.id_User = CASE WHEN lm.sender_id = @userId THEN lm.receiver_id ELSE lm.sender_id END
        LEFT JOIN Restaurant r ON u.id_User = r.owner_id AND u.role = 'restaurant_owner'
        WHERE lm.rn = 1
        ORDER BY lm.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy hội thoại', error: err.message });
  }
};

// Lấy tin nhắn chi tiết giữa người dùng hiện tại và một đối tác
exports.getMessages = async (req, res) => {
  const userId = req.user.id;
  const { partnerId } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .input('partnerId', partnerId)
      .query(`
        SELECT m.*, 
               s.fullName as senderName, s.avatar as senderAvatar,
               r.fullName as receiverName, r.avatar as receiverAvatar
        FROM RestaurantMessage m
        JOIN [User] s ON m.sender_id = s.id_User
        JOIN [User] r ON m.receiver_id = r.id_User
        WHERE (m.sender_id = @userId AND m.receiver_id = @partnerId)
           OR (m.sender_id = @partnerId AND m.receiver_id = @userId)
        ORDER BY m.created_at ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy tin nhắn', error: err.message });
  }
};

// Gửi tin nhắn mới
exports.sendMessage = async (req, res) => {
  const userId = req.user.id;
  const { receiverId, messageText } = req.body;
  if (!receiverId || !messageText) {
    return res.status(400).json({ message: 'Thiếu thông tin người nhận hoặc nội dung tin nhắn' });
  }
  try {
    const pool = await poolPromise;
    
    const result = await pool.request()
      .input('senderId', userId)
      .input('receiverId', receiverId)
      .input('messageText', messageText)
      .query(`
        INSERT INTO RestaurantMessage (sender_id, receiver_id, message_text, created_at, is_read)
        OUTPUT inserted.*
        VALUES (@senderId, @receiverId, @messageText, GETDATE(), 0)
      `);
      
    res.json({ message: 'Gửi tin nhắn thành công', data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi gửi tin nhắn', error: err.message });
  }
};

// Đánh dấu tin nhắn đã đọc
exports.markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { partnerId } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('userId', userId)
      .input('partnerId', partnerId)
      .query(`
        UPDATE RestaurantMessage
        SET is_read = 1
        WHERE sender_id = @partnerId AND receiver_id = @userId AND is_read = 0
      `);
    res.json({ message: 'Đã đánh dấu đã đọc' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy danh sách liên hệ theo vai trò (Customer -> Nhà hàng/Tài xế của đơn hàng, Restaurant -> Khách/Tài xế của đơn hàng, Driver -> Khách/Nhà hàng của đơn hàng)
exports.getContacts = async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;
  try {
    const pool = await poolPromise;
    
    if (role === 'restaurant_owner') {
      // Lấy id nhà hàng
      const resCheck = await pool.request()
        .input('ownerId', userId)
        .query('SELECT id_Restaurant FROM Restaurant WHERE owner_id = @ownerId');
      if (resCheck.recordset.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
      }
      const id_Restaurant = resCheck.recordset[0].id_Restaurant;

      // Lấy Khách hàng và Shipper liên quan đến nhà hàng
      const result = await pool.request()
        .input('resId', id_Restaurant)
        .query(`
          SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
          FROM [Order] o
          JOIN [User] u ON o.id_User = u.id_User
          WHERE o.id_Restaurant = @resId
          
          UNION
          
          SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
          FROM [Order] o
          JOIN Driver d ON o.id_Driver = d.id_Driver
          JOIN [User] u ON d.id_User = u.id_User
          WHERE o.id_Restaurant = @resId
        `);
      return res.json(result.recordset);

    } else if (role === 'customer') {
      // Lấy danh sách chủ nhà hàng (Restaurant Owners) và tài xế (Drivers) từ các đơn hàng của khách hàng này
      const result = await pool.request()
        .input('userId', userId)
        .query(`
          -- Chủ nhà hàng
          SELECT DISTINCT owner.id_User as id, 
                 r.name_Restaurant as fullName, 
                 r.logo as avatar, 
                 owner.role, 
                 owner.phone
          FROM [Order] o
          JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
          JOIN [User] owner ON r.owner_id = owner.id_User
          WHERE o.id_User = @userId
          
          UNION
          
          -- Tài xế
          SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
          FROM [Order] o
          JOIN Driver d ON o.id_Driver = d.id_Driver
          JOIN [User] u ON d.id_User = u.id_User
          WHERE o.id_User = @userId
        `);
      return res.json(result.recordset);

    } else if (role === 'driver') {
      // Lấy danh sách chủ nhà hàng và khách hàng của các đơn hàng tài xế này đã/đang nhận giao
      const driverCheck = await pool.request()
        .input('userId', userId)
        .query('SELECT id_Driver FROM Driver WHERE id_User = @userId');
      if (driverCheck.recordset.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy tài xế' });
      }
      const id_Driver = driverCheck.recordset[0].id_Driver;

      const result = await pool.request()
        .input('driverId', id_Driver)
        .query(`
          -- Khách hàng
          SELECT DISTINCT u.id_User as id, u.fullName, u.avatar, u.role, u.phone
          FROM [Order] o
          JOIN [User] u ON o.id_User = u.id_User
          WHERE o.id_Driver = @driverId
          
          UNION
          
          -- Chủ nhà hàng
          SELECT DISTINCT owner.id_User as id, 
                 r.name_Restaurant as fullName, 
                 r.logo as avatar, 
                 owner.role, 
                 owner.phone
          FROM [Order] o
          JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
          JOIN [User] owner ON r.owner_id = owner.id_User
          WHERE o.id_Driver = @driverId
        `);
      return res.json(result.recordset);
    } else {
      // Admin hoặc vai trò khác: Trả về danh sách trống hoặc tất cả
      return res.json([]);
    }
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách liên hệ', error: err.message });
  }
};
