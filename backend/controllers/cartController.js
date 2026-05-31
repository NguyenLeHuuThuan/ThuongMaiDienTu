const { poolPromise, sql } = require('../config/db');

// Lấy giỏ hàng của user
exports.getCart = async (req, res) => {
  try {
    const pool = await poolPromise;
    // Tìm các cart chưa được chuyển thành order
    const result = await pool.request()
      .input('userId', req.user.id)
      .query(`
        SELECT c.id_Cart, c.id_Restaurant, r.name_Restaurant, c.created_At, c.update_At
        FROM Cart c
        JOIN Restaurant r ON c.id_Restaurant = r.id_Restaurant
        WHERE c.id_User = @userId
        ORDER BY COALESCE(c.update_At, c.created_At) DESC
      `);

    const carts = result.recordset;

    // Lấy chi tiết món ăn trong từng cart
    const configRes = await pool.request()
      .query("SELECT config_value FROM SystemConfig WHERE config_key = 'op_service_fee_percent' AND is_enabled = 1");
    let resFeePercent = 15.0;
    if (configRes.recordset.length > 0) {
      resFeePercent = parseFloat(configRes.recordset[0].config_value) || 15.0;
    }
    const factor = 1 + resFeePercent / 100.0;

    for (let cart of carts) {
      const foodsResult = await pool.request()
        .input('cartId', cart.id_Cart)
        .query(`
          SELECT cf.id_CartFood, cf.id_Food, cf.quantity, cf.note, f.name, f.price, f.discount_Price, f.image 
          FROM Cart_Food cf
          JOIN Food f ON cf.id_Food = f.id_Food
          WHERE cf.id_Cart = @cartId
        `);
      cart.items = foodsResult.recordset.map(item => ({
        ...item,
        price: Math.round(item.price * factor),
        discount_Price: item.discount_Price ? Math.round(item.discount_Price * factor) : null
      }));
    }

    res.json(carts);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Thêm vào giỏ hàng
exports.addToCart = async (req, res) => {
  const { id_Restaurant, id_Food, quantity, note } = req.body;
  try {
    const pool = await poolPromise;
    
    // Tìm cart hiện tại của user cho nhà hàng này
    let cartResult = await pool.request()
      .input('userId', req.user.id)
      .input('resId', id_Restaurant)
      .query(`SELECT id_Cart FROM Cart WHERE id_User = @userId AND id_Restaurant = @resId`);
      
    let cartId;
    if (cartResult.recordset.length > 0) {
      cartId = cartResult.recordset[0].id_Cart;
      // Cập nhật update_At để giỏ hàng này xuất hiện lên đầu
      await pool.request()
        .input('cartId', cartId)
        .query('UPDATE Cart SET update_At = GETDATE() WHERE id_Cart = @cartId');
    } else {
      // Tạo mới cart
      const newCart = await pool.request()
        .input('userId', req.user.id)
        .input('resId', id_Restaurant)
        .query(`
          INSERT INTO Cart (id_User, id_Restaurant, created_At, update_At) 
          OUTPUT INSERTED.id_Cart
          VALUES (@userId, @resId, GETDATE(), GETDATE())
        `);
      cartId = newCart.recordset[0].id_Cart;
    }

    // Kiểm tra món ăn đã có trong cart chưa
    const checkFood = await pool.request()
      .input('cartId', cartId)
      .input('foodId', id_Food)
      .query(`SELECT id_CartFood, quantity FROM Cart_Food WHERE id_Cart = @cartId AND id_Food = @foodId`);

    if (checkFood.recordset.length > 0) {
      // Cập nhật số lượng
      await pool.request()
        .input('cartFoodId', sql.Int, checkFood.recordset[0].id_CartFood)
        .input('qty', sql.Int, checkFood.recordset[0].quantity + quantity)
        .input('note', sql.NVarChar, note || null)
        .query(`UPDATE Cart_Food SET quantity = @qty, note = @note WHERE id_CartFood = @cartFoodId`);
    } else {
      // Thêm mới món ăn
      await pool.request()
        .input('cartId', sql.Int, cartId)
        .input('foodId', sql.Int, id_Food)
        .input('qty', sql.Int, quantity)
        .input('note', sql.NVarChar, note || null)
        .query(`INSERT INTO Cart_Food (id_Cart, id_Food, quantity, note) VALUES (@cartId, @foodId, @qty, @note)`);
    }

    res.json({ message: 'Thêm vào giỏ hàng thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật số lượng và ghi chú
exports.updateCartItem = async (req, res) => {
  const { id } = req.params; // id_CartFood
  const { quantity, note } = req.body;
  try {
    const pool = await poolPromise;
    const parsedId = parseInt(id, 10);

    // Cập nhật update_At của Cart cha trước khi thay đổi Cart_Food
    await pool.request()
      .input('id', sql.Int, parsedId)
      .query('UPDATE Cart SET update_At = GETDATE() WHERE id_Cart = (SELECT id_Cart FROM Cart_Food WHERE id_CartFood = @id)');

    if (quantity !== undefined && quantity <= 0) {
      await pool.request()
        .input('id', sql.Int, parsedId)
        .query('DELETE FROM Cart_Food WHERE id_CartFood = @id');
    } else {
      let queryStr = 'UPDATE Cart_Food SET ';
      const reqBuilder = pool.request().input('id', sql.Int, parsedId);
      const updates = [];

      if (quantity !== undefined) {
        updates.push('quantity = @qty');
        reqBuilder.input('qty', sql.Int, quantity);
      }
      if (note !== undefined) {
        updates.push('note = @note');
        reqBuilder.input('note', sql.NVarChar, note || null);
      }

      if (updates.length > 0) {
        queryStr += updates.join(', ') + ' WHERE id_CartFood = @id';
        await reqBuilder.query(queryStr);
      }
    }
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Xoá món khỏi giỏ hàng
exports.removeCartItem = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const parsedId = parseInt(id, 10);

    // Cập nhật update_At của Cart cha trước khi xóa Cart_Food
    await pool.request()
      .input('id', sql.Int, parsedId)
      .query('UPDATE Cart SET update_At = GETDATE() WHERE id_Cart = (SELECT id_Cart FROM Cart_Food WHERE id_CartFood = @id)');

    await pool.request()
      .input('id', sql.Int, parsedId)
      .query('DELETE FROM Cart_Food WHERE id_CartFood = @id');
    res.json({ message: 'Xoá thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
