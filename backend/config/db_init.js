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

    // Clean up pay_momo_enabled config dynamically
    await pool.request().query("DELETE FROM SystemConfig WHERE config_key = 'pay_momo_enabled'");
    // Ensure pay_vnpay_enabled is seeded
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM SystemConfig WHERE config_key = 'pay_vnpay_enabled')
      BEGIN
        INSERT INTO SystemConfig (config_key, config_value, category, description, is_enabled)
        VALUES ('pay_vnpay_enabled', 'true', 'payment', N'Kích hoạt cổng thanh toán VNPAY', 1);
      END
    `);

    // Add wallet_balance to [User] table if it does not exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('[User]') AND name = 'wallet_balance'
      )
      BEGIN
        ALTER TABLE [User] ADD wallet_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00;
        PRINT 'Column wallet_balance added to [User].';
      END
    `);

    // Create Wallet_Transaction table if it does not exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Wallet_Transaction')
      BEGIN
        CREATE TABLE Wallet_Transaction (
            id_Transaction   INTEGER         PRIMARY KEY IDENTITY(1,1),
            id_User          INTEGER         NOT NULL,
            id_Order         INTEGER,
            transaction_type NVARCHAR(50)    NOT NULL 
                             CHECK (transaction_type IN (
                                 'top_up',
                                 'withdraw',
                                 'payment',
                                 'refund',
                                 'order_revenue',
                                 'commission_deduction',
                                 'shipping_reward',
                                 'order_deduction'
                             )), 
            amount           DECIMAL(10,2)   NOT NULL, 
            balance_before   DECIMAL(15,2)   NOT NULL, 
            balance_after    DECIMAL(15,2)   NOT NULL, 
            note             NVARCHAR(255),
            created_At       DATETIME        NOT NULL DEFAULT GETDATE(),
            CONSTRAINT FK_WalletTransaction_User  FOREIGN KEY (id_User)  REFERENCES [User](id_User),
            CONSTRAINT FK_WalletTransaction_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order)
        );
        PRINT 'Table Wallet_Transaction created successfully.';
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

    // 3.6 Alter image columns to VARCHAR(MAX)/NVARCHAR(MAX) to support base64 strings
    await pool.request().query(`
      -- Food.image
      IF EXISTS (
        SELECT * FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'Food' AND c.name = 'image' AND c.max_length <> -1
      )
      BEGIN
        ALTER TABLE Food ALTER COLUMN image VARCHAR(MAX) NULL;
        PRINT 'Column Food.image altered to VARCHAR(MAX).';
      END

      -- [User].avatar
      IF EXISTS (
        SELECT * FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'User' AND c.name = 'avatar' AND c.max_length <> -1
      )
      BEGIN
        ALTER TABLE [User] ALTER COLUMN avatar NVARCHAR(MAX) NULL;
        PRINT 'Column [User].avatar altered to NVARCHAR(MAX).';
      END

      -- Restaurant.logo
      IF EXISTS (
        SELECT * FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'Restaurant' AND c.name = 'logo' AND c.max_length <> -1
      )
      BEGIN
        ALTER TABLE Restaurant ALTER COLUMN logo VARCHAR(MAX) NULL;
        PRINT 'Column Restaurant.logo altered to VARCHAR(MAX).';
      END

      -- Restaurant.cover_image
      IF EXISTS (
        SELECT * FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'Restaurant' AND c.name = 'cover_image' AND c.max_length <> -1
      )
      BEGIN
        ALTER TABLE Restaurant ALTER COLUMN cover_image VARCHAR(MAX) NULL;
        PRINT 'Column Restaurant.cover_image altered to VARCHAR(MAX).';
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
        ('pay_vnpay_enabled', 'true', 'payment', N'Kích hoạt cổng thanh toán VNPAY', 1),
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
    // Migration: Refactor Voucher Table (Remove User_Voucher, update columns to reference Promotion)
    await pool.request().query(`
      -- 1. Drop User_Voucher table if it exists
      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'User_Voucher')
      BEGIN
        DROP TABLE User_Voucher;
        PRINT 'Table User_Voucher dropped successfully.';
      END

      -- 2. Modify Voucher table structure
      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Voucher')
      BEGIN
        -- Drop unique constraint on code, id_User if exists
        IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('Voucher') AND name = 'UQ_Voucher_Code_User')
        BEGIN
          ALTER TABLE Voucher DROP CONSTRAINT UQ_Voucher_Code_User;
        END

        -- Also drop any other UQ constraints on Voucher
        DECLARE @UQConstraintName NVARCHAR(128);
        SELECT TOP 1 @UQConstraintName = name 
        FROM sys.key_constraints 
        WHERE parent_object_id = OBJECT_ID('Voucher') AND type = 'UQ';
        IF @UQConstraintName IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE Voucher DROP CONSTRAINT ' + @UQConstraintName);
        END

        -- Add id_Promo column if not exists
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'id_Promo')
        BEGIN
          ALTER TABLE Voucher ADD id_Promo INT NULL;
          PRINT 'Column id_Promo added to Voucher.';
        END

        -- Map existing Voucher data to Promotion by code if any, to avoid constraint failure
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'code')
        BEGIN
          EXEC('
            UPDATE v 
            SET v.id_Promo = p.id_Promo 
            FROM Voucher v 
            JOIN Promotion p ON v.code = p.code
            WHERE v.id_Promo IS NULL
          ');
        END

        -- Set a fallback promo ID or delete orphans if any id_Promo is still NULL
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'id_Promo')
        BEGIN
          EXEC('
            IF EXISTS (SELECT 1 FROM Voucher WHERE id_Promo IS NULL)
            BEGIN
              DECLARE @FirstPromo INT;
              SELECT TOP 1 @FirstPromo = id_Promo FROM Promotion;
              IF @FirstPromo IS NOT NULL
                UPDATE Voucher SET id_Promo = @FirstPromo WHERE id_Promo IS NULL;
              ELSE
                DELETE FROM Voucher WHERE id_Promo IS NULL;
            END
          ');
        END

        -- Alter id_Promo to be NOT NULL
        ALTER TABLE Voucher ALTER COLUMN id_Promo INT NOT NULL;

        -- Add foreign key reference to Promotion if not exists
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Voucher_Promotion' AND parent_object_id = OBJECT_ID('Voucher'))
        BEGIN
          ALTER TABLE Voucher ADD CONSTRAINT FK_Voucher_Promotion FOREIGN KEY (id_Promo) REFERENCES Promotion(id_Promo);
          PRINT 'Foreign key FK_Voucher_Promotion added.';
        END

        -- Add claimed_At column if not exists
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'claimed_At')
        BEGIN
          ALTER TABLE Voucher ADD claimed_At DATETIME NOT NULL DEFAULT GETDATE();
          PRINT 'Column claimed_At added to Voucher.';
        END

        -- Drop old obsolete columns: code, value, expiry_date
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'code')
        BEGIN
          ALTER TABLE Voucher DROP COLUMN code;
        END
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'value')
        BEGIN
          ALTER TABLE Voucher DROP COLUMN value;
        END
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Voucher') AND name = 'expiry_date')
        BEGIN
          ALTER TABLE Voucher DROP COLUMN expiry_date;
        END
        PRINT 'Obsolete columns dropped from Voucher.';
      END
    `);
    console.log('Database image assets and vouchers audited successfully.');

    console.log('Database migration/initialization finished successfully!');
  } catch (err) {
    console.error('Error during database migration/initialization:', err);
  }
}

module.exports = { initializeDatabase };
