USE master;
GO

IF EXISTS (
    SELECT *
    FROM sys.databases
    WHERE name = 'QuanLyMonAnTaiNha'
)
BEGIN
    ALTER DATABASE QuanLyMonAnTaiNha
    SET SINGLE_USER
    WITH ROLLBACK IMMEDIATE;

    DROP DATABASE QuanLyMonAnTaiNha;
END
GO

CREATE DATABASE QuanLyMonAnTaiNha;
GO

USE QuanLyMonAnTaiNha;
GO
-- ============================================================
-- BẢNG 1: User (không phụ thuộc bảng nào)
-- ============================================================
CREATE TABLE [User] (
    id_User         INTEGER         PRIMARY KEY IDENTITY(1,1),
    phone           VARCHAR(15)     NOT NULL UNIQUE,
    password        NVARCHAR(255)    NOT NULL,
    fullName        NVARCHAR(50)    NOT NULL,
    email           NVARCHAR(50),
    avatar          NVARCHAR(255),
    role            NVARCHAR(20)    NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer','restaurant_owner','driver','admin')),
    status          NVARCHAR(20)    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','banned')),
    wallet_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME,
    default_Address_Id INTEGER,
    reputation_score   INTEGER      DEFAULT 0,
    total_orders    INTEGER         DEFAULT 0,
    cancelled_Orders INTEGER        DEFAULT 0,
    cancel_Rate     FLOAT           DEFAULT 0.0
);
GO

-- ============================================================
-- BẢNG 2: Category (không phụ thuộc bảng nào)
-- ============================================================
CREATE TABLE Category (
    id_Category     INTEGER         PRIMARY KEY IDENTITY(1,1),
    name            NVARCHAR(100)   NOT NULL,
    icon            VARCHAR(255),
    display_order   INT             NOT NULL DEFAULT 0,
    is_active       BIT             NOT NULL DEFAULT 1
);
GO

