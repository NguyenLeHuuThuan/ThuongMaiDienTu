const { poolPromise } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  const { phone, password, fullName, email } = req.body;
  
  if (!phone || !password || !fullName) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đủ số điện thoại, mật khẩu và họ tên' });
  }

  if (phone.length > 15) {
    return res.status(400).json({ message: 'Số điện thoại không được vượt quá 15 ký tự' });
  }

  if (fullName.length > 50) {
    return res.status(400).json({ message: 'Họ và tên không được vượt quá 50 ký tự' });
  }

  if (email && email.length > 50) {
    return res.status(400).json({ message: 'Email không được vượt quá 50 ký tự' });
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
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(__dirname, '../registration_error.log');
      fs.appendFileSync(errorLogPath, `${new Date().toISOString()} - [Register] - ${error.stack || error.message}\n`);
    } catch (fsErr) {
      console.error('Failed to write error log file:', fsErr);
    }
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.registerShipper = async (req, res) => {
  const { phone, email, password, fullName, license_plate } = req.body;
  
  if (!phone || !password || !fullName || !email) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin bắt buộc' });
  }

  if (phone.length > 15) {
    return res.status(400).json({ message: 'Số điện thoại không được vượt quá 15 ký tự' });
  }

  if (fullName.length > 50) {
    return res.status(400).json({ message: 'Họ và tên không được vượt quá 50 ký tự' });
  }

  if (email.length > 50) {
    return res.status(400).json({ message: 'Email không được vượt quá 50 ký tự' });
  }

  if (license_plate && license_plate.length > 20) {
    return res.status(400).json({ message: 'Biển số xe không được vượt quá 20 ký tự' });
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

    // 1. Thêm user mới với role = 'driver'
    const insertUserResult = await pool.request()
      .input('phone', phone)
      .input('password', hashedPassword)
      .input('fullName', fullName)
      .input('email', email)
      .input('role', 'driver')
      .query(`
        INSERT INTO [User] (phone, password, fullName, email, role, status, created_at)
        OUTPUT INSERTED.id_User, INSERTED.fullName, INSERTED.role
        VALUES (@phone, @password, @fullName, @email, @role, 'inactive', GETDATE())
      `);

    const user = insertUserResult.recordset[0];
    
    // 2. Thêm vào bảng Driver
    await pool.request()
      .input('id_User', user.id_User)
      .input('license_plate', license_plate || null)
      .query(`
        INSERT INTO Driver (id_User, license_plate, is_Busy, is_Online, rating_Avg, total_Orders)
        VALUES (@id_User, @license_plate, 0, 1, 5.0, 0)
      `);
    
    // 3. Tạo token
    const token = jwt.sign(
      { id: user.id_User, role: user.role },
      process.env.JWT_SECRET || 'secret_key_123',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'Đăng ký tài khoản Shipper thành công',
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
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(__dirname, '../registration_error.log');
      fs.appendFileSync(errorLogPath, `${new Date().toISOString()} - [Shipper] - ${error.stack || error.message}\n`);
    } catch (fsErr) {
      console.error('Failed to write error log file:', fsErr);
    }
  }
};

exports.registerRestaurant = async (req, res) => {
  const { phone, password, fullName, email, name_Restaurant, description, address } = req.body;
  
  if (!phone || !password || !fullName || !name_Restaurant || !address) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đủ thông tin bắt buộc' });
  }

  if (phone.length > 15) {
    return res.status(400).json({ message: 'Số điện thoại không được vượt quá 15 ký tự' });
  }

  if (fullName.length > 50) {
    return res.status(400).json({ message: 'Họ và tên không được vượt quá 50 ký tự' });
  }

  if (email && email.length > 50) {
    return res.status(400).json({ message: 'Email không được vượt quá 50 ký tự' });
  }

  if (name_Restaurant.length > 100) {
    return res.status(400).json({ message: 'Tên nhà hàng không được vượt quá 100 ký tự' });
  }

  if (address.length > 55) {
    return res.status(400).json({ message: 'Địa chỉ không được vượt quá 55 ký tự' });
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

    // Get base64 logo and cover_image strings from req.body
    const logoPath = req.body.logo || 'default-logo.svg';
    const coverImagePath = req.body.cover_image || 'default-cover.jpg';

    // 1. Thêm user mới với role = 'restaurant_owner'
    const insertUserResult = await pool.request()
      .input('phone', phone)
      .input('password', hashedPassword)
      .input('fullName', fullName)
      .input('email', email || null)
      .input('role', 'restaurant_owner')
      .query(`
        INSERT INTO [User] (phone, password, fullName, email, role, status, created_at)
        OUTPUT INSERTED.id_User, INSERTED.fullName, INSERTED.role
        VALUES (@phone, @password, @fullName, @email, @role, 'inactive', GETDATE())
      `);

    const user = insertUserResult.recordset[0];
    
    // 2. Thêm vào bảng Restaurant
    await pool.request()
      .input('owner_id', user.id_User)
      .input('name_Restaurant', name_Restaurant)
      .input('description', description || null)
      .input('logo', logoPath)
      .input('cover_image', coverImagePath)
      .input('address', address)
      .query(`
        INSERT INTO Restaurant (owner_id, name_Restaurant, description, logo, cover_image, address, rating_avg)
        VALUES (@owner_id, @name_Restaurant, @description, @logo, @cover_image, @address, 0.0)
      `);

    res.status(201).json({
      message: 'Đăng ký tài khoản Đối tác nhà hàng thành công! Vui lòng chờ quản trị viên phê duyệt hồ sơ và kích hoạt hoạt động.',
      user: {
        id: user.id_User,
        fullName: user.fullName,
        phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error(error);
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(__dirname, '../registration_error.log');
      fs.appendFileSync(errorLogPath, `${new Date().toISOString()} - [Restaurant] - ${error.stack || error.message}\n`);
    } catch (fsErr) {
      console.error('Failed to write error log file:', fsErr);
    }
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

    if (user.status === 'banned') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị cấm truy cập' });
    } else if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Tài khoản của bạn đang chờ quản trị viên phê duyệt' });
    } else if (user.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khoá hoặc ngưng hoạt động' });
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
