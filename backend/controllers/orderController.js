const { sql, poolPromise } = require('../config/db');

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Khoảng cách (km)
}

async function clearOrderDebt(pool, order) {
  try {
    const baseAmt = parseFloat(order.food_Amount || 0) + parseFloat(order.shipping_Fee || 0) - parseFloat(order.discount_Amount || 0);
    const debtAmt = parseFloat(order.total_Amount || 0) - baseAmt;
    if (debtAmt > 0.01) {
      const userRes = await pool.request()
        .input('id_User', order.id_User)
        .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
        
      if (userRes.recordset.length > 0) {
        const balance_before = parseFloat(userRes.recordset[0].wallet_balance || 0);
        const balance_after = balance_before + debtAmt;
        
        await pool.request()
          .input('id_User', order.id_User)
          .input('balance', balance_after)
          .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @id_User');
          
        await pool.request()
          .input('id_User', order.id_User)
          .input('id_Order', order.id_Order)
          .input('amount', debtAmt)
          .input('balance_before', balance_before)
          .input('balance_after', balance_after)
          .input('note', `Thu hồi dư nợ bom hàng từ đơn #${order.order_Code}`)
          .query(`
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (@id_User, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
          `);
      }
    }
  } catch (err) {
    console.error('Error in clearOrderDebt:', err);
  }
}

exports.chargeBoomOrder = async (pool, id_Order) => {
  try {
    const orderCheck = await pool.request()
      .input('id_Order', id_Order)
      .query("SELECT id_User, id_Driver, id_Restaurant, order_Code, total_Amount, food_Amount, shipping_Fee, discount_Amount, payment_Method, order_Status FROM [Order] WHERE id_Order = @id_Order");
      
    if (orderCheck.recordset.length > 0) {
      const order = orderCheck.recordset[0];
      
      // Chỉ phạt nếu đơn hàng chưa ở các trạng thái kết thúc (boom, delivered, cancelled)
      if (order.order_Status !== 'boom' && order.order_Status !== 'delivered' && order.order_Status !== 'cancelled') {
        const pmCheck = await pool.request()
          .input('id_Order', id_Order)
          .query("SELECT method, status FROM PaymentMethod WHERE id_Order = @id_Order");
          
        const isCod = (order.payment_Method === 'cash') || 
                      (pmCheck.recordset.length > 0 && pmCheck.recordset[0].method === 'cash') ||
                      (order.payment_Method && ['cod', 'tiền mặt', 'cash'].includes(order.payment_Method.toLowerCase()));
                      
        const transaction = pool.transaction();
        await transaction.begin();
        try {
          // A. Cập nhật trạng thái đơn hàng thành boom và payment_Status thành failed
          await transaction.request()
            .input('id', id_Order)
            .query("UPDATE [Order] SET order_Status = 'boom', payment_Status = 'failed' WHERE id_Order = @id");
            
          await transaction.request()
            .input('id_Order', id_Order)
            .query("UPDATE PaymentMethod SET status = 'failed' WHERE id_Order = @id_Order");

          // B. Phạt khách hàng (nợ ví) và trừ điểm uy tín (Chỉ áp dụng cho đơn COD)
          if (isCod) {
            const userRes = await transaction.request()
              .input('userId', order.id_User)
              .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @userId');
              
            if (userRes.recordset.length > 0) {
              const balance_before = parseFloat(userRes.recordset[0].wallet_balance);
              const balance_after = balance_before - parseFloat(order.total_Amount);
              
              await transaction.request()
                .input('userId', order.id_User)
                .input('balance', balance_after)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @userId');
                
              await transaction.request()
                .input('userId', order.id_User)
                .query(`
                  UPDATE [User] 
                  SET reputation_score = CASE WHEN reputation_score - 20 < 0 THEN 0 ELSE reputation_score - 20 END 
                  WHERE id_User = @userId
                `);
                
              const noteMsg = `Phạt bom hàng đơn COD #${order.order_Code}`;
              await transaction.request()
                .input('userId', order.id_User)
                .input('id_Order', id_Order)
                .input('amount', -order.total_Amount)
                .input('balance_before', balance_before)
                .input('balance_after', balance_after)
                .input('note', noteMsg)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@userId, @id_Order, 'payment', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              // Gửi thông báo cho User về việc bị phạt trừ tiền ví
              const notiTitle = 'Tài khoản ví bị trừ tiền do bom hàng';
              const notiBody = `Bạn bị trừ ${order.total_Amount.toLocaleString('vi-VN')} đ vào ví và giảm 20 điểm uy tín do bom hàng đơn #${order.order_Code}.`;
              
              const notiResult = await transaction.request()
                .input('id_User', order.id_User)
                .input('title', notiTitle)
                .input('body', notiBody)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  OUTPUT inserted.id_Noti
                  VALUES (@id_User, @title, @body, 'WALLET', 0, GETDATE())
                `);
              const id_Noti = notiResult.recordset[0].id_Noti;
              await transaction.request()
                .input('id_Noti', id_Noti)
                .input('id_User', order.id_User)
                .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
            }
          } else {
            // Đơn Online thì khách hàng đã trả tiền trước rồi, không trừ ví, chỉ trừ điểm uy tín của khách
            await transaction.request()
              .input('userId', order.id_User)
              .query(`
                UPDATE [User] 
                SET reputation_score = CASE WHEN reputation_score - 20 < 0 THEN 0 ELSE reputation_score - 20 END 
                WHERE id_User = @userId
              `);
          }

          // Lấy cấu hình phí dịch vụ
          const resFeePercentRes = await transaction.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
          const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
          const foodAmount = order.food_Amount || 0;
          const foodAmountBase = Math.round(foodAmount / (1.0 + resFeePercent / 100.0));
          const adminResCommission = foodAmount - foodAmountBase;

          const configRes = await transaction.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'");
          const feePercent = configRes.recordset[0].fee_percent;
          const shippingFee = order.shipping_Fee || 0;
          const shipperEarned = Math.round(shippingFee / (1.0 + feePercent / 100.0));
          const adminShipperCommission = shippingFee - shipperEarned;
          const refundAmount = isCod ? foodAmountBase : 0;

          // C. Đền bù cho Shipper (Tài xế)
          if (order.id_Driver) {
            const driverRes = await transaction.request()
              .input('id_Driver', order.id_Driver)
              .query("SELECT id_User FROM Driver WHERE id_Driver = @id_Driver");
              
            if (driverRes.recordset.length > 0) {
              const driverUserId = driverRes.recordset[0].id_User;
              
              // COD hoàn ký quỹ foodAmountBase + trả công ship shipperEarned. Online trả shipperEarned.
              const totalShipperCompensation = refundAmount + shipperEarned;
              
              const wShipperCheck = await transaction.request()
                .input('driverUserId', driverUserId)
                .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @driverUserId');
              
              if (wShipperCheck.recordset.length > 0) {
                const wShipper = parseFloat(wShipperCheck.recordset[0].wallet_balance || 0);
                
                let driverBalance = wShipper;
                
                if (isCod) {
                  // Giao dịch 1: Hoàn tiền ký quỹ COD
                  const bA = driverBalance;
                  const bA_after = bA + refundAmount;
                  await transaction.request()
                    .input('driverUserId', driverUserId)
                    .input('id_Order', id_Order)
                    .input('amount', refundAmount)
                    .input('balance_before', bA)
                    .input('balance_after', bA_after)
                    .query(`
                      UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @driverUserId;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@driverUserId, @id_Order, 'refund', @amount, @balance_before, @balance_after, N'Hoàn trả tiền ký quỹ đơn COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                    `);
                  driverBalance = bA_after;
                  
                  // Giao dịch 2: Chi phí ship đền bù
                  const bB = driverBalance;
                  const bB_after = bB + shipperEarned;
                  await transaction.request()
                    .input('driverUserId', driverUserId)
                    .input('id_Order', id_Order)
                    .input('amount', shipperEarned)
                    .input('balance_before', bB)
                    .input('balance_after', bB_after)
                    .query(`
                      UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @driverUserId;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@driverUserId, @id_Order, 'shipping_reward', @amount, @balance_before, @balance_after, N'Phí ship đền bù đơn hàng COD bị bom #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                    `);
                  driverBalance = bB_after;
                } else {
                  // Giao dịch ship đền bù đơn Online
                  const bA = driverBalance;
                  const bA_after = bA + shipperEarned;
                  await transaction.request()
                    .input('driverUserId', driverUserId)
                    .input('id_Order', id_Order)
                    .input('amount', shipperEarned)
                    .input('balance_before', bA)
                    .input('balance_after', bA_after)
                    .query(`
                      UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @driverUserId;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@driverUserId, @id_Order, 'shipping_reward', @amount, @balance_before, @balance_after, N'Phí ship đền bù đơn hàng Online bị bom #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                    `);
                  driverBalance = bA_after;
                }
                
                const notiMsg = isCod 
                  ? `Đền bù bom đơn #${order.order_Code}: Hoàn ký quỹ +${refundAmount.toLocaleString('vi-VN')}đ, Tiền ship +${shipperEarned.toLocaleString('vi-VN')}đ`
                  : `Đền bù bom đơn #${order.order_Code}: Tiền ship +${shipperEarned.toLocaleString('vi-VN')}đ`;
                  
                // Gửi thông báo cho Shipper
                const notiResult = await transaction.request()
                  .input('driverUserId', driverUserId)
                  .input('id_Order', id_Order)
                  .input('body', `Đơn hàng #${order.order_Code} bị bom. Hệ thống đền bù cho bạn: ${notiMsg}`)
                  .query(`
                    INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
                    OUTPUT inserted.id_Noti
                    VALUES (@driverUserId, N'Hệ thống đền bù đơn bom', @body, 'WALLET', 0, @id_Order, GETDATE())
                  `);
                const id_Noti_Shipper = notiResult.recordset[0].id_Noti;
                await transaction.request()
                  .input('id_Noti', id_Noti_Shipper)
                  .input('driverUserId', driverUserId)
                  .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @driverUserId)');
              }
            }
          }

          // D. Đền bù cho Nhà hàng (Restaurant) - Chỉ đền bù qua ví nếu là đơn Online (vì đơn COD nhà hàng đã nhận tiền mặt từ shipper lúc lấy hàng)
          if (order.id_Restaurant && !isCod) {
            const resRes = await transaction.request()
              .input('id_Restaurant', order.id_Restaurant)
              .query("SELECT owner_id FROM Restaurant WHERE id_Restaurant = @id_Restaurant");
              
            if (resRes.recordset.length > 0) {
              const resOwnerId = resRes.recordset[0].owner_id;
              const restaurantRevenue = foodAmountBase;
              
              if (restaurantRevenue > 0) {
                const wResCheck = await transaction.request()
                  .input('resOwnerId', resOwnerId)
                  .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @resOwnerId');
                  
                if (wResCheck.recordset.length > 0) {
                  const wRes = parseFloat(wResCheck.recordset[0].wallet_balance || 0);
                  const newResBalance = wRes + restaurantRevenue;
                  
                  await transaction.request()
                    .input('resOwnerId', resOwnerId)
                    .input('balance', newResBalance)
                    .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @resOwnerId');
                    
                  const noteMsg = `Đền bù bom đơn #${order.order_Code} (Chiết khấu: -${adminResCommission.toLocaleString('vi-VN')}đ)`;
                  
                  await transaction.request()
                    .input('resOwnerId', resOwnerId)
                    .input('id_Order', id_Order)
                    .input('amount', restaurantRevenue)
                    .input('balance_before', wRes)
                    .input('balance_after', newResBalance)
                    .input('note', noteMsg)
                    .query(`
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@resOwnerId, @id_Order, 'order_revenue', @amount, @balance_before, @balance_after, @note, GETDATE())
                    `);
                    
                  // Gửi thông báo cho nhà hàng
                  const notiResult = await transaction.request()
                    .input('resOwnerId', resOwnerId)
                    .input('id_Order', id_Order)
                    .input('body', `Đơn hàng #${order.order_Code} bị bom. Hệ thống đền bù cho bạn ${restaurantRevenue.toLocaleString('vi-VN')}đ tiền món ăn.`)
                    .query(`
                      INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
                      OUTPUT inserted.id_Noti
                      VALUES (@resOwnerId, N'Đền bù đơn bom hàng', @body, 'WALLET', 0, @id_Order, GETDATE())
                    `);
                  const id_Noti_Res = notiResult.recordset[0].id_Noti;
                  await transaction.request()
                    .input('id_Noti', id_Noti_Res)
                    .input('resOwnerId', resOwnerId)
                    .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @resOwnerId)');
                }
              }
            }
          }

          // E. Cập nhật Ví hệ thống (Admin - id_User = 1)
          const adminId = 1;
          const adminCheck = await transaction.request()
            .input('adminId', adminId)
            .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @adminId');
            
          if (adminCheck.recordset.length > 0) {
            let adminBalance = parseFloat(adminCheck.recordset[0].wallet_balance || 0);
            
            if (isCod) {
              // 1. Ghi nhận công nợ phạt thu từ khách hàng
              const b1 = adminBalance;
              const b1_after = b1 + parseFloat(order.total_Amount);
              await transaction.request()
                .input('adminId', adminId)
                .input('id_Order', id_Order)
                .input('amount', order.total_Amount)
                .input('balance_before', b1)
                .input('balance_after', b1_after)
                .input('note', `Ghi nhận nợ phải thu phạt bom đơn COD #${order.order_Code} từ khách hàng`)
                .query(`
                  UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @adminId;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@adminId, @id_Order, 'payment', @amount, @balance_before, @balance_after, @note, GETDATE());
                `);
              adminBalance = b1_after;
              
              // 2. Chi đền bù trả tiền ký quỹ đơn COD cho tài xế
              const b2 = adminBalance;
              const b2_after = b2 - refundAmount;
              await transaction.request()
                .input('adminId', adminId)
                .input('id_Order', id_Order)
                .input('amount', -refundAmount)
                .input('balance_before', b2)
                .input('balance_after', b2_after)
                .input('note', `Hoàn trả tiền ký quỹ đơn COD #${order.order_Code} cho tài xế`)
                .query(`
                  UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @adminId;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@adminId, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE());
                `);
              adminBalance = b2_after;
              
              // 3. Chi phí ship đền bù cho tài xế
              const b3 = adminBalance;
              const b3_after = b3 - shipperEarned;
              await transaction.request()
                .input('adminId', adminId)
                .input('id_Order', id_Order)
                .input('amount', -shipperEarned)
                .input('balance_before', b3)
                .input('balance_after', b3_after)
                .input('note', `Chi đền bù phí ship đơn COD #${order.order_Code} cho tài xế`)
                .query(`
                  UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @adminId;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@adminId, @id_Order, 'shipping_reward', @amount, @balance_before, @balance_after, @note, GETDATE());
                `);
              adminBalance = b3_after;
              
              // 4. Chi tiền đền bù món ăn đơn COD cho nhà hàng (BỎ QUA VÌ ĐƠN COD NHÀ HÀNG ĐÃ NHẬN TIỀN MẶT TỪ SHIPPER, KHÔNG ĐƯỢC ĐỀN BÙ VÍ SONG PHƯƠNG)
              // Không thực hiện trừ ví admin hay cộng ví nhà hàng nữa để tránh nhà hàng nhận tiền 2 lần.
            } else {
              // Online: Đã thanh toán trước nên không ghi nhận thêm nợ phải thu từ khách
              // 1. Chi phí ship đền bù cho tài xế
              const b1 = adminBalance;
              const b1_after = b1 - shipperEarned;
              await transaction.request()
                .input('adminId', adminId)
                .input('id_Order', id_Order)
                .input('amount', -shipperEarned)
                .input('balance_before', b1)
                .input('balance_after', b1_after)
                .input('note', `Chi đền bù phí ship đơn Online #${order.order_Code} cho tài xế`)
                .query(`
                  UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @adminId;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@adminId, @id_Order, 'shipping_reward', @amount, @balance_before, @balance_after, @note, GETDATE());
                `);
              adminBalance = b1_after;
              
              // 2. Chi tiền đền bù món ăn cho nhà hàng
              const b2 = adminBalance;
              const b2_after = b2 - foodAmountBase;
              await transaction.request()
                .input('adminId', adminId)
                .input('id_Order', id_Order)
                .input('amount', -foodAmountBase)
                .input('balance_before', b2)
                .input('balance_after', b2_after)
                .input('note', `Chi đền bù tiền món ăn đơn Online #${order.order_Code} cho nhà hàng`)
                .query(`
                  UPDATE [User] SET wallet_balance = @balance_after WHERE id_User = @adminId;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@adminId, @id_Order, 'order_revenue', @amount, @balance_before, @balance_after, @note, GETDATE());
                `);
              adminBalance = b2_after;
            }
          }
          
          await transaction.commit();
        } catch (txErr) {
          await transaction.rollback();
          throw txErr;
        }
      }
    }
  } catch (error) {
    console.error('Error in chargeBoomOrder:', error);
  }
}

