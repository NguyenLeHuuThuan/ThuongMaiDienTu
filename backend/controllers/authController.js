const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  const { phone, password, fullName, email } = req.body;
  
  if (!phone || !password || !fullName) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đủ số điện thoại, mật khẩu và họ tên' });
  }

  try {
    const pool = await poolPromise;
    // Kiểm tra user tồn tại
    const userCheck = await pool.request()
      .input('phone', phone)
      .query('SELECT * FROM [User] WHERE phone = @phone');
      
    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Thêm user mới
    const insertResult = await pool.request()
      .input('phone', phone)
      .input('password', hashedPassword)
      .input('fullName', fullName)
      .input('email', email || null)
      .input('role', 'customer')
      .query(`
        INSERT INTO [User] (phone, password, fullName, email, role, status, created_at)
        OUTPUT INSERTED.id_User, INSERTED.fullName, INSERTED.role
        VALUES (@phone, @password, @fullName, @email, @role, 'active', GETDATE())
      `);

    const user = insertResult.recordset[0];
    
    // Tạo token
    const token = jwt.sign(
      { id: user.id_User, role: user.role },
      process.env.JWT_SECRET || 'secret_key_123',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: {
        id: user.id_User,
        fullName: user.fullName,
        phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.login = async (req, res) => {
  const { phone, password } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('phone', phone)
      .query('SELECT * FROM [User] WHERE phone = @phone');

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Số điện thoại hoặc mật khẩu không đúng' });
    }

    const user = result.recordset[0];

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khoá hoặc ngưng hoạt động' });
    }

    // Kiểm tra password (Hỗ trợ data mẫu chưa mã hóa bcrypt và data mới)
    let isMatch = false;
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
       isMatch = await bcrypt.compare(password, user.password);
    } else {
       isMatch = (password === user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Số điện thoại hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { id: user.id_User, role: user.role },
      process.env.JWT_SECRET || 'secret_key_123',
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id_User,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', req.user.id)
      .query('SELECT id_User, phone, fullName, email, avatar, role, reputation_score, default_Address_Id FROM [User] WHERE id_User = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