-- ============================================================
-- BẢNG 3: Restaurant (phụ thuộc User)
-- ============================================================
CREATE TABLE Restaurant (
    id_Restaurant       INTEGER         PRIMARY KEY IDENTITY(1,1),
    owner_id            INTEGER         NOT NULL,
    name_Restaurant     NVARCHAR(100)   NOT NULL,
    description         NTEXT,
    logo                VARCHAR(255),
    cover_image         VARCHAR(255),
    address             NVARCHAR(55)    NOT NULL,
    lat                 DECIMAL(10,7),
    lng                 DECIMAL(10,7),
    openTime            TIME,
    closeTime           TIME,
    rating_avg          DECIMAL(3,2)    DEFAULT 0.0,
    CONSTRAINT FK_Restaurant_Owner FOREIGN KEY (owner_id) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 4: Driver / Shipper (phụ thuộc User)
-- ============================================================
CREATE TABLE Driver (
    id_Driver           INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User             INTEGER         NOT NULL UNIQUE,
    license_plate       NVARCHAR(20),
    cccd_Front          VARCHAR(255),
    cccd_Back           VARCHAR(255),
    driving_License     VARCHAR(255),
    current_Lat         DECIMAL(10,7),
    current_Lng         DECIMAL(10,7),
    is_Busy             BIT             DEFAULT 0,
    is_Online           BIT             DEFAULT 0,
    rating_Avg          DECIMAL(3,2)    DEFAULT 0.0,
    total_Orders        INTEGER         DEFAULT 0,
    CONSTRAINT FK_Driver_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 5: Address (phụ thuộc User)
-- ============================================================
CREATE TABLE Address (
    id_Address      INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User         INTEGER         NOT NULL,
    name            NVARCHAR(50),
    phone           VARCHAR(15),
    full_Address    NVARCHAR(255)   NOT NULL,
    lat             DECIMAL(10,7),
    lng             DECIMAL(10,7),
    note            NVARCHAR(255),
    is_Default      BIT             DEFAULT 0,
    CONSTRAINT FK_Address_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 6: User_Address (bảng nối User - Address)
-- ============================================================
CREATE TABLE User_Address (
    id_User         INTEGER NOT NULL,
    id_Address      INTEGER NOT NULL,
    PRIMARY KEY (id_User, id_Address),
    CONSTRAINT FK_UserAddress_User    FOREIGN KEY (id_User)    REFERENCES [User](id_User),
    CONSTRAINT FK_UserAddress_Address FOREIGN KEY (id_Address) REFERENCES Address(id_Address)
);
GO

-- ============================================================
-- BẢNG 7: Voucher (phụ thuộc User, Promotion)
-- ============================================================
CREATE TABLE Voucher (
    id_Voucher      INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User         INTEGER         NOT NULL,
    id_Promo        INTEGER         NOT NULL,
    used            BIT             DEFAULT 0,
    claimed_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Voucher_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 9: Notification (phụ thuộc User)
-- ============================================================
CREATE TABLE Notification (
    id_Noti         INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User         INTEGER         NOT NULL,
    title           NVARCHAR(100)   NOT NULL,
    body            NTEXT,
    type            NVARCHAR(50),
    is_Read         BIT             DEFAULT 0,
    related_OrderId INTEGER,
    image           NVARCHAR(255),
    created_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Notification_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 10: User_Notification (bảng nối)
-- ============================================================
CREATE TABLE User_Notification (
    id_Noti         INTEGER NOT NULL,
    id_User         INTEGER NOT NULL,
    PRIMARY KEY (id_Noti, id_User),
    CONSTRAINT FK_UserNotif_Noti FOREIGN KEY (id_Noti) REFERENCES Notification(id_Noti),
    CONSTRAINT FK_UserNotif_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 11: Food (phụ thuộc Category, Restaurant)
-- ============================================================
CREATE TABLE Food (
    id_Food         INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Category     INTEGER         NOT NULL,
    id_Restaurant   INTEGER         NOT NULL,
    name            NVARCHAR(60)    NOT NULL,
    description     NTEXT,
    image           VARCHAR(255),
    video           VARCHAR(255),
    price           DECIMAL(10,2)   NOT NULL,
    discount_Price  DECIMAL(10,2),
    is_Availabe     BIT             DEFAULT 1,
    sold_Count      INTEGER         DEFAULT 0,
    prep_Time       INTEGER,
    CONSTRAINT FK_Food_Category    FOREIGN KEY (id_Category)   REFERENCES Category(id_Category),
    CONSTRAINT FK_Food_Restaurant  FOREIGN KEY (id_Restaurant) REFERENCES Restaurant(id_Restaurant)
);
GO

-- ============================================================
-- BẢNG 12: Food_Image (phụ thuộc Food)
-- ============================================================
CREATE TABLE Food_Image (
    id_FoodImage    INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Food         INTEGER         NOT NULL,
    image           VARCHAR(255),
    CONSTRAINT FK_FoodImage_Food FOREIGN KEY (id_Food) REFERENCES Food(id_Food)
);
GO

-- ============================================================
-- BẢNG 13: Promotion (phụ thuộc Restaurant)
-- ============================================================
CREATE TABLE Promotion (
    id_Promo        INTEGER         PRIMARY KEY IDENTITY(1,1),
    code            VARCHAR(20)     NOT NULL UNIQUE,
    type            NVARCHAR(20)    NOT NULL
                    CHECK (type IN ('percent','fixed','freeship')),
    value           DECIMAL(10,2)   NOT NULL,
    min_OrderValue  DECIMAL(10,2),
    max_Discount    DECIMAL(10,2),
    usage_Limit     INTEGER,
    used_Count      INTEGER         DEFAULT 0,
    star_Date       DATETIME,
    end_Date        DATETIME,
    is_Applicable_To NVARCHAR(20)   DEFAULT 'all',
    id_Restaurant   INTEGER,
    CONSTRAINT FK_Promotion_Restaurant FOREIGN KEY (id_Restaurant) REFERENCES Restaurant(id_Restaurant)
);
-- Thêm ràng buộc khoá ngoại liên kết Voucher sang Promotion
ALTER TABLE Voucher ADD CONSTRAINT FK_Voucher_Promotion FOREIGN KEY (id_Promo) REFERENCES Promotion(id_Promo);
GO

-- ============================================================
-- BẢNG 14: Cart (phụ thuộc User, Restaurant)
-- ============================================================
CREATE TABLE Cart (
    id_Cart         INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User         INTEGER         NOT NULL,
    id_Restaurant   INTEGER         NOT NULL,
    created_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    update_At       DATETIME,
    CONSTRAINT FK_Cart_User       FOREIGN KEY (id_User)       REFERENCES [User](id_User),
    CONSTRAINT FK_Cart_Restaurant FOREIGN KEY (id_Restaurant) REFERENCES Restaurant(id_Restaurant)
);
GO

-- ============================================================
-- BẢNG 15: Cart_Food (phụ thuộc Cart, Food)
-- ============================================================
CREATE TABLE Cart_Food (
    id_CartFood     INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Cart         INTEGER         NOT NULL,
    id_Food         INTEGER         NOT NULL,
    quantity        INTEGER         NOT NULL DEFAULT 1,
    note            NVARCHAR(255),
    CONSTRAINT FK_CartFood_Cart FOREIGN KEY (id_Cart) REFERENCES Cart(id_Cart),
    CONSTRAINT FK_CartFood_Food FOREIGN KEY (id_Food) REFERENCES Food(id_Food)
);
GO

-- ============================================================
-- BẢNG 16: Order (phụ thuộc User, Restaurant, Driver, Address)
-- ============================================================
CREATE TABLE [Order] (
    id_Order            INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User             INTEGER         NOT NULL,
    id_Restaurant       INTEGER         NOT NULL,
    id_Driver           INTEGER,
    id_Address          INTEGER         NOT NULL,
    order_Code          VARCHAR(15)     NOT NULL UNIQUE,
    total_Amount        DECIMAL(10,2)   NOT NULL,
    food_Amount         DECIMAL(10,2)   NOT NULL,
    shipping_Fee        DECIMAL(10,2)   DEFAULT 0,
    discount_Amount     DECIMAL(10,2)   DEFAULT 0,
    payment_Method      NVARCHAR(20)    NOT NULL
                        CHECK (payment_Method IN ('cash','online')),
    payment_Status      NVARCHAR(20)    NOT NULL DEFAULT 'pending'
                        CHECK (payment_Status IN ('pending','paid','failed','refunded')),
    order_Status        NVARCHAR(30)    NOT NULL DEFAULT 'pending'
                        CHECK (order_Status IN ('pending','confirmed','preparing','ready','picking','delivering','delivered','cancelled','boom')),
    note                NVARCHAR(255),
    cancelled_By        NVARCHAR(20),
    cancellation_Reason NTEXT,
    created_At          DATETIME        NOT NULL DEFAULT GETDATE(),
    accepted_At         DATETIME,
    accepted_Delivery_At DATETIME,
    ready_At            DATETIME,
    picked_UpAt         DATETIME,
    delivered_At        DATETIME,
    CONSTRAINT FK_Order_User       FOREIGN KEY (id_User)       REFERENCES [User](id_User),
    CONSTRAINT FK_Order_Restaurant FOREIGN KEY (id_Restaurant) REFERENCES Restaurant(id_Restaurant),
    CONSTRAINT FK_Order_Driver     FOREIGN KEY (id_Driver)     REFERENCES Driver(id_Driver),
    CONSTRAINT FK_Order_Address    FOREIGN KEY (id_Address)    REFERENCES Address(id_Address)
);
GO

-- ============================================================
-- BẢNG 17: Order_Food (phụ thuộc Order, Food)
-- ============================================================
CREATE TABLE Order_Food (
    id_OrderFood    INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Order        INTEGER         NOT NULL,
    id_Food         INTEGER         NOT NULL,
    quantity        INTEGER         NOT NULL DEFAULT 1,
    unit_Price      DECIMAL(10,2)   NOT NULL,
    note            NVARCHAR(255),
    CONSTRAINT FK_OrderFood_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order),
    CONSTRAINT FK_OrderFood_Food  FOREIGN KEY (id_Food)  REFERENCES Food(id_Food)
);
GO

-- ============================================================
-- BẢNG 18: Order_Restaurant (phụ thuộc Order, Restaurant)
-- ============================================================
CREATE TABLE Order_Restaurant (
    id_Order        INTEGER         NOT NULL,
    id_Restaurant   INTEGER         NOT NULL,
    shippingfee     DECIMAL(10,2),
    status          NVARCHAR(20),
    PRIMARY KEY (id_Order, id_Restaurant),
    CONSTRAINT FK_OrderRestaurant_Order      FOREIGN KEY (id_Order)      REFERENCES [Order](id_Order),
    CONSTRAINT FK_OrderRestaurant_Restaurant FOREIGN KEY (id_Restaurant) REFERENCES Restaurant(id_Restaurant)
);
GO

-- ============================================================
-- BẢNG 19: Order_Promotion (phụ thuộc Order, Promotion)
-- ============================================================
CREATE TABLE Order_Promotion (
    id_Order        INTEGER         NOT NULL,
    id_Promo        INTEGER         NOT NULL,
    discount_Amount DECIMAL(10,2)   NOT NULL DEFAULT 0,
    PRIMARY KEY (id_Order, id_Promo),
    CONSTRAINT FK_OrderPromo_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order),
    CONSTRAINT FK_OrderPromo_Promo FOREIGN KEY (id_Promo) REFERENCES Promotion(id_Promo)
);
GO

-- ============================================================
-- BẢNG 20: PaymentMethod (phụ thuộc Order)
-- ============================================================
CREATE TABLE PaymentMethod (
    id_Transaction  INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Order        INTEGER         NOT NULL,
    method          NVARCHAR(20)    NOT NULL,
    gateway         NVARCHAR(20),
    id_gateway      VARCHAR(50),
    status          NVARCHAR(20)    NOT NULL DEFAULT 'pending',
    created_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    amount          DECIMAL(10,2)   NOT NULL,
    CONSTRAINT FK_Payment_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order)
);
GO

-- ============================================================
-- BẢNG 21: Review (phụ thuộc User, Order, Restaurant, Driver)
-- ============================================================
CREATE TABLE Review (
    id_Review           INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User             INTEGER         NOT NULL,
    id_Order            INTEGER         NOT NULL,
    id_ForOrder         INTEGER,
    rating_Res          INTEGER         NOT NULL CHECK (rating_Res BETWEEN 1 AND 5),
    comment_ForRes      NVARCHAR(225),
    id_Driver           INTEGER,
    rating_Dri          INTEGER         CHECK (rating_Dri BETWEEN 1 AND 5),
    comment_ForDri      NVARCHAR(255),
    image               VARCHAR(255),
    video               VARCHAR(255),
    created_At          DATETIME        NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Review_User   FOREIGN KEY (id_User)  REFERENCES [User](id_User),
    CONSTRAINT FK_Review_Order  FOREIGN KEY (id_Order) REFERENCES [Order](id_Order),
    CONSTRAINT FK_Review_Driver FOREIGN KEY (id_Driver) REFERENCES Driver(id_Driver)
);
GO

-- ============================================================
-- BẢNG 22: Review_Food (phụ thuộc Review, Food)
-- ============================================================
CREATE TABLE Review_Food (
    id_ReviewFood   INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Review       INTEGER         NOT NULL,
    id_Food         INTEGER         NOT NULL,
    rating_Food     INTEGER         CHECK (rating_Food BETWEEN 1 AND 5),
    comment_Food    NVARCHAR(255),
    image           VARCHAR(255),
    video           VARCHAR(15),
    CONSTRAINT FK_ReviewFood_Review FOREIGN KEY (id_Review) REFERENCES Review(id_Review),
    CONSTRAINT FK_ReviewFood_Food   FOREIGN KEY (id_Food)   REFERENCES Food(id_Food)
);
GO

-- ============================================================
-- BẢNG 23: Complaint (phụ thuộc Order, User)
-- ============================================================
CREATE TABLE Complaint (
    id_Complaint    INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_Order        INTEGER         NOT NULL,
    id_User         INTEGER         NOT NULL,
    type            NVARCHAR(30),
    description     NVARCHAR(255),
    image           VARCHAR(255),
    video           VARCHAR(255),
    status          NVARCHAR(20)    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','resolved','rejected')),
    handled_By      INTEGER,
    resolution      NVARCHAR(255),
    created_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    resolved_At     DATETIME,
    CONSTRAINT FK_Complaint_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order),
    CONSTRAINT FK_Complaint_User  FOREIGN KEY (id_User)  REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 24: SystemLog (phụ thuộc User)
-- ============================================================
CREATE TABLE SystemLog (
    id_Log          INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User         INTEGER         NOT NULL,
    action          NVARCHAR(100)   NOT NULL,
    entity          NVARCHAR(100),
    id_Entity       INTEGER,
    old_Value       NVARCHAR(MAX),
    new_Value       NVARCHAR(MAX),
    created_At      DATETIME        NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_SystemLog_User FOREIGN KEY (id_User) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 25: Commission (phụ thuộc Order, Restaurant)
-- ============================================================
CREATE TABLE Commission (
    id_Commission INT PRIMARY KEY IDENTITY(1,1),
    id_Order INTEGER         NOT NULL,
    id_Restaurnt INTEGER     NOT NULL,
    comission_rate DECIMAL(5,2),
    commission_amount DECIMAL(10,2),
    created_At DATETIME
    CONSTRAINT FK_Commission_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order),
    CONSTRAINT FK_Commission_Restaurant FOREIGN KEY (id_Restaurnt) REFERENCES Restaurant(id_Restaurant)
);
GO

-- ============================================================
-- BẢNG 26: RestaurantMessage (phụ thuộc User)
-- ============================================================
CREATE TABLE RestaurantMessage (
    id_Message      INTEGER         PRIMARY KEY IDENTITY(1,1),
    sender_id       INTEGER         NOT NULL,
    receiver_id     INTEGER         NOT NULL,
    message_text    NVARCHAR(MAX)   NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    is_read         BIT             NOT NULL DEFAULT 0,
    CONSTRAINT FK_RestaurantMessage_Sender FOREIGN KEY (sender_id) REFERENCES [User](id_User),
    CONSTRAINT FK_RestaurantMessage_Receiver FOREIGN KEY (receiver_id) REFERENCES [User](id_User)
);
GO

-- ============================================================
-- BẢNG 27: SystemConfig (không phụ thuộc bảng nào)
-- ============================================================
CREATE TABLE SystemConfig (
    config_key      VARCHAR(100)    PRIMARY KEY,
    config_value    NVARCHAR(MAX)   NOT NULL,
    category        VARCHAR(50)     NOT NULL, -- 'operation', 'logistics', 'payment', 'ui_notification'
    description     NVARCHAR(255),
    is_enabled      BIT             NOT NULL DEFAULT 1,
    updated_at      DATETIME        NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- BẢNG 28: Wallet_Transaction (Lịch sử giao dịch ví)
-- ============================================================
CREATE TABLE Wallet_Transaction (
    id_Transaction   INTEGER         PRIMARY KEY IDENTITY(1,1),
    id_User          INTEGER         NOT NULL, -- Dùng id_User để ai cũng có thể giao dịch
    id_Order         INTEGER,        -- NULL nếu là giao dịch nạp/rút ngoài đơn hàng
    
    -- Mở rộng các loại giao dịch để phục vụ đủ 4 role (Admin, Customer, Owner, Driver)
    transaction_type NVARCHAR(50)    NOT NULL 
                     CHECK (transaction_type IN (
                         'top_up',               -- (Chung) Nạp tiền vào ví
                         'withdraw',             -- (Chung) Rút tiền về ngân hàng
                         'payment',              -- (Customer) Thanh toán đơn hàng
                         'refund',               -- (Customer) Nhận hoàn tiền khi đơn hủy
                         'order_revenue',        -- (Restaurant) Nhận tiền hàng từ đơn thành công
                         'commission_deduction', -- (Restaurant) Bị hệ thống trừ chiết khấu
                         'shipping_reward',      -- (Driver) Nhận tiền công ship
                         'order_deduction'       -- (Driver) Bị trừ tiền hàng khi giao đơn COD
                     )), 
                     
    amount           DECIMAL(10,2)   NOT NULL, 
    balance_before   DECIMAL(15,2)   NOT NULL, 
    balance_after    DECIMAL(15,2)   NOT NULL, 
    note             NVARCHAR(255),
    created_At       DATETIME        NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_WalletTransaction_User  FOREIGN KEY (id_User)  REFERENCES [User](id_User),
    CONSTRAINT FK_WalletTransaction_Order FOREIGN KEY (id_Order) REFERENCES [Order](id_Order)
);
-- Seed dữ liệu mặc định cho SystemConfig
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
('pay_vnpay_enabled', 'true', 'payment', N'Kích hoạt cổng thanh toán Ví Momo', 1),
('pay_min_checkout_value', '20000', 'payment', N'Giá trị đơn hàng tối thiểu để thanh toán (VND)', 1),

-- UI & Notifications
('ui_theme_mode', 'dark', 'ui_notification', N'Chế độ giao diện mặc định cho Admin (dark/light)', 1),
('ui_promo_banner_active', 'true', 'ui_notification', N'Hiển thị banner chương trình hot ngoài trang chủ', 1),
('ui_alert_broadcast_message', N'Hôm nay hệ thống tặng voucher 20k cho khách hàng mới!', 'ui_notification', N'Thông điệp thông báo chạy chữ trên ứng dụng', 1),
('ui_email_notification_trigger', 'true', 'ui_notification', N'Gửi email thông báo tự động khi đăng ký đối tác thành công', 1);
GO

-- ============================================================
-- ====                 DỮ LIỆU MẪU                       ====
-- ============================================================

-- ============================================================
-- INSERT: User
-- Bao gồm: admin, customer, restaurant_owner, driver
-- ============================================================
INSERT INTO [User] (phone, password, fullName, email, avatar, role, status, created_at, reputation_score, total_orders, cancel_Rate)
VALUES
-- Admin
(N'0900000001', 'hashed_admin_pw_1', N'Nguyễn Quản Trị', 'admin@quanlymona.vn',     NULL,                    'admin',            'active', '2024-01-01', 100, 0, 0.0),
-- Customers
(N'0901234567', 'hashed_pw_khachhang1', N'Trần Văn An',    'tranvanan@gmail.com',    'avatars/an.jpg',        'customer',         'active', '2024-02-10',  80, 12, 0.08),
(N'0912345678', 'hashed_pw_khachhang2', N'Lê Thị Bích',   'lethibich@gmail.com',    'avatars/bich.jpg',      'customer',         'active', '2024-03-05',  90,  8, 0.00),
(N'0923456789', 'hashed_pw_khachhang3', N'Phạm Minh Châu','minhchau@gmail.com',     NULL,                    'customer',         'active', '2024-04-20',  70,  5, 0.20),
-- Restaurant owners
(N'0934567890', 'hashed_pw_owner1',    N'Nguyễn Hoa Mai', 'hoamai.res@gmail.com',   'avatars/hoamai.jpg',    'restaurant_owner', 'active', '2024-01-15',  95,  0, 0.0),
(N'0945678901', 'hashed_pw_owner2',    N'Võ Thanh Tùng',  'thanhtung.res@gmail.com','avatars/thanhtung.jpg', 'restaurant_owner', 'active', '2024-02-01',  90,  0, 0.0),
(N'0956789012', 'hashed_pw_owner3',    N'Đặng Thị Kim',   'dangthikim.res@gmail.com',NULL,                   'restaurant_owner', 'active', '2024-03-10',  85,  0, 0.0),
-- Drivers
(N'0967890123', 'hashed_pw_driver1',   N'Bùi Văn Dũng',   'buivandung@gmail.com',   'avatars/dung.jpg',      'driver',           'active', '2024-01-20',  88,  0, 0.0),
(N'0978901234', 'hashed_pw_driver2',   N'Hoàng Thành Đạt','thanhdat@gmail.com',     NULL,                    'driver',           'active', '2024-02-25',  92,  0, 0.0),
(N'0989012345', 'hashed_pw_driver3',   N'Trịnh Văn Hùng', 'trinhvanhung@gmail.com', NULL,                    'driver',           'active', '2024-03-30',  78,  0, 0.0),
-- New Customer
(N'0999999999', 'hashed_pw_doyngan',   N'DoYNgan',        'doyngan@gmail.com',      NULL,                    'customer',         'active', '2026-05-25', 100,  0, 0.0);
GO

-- ============================================================
-- INSERT: Category
-- ============================================================
INSERT INTO Category (name, icon)
VALUES
(N'Cơm',          'icons/com.png'),
(N'Bún - Phở',    'icons/bun_pho.png'),
(N'Bánh mì',      'icons/banhmi.png'),
(N'Đồ uống',      'icons/douong.png'),
(N'Lẩu - Nướng',  'icons/lau_nuong.png'),
(N'Pizza - Burger','icons/fastfood.png'),
(N'Chay',         'icons/chay.png');
GO

-- ============================================================
-- INSERT: Restaurant
-- owner_id: 5=Hoa Mai, 6=Thanh Tùng, 7=Đặng Kim
-- ============================================================
INSERT INTO Restaurant (owner_id, name_Restaurant, description, logo, cover_image, address, lat, lng, openTime, closeTime, rating_avg)
VALUES
(5, N'Cơm Nhà Hoa Mai',      N'Quán cơm gia đình với các món ăn truyền thống miền Trung',       'logos/hoamai.png', 'covers/hoamai.jpg', N'12 Trần Phú, Hải Châu, Đà Nẵng',    16.0678, 108.2208, '07:00', '21:00', 4.50),
(6, N'Bún Bò Thanh Tùng',    N'Bún bò Huế chuẩn vị, nước dùng đậm đà hầm từ xương bò tươi',   'logos/thanhtung.png','covers/thanhtung.jpg',N'45 Lê Duẩn, Hải Châu, Đà Nẵng', 16.0710, 108.2190, '06:00', '14:00', 4.70),
(7, N'Pizza Đà Nẵng By Kim', N'Pizza kiểu Ý chính hiệu, phục vụ thêm burger và pasta',          'logos/kim.png',    'covers/kim.jpg',    N'88 Nguyễn Văn Linh, Thanh Khê, Đà Nẵng', 16.0800, 108.2100, '10:00', '22:00', 4.20);
GO

-- ============================================================
-- INSERT: Driver / Shipper
-- id_User: 8=Bùi Văn Dũng, 9=Hoàng Thành Đạt, 10=Trịnh Văn Hùng
-- ============================================================
INSERT INTO Driver (id_User, license_plate, cccd_Front, cccd_Back, driving_License, current_Lat, current_Lng, is_Busy, is_Online, rating_Avg, total_Orders)
VALUES
(8,  '43B1-12345', 'cccd/dung_f.jpg',  'cccd/dung_b.jpg',  'bl/dung_bl.jpg',  16.0750, 108.2220, 0, 1, 4.80, 120),
(9,  '43C2-67890', 'cccd/dat_f.jpg',   'cccd/dat_b.jpg',   'bl/dat_bl.jpg',   16.0690, 108.2150, 0, 1, 4.60,  95),
(10, '43A3-11223', 'cccd/hung_f.jpg',  'cccd/hung_b.jpg',  'bl/hung_bl.jpg',  16.0720, 108.2180, 0, 0, 4.30,  60);
GO

-- ============================================================
-- INSERT: Address
-- ============================================================
INSERT INTO Address (id_User, name, phone, full_Address, lat, lng, note, is_Default)
VALUES
-- Customer Trần Văn An (id=2)
(2, N'Nhà',       '0901234567', N'23 Đường Hùng Vương, Hải Châu, Đà Nẵng',        16.0700, 108.2200, N'Cổng màu xanh', 1),
(2, N'Công ty',   '0901234567', N'200 Nguyễn Công Trứ, Sơn Trà, Đà Nẵng',         16.0810, 108.2350, N'Tầng 3',        0),
-- Customer Lê Thị Bích (id=3)
(3, N'Nhà',       '0912345678', N'5 Lê Hồng Phong, Hải Châu, Đà Nẵng',            16.0660, 108.2170, NULL,             1),
(3, N'Trường học','0912345678', N'41 Lê Duẩn, Hải Châu, Đà Nẵng',                 16.0720, 108.2195, N'Cổng phụ',      0),
-- Customer Phạm Minh Châu (id=4)
(4, N'Nhà',       '0923456789', N'78 Trần Cao Vân, Thanh Khê, Đà Nẵng',           16.0780, 108.2090, NULL,             1),
-- Customer DoYNgan (id=11)
(11, N'Nhà',      '0999999999', N'100 Điện Biên Phủ, Đà Nẵng',                    16.0660, 108.2170, NULL,             1);
GO

-- ============================================================
-- INSERT: User_Address
-- ============================================================
INSERT INTO User_Address (id_User, id_Address)
VALUES
(2, 1),(2, 2),
(3, 3),(3, 4),
(4, 5),
(11, 6);
GO



-- ============================================================
-- INSERT: Notification
-- ============================================================
INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, image, created_At)
VALUES
(2, N'Đơn hàng đã xác nhận',   N'Nhà hàng Cơm Nhà Hoa Mai đã xác nhận đơn hàng #ORD001 của bạn.',  'order',    1, 1,    NULL, '2025-05-01 10:05:00'),
(2, N'Shipper đang lấy hàng',   N'Bùi Văn Dũng đang trên đường đến nhà hàng để lấy đơn #ORD001.',   'delivery', 1, 1,    NULL, '2025-05-01 10:30:00'),
(3, N'Khuyến mãi hôm nay',      N'Giảm ngay 20K cho đơn từ 100K. Dùng mã SAVE20K!',                 'promo',    0, NULL, 'promos/sale.jpg', '2025-05-02 08:00:00'),
(4, N'Đánh giá đơn hàng',       N'Hãy để lại đánh giá cho đơn hàng #ORD002 vừa hoàn thành nhé!',    'review',   0, 2,    NULL, '2025-05-01 15:00:00'),
(5, N'Đơn hàng mới',            N'Bạn vừa nhận được đơn hàng mới #ORD001. Hãy xác nhận ngay!',       'order',    1, 1,    NULL, '2025-05-01 10:00:00');
GO

-- ============================================================
-- INSERT: User_Notification
-- ============================================================
INSERT INTO User_Notification (id_Noti, id_User)
VALUES
(1, 2),(2, 2),(3, 3),(4, 4),(5, 5);
GO

-- ============================================================
-- INSERT: Food
-- id_Category: 1=Cơm, 2=Bún-Phở, 6=Pizza-Burger
-- id_Restaurant: 1=Hoa Mai, 2=Thanh Tùng, 3=Kim
-- ============================================================
INSERT INTO Food (id_Category, id_Restaurant, name, description, image, price, discount_Price, is_Availabe, sold_Count, prep_Time)
VALUES
-- Nhà hàng 1 - Cơm Nhà Hoa Mai
(1, 1, N'Cơm sườn nướng',        N'Cơm trắng kèm sườn heo nướng mật ong, rau cải xào, canh chua',      'food/com_suon.jpg',      45000, 40000, 1, 320, 15),
(1, 1, N'Cơm gà chiên mắm tỏi',  N'Gà chiên vàng sốt mắm tỏi thơm ngon, ăn kèm dưa leo muối',          'food/com_ga.jpg',        42000, NULL,  1, 210, 12),
(1, 1, N'Cơm tấm bì chả',        N'Cơm tấm đặc biệt với bì lợn, chả, trứng ốp la và mỡ hành',          'food/com_tam.jpg',       50000, 45000, 1, 180, 10),
-- Nhà hàng 2 - Bún Bò Thanh Tùng
(2, 2, N'Bún bò Huế đặc biệt',   N'Bún bò chuẩn Huế, nước dùng hầm 12 tiếng, thêm chân giò và huyết', 'food/bunbo_dacbiet.jpg', 55000, NULL,  1, 540, 10),
(2, 2, N'Bún bò thường',         N'Bún bò Huế với thịt bò và sả mùi đặc trưng',                         'food/bunbo_thuong.jpg',  40000, 35000, 1, 380, 8),
(2, 2, N'Bánh mì bò kẹp',        N'Bánh mì giòn kẹp thịt bò áp chảo, rau thơm và sốt đặc biệt',       'food/banhmi_bo.jpg',     30000, NULL,  1, 120, 5),
-- Nhà hàng 3 - Pizza Đà Nẵng By Kim
(6, 3, N'Pizza Hải Sản 25cm',     N'Đế dày phủ phô mai mozzarella, tôm, mực, nghêu tươi sốt cà chua',  'food/pizza_haissan.jpg', 180000, 160000, 1, 95, 20),
(6, 3, N'Pizza BBQ Gà 25cm',      N'Đế mỏng kiểu Ý, sốt BBQ, gà nướng, hành tây, ớt chuông',          'food/pizza_bbq.jpg',     170000, NULL,   1, 78, 20),
(6, 3, N'Burger Bò Phô Mai',      N'Burger beef patty 150g, phô mai cheddar, rau xà lách, cà chua',    'food/burger_bo.jpg',      90000, 80000,  1, 150, 12);
GO

-- ============================================================
-- INSERT: Food_Image
-- ============================================================
INSERT INTO Food_Image (id_Food, image)
VALUES
(1, 'food_imgs/com_suon_1.jpg'),
(1, 'food_imgs/com_suon_2.jpg'),
(4, 'food_imgs/bunbo_dacbiet_1.jpg'),
(4, 'food_imgs/bunbo_dacbiet_2.jpg'),
(7, 'food_imgs/pizza_haisan_1.jpg'),
(9, 'food_imgs/burger_bo_1.jpg');
GO

-- ============================================================
-- INSERT: Promotion
-- ============================================================
INSERT INTO Promotion (code, type, value, min_OrderValue, max_Discount, usage_Limit, used_Count, star_Date, end_Date, is_Applicable_To, id_Restaurant)
VALUES
('FREESHIP50',  'freeship', 50000, 100000, NULL,  200,  45, '2025-04-01', '2026-06-30', 'all',        NULL),
('GIAM10PCT',   'percent',  10,    80000,  30000, 100,  20, '2025-05-01', '2026-05-31', 'all',        NULL),
('HOAMAI20K',   'fixed',    20000, 150000, NULL,  50,    8, '2025-04-15', '2026-06-15', 'restaurant', 1),
('BUNBO15K',    'fixed',    15000, 80000,  NULL,  80,   15, '2025-05-01', '2026-07-31', 'restaurant', 2),
('PIZZA15PCT',  'percent',  15,    200000, 40000, 60,    5, '2025-04-20', '2026-05-31', 'restaurant', 3);
GO

-- ============================================================
-- INSERT: Voucher
-- ============================================================
INSERT INTO Voucher (id_User, id_Promo, used)
VALUES
(2, 1, 0),
(3, 2, 0),
(4, 3, 1);
GO

-- ============================================================
-- INSERT: Cart
-- ============================================================
INSERT INTO Cart (id_User, id_Restaurant, created_At, update_At)
VALUES
(2, 1, '2025-05-02 09:00:00', '2025-05-02 09:15:00'),
(3, 2, '2025-05-02 10:00:00', '2025-05-02 10:05:00'),
(4, 3, '2025-05-02 11:00:00', NULL);
GO

-- ============================================================
-- INSERT: Cart_Food
-- ============================================================
INSERT INTO Cart_Food (id_Cart, id_Food, quantity, note)
VALUES
(1, 1, 2, N'Ít cay'),
(1, 2, 1, NULL),
(2, 4, 1, N'Thêm huyết'),
(2, 5, 2, NULL),
(3, 7, 1, N'Thêm phô mai'),
(3, 9, 1, NULL);
GO

-- ============================================================
-- INSERT: Order
-- Đơn hàng thực tế phù hợp với usecase: đặt đơn, thanh toán, giao hàng
-- ============================================================
INSERT INTO [Order] (id_User, id_Restaurant, id_Driver, id_Address, order_Code, total_Amount, food_Amount, shipping_Fee, discount_Amount, payment_Method, payment_Status, order_Status, note, created_At, accepted_At, ready_At, picked_UpAt, delivered_At)
VALUES
-- Đơn 1: Đã giao - Trần Văn An tại Hoa Mai, Shipper Bùi Văn Dũng
(2, 1, 1, 1, 'ORD20250501001', 105000, 87000, 20000, 2000,  'online', 'paid',    'delivered', N'Giao giờ trưa', '2025-05-01 10:00:00', '2025-05-01 10:05:00', '2025-05-01 10:25:00', '2025-05-01 10:35:00', '2025-05-01 11:00:00'),
-- Đơn 2: Đã giao - Lê Thị Bích tại Thanh Tùng, Shipper Hoàng Thành Đạt
(3, 2, 2, 3, 'ORD20250501002', 70000,  55000, 20000, 5000,  'cash',   'paid',    'delivered', NULL,             '2025-05-01 11:30:00', '2025-05-01 11:35:00', '2025-05-01 11:50:00', '2025-05-01 12:00:00', '2025-05-01 12:25:00'),
-- Đơn 3: Đang giao - Phạm Minh Châu tại Pizza Kim, Shipper Trịnh Văn Hùng
(4, 3, 3, 5, 'ORD20250502001', 250000, 270000, 25000, 45000, 'online', 'paid',    'delivering',N'Gọi trước cửa', '2025-05-02 11:00:00', '2025-05-02 11:05:00', '2025-05-02 11:30:00', '2025-05-02 11:45:00', NULL),
-- Đơn 4: Đã bị huỷ - Trần Văn An huỷ đơn tại Bún Bò
(2, 2, NULL, 1, 'ORD20250430001', 0,    40000, 20000, 0,     'cash',   'pending', 'cancelled', NULL,             '2025-04-30 09:00:00', NULL, NULL, NULL, NULL),
-- Đơn 5: Đang chuẩn bị - Lê Thị Bích tại Hoa Mai
(3, 1, 1, 3, 'ORD20250502002', 65000,  50000, 20000, 5000,  'online', 'paid',    'preparing', N'Ít mỡ',         '2025-05-02 12:00:00', '2025-05-02 12:05:00', NULL, NULL, NULL),
-- Đơn 6: Đã giao - DoYNgan tại Hoa Mai
(11, 1, 1, 6, 'ORD_DOYNGAN_001', 85000, 65000, 20000, 0, 'cash', 'paid', 'delivered', NULL, GETDATE(), GETDATE(), GETDATE(), GETDATE(), GETDATE()),
-- Đơn 7: Đã giao - DoYNgan tại Thanh Tùng
(11, 2, 2, 6, 'ORD_DOYNGAN_002', 75000, 55000, 20000, 0, 'cash', 'paid', 'delivered', NULL, GETDATE(), GETDATE(), GETDATE(), GETDATE(), GETDATE()),
-- Đơn 8: Đã giao - DoYNgan tại Pizza Kim
(11, 3, 3, 6, 'ORD_DOYNGAN_003', 180000, 160000, 20000, 0, 'cash', 'paid', 'delivered', NULL, GETDATE(), GETDATE(), GETDATE(), GETDATE(), GETDATE());
GO

-- ============================================================
-- INSERT: Order_Food
-- ============================================================
INSERT INTO Order_Food (id_Order, id_Food, quantity, unit_Price, note)
VALUES
-- Đơn 1 (ORD20250501001): Cơm sườn x2, Cơm gà x1
(1, 1, 2, 40000, N'Ít cay'),
(1, 2, 1, 42000, NULL),
-- Đơn 2 (ORD20250501002): Bún bò thường x1, Bún bò đặc biệt x1
(2, 4, 1, 55000, N'Thêm huyết'),
(2, 5, 1, 35000, NULL),
-- Đơn 3 (ORD20250502001): Pizza hải sản x1, Burger bò x1
(3, 7, 1, 160000, NULL),
(3, 9, 1, 80000,  NULL),
-- Đơn 4 (ORD20250430001): Bún bò thường x1
(4, 5, 1, 40000, NULL),
-- Đơn 5 (ORD20250502002): Cơm tấm x1
(5, 3, 1, 50000, NULL);
GO

-- ============================================================
-- INSERT: Order_Restaurant
-- ============================================================
INSERT INTO Order_Restaurant (id_Order, id_Restaurant, shippingfee, status)
VALUES
(1, 1, 20000, 'delivered'),
(2, 2, 20000, 'delivered'),
(3, 3, 25000, 'delivering'),
(4, 2, 20000, 'cancelled'),
(5, 1, 20000, 'preparing');
GO

-- ============================================================
-- INSERT: Order_Promotion
-- ============================================================
INSERT INTO Order_Promotion (id_Order, id_Promo, discount_Amount)
VALUES
(1, 3, 2000.00),   -- HOAMAI20K áp dụng cho đơn 1 (đã đủ dk tối thiểu)
(2, 4, 5000.00),   -- BUNBO15K áp dụng cho đơn 2
(3, 5, 45000.00);  -- PIZZA15PCT áp dụng cho đơn 3
GO

-- ============================================================
-- INSERT: PaymentMethod
-- ============================================================
INSERT INTO PaymentMethod (id_Order, method, gateway, id_gateway, status, created_At, amount)
VALUES
(1, 'online', 'VNPay',  'VNP20250501001', 'paid',    '2025-05-01 10:01:00', 105000),
(2, 'cash',    NULL,     NULL,             'paid',    '2025-05-01 12:25:00',  70000),
(3, 'online', 'Momo',   'MOMO250502001',  'paid',    '2025-05-02 11:01:00', 250000),
(4, 'cash',    NULL,     NULL,             'pending', '2025-04-30 09:00:00',      0),
(5, 'online', 'ZaloPay','ZLP250502002',   'paid',    '2025-05-02 12:01:00',  65000);
GO

-- ============================================================
-- INSERT: Review (chỉ các đơn đã delivered)
-- ============================================================
INSERT INTO Review (id_User, id_Order, id_ForOrder, rating_Res, comment_ForRes, id_Driver, rating_Dri, comment_ForDri, image, created_At)
VALUES
-- Trần Văn An đánh giá đơn 1 (Hoa Mai + Shipper Bùi Văn Dũng)
(2, 1, 1, 5, N'Cơm ngon, đúng vị, đóng gói sạch sẽ. Sẽ order lại!',     1, 5, N'Shipper giao nhanh, thái độ tốt.', NULL, '2025-05-01 12:00:00'),
-- Lê Thị Bích đánh giá đơn 2 (Bún Bò + Shipper Hoàng Thành Đạt)
(3, 2, 2, 4, N'Bún bò ngon, nước dùng đậm đà. Bún hơi nát một chút.',    2, 4, N'Giao đúng giờ, lịch sự.', NULL, '2025-05-01 13:00:00');
GO

-- ============================================================
-- INSERT: Review_Food
-- ============================================================
INSERT INTO Review_Food (id_Review, id_Food, rating_Food, comment_Food, image, video)
VALUES
-- Review 1: đánh giá từng món của đơn 1
(1, 1, 5, N'Sườn nướng mật ong rất thơm, không bị khô!',     'rfood/suon1.jpg', NULL),
(1, 2, 5, N'Gà chiên mắm tỏi đậm đà, ăn kèm cơm rất ngon.', NULL,              NULL),
-- Review 2: đánh giá từng món của đơn 2
(2, 4, 4, N'Bún bò đặc biệt nhiều topping, nước dùng chuẩn vị Huế.', NULL, NULL),
(2, 5, 4, N'Khẩu phần vừa đủ, giá hợp lý.',                 NULL,              NULL);
GO

-- ============================================================
-- INSERT: Complaint (Khiếu nại)
-- ============================================================
INSERT INTO Complaint (id_Order, id_User, type, description, image, video, status, handled_By, resolution, created_At, resolved_At)
VALUES
-- Đơn 4 bị hủy, Trần Văn An khiếu nại về thời gian
(4, 2, N'late_delivery', N'Đơn hàng xác nhận nhưng quá lâu không có shipper, buộc phải hủy.', NULL, NULL, 'resolved', 1, N'Đã hoàn tiền cho khách. Xin lỗi vì bất tiện.', '2025-04-30 09:30:00', '2025-04-30 11:00:00'),
-- Phạm Minh Châu báo sai món
(4, 4, N'wrong_item',    N'Pizza giao thiếu đế, chỉ có topping.',                               'complaint/evidence.jpg', NULL, 'processing', 1, NULL, '2025-05-02 12:30:00', NULL),
-- Lê Thị Bích báo bún nát
(2, 3, N'food_quality',  N'Bún bị nát, trình bày không đẹp như hình mô tả.',                   NULL, NULL, 'pending', NULL, NULL, '2025-05-01 13:30:00', NULL);
GO

-- ============================================================
-- INSERT: SystemLog
-- ============================================================
INSERT INTO SystemLog (id_User, action, entity, id_Entity, old_Value, new_Value, created_At)
VALUES
(1, N'UPDATE_USER_STATUS',       'User',       3, N'{"status":"inactive"}',           N'{"status":"active"}',              '2025-03-01 09:00:00'),
(1, N'CREATE_PROMOTION',         'Promotion',  1, NULL,                                N'{"code":"FREESHIP50","value":50000}','2025-04-01 10:00:00'),
(5, N'UPDATE_FOOD_PRICE',        'Food',       1, N'{"price":50000}',                  N'{"price":45000}',                  '2025-04-10 14:30:00'),
(1, N'RESOLVE_COMPLAINT',        'Complaint',  1, N'{"status":"processing"}',          N'{"status":"resolved"}',            '2025-04-30 11:00:00'),
(6, N'UPDATE_RESTAURANT_INFO',   'Restaurant', 2, N'{"rating_avg":4.60}',              N'{"rating_avg":4.70}',              '2025-05-01 13:05:00');
GO

-- ============================================================
-- INSERT: Commission
-- ============================================================
INSERT INTO Commission (id_Order, id_Restaurnt, comission_rate, commission_amount, created_At)
VALUES
(1, 1, 10.00, 10000, GETDATE()),
(2, 2, 12.50, 25000, GETDATE()),
(3, 3, 8.00, 12000, GETDATE()),
(4, 2, 15.00, 18000, GETDATE()),
(5, 1, 10.00, 15000, GETDATE());


-- ============================================================
-- INSERT: RestaurantMessage
-- ============================================================
INSERT INTO RestaurantMessage (sender_id, receiver_id, message_text, created_at, is_read)
VALUES
(5, 3, N'abc nè', DATEADD(MINUTE, -10, GETDATE()), 1),
(11, 5, N'Chào nhà hàng ạ, mình muốn hỏi về thực đơn hôm nay.', DATEADD(MINUTE, -2, GETDATE()), 0),
(11, 6, N'Chào nhà hàng ạ, mình muốn đặt món bún bò Huế.', DATEADD(MINUTE, -2, GETDATE()), 0),
(11, 7, N'Chào nhà hàng, pizza hải sản còn không ạ?', DATEADD(MINUTE, -2, GETDATE()), 0);
GO

-- ============================================================
-- Cập nhật default_Address_Id cho User sau khi có địa chỉ
-- ============================================================
UPDATE [User] SET default_Address_Id = 1 WHERE id_User = 2;
UPDATE [User] SET default_Address_Id = 3 WHERE id_User = 3;
UPDATE [User] SET default_Address_Id = 5 WHERE id_User = 4;
UPDATE [User] SET default_Address_Id = 6 WHERE id_User = 11;
GO

-- ============================================================
-- KIỂM TRA NHANH
-- ============================================================
SELECT 'User'            AS [Bảng], COUNT(*) AS [Số bản ghi] FROM [User]
UNION ALL
SELECT 'Category',        COUNT(*) FROM Category
UNION ALL
SELECT 'Restaurant',      COUNT(*) FROM Restaurant
UNION ALL
SELECT 'Driver',          COUNT(*) FROM Driver
UNION ALL
SELECT 'Address',         COUNT(*) FROM Address
UNION ALL
SELECT 'Food',            COUNT(*) FROM Food
UNION ALL
SELECT 'Promotion',       COUNT(*) FROM Promotion
UNION ALL
SELECT 'Order',           COUNT(*) FROM [Order]
UNION ALL
SELECT 'Order_Food',      COUNT(*) FROM Order_Food
UNION ALL
SELECT 'Review',          COUNT(*) FROM Review
UNION ALL
SELECT 'Complaint',       COUNT(*) FROM Complaint
UNION ALL
SELECT 'PaymentMethod',   COUNT(*) FROM PaymentMethod
UNION ALL
SELECT 'SystemLog',       COUNT(*) FROM SystemLog;
GO


