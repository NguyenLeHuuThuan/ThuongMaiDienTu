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
                                 'order_deduction',
                                 'payout'
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

    // Dynamic CHECK constraint upgrade for Wallet_Transaction.transaction_type to ensure 'payout' is allowed on existing databases
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Wallet_Transaction')
      BEGIN
          -- Find and drop all existing CHECK constraints on the transaction_type column
          DECLARE @ConstraintName NVARCHAR(256);
          
          DECLARE constraint_cursor CURSOR FOR
          SELECT dc.name
          FROM sys.check_constraints dc
          INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
          WHERE dc.parent_object_id = OBJECT_ID('Wallet_Transaction') AND c.name = 'transaction_type';
          
          OPEN constraint_cursor;
          FETCH NEXT FROM constraint_cursor INTO @ConstraintName;
          
          WHILE @@FETCH_STATUS = 0
          BEGIN
              EXEC('ALTER TABLE Wallet_Transaction DROP CONSTRAINT [' + @ConstraintName + ']');
              PRINT 'Dropped existing check constraint: ' + @ConstraintName;
              FETCH NEXT FROM constraint_cursor INTO @ConstraintName;
          END;
          
          CLOSE constraint_cursor;
          DEALLOCATE constraint_cursor;
          
          -- Add the new updated CHECK constraint including 'payout'
          IF NOT EXISTS (
              SELECT * FROM sys.check_constraints 
              WHERE parent_object_id = OBJECT_ID('Wallet_Transaction') AND name = 'CK_Wallet_Transaction_Type'
          )
          BEGIN
              ALTER TABLE Wallet_Transaction ADD CONSTRAINT CK_Wallet_Transaction_Type CHECK (transaction_type IN (
                  'top_up', 'withdraw', 'payment', 'refund', 'order_revenue', 'commission_deduction', 'shipping_reward', 'order_deduction', 'payout'
              ));
              PRINT 'CHECK constraint CK_Wallet_Transaction_Type added successfully.';
          END
      END
    `);

    // Update existing transaction notes to replace "Tổ chức" with "Nhóm"
    try {
      await pool.request().query("UPDATE Wallet_Transaction SET note = REPLACE(note, N'Tổ chức', N'Nhóm') WHERE note LIKE N'%Tổ chức%'");
    } catch (e) {
      console.log('Wallet_Transaction not initialized yet, skipping note cleanup.');
    }


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

    // 3.1 Add advanced marketing columns to Promotion if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Promotion') AND name = 'sys_funding_percent'
      )
      BEGIN
        ALTER TABLE Promotion ADD sys_funding_percent INT NOT NULL DEFAULT 100;
        PRINT 'Column sys_funding_percent added to Promotion.';
      END

      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Promotion') AND name = 'res_funding_percent'
      )
      BEGIN
        ALTER TABLE Promotion ADD res_funding_percent INT NOT NULL DEFAULT 0;
        PRINT 'Column res_funding_percent added to Promotion.';
      END

      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Promotion') AND name = 'usage_limit_per_user'
      )
      BEGIN
        ALTER TABLE Promotion ADD usage_limit_per_user INT NOT NULL DEFAULT 1;
        PRINT 'Column usage_limit_per_user added to Promotion.';
      END

      -- Add compensation columns to Complaint table
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Complaint') AND name = 'comp_customer_amount'
      )
      BEGIN
        ALTER TABLE Complaint ADD comp_customer_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
        ALTER TABLE Complaint ADD comp_driver_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
        ALTER TABLE Complaint ADD comp_restaurant_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
        PRINT 'Compensation columns added to Complaint.';
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

    // Ensure [User].wallet_balance column exists
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

    // Ensure Wallet_Transaction table exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Wallet_Transaction')
      BEGIN
        CREATE TABLE Wallet_Transaction (
            id_Transaction   INTEGER         PRIMARY KEY IDENTITY(1,1),
            id_User          INTEGER         NOT NULL,
            id_Order         INTEGER,
            transaction_type NVARCHAR(50)    NOT NULL 
                             CHECK (transaction_type IN (
                                 'top_up', 'withdraw', 'payment', 'refund', 
                                 'order_revenue', 'commission_deduction', 
                                 'shipping_reward', 'order_deduction'
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

    // Sync Admin Wallet and Transactions purely based on actual completed orders and initial capital
    console.log('Synchronizing Admin Wallet ledger dynamically with actual completed orders...');
    try {
      // Safety Guard: Check if there are any manual transactions (like payout, refund, etc.) other than top_up and commission_deduction
      const manualTransCheck = await pool.request().query(`
        SELECT COUNT(*) as count 
        FROM Wallet_Transaction 
        WHERE id_User = 1 AND transaction_type NOT IN ('top_up', 'commission_deduction')
      `);
      
      if (manualTransCheck.recordset[0].count > 0) {
        console.log('Skipping Admin Wallet ledger synchronization because active manual transactions (payouts/refunds) exist.');
      } else {
        // 1. Clear existing transactions for Admin
        await pool.request().query("DELETE FROM Wallet_Transaction WHERE id_User = 1");
      
      // 2. Insert initial capital top-up
      let runningBalance = 30000000.00;
      await pool.request().query(`
        INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
        VALUES (1, 'top_up', 30000000.00, 0.00, 30000000.00, N'Cấp vốn điều lệ ban đầu cho Ví hệ thống', DATEADD(day, -5, GETDATE()))
      `);

      // 3. Fetch all delivered orders to record their real-time commissions
      const deliveredOrdersRes = await pool.request().query(`
        SELECT id_Order, order_Code, food_Amount, shipping_Fee, discount_Amount, created_At
        FROM [Order]
        WHERE order_Status = 'delivered'
        ORDER BY created_At ASC
      `);

      const resFeePercent = 15.0; // standard default
      const shipFeePercent = 5.0; // standard default

      for (const order of deliveredOrdersRes.recordset) {
        const foodAmount = order.food_Amount || 0;
        const shippingFee = order.shipping_Fee || 0;
        const discountAmount = order.discount_Amount || 0;

        const restaurantRevenue = Math.round(foodAmount / (1.0 + resFeePercent / 100.0));
        const adminResCommission = foodAmount - restaurantRevenue;

        const shipperEarned = Math.round(shippingFee / (1.0 + shipFeePercent / 100.0));
        const adminShipperCommission = shippingFee - shipperEarned;

        const commission = adminResCommission + adminShipperCommission - discountAmount;
        const balanceBefore = runningBalance;
        runningBalance += commission;

        await pool.request()
          .input('id_Order', order.id_Order)
          .input('order_Code', order.order_Code)
          .input('commission', commission)
          .input('balanceBefore', balanceBefore)
          .input('balanceAfter', runningBalance)
          .input('created_At', order.created_At)
          .query(`
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (1, @id_Order, 'commission_deduction', @commission, @balanceBefore, @balanceAfter, N'Thu phí dịch vụ đơn hàng ' + @order_Code, @created_At)
          `);
      }

      // 4. Set admin balance to runningBalance
      await pool.request()
        .input('wallet_balance', runningBalance)
        .query("UPDATE [User] SET wallet_balance = @wallet_balance WHERE id_User = 1");

      console.log(`Admin Wallet synchronized! Real-time balance: ${runningBalance.toLocaleString('vi-VN')}đ, Ledger entries: ${deliveredOrdersRes.recordset.length + 1}`);
      }
    } catch (err) {
      console.error('Error during Admin Wallet ledger synchronization:', err);
    }

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

    // 6. Deploy trg_Order_Complete_Wallet trigger defensively to sync order completions to Admin Wallet in real-time
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_Order_Complete_Wallet')
      BEGIN
        DROP TRIGGER trg_Order_Complete_Wallet;
      END
    `);

    await pool.request().query(`
      CREATE TRIGGER trg_Order_Complete_Wallet
      ON [Order]
      AFTER UPDATE
      AS
      BEGIN
          SET NOCOUNT ON;
          
          IF UPDATE(order_Status)
          BEGIN
              DECLARE @id_Order INT;
              DECLARE @food_Amount DECIMAL(10,2);
              DECLARE @shipping_Fee DECIMAL(10,2);
              DECLARE @discount_Amount DECIMAL(10,2);
              DECLARE @order_Code NVARCHAR(50);
              
              DECLARE order_cursor CURSOR LOCAL FAST_FORWARD FOR
              SELECT i.id_Order, i.food_Amount, i.shipping_Fee, i.discount_Amount, i.order_Code
              FROM inserted i
              JOIN deleted d ON i.id_Order = d.id_Order
              WHERE i.order_Status = 'delivered' AND d.order_Status <> 'delivered';
              
              OPEN order_cursor;
              FETCH NEXT FROM order_cursor INTO @id_Order, @food_Amount, @shipping_Fee, @discount_Amount, @order_Code;
              
              WHILE @@FETCH_STATUS = 0
              BEGIN
                  DECLARE @resFee FLOAT = NULL;
                  DECLARE @shipFee FLOAT = NULL;
                  
                  SELECT @resFee = CAST(config_value AS FLOAT) FROM SystemConfig WHERE config_key = 'op_service_fee_percent' AND is_enabled = 1;
                  SELECT @shipFee = CAST(config_value AS FLOAT) FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent' AND is_enabled = 1;
                  
                  IF @resFee IS NULL SET @resFee = 15.0;
                  IF @shipFee IS NULL SET @shipFee = 5.0;
                  
                  DECLARE @restaurantRevenue DECIMAL(15,2);
                  DECLARE @adminResCommission DECIMAL(15,2);
                  DECLARE @shipperEarned DECIMAL(15,2);
                  DECLARE @adminShipperCommission DECIMAL(15,2);
                  DECLARE @commission DECIMAL(15,2);
                  
                  SET @restaurantRevenue = ROUND(@food_Amount / (1.0 + @resFee / 100.0), 0);
                  SET @adminResCommission = @food_Amount - @restaurantRevenue;
                  
                  SET @shipperEarned = ROUND(@shipping_Fee / (1.0 + @shipFee / 100.0), 0);
                  SET @adminShipperCommission = @shipping_Fee - @shipperEarned;
                  
                  SET @commission = @adminResCommission + @adminShipperCommission - ISNULL(@discount_Amount, 0);
                  
                  IF @commission <> 0
                  BEGIN
                      DECLARE @admin_balance_before DECIMAL(15,2);
                      SELECT @admin_balance_before = wallet_balance FROM [User] WHERE id_User = 1;
                      
                      IF @admin_balance_before IS NULL SET @admin_balance_before = 0.00;
                      
                      UPDATE [User] 
                      SET wallet_balance = wallet_balance + @commission 
                      WHERE id_User = 1;
                      
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (
                          1,
                          @id_Order,
                          'commission_deduction',
                          @commission,
                          @admin_balance_before,
                          @admin_balance_before + @commission,
                          N'Thu phí dịch vụ đơn hàng ' + @order_Code,
                          GETDATE()
                      );
                  END
                  
                  FETCH NEXT FROM order_cursor INTO @id_Order, @food_Amount, @shipping_Fee, @discount_Amount, @order_Code;
              END
              
              CLOSE order_cursor;
              DEALLOCATE order_cursor;
          END
      END
    `);
    console.log('Trigger trg_Order_Complete_Wallet deployed successfully.');

    console.log('Database image assets and vouchers audited successfully.');

    console.log('Database migration/initialization finished successfully!');
  } catch (err) {
    console.error('Error during database migration/initialization:', err);
  }
}

module.exports = { initializeDatabase };
