const { poolPromise } = require('./db');

async function initializeDatabase() {
  console.log('Starting defensive database migration/initialization for Admin features...');
  try {
    const pool = await poolPromise;

    // 1. Create SystemConfig table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemConfig')
      BEGIN
        CREATE TABLE SystemConfig (
          config_key VARCHAR(100) PRIMARY KEY,
          config_value NVARCHAR(MAX) NOT NULL,
          category VARCHAR(50) NOT NULL, -- 'operation', 'logistics', 'payment', 'ui_notification'
          description NVARCHAR(255),
          is_enabled BIT NOT NULL DEFAULT 1,
          updated_at DATETIME NOT NULL DEFAULT GETDATE()
        );
        PRINT 'Table SystemConfig created successfully.';
      END
    `);

    // 2. Add columns display_order and is_active to Category if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Category') AND name = 'display_order'
      )
      BEGIN
        ALTER TABLE Category ADD display_order INT NOT NULL DEFAULT 0;
        PRINT 'Column display_order added to Category.';
      END

      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Category') AND name = 'is_active'
      )
      BEGIN
        ALTER TABLE Category ADD is_active BIT NOT NULL DEFAULT 1;
        PRINT 'Column is_active added to Category.';
      END
    `);

    // 3. Add column is_hot to Promotion if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Promotion') AND name = 'is_hot'
      )
      BEGIN
        ALTER TABLE Promotion ADD is_hot BIT NOT NULL DEFAULT 0;
        PRINT 'Column is_hot added to Promotion.';
      END
    `);

    // 3.5 Alter User password column length to NVARCHAR(255) to support 60-character bcrypt hashes safely
    await pool.request().query(`
      IF EXISTS (
        SELECT * FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'User' AND c.name = 'password' AND c.max_length < 510
      )
      BEGIN
        ALTER TABLE [User] ALTER COLUMN password NVARCHAR(255) NOT NULL;
      END
    `);

    // 4. Seed default configurations into SystemConfig if it is empty
    const countResult = await pool.request().query('SELECT COUNT(*) AS count FROM SystemConfig');
    if (countResult.recordset[0].count === 0) {
      await pool.request().query(`
        INSERT INTO SystemConfig (config_key, config_value, category, description, is_enabled)
        VALUES
        -- Operations
        ('op_open_time', '06:00', 'operation', N'Giờ mở cửa toàn hệ thống', 1),
        ('op_close_time', '23:00', 'operation', N'Giờ đóng cửa toàn hệ thống', 1),
        ('op_service_fee_percent', '10.0', 'operation', N'Phần trăm phí dịch vụ thu của nhà hàng (%)', 1),
        ('op_shipper_fee_percent', '5.0', 'operation', N'Phần trăm phí dịch vụ thu của shipper (%)', 1),
        ('op_auto_assign_driver', 'true', 'operation', N'Tự động gán tài xế cho đơn hàng mới', 1),
        
        -- Logistics
        ('log_base_delivery_fee', '15000', 'logistics', N'Phí giao hàng cơ bản (cho 2km đầu tiên - VND)', 1),
        ('log_per_km_fee', '5000', 'logistics', N'Phí giao hàng tăng thêm mỗi km tiếp theo (VND)', 1),
        ('log_max_delivery_distance', '15', 'logistics', N'Khoảng cách giao hàng tối đa cho phép (km)', 1),
        ('log_active_shipper_limit', '50', 'logistics', N'Số lượng shipper tối đa hoạt động cùng lúc', 1),
        
        -- Payment
        ('pay_cod_enabled', 'true', 'payment', N'Cho phép thanh toán khi nhận hàng (COD)', 1),
        ('pay_vnpay_enabled', 'true', 'payment', N'Kích hoạt cổng thanh toán VNPay', 1),
        ('pay_momo_enabled', 'true', 'payment', N'Kích hoạt cổng thanh toán Ví Momo', 1),
        ('pay_min_checkout_value', '20000', 'payment', N'Giá trị đơn hàng tối thiểu để thanh toán (VND)', 1),
        
        -- UI & Notifications
        ('ui_theme_mode', 'dark', 'ui_notification', N'Chế độ giao diện mặc định cho Admin (dark/light)', 1),
        ('ui_promo_banner_active', 'true', 'ui_notification', N'Hiển thị banner chương trình hot ngoài trang chủ', 1),
        ('ui_alert_broadcast_message', N'Hôm nay hệ thống tặng voucher 20k cho khách hàng mới!', 'ui_notification', N'Thông điệp thông báo chạy chữ trên ứng dụng', 1),
        ('ui_email_notification_trigger', 'true', 'ui_notification', N'Gửi email thông báo tự động khi đăng ký đối tác thành công', 1)
      `);
      console.log('Default configurations seeded into SystemConfig.');
    }

    // 5. Audit images: update NULL or empty values to default values
    await pool.request().query(`
      UPDATE Food 
      SET image = 'default-food.svg' 
      WHERE image IS NULL OR image = '' OR image = 'NULL';

      UPDATE Restaurant 
      SET logo = 'default-logo.svg' 
      WHERE logo IS NULL OR logo = '' OR logo = 'NULL';

      UPDATE Restaurant 
      SET cover_image = 'default-cover.jpg' 
      WHERE cover_image IS NULL OR cover_image = '' OR cover_image = 'NULL';

      UPDATE [User] 
      SET avatar = 'default-avatar.png' 
      WHERE avatar IS NULL OR avatar = '' OR avatar = 'NULL';
    `);
    console.log('Database image assets audited successfully.');

    console.log('Database migration/initialization finished successfully!');
  } catch (err) {
    console.error('Error during database migration/initialization:', err);
  }
}

module.exports = { initializeDatabase };