// Lấy danh sách đơn hàng của user
exports.getOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', req.user.id)
      .query(`
        SELECT o.*, r.name_Restaurant, r.logo,
               CASE WHEN EXISTS (SELECT 1 FROM Review rev WHERE rev.id_Order = o.id_Order) THEN 1 ELSE 0 END as is_Reviewed
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        WHERE o.id_User = @userId
        ORDER BY o.created_At DESC
      `);
      
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Lấy chi tiết đơn hàng
exports.getOrderDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const orderResult = await pool.request()
      .input('id', id)
      .input('userId', req.user.id)
      .query(`
        SELECT o.*, r.name_Restaurant, r.address as res_address, r.owner_id as res_owner_id, 
               a.full_Address as user_address, a.name as user_name, a.phone as user_phone,
               driver_u.id_User as driver_user_id, driver_u.fullName as driver_name
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
        LEFT JOIN Driver d ON o.id_Driver = d.id_Driver
        LEFT JOIN [User] driver_u ON d.id_User = driver_u.id_User
        WHERE o.id_Order = @id AND o.id_User = @userId
      `);

    if (orderResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = orderResult.recordset[0];

    // Lấy chi tiết món ăn
    const itemsResult = await pool.request()
      .input('orderId', id)
      .query(`
        SELECT ofood.*, f.name, f.image
        FROM Order_Food ofood
        JOIN Food f ON ofood.id_Food = f.id_Food
        WHERE ofood.id_Order = @orderId
      `);
      
    order.items = itemsResult.recordset;

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Tính phí vận chuyển cho khách hàng (gồm cả chiết khấu shipper)
exports.getShippingFee = async (req, res) => {
  const { id_Address, id_Restaurant } = req.query;
  if (!id_Address || !id_Restaurant) {
    return res.status(400).json({ message: 'Thiếu id_Address hoặc id_Restaurant' });
  }

  try {
    const pool = await poolPromise;
    
    // Fetch Restaurant coords
    const restaurantRes = await pool.request()
      .input('id_Restaurant', id_Restaurant)
      .query('SELECT lat, lng FROM Restaurant WHERE id_Restaurant = @id_Restaurant');
      
    if (restaurantRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy nhà hàng' });
    }
    
    const addressRes = await pool.request()
      .input('id_Address', id_Address)
      .query('SELECT lat, lng FROM Address WHERE id_Address = @id_Address');
      
    if (addressRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }
    
    const restaurant = restaurantRes.recordset[0];
    const address = addressRes.recordset[0];
    
    if (restaurant.lat == null || restaurant.lng == null || address.lat == null || address.lng == null) {
      return res.status(400).json({ message: 'Vị trí của nhà hàng hoặc địa chỉ chưa được cấu hình tọa độ' });
    }
    
    const distance = calculateDistance(restaurant.lat, restaurant.lng, address.lat, address.lng);
    
    const configRes = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('log_base_delivery_fee', 'log_per_km_fee', 'op_shipper_fee_percent', 'log_max_delivery_distance')
    `);

    let baseFee = 15000;
    let perKmFee = 5000;
    let maxDistance = 15.0;
    let shipperFeePercent = 5.0;

    configRes.recordset.forEach(c => {
      if (c.config_key === 'log_base_delivery_fee' && c.is_enabled) {
        baseFee = parseFloat(c.config_value) || 15000;
      }
      if (c.config_key === 'log_per_km_fee' && c.is_enabled) {
        perKmFee = parseFloat(c.config_value) || 5000;
      }
      if (c.config_key === 'log_max_delivery_distance' && c.is_enabled) {
        maxDistance = parseFloat(c.config_value) || 15.0;
      }
      if (c.config_key === 'op_shipper_fee_percent' && c.is_enabled) {
        shipperFeePercent = parseFloat(c.config_value) || 5.0;
      }
    });

    if (distance > maxDistance) {
      return res.status(400).json({ 
        message: `Khoảng cách giao hàng (${distance.toFixed(1)}km) vượt quá giới hạn tối đa (${maxDistance}km)`,
        distance,
        maxDistance,
        shippingFee: null
      });
    }

    let baseShippingFee = baseFee;
    if (distance > 2) {
      baseShippingFee += Math.ceil(distance - 2) * perKmFee;
    }
    const customerShippingFee = Math.round(baseShippingFee * (1 + shipperFeePercent / 100.0));

    res.json({
      distance: parseFloat(distance.toFixed(2)),
      baseShippingFee,
      shippingFee: customerShippingFee,
      shipperFeePercent
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đặt hàng (Checkout)
exports.placeOrder = async (req, res) => {
  const { id_Address, id_Restaurant, payment_Method, note, id_Promo, id_Promo_Freeship, id_Promo_Discount } = req.body;
  const id_User = req.user.id;
  
  try {
    const pool = await poolPromise;
    
    // 1. Lấy giỏ hàng
    const cartResult = await pool.request()
      .input('id_User', id_User)
      .input('id_Restaurant', id_Restaurant)
      .query(`
        SELECT c.id_Cart, cf.id_Food, cf.quantity, cf.note, f.price, f.discount_Price 
        FROM Cart c
        JOIN Cart_Food cf ON c.id_Cart = cf.id_Cart
        JOIN Food f ON cf.id_Food = f.id_Food
        WHERE c.id_User = @id_User AND c.id_Restaurant = @id_Restaurant
      `);
      
    if (cartResult.recordset.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }
    
    const id_Cart = cartResult.recordset[0].id_Cart;
    
    // A. Lấy cấu hình chiết khấu nhà hàng
    const configRes = await pool.request()
      .query("SELECT config_value FROM SystemConfig WHERE config_key = 'op_service_fee_percent' AND is_enabled = 1");
    let resFeePercent = 15.0; // default 15%
    if (configRes.recordset.length > 0) {
      resFeePercent = parseFloat(configRes.recordset[0].config_value) || 15.0;
    }
    const resFactor = 1 + resFeePercent / 100.0;

    let food_Amount = 0;
    cartResult.recordset.forEach(item => {
      const price = item.discount_Price || item.price;
      const inflatedPrice = Math.round(price * resFactor);
      food_Amount += inflatedPrice * item.quantity;
    });

    // B. Tính phí giao hàng động
    const restaurantRes = await pool.request()
      .input('id_Restaurant', id_Restaurant)
      .query('SELECT lat, lng FROM Restaurant WHERE id_Restaurant = @id_Restaurant');
      
    const addressRes = await pool.request()
      .input('id_Address', id_Address)
      .query('SELECT lat, lng FROM Address WHERE id_Address = @id_Address');
      
    if (restaurantRes.recordset.length === 0 || addressRes.recordset.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy nhà hàng hoặc địa chỉ giao hàng' });
    }
    
    const restaurant = restaurantRes.recordset[0];
    const address = addressRes.recordset[0];
    
    if (restaurant.lat == null || restaurant.lng == null || address.lat == null || address.lng == null) {
      return res.status(400).json({ message: 'Vị trí nhà hàng hoặc địa chỉ giao hàng chưa được cấu hình tọa độ' });
    }
    
    const distance = calculateDistance(restaurant.lat, restaurant.lng, address.lat, address.lng);
    
    const shippingConfigRes = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('log_base_delivery_fee', 'log_per_km_fee', 'op_shipper_fee_percent', 'log_max_delivery_distance')
    `);

    let baseFee = 15000;
    let perKmFee = 5000;
    let maxDistance = 15.0;
    let shipperFeePercent = 5.0;

    shippingConfigRes.recordset.forEach(c => {
      if (c.config_key === 'log_base_delivery_fee' && c.is_enabled) {
        baseFee = parseFloat(c.config_value) || 15000;
      }
      if (c.config_key === 'log_per_km_fee' && c.is_enabled) {
        perKmFee = parseFloat(c.config_value) || 5000;
      }
      if (c.config_key === 'log_max_delivery_distance' && c.is_enabled) {
        maxDistance = parseFloat(c.config_value) || 15.0;
      }
      if (c.config_key === 'op_shipper_fee_percent' && c.is_enabled) {
        shipperFeePercent = parseFloat(c.config_value) || 5.0;
      }
    });

    if (distance > maxDistance) {
      return res.status(400).json({ message: `Khoảng cách giao hàng (${distance.toFixed(1)}km) vượt quá giới hạn tối đa (${maxDistance}km)` });
    }

    let baseShippingFee = baseFee;
    if (distance > 2) {
      baseShippingFee += Math.ceil(distance - 2) * perKmFee;
    }
    const shipping_Fee = Math.round(baseShippingFee * (1 + shipperFeePercent / 100.0));
    
    let discount_Amount = 0;
    const appliedPromos = [];

    // Helper validate cục bộ
    const validatePromo = async (promoOrVoucherId, expectedType) => {
      if (!promoOrVoucherId) return null;
      
      let promo = null;
      let voucherId = null;
      
      if (typeof promoOrVoucherId === 'string' && promoOrVoucherId.startsWith('voucher_')) {
        voucherId = parseInt(promoOrVoucherId.replace('voucher_', ''), 10);
        const voucherResult = await pool.request()
          .input('voucherId', voucherId)
          .input('id_User', id_User)
          .query(`
            SELECT v.id_Voucher, p.id_Promo, p.code, p.value, p.end_Date AS expiry_date,
                   p.type, p.min_OrderValue, p.max_Discount, p.id_Restaurant,
                   p.sys_funding_percent, p.res_funding_percent, p.usage_limit_per_user
            FROM Voucher v
            JOIN Promotion p ON v.id_Promo = p.id_Promo
            WHERE v.id_Voucher = @voucherId AND v.id_User = @id_User AND v.used = 0 AND (p.end_Date IS NULL OR p.end_Date >= GETDATE())
          `);
        
        if (voucherResult.recordset.length === 0) {
          throw new Error('Voucher không tồn tại, đã hết hạn hoặc đã sử dụng');
        }
        
        const row = voucherResult.recordset[0];
        promo = {
          id_Promo: row.id_Promo || null,
          code: row.code,
          type: row.type || 'fixed',
          value: Number(row.value),
          min_OrderValue: row.min_OrderValue !== null ? Number(row.min_OrderValue) : 0,
          max_Discount: row.max_Discount !== null ? Number(row.max_Discount) : Number(row.value),
          id_Restaurant: row.id_Restaurant || null,
          id_Voucher: row.id_Voucher,
          sys_funding_percent: row.sys_funding_percent !== null ? Number(row.sys_funding_percent) : 100,
          res_funding_percent: row.res_funding_percent !== null ? Number(row.res_funding_percent) : 0,
          usage_limit_per_user: row.usage_limit_per_user !== null ? Number(row.usage_limit_per_user) : 1
        };
      } else {
        const promoId = typeof promoOrVoucherId === 'string' && promoOrVoucherId.startsWith('promo_')
          ? parseInt(promoOrVoucherId.replace('promo_', ''), 10)
          : parseInt(promoOrVoucherId, 10);
          
        if (!isNaN(promoId)) {
          const promoResult = await pool.request()
            .input('promoId', promoId)
            .query('SELECT * FROM Promotion WHERE id_Promo = @promoId');
            
          if (promoResult.recordset.length === 0) {
            throw new Error('Chương trình khuyến mãi không tồn tại');
          }
          
          const row = promoResult.recordset[0];
          
          if (row.end_Date && new Date(row.end_Date) < new Date()) {
            throw new Error('Chương trình khuyến mãi đã hết hạn');
          }
          
          if (row.usage_Limit !== null && row.used_Count >= row.usage_Limit) {
            throw new Error('Chương trình khuyến mãi đã hết lượt sử dụng');
          }
          
          promo = {
            id_Promo: row.id_Promo,
            code: row.code,
            type: row.type,
            value: Number(row.value),
            min_OrderValue: row.min_OrderValue !== null ? Number(row.min_OrderValue) : 0,
            max_Discount: row.max_Discount !== null ? Number(row.max_Discount) : Number(row.value),
            id_Restaurant: row.id_Restaurant || null,
            id_Voucher: null,
            sys_funding_percent: row.sys_funding_percent !== null ? Number(row.sys_funding_percent) : 100,
            res_funding_percent: row.res_funding_percent !== null ? Number(row.res_funding_percent) : 0,
            usage_limit_per_user: row.usage_limit_per_user !== null ? Number(row.usage_limit_per_user) : 1
          };
        }
      }
      
      if (!promo) return null;
      
      if (promo.id_Restaurant !== null && Number(promo.id_Restaurant) !== Number(id_Restaurant)) {
        throw new Error(`Voucher ${promo.code} không áp dụng cho nhà hàng này`);
      }
      
      if (expectedType === 'freeship' && promo.type !== 'freeship') {
        throw new Error(`Voucher ${promo.code} không phải là voucher miễn phí vận chuyển`);
      }
      if (expectedType === 'discount' && promo.type === 'freeship') {
        throw new Error(`Voucher ${promo.code} không phải là voucher giảm giá đơn hàng`);
      }
      
      // Personal Usage Limit per User Check
      if (promo.id_Promo) {
        const userUsedResult = await pool.request()
          .input('id_Promo', promo.id_Promo)
          .input('id_User', id_User)
          .query(`
            SELECT COUNT(*) AS count 
            FROM [Order] o
            JOIN Order_Promotion op ON o.id_Order = op.id_Order
            WHERE o.id_User = @id_User AND op.id_Promo = @id_Promo AND o.order_Status <> 'cancelled'
          `);
        const userUsedCount = userUsedResult.recordset[0].count;
        if (userUsedCount >= promo.usage_limit_per_user) {
          throw new Error(`Bạn đã vượt quá giới hạn sử dụng tối đa của voucher ${promo.code} (${promo.usage_limit_per_user} lần)`);
        }
      }

      if (food_Amount < promo.min_OrderValue) {
        throw new Error(`Đơn hàng chưa đạt giá trị tối thiểu từ ${promo.min_OrderValue.toLocaleString('vi-VN')} đ để áp dụng voucher ${promo.code}`);
      }
      
      let discount = 0;
      if (promo.type === 'freeship') {
        discount = Math.min(shipping_Fee, promo.value || shipping_Fee);
      } else if (promo.type === 'percent') {
        discount = (food_Amount * promo.value) / 100;
        if (promo.max_Discount && discount > promo.max_Discount) {
          discount = promo.max_Discount;
        }
      } else if (promo.type === 'fixed') {
        discount = promo.value;
      }
      
      return {
        ...promo,
        calculatedDiscount: discount
      };
    };

    // Thực hiện validate
    if (id_Promo_Freeship) {
      const fs = await validatePromo(id_Promo_Freeship, 'freeship');
      if (fs) {
        discount_Amount += fs.calculatedDiscount;
        appliedPromos.push(fs);
      }
    }
    
    if (id_Promo_Discount) {
      const ds = await validatePromo(id_Promo_Discount, 'discount');
      if (ds) {
        discount_Amount += ds.calculatedDiscount;
        appliedPromos.push(ds);
      }
    }
    
    if (!id_Promo_Freeship && !id_Promo_Discount && id_Promo) {
      const single = await validatePromo(id_Promo, null);
      if (single) {
        discount_Amount += single.calculatedDiscount;
        appliedPromos.push(single);
      }
    }
    
    const userRes = await pool.request()
      .input('id_User', id_User)
      .query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    const wallet_balance_before = parseFloat(userRes.recordset[0].wallet_balance || 0);
    const debt_Amount = wallet_balance_before < 0 ? Math.abs(wallet_balance_before) : 0;

    if (debt_Amount > 0) {
      if (payment_Method === 'cash') {
        return res.status(400).json({ message: 'Bạn đang có dư nợ ví do bom hàng trước đó. Hệ thống bắt buộc thanh toán trực tuyến.' });
      }
    }

    let total_Amount = food_Amount + shipping_Fee - discount_Amount;
    if (total_Amount < 0) total_Amount = 0;
    
    // Cộng tiền đang nợ vào tiền đơn này
    if (debt_Amount > 0) {
      total_Amount += debt_Amount;
    }
    
    const order_Code = 'ORD' + Date.now().toString().slice(-8);
    // Ánh xạ 'vnpay' hoặc 'momo' hoặc 'wallet' thành 'online' để thỏa mãn check constraint của bảng [Order]
    const dbPaymentMethod = (payment_Method === 'vnpay' || payment_Method === 'momo' || payment_Method === 'wallet') ? 'online' : payment_Method;
    
    let payment_Status = 'pending';
    if (payment_Method === 'wallet') {
      if (wallet_balance_before < total_Amount) {
        return res.status(400).json({ message: 'Số dư tài khoản ví không đủ. Vui lòng nạp thêm tiền vào ví để thanh toán!' });
      }
      payment_Status = 'paid';
    } else {
      payment_Status = (payment_Method === 'vnpay') ? 'pending' : ((payment_Method === 'online' || payment_Method === 'momo') ? 'paid' : 'pending');
    }
    
    // 3. Tạo Order
    const orderInsert = await pool.request()
      .input('id_User', id_User)
      .input('id_Restaurant', id_Restaurant)
      .input('id_Address', id_Address)
      .input('order_Code', order_Code)
      .input('total_Amount', total_Amount)
      .input('food_Amount', food_Amount)
      .input('shipping_Fee', shipping_Fee)
      .input('discount_Amount', discount_Amount)
      .input('payment_Method', dbPaymentMethod)
      .input('payment_Status', payment_Status)
      .input('note', note || null)
      .query(`
        INSERT INTO [Order] (id_User, id_Restaurant, id_Address, order_Code, total_Amount, food_Amount, shipping_Fee, discount_Amount, payment_Method, payment_Status, order_Status, note, created_At)
        OUTPUT inserted.id_Order
        VALUES (@id_User, @id_Restaurant, @id_Address, @order_Code, @total_Amount, @food_Amount, @shipping_Fee, @discount_Amount, @payment_Method, @payment_Status, 'pending', @note, GETDATE())
      `);
      
    const id_Order = orderInsert.recordset[0].id_Order;

    // Nếu thanh toán bằng ví, trừ tiền ví của user và lưu lịch sử giao dịch
    if (payment_Method === 'wallet') {
      const wallet_balance_after = wallet_balance_before - total_Amount;
      await pool.request()
        .input('id_User', id_User)
        .input('balance', wallet_balance_after)
        .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @id_User');
        
      await pool.request()
        .input('id_User', id_User)
        .input('id_Order', id_Order)
        .input('amount', total_Amount)
        .input('balance_before', wallet_balance_before)
        .input('balance_after', wallet_balance_after)
        .input('note', `Thanh toán đơn hàng #${order_Code}`)
        .query(`
          INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
          VALUES (@id_User, @id_Order, 'payment', @amount, @balance_before, @balance_after, @note, GETDATE())
        `);

      // Nếu có nợ bom hàng, thanh toán nợ ngay trong ví
      if (debt_Amount > 0) {
        const cleared_balance = wallet_balance_after + debt_Amount;
        await pool.request()
          .input('id_User', id_User)
          .input('balance', cleared_balance)
          .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @id_User');
          
        await pool.request()
          .input('id_User', id_User)
          .input('id_Order', id_Order)
          .input('amount', debt_Amount)
          .input('balance_before', wallet_balance_after)
          .input('balance_after', cleared_balance)
          .input('note', `Thu hồi dư nợ bom hàng từ đơn #${order_Code}`)
          .query(`
            INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
            VALUES (@id_User, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
          `);
      }
    }
    
    // 4. Thêm Order_Food
    for (const item of cartResult.recordset) {
      const price = item.discount_Price || item.price;
      const inflatedPrice = Math.round(price * resFactor);
      await pool.request()
        .input('id_Order', id_Order)
        .input('id_Food', item.id_Food)
        .input('quantity', item.quantity)
        .input('unit_Price', inflatedPrice)
        .input('note', item.note || null)
        .query(`
          INSERT INTO Order_Food (id_Order, id_Food, quantity, unit_Price, note)
          VALUES (@id_Order, @id_Food, @quantity, @unit_Price, @note)
        `);
    }
    
    // 5. Thêm Order_Restaurant
    await pool.request()
      .input('id_Order', id_Order)
      .input('id_Restaurant', id_Restaurant)
      .input('shippingfee', shipping_Fee)
      .query(`
        INSERT INTO Order_Restaurant (id_Order, id_Restaurant, shippingfee, status)
        VALUES (@id_Order, @id_Restaurant, @shippingfee, 'pending')
      `);
      
    // 6. Thêm PaymentMethod
    await pool.request()
      .input('id_Order', id_Order)
      .input('method', payment_Method)
      .input('status', payment_Status)
      .input('amount', total_Amount)
      .query(`
        INSERT INTO PaymentMethod (id_Order, method, status, amount, created_At)
        VALUES (@id_Order, @method, @status, @amount, GETDATE())
      `);
      
    // 7. Xoá giỏ hàng
    await pool.request()
      .input('id_Cart', id_Cart)
      .query('DELETE FROM Cart_Food WHERE id_Cart = @id_Cart');
    await pool.request()
      .input('id_Cart', id_Cart)
      .query('DELETE FROM Cart WHERE id_Cart = @id_Cart');
      
    // 8. Đánh dấu Voucher đã sử dụng và thêm vào Order_Promotion
    for (const app of appliedPromos) {
      if (app.id_Voucher) {
        await pool.request()
          .input('voucherId', app.id_Voucher)
          .query('UPDATE Voucher SET used = 1 WHERE id_Voucher = @voucherId');
      }
      
      if (app.id_Promo) {
        await pool.request()
          .input('id_Order', id_Order)
          .input('id_Promo', app.id_Promo)
          .input('discount_Amount', app.calculatedDiscount)
          .query(`
            INSERT INTO Order_Promotion (id_Order, id_Promo, discount_Amount)
            VALUES (@id_Order, @id_Promo, @discount_Amount)
          `);
          
        await pool.request()
          .input('promoId', app.id_Promo)
          .query('UPDATE Promotion SET used_Count = used_Count + 1 WHERE id_Promo = @promoId');
      }
    }
      

    // 9. Thông báo cho tất cả Shipper (chỉ gửi nếu không thanh toán qua vnpay)
    if (payment_Method !== 'vnpay') {
      const driversResult = await pool.request().query("SELECT id_User FROM Driver");
      for (const driver of driversResult.recordset) {
        await pool.request()
          .input('id_User', driver.id_User)
          .input('id_Order', id_Order)
          .query(`
            INSERT INTO Notification (id_User, title, body, type, related_OrderId)
            VALUES (@id_User, N'Đơn hàng mới', N'Có đơn hàng mới cần giao', 'NEW_ORDER', @id_Order)
          `);
      }
    }

    let paymentUrl = null;
    if (payment_Method === 'vnpay') {
      paymentUrl = generateVnPayUrl(req, order_Code, total_Amount);
    }

    res.json({ message: 'Đặt hàng thành công', id_Order, paymentUrl });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi đặt hàng', error: err.message });
  }
};

