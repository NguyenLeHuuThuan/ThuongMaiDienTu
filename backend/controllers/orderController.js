const { poolPromise } = require('../config/db');

// Lấy danh sách đơn hàng của user
exports.getOrders = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('userId', req.user.id)
      .query(`
        SELECT o.*, r.name_Restaurant, r.logo
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
        SELECT o.*, r.name_Restaurant, r.address as res_address, a.full_Address as user_address, a.name as user_name, a.phone as user_phone
        FROM [Order] o
        JOIN Restaurant r ON o.id_Restaurant = r.id_Restaurant
        JOIN Address a ON o.id_Address = a.id_Address
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