// Hủy đơn hàng
exports.cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const pool = await poolPromise;
    const orderCheck = await pool.request()
      .input('id', id)
      .input('userId', req.user.id)
      .query('SELECT order_Status, order_Code, id_User FROM [Order] WHERE id_Order = @id AND id_User = @userId');
      
    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    if (orderCheck.recordset[0].order_Status !== 'pending') {
      return res.status(400).json({ message: 'Chỉ có thể hủy đơn đang chờ xác nhận' });
    }
    
    await pool.request()
      .input('id', id)
      .input('reason', reason || 'Khách hàng hủy')
      .query(`
        UPDATE [Order] 
        SET order_Status = 'cancelled', cancelled_By = 'customer', cancellation_Reason = @reason
        WHERE id_Order = @id;

        -- Hoàn tác trạng thái sử dụng voucher
        UPDATE Voucher 
        SET used = 0 
        WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
          AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

        -- Giảm lượt sử dụng của Promotion
        UPDATE Promotion
        SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
        WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
      `);
      
    const order = orderCheck.recordset[0];
    const notiTitle = 'Đơn hàng đã bị hủy';
    const notiBody = `Đơn hàng #${order.order_Code} đã được hủy thành công theo yêu cầu của bạn.`;
    
    const notiResult = await pool.request()
      .input('id_User', order.id_User)
      .input('title', notiTitle)
      .input('body', notiBody)
      .input('type', 'order')
      .input('related_OrderId', id)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
        OUTPUT inserted.id_Noti
        VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
      `);
      
    const id_Noti = notiResult.recordset[0].id_Noti;
    await pool.request()
      .input('id_Noti', id_Noti)
      .input('id_User', order.id_User)
      .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
      
    // Hoàn tiền ví nếu thanh toán bằng ví
    await refundWalletOrder(pool, id, order.id_User, order.order_Code);
    
    res.json({ message: 'Đã hủy đơn hàng' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật trạng thái đơn hàng (Dành cho Admin/Nhà hàng - Giả lập)
exports.updateOrderStatus = async (req, res) => {
  const { id } = req.params; // id_Order
  const { status } = req.body; // 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled'
  
  try {
    const pool = await poolPromise;
    
    // 1. Kiểm tra đơn hàng tồn tại
    const orderCheck = await pool.request()
      .input('id', id)
      .query(`
        SELECT o.id_User, o.id_Driver, o.id_Restaurant, o.order_Code, o.order_Status, 
               o.payment_Method, o.food_Amount, o.shipping_Fee, o.discount_Amount, r.owner_id
        FROM [Order] o
        LEFT JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        WHERE o.id_Order = @id
      `);
      
    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    
    const order = orderCheck.recordset[0];
    
    // 2. Cập nhật trạng thái đơn hàng
    if (status === 'cancelled') {
      await pool.request()
        .input('id', id)
        .query(`
          UPDATE [Order] SET order_Status = 'cancelled' WHERE id_Order = @id;

          -- Hoàn tác trạng thái sử dụng voucher
          UPDATE Voucher 
          SET used = 0 
          WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
            AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

          -- Giảm lượt sử dụng của Promotion
          UPDATE Promotion
          SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
          WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
        `);
        
      // Hoàn tiền ví nếu thanh toán bằng ví
      await refundWalletOrder(pool, id, order.id_User, order.order_Code);
    } else if (status === 'boom') {
      await exports.chargeBoomOrder(pool, id);
    } else if (status === 'delivered') {
      await pool.request()
        .input('id', id)
        .query("UPDATE [Order] SET order_Status = 'delivered', delivered_At = GETDATE() WHERE id_Order = @id");

      // Xử lý Ví (Wallet) nếu giao hàng thành công
      if (order.order_Status !== 'delivered') {
        const configRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 5.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_shipper_fee_percent'");
        const feePercent = configRes.recordset[0].fee_percent;
        
        const foodAmount = order.food_Amount || 0;
        const shippingFee = order.shipping_Fee || 0;
        const discountAmount = order.discount_Amount || 0;
        const shipperEarned = Math.round(shippingFee / (1.0 + feePercent / 100.0));
        const adminShipperCommission = shippingFee - shipperEarned;
        const resOwnerId = order.owner_id;

        // Lấy chiết khấu nhà hàng để tính giá gốc
        const resFeePercentRes = await pool.request().query("SELECT ISNULL(MAX(CAST(config_value AS FLOAT)), 15.0) as fee_percent FROM SystemConfig WHERE config_key = 'op_service_fee_percent'");
        const resFeePercent = resFeePercentRes.recordset[0]?.fee_percent || 15.0;
        const restaurantRevenue = Math.round(foodAmount / (1.0 + resFeePercent / 100.0));
        const adminResCommission = foodAmount - restaurantRevenue;

        // A. Cộng tiền cho nhà hàng (Pay Merchant) khi giao hàng thành công (Nhà hàng nhận đúng 100% giá gốc món ăn)
        if (resOwnerId && restaurantRevenue > 0) {
          const wResCheck = await pool.request().input('id_User', resOwnerId).query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
          const wRes = parseFloat(wResCheck.recordset[0]?.wallet_balance || 0);
          const newResBalance = wRes + restaurantRevenue;

          await pool.request()
            .input('id_User', resOwnerId)
            .input('amount', restaurantRevenue)
            .input('new_balance', newResBalance)
            .input('id_Order', id)
            .input('wRes', wRes)
            .input('note', `Doanh thu đơn hàng #${order.order_Code} (Nhận 100% giá gốc món ăn)`)
            .query(`
              UPDATE [User] SET wallet_balance = @new_balance WHERE id_User = @id_User;
              INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
              VALUES (@id_User, @id_Order, 'order_revenue', @amount, @wRes, @new_balance, @note, GETDATE());
            `);
        }

        // B. Xử lý ví cho Shipper
        if (order.id_Driver) {
          const driverRes = await pool.request()
            .input('id_Driver', order.id_Driver)
            .query("SELECT id_User FROM Driver WHERE id_Driver = @id_Driver");
            
          if (driverRes.recordset.length > 0) {
            const driverUserId = driverRes.recordset[0].id_User;
            const isCod = order.payment_Method && ['cod', 'tiền mặt', 'cash'].includes(order.payment_Method.toLowerCase());
            
            if (isCod) {
              await pool.request()
                .input('id_User', driverUserId)
                .input('id_Order', id)
                .input('shipperEarned', shipperEarned)
                .input('discountAmount', discountAmount)
                .input('adminResCommission', adminResCommission)
                .input('adminShipperCommission', adminShipperCommission)
                .query(`
                  DECLARE @curr_balance DECIMAL(15,2);
                  SELECT @curr_balance = wallet_balance FROM [User] WHERE id_User = @id_User;

                  -- 1. Cộng phí ship shipperEarned
                  DECLARE @b1 DECIMAL(15,2) = @curr_balance;
                  DECLARE @b1_after DECIMAL(15,2) = @b1 + @shipperEarned;
                  UPDATE [User] SET wallet_balance = @b1_after WHERE id_User = @id_User;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@id_User, @id_Order, 'shipping_reward', @shipperEarned, @b1, @b1_after, N'Phí ship nhận từ đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());

                  -- 2. Cộng hoàn khuyến mãi nếu discountAmount > 0
                  DECLARE @b2 DECIMAL(15,2) = @b1_after;
                  IF @discountAmount > 0
                  BEGIN
                      DECLARE @b2_after DECIMAL(15,2) = @b2 + @discountAmount;
                      UPDATE [User] SET wallet_balance = @b2_after WHERE id_User = @id_User;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@id_User, @id_Order, 'refund', @discountAmount, @b2, @b2_after, N'Hoàn khuyến mãi khách dùng đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                      SET @b2 = @b2_after;
                  END

                  -- 3. Trừ chiết khấu món ăn nếu adminResCommission > 0
                  DECLARE @b3 DECIMAL(15,2) = @b2;
                  IF @adminResCommission > 0
                  BEGIN
                      DECLARE @b3_after DECIMAL(15,2) = @b3 - @adminResCommission;
                      UPDATE [User] SET wallet_balance = @b3_after WHERE id_User = @id_User;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@id_User, @id_Order, 'order_deduction', -@adminResCommission, @b3, @b3_after, N'Thu hồi chiết khấu món ăn đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                      SET @b3 = @b3_after;
                  END

                  -- 4. Trừ chiết khấu ship nếu adminShipperCommission > 0
                  IF @adminShipperCommission > 0
                  BEGIN
                      DECLARE @b4_after DECIMAL(15,2) = @b3 - @adminShipperCommission;
                      UPDATE [User] SET wallet_balance = @b4_after WHERE id_User = @id_User;
                      INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                      VALUES (@id_User, @id_Order, 'order_deduction', -@adminShipperCommission, @b3, @b4_after, N'Phí dịch vụ giao hàng đơn hàng COD #' + CAST(@id_Order AS NVARCHAR), GETDATE());
                  END
                `);
            } else {
              const wShipperCheck = await pool.request().input('id_User', driverUserId).query('SELECT wallet_balance FROM [User] WHERE id_User = @id_User');
              const wShipper = parseFloat(wShipperCheck.recordset[0]?.wallet_balance || 0);
              const newShipperBalance = wShipper + shipperEarned;

              const noteMsg = `Phí ship nhận từ đơn hàng Online #${order.order_Code}`;

              await pool.request()
                .input('id_User', driverUserId)
                .input('amount', shipperEarned)
                .input('new_balance', newShipperBalance)
                .input('id_Order', id)
                .input('wShipper', wShipper)
                .input('note', noteMsg)
                .query(`
                  UPDATE [User] SET wallet_balance = @new_balance WHERE id_User = @id_User;
                  INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@id_User, @id_Order, 'shipping_reward', @amount, @wShipper, @new_balance, @note, GETDATE());
                `);
            }
          }
        }
      }
    } else {
      await pool.request()
        .input('id', id)
        .input('status', status)
        .query('UPDATE [Order] SET order_Status = @status WHERE id_Order = @id');
    }
      
    // 3. Tạo thông báo tự động cho Khách hàng
    let notiTitle = '';
    let notiBody = '';
    
    if (status === 'confirmed') {
      notiTitle = 'Đơn hàng đã được xác nhận';
      notiBody = `Đơn hàng #${order.order_Code} đã được nhà hàng xác nhận và bắt đầu chuẩn bị.`;
    } else if (status === 'preparing') {
      notiTitle = 'Đơn hàng đang được chuẩn bị';
      notiBody = `Nhà hàng đang chuẩn bị món ăn cho đơn hàng #${order.order_Code}.`;
    } else if (status === 'delivering') {
      notiTitle = 'Đơn hàng đang được giao';
      notiBody = `Tài xế đang giao đơn hàng #${order.order_Code} đến bạn. Vui lòng chú ý điện thoại.`;
    } else if (status === 'delivered') {
      notiTitle = 'Giao hàng thành công';
      notiBody = `Đơn hàng #${order.order_Code} đã được giao thành công. Chúc bạn ngon miệng!`;
    } else if (status === 'cancelled') {
      notiTitle = 'Đơn hàng đã bị hủy';
      notiBody = `Đơn hàng #${order.order_Code} đã bị hủy.`;
    } else if (status === 'boom') {
      notiTitle = 'Giao hàng thất bại (Bom hàng)';
      notiBody = `Đơn hàng #${order.order_Code} được ghi nhận là giao hàng thất bại (Khách hàng bom hàng).`;
    }
    
    if (notiTitle && notiBody) {
      // Thêm vào bảng Notification
      const notiResult = await pool.request()
        .input('id_User', order.id_User)
        .input('title', notiTitle)
        .input('body', notiBody)
        .input('type', 'order')
        .input('related_OrderId', id)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
          OUTPUT inserted.id_Noti
          VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
        `);
        
      const id_Noti = notiResult.recordset[0].id_Noti;
      
      // Thêm vào bảng trung gian User_Notification
      await pool.request()
        .input('id_Noti', id_Noti)
        .input('id_User', order.id_User)
        .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
    }
    
    res.json({ message: 'Cập nhật trạng thái và tạo thông báo thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đánh giá
exports.submitReview = async (req, res) => {
  const { id } = req.params; // id_Order
  const { rating_Res, comment_ForRes, rating_Dri, comment_ForDri, foods } = req.body;
  // foods: [{ id_Food, rating_Food, comment_Food }]
  try {
    const pool = await poolPromise;
    
    // Check if review exists
    const checkRev = await pool.request()
      .input('id_Order', id)
      .query('SELECT * FROM Review WHERE id_Order = @id_Order');
    if (checkRev.recordset.length > 0) {
      return res.status(400).json({ message: 'Đơn hàng này đã được đánh giá' });
    }
    
    // Lấy thông tin nhà hàng và tài xế từ đơn hàng để cập nhật điểm đánh giá
    const orderInfo = await pool.request()
      .input('id_Order', id)
      .query('SELECT id_Restaurant, id_Driver FROM [Order] WHERE id_Order = @id_Order');
    const { id_Restaurant, id_Driver } = orderInfo.recordset[0] || {};

    const revInsert = await pool.request()
      .input('id_User', req.user.id)
      .input('id_Order', id)
      .input('rating_Res', rating_Res)
      .input('comment_ForRes', comment_ForRes || null)
      .input('rating_Dri', rating_Dri || null)
      .input('comment_ForDri', comment_ForDri || null)
      .query(`
        INSERT INTO Review (id_User, id_Order, rating_Res, comment_ForRes, rating_Dri, comment_ForDri, created_At)
        OUTPUT inserted.id_Review
        VALUES (@id_User, @id_Order, @rating_Res, @comment_ForRes, @rating_Dri, @comment_ForDri, GETDATE())
      `);
      
    const id_Review = revInsert.recordset[0].id_Review;
    
    if (foods && foods.length > 0) {
      for (const f of foods) {
        await pool.request()
          .input('id_Review', id_Review)
          .input('id_Food', f.id_Food)
          .input('rating_Food', f.rating_Food || 5)
          .input('comment_Food', f.comment_Food || null)
          .query(`
            INSERT INTO Review_Food (id_Review, id_Food, rating_Food, comment_Food)
            VALUES (@id_Review, @id_Food, @rating_Food, @comment_Food)
          `);
      }
    }

    // Tự động tính toán lại và cập nhật điểm đánh giá trung bình của Nhà Hàng
    if (rating_Res && id_Restaurant) {
      const avgResResult = await pool.request()
        .input('id_Restaurant', id_Restaurant)
        .query(`
          SELECT AVG(CAST(rating_Res AS FLOAT)) as avgRating 
          FROM Review r
          JOIN [Order] o ON r.id_Order = o.id_Order
          WHERE o.id_Restaurant = @id_Restaurant AND r.rating_Res IS NOT NULL
        `);
      const newResAvg = avgResResult.recordset[0].avgRating || rating_Res;
      await pool.request()
        .input('id_Restaurant', id_Restaurant)
        .input('rating_avg', newResAvg)
        .query('UPDATE Restaurant SET rating_avg = @rating_avg WHERE id_Restaurant = @id_Restaurant');
    }

    // Tự động tính toán lại và cập nhật điểm đánh giá trung bình của Tài Xế
    if (rating_Dri && id_Driver) {
      const avgDriResult = await pool.request()
        .input('id_Driver', id_Driver)
        .query(`
          SELECT AVG(CAST(rating_Dri AS FLOAT)) as avgRating 
          FROM Review r
          JOIN [Order] o ON r.id_Order = o.id_Order
          WHERE o.id_Driver = @id_Driver AND r.rating_Dri IS NOT NULL
        `);
      const newDriAvg = avgDriResult.recordset[0].avgRating || rating_Dri;
      await pool.request()
        .input('id_Driver', id_Driver)
        .input('rating_Avg', newDriAvg)
        .query('UPDATE Driver SET rating_Avg = @rating_Avg WHERE id_Driver = @id_Driver');
    }
    
    
    // Tạo thông báo gửi lời cảm ơn đã đánh giá
    const orderCheck = await pool.request()
      .input('id', id)
      .query('SELECT order_Code FROM [Order] WHERE id_Order = @id');
      
    if (orderCheck.recordset.length > 0) {
      const order = orderCheck.recordset[0];
      const notiTitle = 'Cảm ơn ý kiến đóng góp của bạn';
      const notiBody = `Đánh giá của bạn cho đơn hàng #${order.order_Code} đã được gửi thành công. Cảm ơn bạn đã đồng hành cùng Món Ngon Tại Nhà!`;
      
      const notiResult = await pool.request()
        .input('id_User', req.user.id)
        .input('title', notiTitle)
        .input('body', notiBody)
        .input('type', 'promo')
        .input('related_OrderId', id)
        .query(`
          INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
          OUTPUT inserted.id_Noti
          VALUES (@id_User, @title, @body, @type, 0, @related_OrderId, GETDATE())
        `);
        
      const id_Noti = notiResult.recordset[0].id_Noti;
      await pool.request()
        .input('id_Noti', id_Noti)
        .input('id_User', req.user.id)
        .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
    }

    res.json({ message: 'Đánh giá thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Khiếu nại
exports.submitComplaint = async (req, res) => {
  const { id } = req.params; // id_Order
  const { type, description } = req.body;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('id_Order', id)
      .input('id_User', req.user.id)
      .input('type', type)
      .input('description', description)
      .query(`
        INSERT INTO Complaint (id_Order, id_User, type, description, status, created_At)
        VALUES (@id_Order, @id_User, @type, @description, 'pending', GETDATE())
      `);
    res.json({ message: 'Gửi khiếu nại thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// --- VNPay Payment Integration Logic ---

function sortObject(obj) {
  let sorted = {};
  let keys = Object.keys(obj).sort();
  for (let key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  }
  return sorted;
}

function generateVnPayUrl(req, orderCode, amount) {
  const tmnCode = process.env.VNP_TMNCODE || 'ECQGNZXS';
  const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
  const vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  
  const origin = req.headers.origin || 'http://localhost:5173';
  const returnUrl = `${origin}/vnpay-return`;
  
  const date = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const createDate = date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds());
    
  let vnp_Params = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  vnp_Params['vnp_Locale'] = 'vn';
  vnp_Params['vnp_CurrCode'] = 'VND';
  vnp_Params['vnp_TxnRef'] = orderCode;
  vnp_Params['vnp_OrderInfo'] = 'Thanh toan don hang ' + orderCode;
  vnp_Params['vnp_OrderType'] = 'other';
  vnp_Params['vnp_Amount'] = Math.round(amount) * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  vnp_Params['vnp_CreateDate'] = createDate;
  
  vnp_Params = sortObject(vnp_Params);
  
  const signData = Object.keys(vnp_Params)
    .map(key => `${key}=${vnp_Params[key]}`)
    .join('&');
    
  const crypto = require('crypto');
  const hmac = crypto.createHmac("sha512", secretKey);
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
  
  vnp_Params['vnp_SecureHash'] = secureHash;
  const paymentUrl = vnpUrl + '?' + Object.keys(vnp_Params)
    .map(key => `${key}=${vnp_Params[key]}`)
    .join('&');
    
  return paymentUrl;
}

async function notifyShippers(pool, id_Order) {
  const driversResult = await pool.request().query("SELECT id_User FROM Driver");
  for (const driver of driversResult.recordset) {
    await pool.request()
      .input('id_User', driver.id_User)
      .input('id_Order', id_Order)
      .query(`
        INSERT INTO Notification (id_User, title, body, type, related_OrderId)
        VALUES (@id_User, N'Đơn hàng mới', N'Có đơn hàng mới cần giao', 'NEW_ORDER', @id_Order)
      `);
  }
}

exports.vnpayIpn = async (req, res) => {
  try {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
    
    const signData = Object.keys(vnp_Params)
      .map(key => `${key}=${vnp_Params[key]}`)
      .join('&');
      
    const crypto = require('crypto');
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const orderCode = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];
      const pool = await poolPromise;
      
      if (orderCode.startsWith('TOPUP_')) {
        const parts = orderCode.split('_');
        const userId = parseInt(parts[1], 10);
        const amount = parseFloat(parts[3]);
        
        if (responseCode === '00') {
          const transaction = pool.transaction();
          try {
            await transaction.begin();
            
            // 1. Lock the user row to serialize concurrent top-ups for this user
            const userRes = await transaction.request()
              .input('userId', userId)
              .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @userId');
              
            if (userRes.recordset.length > 0) {
              const balance_before = parseFloat(userRes.recordset[0].wallet_balance);
              const balance_after = balance_before + amount;
              
              // 2. Perform the double-process check inside the transaction lock
              const checkTx = await transaction.request()
                .input('orderCode', orderCode)
                .query("SELECT COUNT(*) AS count FROM Wallet_Transaction WHERE note LIKE '%' + @orderCode + '%'");
                
              if (checkTx.recordset[0].count > 0) {
                await transaction.rollback();
                return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
              }

              await transaction.request()
                .input('userId', userId)
                .input('balance', balance_after)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @userId');
                
              const noteMsg = `Nạp tiền ví thành công qua VNPAY. Mã GD: ${vnp_Params['vnp_TransactionNo'] || ''}. Ref: ${orderCode}`;
              await transaction.request()
                .input('userId', userId)
                .input('amount', amount)
                .input('balance_before', balance_before)
                .input('balance_after', balance_after)
                .input('note', noteMsg)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@userId, 'top_up', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              const notiTitle = 'Nạp tiền ví thành công';
              const notiBody = `Ví của bạn đã được cộng ${amount.toLocaleString('vi-VN')} đ qua VNPAY.`;
              
              const notiResult = await transaction.request()
                .input('id_User', userId)
                .input('title', notiTitle)
                .input('body', notiBody)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  OUTPUT inserted.id_Noti
                  VALUES (@id_User, @title, @body, 'WALLET', 0, GETDATE())
                `);
              const id_Noti = notiResult.recordset[0].id_Noti;
              await transaction.request()
                .input('id_Noti', id_Noti)
                .input('id_User', userId)
                .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
            }
            await transaction.commit();
            return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
          } catch (err) {
            await transaction.rollback();
            console.error('Error processing topup IPN:', err);
            return res.status(200).json({ RspCode: '99', Message: 'System Error' });
          }
        } else {
          return res.status(200).json({ RspCode: '00', Message: 'Confirm success (failed transaction)' });
        }
      }
      
      const orderRes = await pool.request()
        .input('orderCode', orderCode)
        .query('SELECT id_Order, id_User, payment_Status, total_Amount, food_Amount, shipping_Fee, discount_Amount, order_Code FROM [Order] WHERE order_Code = @orderCode');
        
      if (orderRes.recordset.length === 0) {
        return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
      }
      
      const order = orderRes.recordset[0];
      
      const transaction = pool.transaction();
      try {
        await transaction.begin();

        // Lock the order row to serialize concurrent order payment confirmations
        const orderLock = await transaction.request()
          .input('id_Order', order.id_Order)
          .query("SELECT payment_Status FROM [Order] WITH (UPDLOCK) WHERE id_Order = @id_Order");

        const currentPaymentStatus = orderLock.recordset[0].payment_Status;

        if (currentPaymentStatus === 'paid') {
          await transaction.commit();
          return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
        }
        
        if (responseCode === '00') {
          await transaction.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'paid' WHERE id_Order = @id");
            
          await transaction.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'paid' WHERE id_Order = @id_Order");
            
          // Giải quyết nợ ví (nếu có) inside transaction
          await clearOrderDebt(transaction, order);

          // Notify drivers
          await notifyShippers(pool, order.id_Order);
        } else {
          await transaction.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'failed', order_Status = 'cancelled', cancellation_Reason = N'Thanh toán VNPay thất bại' WHERE id_Order = @id");
            
          await transaction.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'failed' WHERE id_Order = @id_Order");
            
          // Revert vouchers/promotions
          await transaction.request()
            .input('id', order.id_Order)
            .query(`
              UPDATE Voucher 
              SET used = 0 
              WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
                AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

              UPDATE Promotion
              SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
              WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
            `);
        }
        await transaction.commit();
        return res.status(200).json({ RspCode: '00', Message: 'Confirm success' });
      } catch (err) {
        await transaction.rollback();
        console.error('Error processing order payment IPN:', err);
        return res.status(200).json({ RspCode: '99', Message: 'System Error' });
      }
    } else {
      res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
    }
  } catch (error) {
    console.error('VNPay IPN Error:', error);
    res.status(200).json({ RspCode: '99', Message: 'Input data format error' });
  }
};

exports.verifyVnPay = async (req, res) => {
  try {
    let vnp_Params = req.body;
    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNP_HASHSECRET || 'XRJWB70UVB892PFFZE2AHOYYSLCO6YIC';
    
    const signData = Object.keys(vnp_Params)
      .map(key => `${key}=${vnp_Params[key]}`)
      .join('&');
      
    const crypto = require('crypto');
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    if (secureHash === signed) {
      const orderCode = vnp_Params['vnp_TxnRef'];
      const responseCode = vnp_Params['vnp_ResponseCode'];
      const pool = await poolPromise;
      
      if (orderCode.startsWith('TOPUP_')) {
        const parts = orderCode.split('_');
        const userId = parseInt(parts[1], 10);
        const amount = parseFloat(parts[3]);
        
        if (responseCode === '00') {
          const transaction = pool.transaction();
          try {
            await transaction.begin();
            
            // 1. Lock user row to serialize concurrent top-up confirmations
            const userRes = await transaction.request()
              .input('userId', userId)
              .query('SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @userId');
              
            if (userRes.recordset.length > 0) {
              const balance_before = parseFloat(userRes.recordset[0].wallet_balance);
              const balance_after = balance_before + amount;
              
              // 2. Perform double-process check inside transaction lock
              const checkTx = await transaction.request()
                .input('orderCode', orderCode)
                .query("SELECT COUNT(*) AS count FROM Wallet_Transaction WHERE note LIKE '%' + @orderCode + '%'");
                
              if (checkTx.recordset[0].count > 0) {
                await transaction.rollback();
                return res.json({ success: true, message: 'Nạp tiền vào ví đã được xử lý trước đó' });
              }

              await transaction.request()
                .input('userId', userId)
                .input('balance', balance_after)
                .query('UPDATE [User] SET wallet_balance = @balance WHERE id_User = @userId');
                
              const noteMsg = `Nạp tiền ví thành công qua VNPAY. Mã GD: ${vnp_Params['vnp_TransactionNo'] || ''}. Ref: ${orderCode}`;
              await transaction.request()
                .input('userId', userId)
                .input('amount', amount)
                .input('balance_before', balance_before)
                .input('balance_after', balance_after)
                .input('note', noteMsg)
                .query(`
                  INSERT INTO Wallet_Transaction (id_User, transaction_type, amount, balance_before, balance_after, note, created_At)
                  VALUES (@userId, 'top_up', @amount, @balance_before, @balance_after, @note, GETDATE())
                `);
                
              const notiTitle = 'Nạp tiền ví thành công';
              const notiBody = `Ví của bạn đã được cộng ${amount.toLocaleString('vi-VN')} đ qua VNPAY.`;
              
              const notiResult = await transaction.request()
                .input('id_User', userId)
                .input('title', notiTitle)
                .input('body', notiBody)
                .query(`
                  INSERT INTO Notification (id_User, title, body, type, is_Read, created_At)
                  OUTPUT inserted.id_Noti
                  VALUES (@id_User, @title, @body, 'WALLET', 0, GETDATE())
                `);
              const id_Noti = notiResult.recordset[0].id_Noti;
              await transaction.request()
                .input('id_Noti', id_Noti)
                .input('id_User', userId)
                .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
            }
            await transaction.commit();
            return res.json({ success: true, message: 'Nạp tiền vào ví thành công' });
          } catch (err) {
            await transaction.rollback();
            console.error('Error processing topup verification:', err);
            return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý nạp tiền' });
          }
        } else {
          return res.json({ success: false, message: 'Giao dịch nạp tiền thất bại hoặc bị hủy' });
        }
      }
      
      const orderRes = await pool.request()
        .input('orderCode', orderCode)
        .query('SELECT id_Order, id_User, payment_Status, total_Amount, food_Amount, shipping_Fee, discount_Amount, order_Code FROM [Order] WHERE order_Code = @orderCode');
        
      if (orderRes.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      
      const order = orderRes.recordset[0];
      
      const transaction = pool.transaction();
      try {
        await transaction.begin();

        // Lock the order row to serialize concurrent order payment confirmations
        const orderLock = await transaction.request()
          .input('id_Order', order.id_Order)
          .query("SELECT payment_Status FROM [Order] WITH (UPDLOCK) WHERE id_Order = @id_Order");

        const currentPaymentStatus = orderLock.recordset[0].payment_Status;

        if (currentPaymentStatus === 'paid') {
          await transaction.commit();
          return res.json({ success: true, message: 'Thanh toán thành công' });
        }
        
        if (responseCode === '00') {
          await transaction.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'paid' WHERE id_Order = @id");
            
          await transaction.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'paid' WHERE id_Order = @id_Order");
            
          // Giải quyết nợ ví (nếu có) inside transaction
          await clearOrderDebt(transaction, order);

          // Notify drivers
          await notifyShippers(pool, order.id_Order);
          
          await transaction.commit();
          res.json({ success: true, message: 'Thanh toán thành công' });
        } else {
          await transaction.request()
            .input('id', order.id_Order)
            .query("UPDATE [Order] SET payment_Status = 'failed', order_Status = 'cancelled', cancellation_Reason = N'Thanh toán VNPay thất bại' WHERE id_Order = @id");
            
          await transaction.request()
            .input('id_Order', order.id_Order)
            .query("UPDATE PaymentMethod SET status = 'failed' WHERE id_Order = @id_Order");
            
          // Revert vouchers/promotions
          await transaction.request()
            .input('id', order.id_Order)
            .query(`
              UPDATE Voucher 
              SET used = 0 
              WHERE id_User = (SELECT id_User FROM [Order] WHERE id_Order = @id)
                AND id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);

              UPDATE Promotion
              SET used_Count = CASE WHEN used_Count > 0 THEN used_Count - 1 ELSE 0 END
              WHERE id_Promo IN (SELECT id_Promo FROM Order_Promotion WHERE id_Order = @id);
            `);
            
          await transaction.commit();
          res.json({ success: false, message: 'Thanh toán thất bại hoặc đã bị hủy' });
        }
      } catch (err) {
        await transaction.rollback();
        console.error('Error processing order payment verification:', err);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý thanh toán đơn hàng' });
      }
    } else {
      res.status(400).json({ success: false, message: 'Chữ ký không hợp lệ' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi xác thực thanh toán', error: error.message });
  }
};

// Lấy trạng thái cấu hình thanh toán hoạt động (pay_cod_enabled, pay_vnpay_enabled)
exports.getPaymentConfigs = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT config_key, config_value, is_enabled 
      FROM SystemConfig 
      WHERE config_key IN ('pay_cod_enabled', 'pay_vnpay_enabled', 'pay_wallet_enabled')
    `);
    
    const configs = {};
    result.recordset.forEach(c => {
      configs[c.config_key] = {
        value: c.config_value,
        enabled: c.is_enabled === 1 || c.is_enabled === true || String(c.is_enabled) === 'true'
      };
    });
    
    // Đảm bảo pay_wallet_enabled luôn có trong danh sách và mặc định là true
    if (!configs.pay_wallet_enabled) {
      configs.pay_wallet_enabled = { value: 'true', enabled: true };
    }
    
    res.json(configs);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy cấu hình thanh toán', error: err.message });
  }
};

// Helper hoàn tiền ví khi đơn hàng bị hủy
async function refundWalletOrder(pool, id_Order, id_User, order_Code) {
  try {
    const paymentCheck = await pool.request()
      .input('id_Order', id_Order)
      .query("SELECT method, status, amount FROM PaymentMethod WHERE id_Order = @id_Order");
      
    if (paymentCheck.recordset.length > 0) {
      const pm = paymentCheck.recordset[0];
      if (pm.method === 'wallet' && pm.status === 'paid') {
        const transaction = pool.transaction();
        await transaction.begin();
        
        const userRes = await transaction.request()
          .input('userId', id_User)
          .query("SELECT wallet_balance FROM [User] WITH (UPDLOCK) WHERE id_User = @userId");
          
        if (userRes.recordset.length > 0) {
          const balance_before = parseFloat(userRes.recordset[0].wallet_balance);
          const balance_after = balance_before + pm.amount;
          
          await transaction.request()
            .input('userId', id_User)
            .input('balance', balance_after)
            .query("UPDATE [User] SET wallet_balance = @balance WHERE id_User = @userId");
            
          await transaction.request()
            .input('userId', id_User)
            .input('id_Order', id_Order)
            .input('amount', pm.amount)
            .input('balance_before', balance_before)
            .input('balance_after', balance_after)
            .input('note', `Hoàn tiền hủy đơn hàng #${order_Code}`)
            .query(`
              INSERT INTO Wallet_Transaction (id_User, id_Order, transaction_type, amount, balance_before, balance_after, note, created_At)
              VALUES (@userId, @id_Order, 'refund', @amount, @balance_before, @balance_after, @note, GETDATE())
            `);
            
          await transaction.request()
            .input('id_Order', id_Order)
            .query("UPDATE PaymentMethod SET status = 'refunded' WHERE id_Order = @id_Order");
            
          const notiTitle = 'Hoàn tiền đơn hàng';
          const notiBody = `Ví của bạn đã được hoàn trả ${pm.amount.toLocaleString('vi-VN')} đ do hủy đơn hàng #${order_Code}.`;
          
          const notiResult = await transaction.request()
            .input('id_User', id_User)
            .input('title', notiTitle)
            .input('body', notiBody)
            .input('id_Order', id_Order)
            .query(`
              INSERT INTO Notification (id_User, title, body, type, is_Read, related_OrderId, created_At)
              OUTPUT inserted.id_Noti
              VALUES (@id_User, @title, @body, 'WALLET', 0, @id_Order, GETDATE())
            `);
          const id_Noti = notiResult.recordset[0].id_Noti;
          await transaction.request()
            .input('id_Noti', id_Noti)
            .input('id_User', id_User)
            .query('INSERT INTO User_Notification (id_Noti, id_User) VALUES (@id_Noti, @id_User)');
        }
        await transaction.commit();
        console.log(`Refunded successfully for order #${order_Code}`);
      }
    }
  } catch (err) {
    console.error(`Refund failed for order ${id_Order}:`, err);
  }
}

